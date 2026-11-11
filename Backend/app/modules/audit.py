"""Audit trail helper.

Auditing must never break a request, so failures are swallowed and logged.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database.models.organization import AuditLog

logger = get_logger(__name__)


def log_action(
    db: Session,
    *,
    action: str,
    organization_id: str | None = None,
    user_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    changes: dict[str, Any] | None = None,
    description: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    commit: bool = False,
) -> AuditLog | None:
    """Append an entry to ``audit_logs``.

    ``changes`` should contain only the fields that actually changed; secrets
    are the caller's responsibility to strip.
    """
    try:
        entry = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action[:80],
            resource_type=(resource_type or None) and resource_type[:64],
            resource_id=(resource_id or None) and str(resource_id)[:64],
            changes=changes or None,
            description=(description or None) and description[:2000],
            ip_address=ip_address,
            user_agent=(user_agent or None) and user_agent[:255],
        )
        db.add(entry)
        db.flush()
        if commit:
            db.commit()
        return entry
    except Exception as exc:  # noqa: BLE001 - auditing is best effort
        logger.warning("audit_log_failed", action=action, error=str(exc))
        return None


def record(
    db: Session,
    action: str,
    *,
    organization_id: str | None,
    user_id: str | None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    description: str | None = None,
    changes: dict[str, Any] | None = None,
) -> None:
    """Shorthand used by routers that do not care about the returned row."""
    log_action(
        db,
        action=action,
        organization_id=organization_id,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        changes=changes,
    )
