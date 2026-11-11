"""FastAPI dependency wiring: database session, principal, RBAC, pagination.

Routers stay thin - they translate HTTP into calls on ``app.modules``. All
authorization decisions happen here so a service function can never be reached
with a principal that is not a member of the tenant being touched.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Annotated, Callable

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.constants import Perm, Role, permissions_for
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.logging import get_logger
from app.core.pagination import PageParams, page_params
from app.core.security import decode_token
from app.database.models.organization import ApiKey, Organization, User
from app.database.session import get_db
from app.modules import developers

logger = get_logger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

API_KEY_PREFIX = "ownai_"


@dataclass(slots=True)
class Principal:
    """The authenticated caller and the tenant they are acting inside."""

    organization: Organization
    role: str
    permissions: frozenset[str]
    user: User | None = None
    via: str = "jwt"
    api_key: ApiKey | None = None
    extra: dict[str, object] = field(default_factory=dict)

    @property
    def organization_id(self) -> str:
        return self.organization.id

    @property
    def user_id(self) -> str | None:
        return self.user.id if self.user else None

    def can(self, permission: str) -> bool:
        return permission in self.permissions


DbSession = Annotated[Session, Depends(get_db)]
Pagination = Annotated[PageParams, Depends(page_params)]


# ---------------------------------------------------------------------------
# Principal resolution
# ---------------------------------------------------------------------------
def get_principal(
    request: Request,
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> Principal:
    """Resolve the caller from either a JWT bearer token or a developer API key."""
    token = credentials.credentials if credentials else x_api_key

    if not token:
        raise AuthenticationError("Provide an Authorization bearer token or X-API-Key header.")

    if token.startswith(API_KEY_PREFIX) or token == x_api_key:
        return _principal_from_api_key(db, token)

    return _principal_from_jwt(db, token, request)


def _principal_from_jwt(db: Session, token: str, request: Request) -> Principal:
    payload = decode_token(token)
    user_id = str(payload.get("sub") or "")
    organization_id = payload.get("org")

    user = db.get(User, user_id) if user_id else None
    if user is None or not user.is_active:
        raise AuthenticationError("This account is no longer active.")

    if not organization_id:
        raise AuthenticationError(
            "Your token is not scoped to an organization. Sign in again to select a workspace."
        )

    organization = db.get(Organization, str(organization_id))
    if organization is None or not organization.is_active:
        raise AuthenticationError("The organization for this session is unavailable.")

    role = str(payload.get("role") or Role.MEMBER)
    scopes = payload.get("scopes")
    permissions = frozenset(scopes) if isinstance(scopes, list) else permissions_for(role)

    principal = Principal(
        organization=organization,
        role=role,
        permissions=permissions,
        user=user,
        via="jwt",
    )
    request.state.principal = principal
    return principal


def _principal_from_api_key(db: Session, raw_key: str) -> Principal:
    key = developers.authenticate_api_key(db, raw_key)
    organization = db.get(Organization, key.organization_id)
    if organization is None or not organization.is_active:
        raise AuthenticationError("The organization for this API key is unavailable.")

    # An API key acts with owner-level rights, narrowed by its declared scopes.
    granted = frozenset(key.scopes or []) or permissions_for(Role.OWNER)
    return Principal(
        organization=organization,
        role=str(Role.OWNER),
        permissions=granted,
        user=None,
        via="api_key",
        api_key=key,
    )


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


# ---------------------------------------------------------------------------
# Authorization helpers
# ---------------------------------------------------------------------------
def require_permissions(*required: str) -> Callable[[Principal], Principal]:
    """Dependency factory demanding every listed permission."""

    def _guard(principal: CurrentPrincipal) -> Principal:
        missing = [perm for perm in required if not principal.can(perm)]
        if missing:
            raise PermissionDeniedError(
                f"Your role ({principal.role}) cannot perform '{missing[0]}'.",
                details={"missing_permissions": missing, "role": principal.role},
            )
        return principal

    return _guard


def require_api_key(principal: CurrentPrincipal) -> Principal:
    """Endpoints reserved for machine clients (developer platform)."""
    if principal.via != "api_key":
        raise PermissionDeniedError(
            "This endpoint requires an API key (X-API-Key or the ownai_ bearer token)."
        )
    return principal


def require_user(principal: CurrentPrincipal) -> User:
    """Dependency for endpoints that act on a human account, not an API key."""
    if principal.user is None:
        raise AuthenticationError(
            "This endpoint requires a signed-in user, not an API key."
        )
    return principal.user


def assert_self_or_admin(principal: Principal, user_id: str) -> None:
    """Guard for user-scoped resources (profile edits, sessions)."""
    if principal.user_id == user_id or principal.can(Perm.USERS_WRITE):
        return
    raise PermissionDeniedError("You can only modify your own profile.")
