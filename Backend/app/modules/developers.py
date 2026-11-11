"""Developer platform: API keys, audit trail and usage reporting - PRD module 18.

API keys are hashed with SHA-256 on write, so the plaintext exists only in the
creation response. Authentication is a single indexed lookup on ``key_hash``.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.logging import get_logger
from app.core.pagination import PageParams, paginate
from app.core.security import generate_api_key, hash_api_key
from app.database.base import utcnow
from app.database.models.organization import ApiKey, AuditLog, Organization
from app.modules import audit
from app.schemas.integration import ApiKeyCreate, ApiKeyCreated, ApiKeyOut, AuditLogOut

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------
def list_api_keys(db: Session, organization_id: str) -> list[ApiKeyOut]:
    rows = db.execute(
        select(ApiKey)
        .where(ApiKey.organization_id == organization_id, ApiKey.revoked_at.is_(None))
        .order_by(ApiKey.created_at.desc())
    ).scalars().all()
    return [ApiKeyOut.model_validate(row) for row in rows]


def create_api_key(
    db: Session, organization: Organization, payload: ApiKeyCreate, *, user_id: str | None
) -> ApiKeyCreated:
    """Issue a key. The plaintext value is returned exactly once."""
    raw, digest = generate_api_key()
    existing = int(
        db.execute(
            select(func.count())
            .select_from(ApiKey)
            .where(ApiKey.organization_id == organization.id, ApiKey.revoked_at.is_(None))
        ).scalar_one()
    )
    if existing >= 25:
        raise AuthenticationError(
            "This organization already has the maximum number of active API keys (25)."
        )

    row = ApiKey(
        organization_id=organization.id,
        name=payload.name,
        key_hash=digest,
        prefix=raw[:12],
        scopes=payload.scopes or [],
        created_by=user_id,
    )
    db.add(row)
    db.flush()

    audit.log_action(
        db,
        action="api_key.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="api_key",
        resource_id=row.id,
        changes={"name": row.name, "scopes": row.scopes},
    )
    db.commit()
    db.refresh(row)

    # ``api_key`` is not a column: it exists only in this response, once.
    created = ApiKeyCreated(
        **ApiKeyOut.model_validate(row).model_dump(), api_key=raw
    )
    return created


def revoke_api_key(
    db: Session, organization_id: str, key_id: str, *, user_id: str | None
) -> None:
    row = db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.organization_id == organization_id)
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("API key not found.", details={"id": key_id})

    row.revoked_at = utcnow()
    audit.log_action(
        db,
        action="api_key.revoked",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="api_key",
        resource_id=row.id,
        changes={"name": row.name},
    )
    db.commit()


def authenticate_api_key(db: Session, raw_key: str) -> ApiKey:
    """Resolve a bearer key to its tenant record, bumping usage counters."""
    digest = hash_api_key(raw_key.strip())
    row = db.execute(select(ApiKey).where(ApiKey.key_hash == digest)).scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        raise AuthenticationError("The supplied API key is invalid or has been revoked.")

    row.last_used_at = utcnow()
    row.request_count = int(row.request_count or 0) + 1
    db.commit()
    db.refresh(row)
    return row


def api_key_usage(db: Session, organization_id: str) -> dict[str, Any]:
    rows = db.execute(
        select(ApiKey.name, ApiKey.prefix, ApiKey.request_count, ApiKey.last_used_at)
        .where(ApiKey.organization_id == organization_id, ApiKey.revoked_at.is_(None))
        .order_by(ApiKey.request_count.desc())
    ).all()
    return {
        "keys": [
            {
                "name": name,
                "prefix": prefix,
                "request_count": int(request_count or 0),
                "last_used_at": last_used_at,
            }
            for name, prefix, request_count, last_used_at in rows
        ],
        "total_requests": sum(int(row.request_count or 0) for row in rows),
    }


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------
def list_audit_logs(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    action: str | None = None,
    resource_type: str | None = None,
    user_id: str | None = None,
) -> tuple[list[AuditLogOut], int]:
    stmt = select(AuditLog).where(AuditLog.organization_id == organization_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)

    rows, total = paginate(db, stmt.order_by(AuditLog.created_at.desc()), params)
    return [AuditLogOut.model_validate(row) for row in rows], total


def audit_stats(db: Session, organization_id: str) -> dict[str, int]:
    rows = db.execute(
        select(AuditLog.action, func.count())
        .where(AuditLog.organization_id == organization_id)
        .group_by(AuditLog.action)
        .order_by(func.count().desc())
        .limit(20)
    ).all()
    return {str(action): int(count) for action, count in rows}
