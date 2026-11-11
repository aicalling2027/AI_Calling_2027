"""Authentication use cases: signup, login, refresh, profile."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import Role, TRIAL_CREDITS, permissions_for
from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database.base import utcnow
from app.database.models.organization import (
    Organization,
    OrganizationMember,
    RefreshToken,
    User,
)
from app.modules import audit, billing
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    OrganizationSummary,
    RegisterRequest,
    TokenPair,
    UpdateProfileRequest,
    UserOut,
)
from app.utils.text import unique_slug

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------
def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(
        select(User).where(User.email == email.strip().lower())
    ).scalar_one_or_none()


def get_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", details={"id": user_id})
    return user


def get_membership(
    db: Session, *, user_id: str, organization_id: str | None = None
) -> OrganizationMember | None:
    """Return the active membership, optionally pinned to one organization."""
    stmt = select(OrganizationMember).where(
        OrganizationMember.user_id == user_id,
        OrganizationMember.is_active.is_(True),
    )
    if organization_id:
        stmt = stmt.where(OrganizationMember.organization_id == organization_id)
    stmt = stmt.order_by(OrganizationMember.created_at.asc())
    return db.execute(stmt).scalars().first()


# ---------------------------------------------------------------------------
# Signup / login
# ---------------------------------------------------------------------------
def register(
    db: Session,
    payload: RegisterRequest,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> TokenPair:
    """Create a user, their organization and a trial credit balance."""
    email = payload.email.strip().lower()
    if get_user_by_email(db, email) is not None:
        raise ConflictError(
            "An account with this email already exists.",
            details={"email": email},
        )

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        is_active=True,
    )
    db.add(user)
    db.flush()

    organization_name = (payload.organization_name or f"{payload.full_name}'s workspace").strip()
    slug = unique_slug(
        organization_name,
        exists=lambda candidate: bool(
            db.execute(
                select(Organization.id).where(Organization.slug == candidate)
            ).scalar_one_or_none()
        ),
    )
    organization = Organization(name=organization_name[:160], slug=slug)
    db.add(organization)
    db.flush()

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        role=str(Role.OWNER),
        is_active=True,
        joined_at=utcnow(),
    )
    db.add(membership)

    billing.ensure_credit_account(db, organization.id, initial_balance=TRIAL_CREDITS)
    billing.ensure_subscription(db, organization.id, plan_code="starter")

    audit.log_action(
        db,
        action="auth.register",
        organization_id=organization.id,
        user_id=user.id,
        resource_type="organization",
        resource_id=organization.id,
        description=f"Organization '{organization.name}' created",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.commit()
    db.refresh(user)

    logger.info("user_registered", user_id=user.id, organization_id=organization.id)
    return _issue_tokens(
        db,
        user=user,
        organization=organization,
        role=membership.role,
        user_agent=user_agent,
        ip_address=ip_address,
    )


def authenticate(
    db: Session,
    payload: LoginRequest,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> TokenPair:
    """Verify credentials and issue a token pair."""
    user = get_user_by_email(db, payload.email)
    if user is None or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise AuthenticationError("Incorrect email or password.")

    membership = get_membership(db, user_id=user.id, organization_id=payload.organization_id)
    if membership is None and not user.is_superadmin:
        raise AuthenticationError(
            "This account is not attached to an organization. Contact your administrator."
        )

    organization = db.get(Organization, membership.organization_id) if membership else None
    if organization is not None and not organization.is_active:
        raise AuthenticationError("This organization has been deactivated.")

    user.last_login_at = utcnow()
    audit.log_action(
        db,
        action="auth.login",
        organization_id=organization.id if organization else None,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.commit()

    return _issue_tokens(
        db,
        user=user,
        organization=organization,
        role=membership.role if membership else str(Role.SUPER_ADMIN),
        user_agent=user_agent,
        ip_address=ip_address,
    )


def refresh(
    db: Session,
    refresh_token: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> TokenPair:
    """Rotate a refresh token: the presented token is revoked immediately."""
    claims = decode_token(refresh_token, expected_type=REFRESH_TOKEN_TYPE)
    jti = claims.get("jti")
    user_id = claims.get("sub")
    if not jti or not user_id:
        raise AuthenticationError("The refresh token is malformed.")

    stored = db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti)
    ).scalar_one_or_none()
    if stored is None or stored.revoked_at is not None:
        raise AuthenticationError("This session has been revoked. Please sign in again.")
    if stored.expires_at <= utcnow():
        raise AuthenticationError("This session has expired. Please sign in again.")

    user = get_user(db, user_id)
    if not user.is_active:
        raise AuthenticationError("This account has been deactivated.")

    stored.revoked_at = utcnow()

    membership = get_membership(db, user_id=user.id, organization_id=stored.organization_id)
    organization = db.get(Organization, stored.organization_id) if stored.organization_id else None
    role = membership.role if membership else str(Role.MEMBER)

    db.commit()
    return _issue_tokens(
        db,
        user=user,
        organization=organization,
        role=role,
        user_agent=user_agent,
        ip_address=ip_address,
    )


def logout(db: Session, user: User, refresh_token: str | None = None) -> int:
    """Revoke one refresh token, or every token for the user when omitted."""
    now = utcnow()
    stmt = select(RefreshToken).where(
        RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
    )
    if refresh_token:
        try:
            claims = decode_token(refresh_token, expected_type=REFRESH_TOKEN_TYPE)
            stmt = stmt.where(RefreshToken.jti == claims.get("jti"))
        except Exception:  # noqa: BLE001 - an invalid token still means "log out"
            pass

    tokens = db.execute(stmt).scalars().all()
    for token in tokens:
        token.revoked_at = now
    audit.log_action(db, action="auth.logout", user_id=user.id, organization_id=None)
    db.commit()
    return len(tokens)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
def build_me(db: Session, user: User, organization_id: str | None) -> MeResponse:
    membership = get_membership(db, user_id=user.id, organization_id=organization_id)
    organization = db.get(Organization, membership.organization_id) if membership else None
    role = membership.role if membership else None
    return MeResponse(
        user=UserOut.model_validate(user),
        organization=(
            OrganizationSummary.model_validate(organization) if organization else None
        ),
        role=role,
        permissions=sorted(permissions_for(role)) if role else [],
    )


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise AuthenticationError("Your current password is incorrect.")
    if verify_password(new_password, user.hashed_password):
        raise ConflictError("The new password must be different from the current one.")
    user.hashed_password = hash_password(new_password)

    # Force a re-login everywhere: revoke every outstanding refresh token.
    now = utcnow()
    for token in db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    ).scalars():
        token.revoked_at = now

    audit.log_action(db, action="auth.password_changed", user_id=user.id)
    db.commit()


def update_profile(db: Session, user: User, payload: UpdateProfileRequest) -> User:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(user, field, value)
    audit.log_action(
        db, action="auth.profile_updated", user_id=user.id, changes=list(updates.keys())
    )
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _issue_tokens(
    db: Session,
    *,
    user: User,
    organization: Organization | None,
    role: str,
    user_agent: str | None,
    ip_address: str | None,
) -> TokenPair:
    organization_id = organization.id if organization else None
    access_token = create_access_token(
        user_id=user.id,
        organization_id=organization_id,
        role=role,
        scopes=sorted(permissions_for(role)),
    )
    refresh_token, jti = create_refresh_token(user_id=user.id, organization_id=organization_id)

    db.add(
        RefreshToken(
            user_id=user.id,
            organization_id=organization_id,
            jti=jti,
            expires_at=utcnow().replace(microsecond=0)
            + timedelta(days=settings.refresh_token_expire_days),
            user_agent=(user_agent or None) and user_agent[:255],
            ip_address=ip_address,
        )
    )
    db.commit()

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
        organization=OrganizationSummary.model_validate(organization) if organization else None,
        role=role,
    )
