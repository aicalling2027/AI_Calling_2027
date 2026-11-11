"""Organization profile and team management."""

from __future__ import annotations

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import hash_password
from app.database.base import utcnow
from app.database.models.organization import Organization, OrganizationMember, User
from app.modules import audit
from app.schemas.organization import (
    MemberInvite,
    MemberOut,
    MemberUpdate,
    OrganizationOut,
    OrganizationUpdate,
    OrganizationWithMembers,
)

_OWNER_ROLES = frozenset({str(Role.OWNER), str(Role.SUPER_ADMIN)})


def get_organization(db: Session, organization_id: str) -> Organization:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError("Organization not found.", details={"id": organization_id})
    return organization


def org_out(organization: Organization) -> OrganizationOut:
    return OrganizationOut.model_validate(organization)


def update_organization(
    db: Session, organization: Organization, payload: OrganizationUpdate, *, user_id: str | None
) -> OrganizationOut:
    changes = {
        field: value
        for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items()
        if getattr(organization, field, None) != value
    }
    for field, value in changes.items():
        setattr(organization, field, value)

    audit.log_action(
        db,
        action="organization.updated",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="organization",
        resource_id=organization.id,
        changes=changes,
    )
    db.commit()
    db.refresh(organization)
    return org_out(organization)


def _member_rows(db: Session, organization_id: str) -> list[tuple[OrganizationMember, User]]:
    return list(
        db.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(OrganizationMember.organization_id == organization_id)
            .order_by(OrganizationMember.created_at.asc())
        ).all()
    )


def _to_member(member: OrganizationMember, user: User) -> MemberOut:
    return MemberOut(
        id=member.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=member.role,
        is_active=member.is_active and user.is_active,
        joined_at=member.joined_at,
    )


def list_members(db: Session, organization_id: str) -> list[MemberOut]:
    return [_to_member(member, user) for member, user in _member_rows(db, organization_id)]


def organization_with_members(db: Session, organization: Organization) -> OrganizationWithMembers:
    members = list_members(db, organization.id)
    return OrganizationWithMembers(
        **org_out(organization).model_dump(),
        members=members,
        user_count=len(members),
    )


def invite_member(
    db: Session, organization_id: str, payload: MemberInvite, *, actor_id: str | None
) -> MemberOut:
    """Attach a user to the organization, creating the account when needed."""
    email = payload.email.strip().lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if user is None:
        temporary_password = payload.password or secrets.token_urlsafe(12)
        user = User(
            email=email,
            hashed_password=hash_password(temporary_password),
            full_name=(payload.full_name or email.split("@")[0]).strip()[:160],
            is_active=True,
        )
        db.add(user)
        db.flush()

    existing = db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(
            "This user is already a member of the organization.", details={"email": email}
        )

    member = OrganizationMember(
        organization_id=organization_id,
        user_id=user.id,
        role=str(payload.role),
        is_active=True,
        invited_by=actor_id,
        joined_at=utcnow(),
    )
    db.add(member)
    audit.log_action(
        db,
        action="organization.member_invited",
        organization_id=organization_id,
        user_id=actor_id,
        resource_type="user",
        resource_id=user.id,
        changes={"role": str(payload.role), "email": email},
    )
    db.commit()
    db.refresh(member)
    return _to_member(member, user)


def update_member(
    db: Session,
    organization_id: str,
    member_id: str,
    payload: MemberUpdate,
    *,
    actor_id: str | None,
) -> MemberOut:
    member = db.execute(
        select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if member is None:
        raise NotFoundError("Member not found.", details={"id": member_id})

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "role" in updates and member.role in _OWNER_ROLES:
        _assert_not_last_owner(db, organization_id, member)

    changes: dict[str, object] = {}
    for field, value in updates.items():
        value = str(value) if field == "role" else value
        if getattr(member, field) != value:
            setattr(member, field, value)
            changes[field] = value

    audit.log_action(
        db,
        action="organization.member_updated",
        organization_id=organization_id,
        user_id=actor_id,
        resource_type="organization_member",
        resource_id=member.id,
        changes=changes,
    )
    db.commit()
    db.refresh(member)
    user = db.get(User, member.user_id)
    return _to_member(member, user)  # type: ignore[arg-type]


def remove_member(
    db: Session, organization_id: str, member_id: str, *, actor_id: str | None
) -> None:
    member = db.execute(
        select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if member is None:
        raise NotFoundError("Member not found.", details={"id": member_id})
    if member.role in _OWNER_ROLES:
        _assert_not_last_owner(db, organization_id, member)

    db.delete(member)
    audit.log_action(
        db,
        action="organization.member_removed",
        organization_id=organization_id,
        user_id=actor_id,
        resource_type="organization_member",
        resource_id=member_id,
    )
    db.commit()


def _assert_not_last_owner(
    db: Session, organization_id: str, member: OrganizationMember
) -> None:
    owners = int(
        db.execute(
            select(func.count())
            .select_from(OrganizationMember)
            .where(
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.role.in_(tuple(_OWNER_ROLES)),
                OrganizationMember.is_active.is_(True),
            )
        ).scalar_one()
    )
    if owners <= 1:
        raise PermissionDeniedError(
            "The organization must keep at least one owner.",
            details={"member_id": member.id},
        )
