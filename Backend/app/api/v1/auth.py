"""Authentication endpoints: signup, login, token refresh, profile."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import CurrentPrincipal, DbSession, require_user
from app.core.constants import TRIAL_CREDITS
from app.database.models.organization import User
from app.modules import auth
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    OrganizationSummary,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UpdateProfileRequest,
    UserOut,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

CurrentUser = Annotated[User, Depends(require_user)]


def _client_meta(request: Request) -> dict[str, str | None]:
    return {
        "user_agent": (request.headers.get("user-agent") or "")[:255] or None,
        "ip_address": (request.client.host if request.client else None),
    }


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account and its workspace",
)
def register(payload: RegisterRequest, request: Request, db: DbSession) -> TokenPair:
    """Signs the user up, provisions the tenant and returns a usable token pair."""
    tokens = auth.register(db, payload, **_client_meta(request))
    return tokens


@router.post("/login", response_model=TokenPair, summary="Exchange credentials for tokens")
def login(payload: LoginRequest, request: Request, db: DbSession) -> TokenPair:
    return auth.authenticate(db, payload, **_client_meta(request))


@router.post("/refresh", response_model=TokenPair, summary="Rotate the token pair")
def refresh(payload: RefreshRequest, request: Request, db: DbSession) -> TokenPair:
    return auth.refresh(db, payload.refresh_token, **_client_meta(request))


@router.post("/logout", response_model=MessageResponse, summary="Revoke refresh tokens")
def logout(payload: LogoutRequest, user: CurrentUser, db: DbSession) -> MessageResponse:
    revoked = auth.logout(db, user, payload.refresh_token)
    return MessageResponse(message=f"{revoked} session(s) signed out.")


@router.get("/me", response_model=MeResponse, summary="Current user, workspace and permissions")
def me(principal: CurrentPrincipal, db: DbSession) -> MeResponse:
    if principal.user is None:
        # API-key callers have no user record - report the workspace only.
        return MeResponse(
            organization=OrganizationSummary.model_validate(principal.organization),
            role=principal.role,
            permissions=sorted(principal.permissions),
        )
    return auth.build_me(db, principal.user, principal.organization_id)


@router.patch("/me", response_model=UserOut, summary="Update your own profile")
def update_profile(
    payload: UpdateProfileRequest, user: CurrentUser, db: DbSession
) -> UserOut:
    return UserOut.model_validate(auth.update_profile(db, user, payload))


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change your password (revokes other sessions)",
)
def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbSession
) -> MessageResponse:
    auth.change_password(db, user, payload.current_password, payload.new_password)
    return MessageResponse(message="Password updated. Other sessions were signed out.")


@router.get("/onboarding", summary="What a new workspace starts with")
def onboarding(principal: CurrentPrincipal) -> dict[str, object]:
    """Small helper the frontend uses for the post-signup checklist."""
    return {
        "trial_credits": TRIAL_CREDITS,
        "role": principal.role,
        "organization": {
            "id": principal.organization.id,
            "name": principal.organization.name,
            "timezone": principal.organization.timezone,
        },
        "next_steps": [
            "Create your first AI employee",
            "Add a phone number",
            "Import or create leads",
            "Run a test call",
        ],
    }
