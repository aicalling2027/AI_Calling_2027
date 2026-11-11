"""Developer platform: API keys, audit trail and machine-facing helpers."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    DbSession,
    Pagination,
    Principal,
    require_api_key,
    require_permissions,
)
from app.core.constants import Perm
from app.modules import developers
from app.schemas.common import MessageResponse, Page
from app.schemas.integration import ApiKeyCreate, ApiKeyCreated, ApiKeyOut, AuditLogOut

router = APIRouter(prefix="/developers", tags=["Developers"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.DEVELOPERS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.DEVELOPERS_WRITE))]
Machine = Annotated[Principal, Depends(require_api_key)]


@router.get("/api-keys", response_model=list[ApiKeyOut], summary="List API keys")
def list_api_keys(principal: Reader, db: DbSession) -> list[ApiKeyOut]:
    return developers.list_api_keys(db, principal.organization_id)


@router.post(
    "/api-keys",
    response_model=ApiKeyCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Issue an API key (plaintext shown once)",
)
def create_api_key(
    payload: ApiKeyCreate, principal: Writer, db: DbSession
) -> ApiKeyCreated:
    return developers.create_api_key(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.delete("/api-keys/{key_id}", response_model=MessageResponse, summary="Revoke a key")
def revoke_api_key(key_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    developers.revoke_api_key(
        db, principal.organization_id, key_id, user_id=principal.user_id
    )
    return MessageResponse(message="API key revoked.")


@router.get("/api-keys/usage", summary="Request counts per key")
def api_key_usage(principal: Reader, db: DbSession) -> dict:
    return developers.api_key_usage(db, principal.organization_id)


@router.get("/audit-logs", response_model=Page[AuditLogOut], summary="Audit trail")
def list_audit_logs(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    action: str | None = None,
    resource_type: str | None = None,
    user_id: str | None = None,
) -> Page[AuditLogOut]:
    rows, total = developers.list_audit_logs(
        db,
        principal.organization_id,
        params,
        action=action,
        resource_type=resource_type,
        user_id=user_id,
    )
    return Page[AuditLogOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.get("/audit-logs/stats", summary="Most frequent audit actions")
def audit_stats(principal: Reader, db: DbSession) -> dict[str, int]:
    return developers.audit_stats(db, principal.organization_id)


@router.get("/whoami", summary="Echo the API key's organization and scopes")
def whoami(principal: Machine) -> dict:
    """Cheap handshake for integrations: confirms the key works and shows scopes."""
    return {
        "organization_id": principal.organization_id,
        "organization": principal.organization.name,
        "role": principal.role,
        "scopes": sorted(principal.permissions),
        "api_key_prefix": principal.api_key.prefix if principal.api_key else None,
    }


@router.get("/quickstart", summary="Copy-paste examples for this deployment")
def quickstart(principal: Reader, base_url: str = Query("/api/v1")) -> dict:
    return {
        "base_url": base_url,
        "auth": {
            "bearer": "Authorization: Bearer <access_token>",
            "api_key": "X-API-Key: ownai_<your_key>",
        },
        "examples": [
            {
                "name": "Place an outbound call",
                "method": "POST",
                "path": "/calls/outbound",
                "body": {
                    "to_number": "+919876543210",
                    "employee_id": "<employee_id>",
                },
            },
            {
                "name": "Create a lead",
                "method": "POST",
                "path": "/leads",
                "body": {
                    "contact": {"full_name": "Asha Rao", "phone": "+919876543210"},
                    "source": "api",
                },
            },
            {
                "name": "Start a campaign",
                "method": "POST",
                "path": "/campaigns/{campaign_id}/start",
            },
            {
                "name": "Read the dashboard",
                "method": "GET",
                "path": "/dashboard?days=30",
            },
        ],
    }
