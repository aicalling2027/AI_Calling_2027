"""Integration hub, automations, webhooks and notifications - PRD modules 15-18.

Two very different things live here:

* :class:`Integration` - a *tenant* record of a third-party connection. Secret
  material is stored as an ``env:VAR_NAME`` reference so a database dump never
  leaks credentials.
* :mod:`app.integrations.registry` - the *deployment* view of the same providers
  (is a key present at all?). Both are surfaced together by :func:`catalog` so the
  UI can render "configured", "connected" and "simulated" states.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.constants import IntegrationStatus
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.core.pagination import PageParams, paginate
from app.database.base import utcnow
from app.database.models.integration import (
    Integration,
    IntegrationCredential,
    IntegrationLog,
    NotificationLog,
    Webhook,
    Workflow,
    WorkflowExecution,
)
from app.database.models.organization import Organization
from app.integrations import n8n, registry, whatsapp
from app.modules import audit
from app.modules.common import scoped
from app.schemas.integration import (
    IntegrationConnect,
    IntegrationLogOut,
    IntegrationOut,
    IntegrationStatusOut,
    NotificationLogOut,
    WebhookCreate,
    WebhookOut,
    WorkflowCreate,
    WorkflowExecutionOut,
    WorkflowOut,
)

logger = get_logger(__name__)

ENV_REF_PREFIX = "env:"
_SECRET_KEYS = frozenset(
    {"api_key", "secret", "token", "access_token", "password", "webhook_secret", "key"}
)


# ---------------------------------------------------------------------------
# Provider catalogue
# ---------------------------------------------------------------------------
def catalog() -> list[dict[str, Any]]:
    """Static list of providers this product can talk to (from the registry)."""
    return [registry.describe(spec.code) for spec in registry.PROVIDERS]


def provider_status(db: Session, organization: Organization) -> list[IntegrationStatusOut]:
    """Deployment readiness *and* tenant connection state, provider by provider."""
    connected = {
        row.provider: row
        for row in db.execute(
            select(Integration).where(Integration.organization_id == organization.id)
        ).scalars()
    }

    statuses: list[IntegrationStatusOut] = []
    for spec in registry.PROVIDERS:
        info = registry.describe(spec.code)
        tenant_row = connected.get(spec.code)
        detail = info["detail"]
        if tenant_row is not None:
            detail = f"{detail} Tenant status: {tenant_row.status}."
        elif not info["configured"]:
            detail = f"{detail} Not connected for this organization."

        statuses.append(
            IntegrationStatusOut(
                provider=spec.code,
                configured=bool(info["configured"]),
                healthy=bool(info["healthy"]),
                detail=detail,
                missing_settings=list(info["missing_settings"]),
            )
        )
    return statuses


# ---------------------------------------------------------------------------
# Integrations (tenant records)
# ---------------------------------------------------------------------------
def list_integrations(
    db: Session, organization_id: str, params: PageParams, *, category: str | None = None
) -> tuple[list[IntegrationOut], int]:
    stmt = select(Integration).where(Integration.organization_id == organization_id)
    if category:
        stmt = stmt.where(Integration.category == category)
    rows, total = paginate(db, stmt.order_by(Integration.created_at.desc()), params)
    return [IntegrationOut.model_validate(row) for row in rows], total


def get_integration(db: Session, organization_id: str, integration_id: str) -> Integration:
    return scoped(db, Integration, integration_id, organization_id, label="Integration")


def connect_integration(
    db: Session, organization: Organization, payload: IntegrationConnect, *, user_id: str | None
) -> IntegrationOut:
    """Create or update the tenant record for a provider.

    Credential values are never persisted - only the ``env:`` reference is, so
    rotating a key is an environment change rather than a database migration.
    """
    spec = registry.describe(payload.provider)
    if spec["provider"] is None:
        raise ValidationError(
            f"Unknown provider '{payload.provider}'.",
            details={"provider": payload.provider, "known": [s.code for s in registry.PROVIDERS]},
        )

    row = db.execute(
        select(Integration)
        .where(
            Integration.organization_id == organization.id,
            Integration.provider == payload.provider,
        )
        .options(selectinload(Integration.credentials))
    ).scalar_one_or_none()

    if row is None:
        row = Integration(
            organization_id=organization.id,
            provider=payload.provider,
            name=payload.name or spec.get("name") or payload.provider,
            category=spec.get("category") or "other",
            status=str(IntegrationStatus.CONNECTED),
            config=payload.config or {},
            connected_by=user_id,
        )
        db.add(row)
        db.flush()
    else:
        row.name = payload.name or row.name
        row.config = {**row.config, **(payload.config or {})}
        row.status = str(IntegrationStatus.CONNECTED)
        row.last_error = None
        row.connected_by = user_id or row.connected_by

    _store_credentials(db, row, payload.credentials)

    _log_event(
        db,
        organization_id=organization.id,
        integration_id=row.id,
        event="integration.connected",
        status="success",
        request_payload={"provider": payload.provider, "keys": sorted(payload.credentials)},
    )
    audit.log_action(
        db,
        action="integration.connected",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="integration",
        resource_id=row.id,
        changes={"provider": payload.provider},
    )
    db.commit()
    db.refresh(row)
    return IntegrationOut.model_validate(row)


def disconnect_integration(
    db: Session, integration: Integration, *, user_id: str | None
) -> IntegrationOut:
    integration.status = str(IntegrationStatus.DISCONNECTED)
    _log_event(
        db,
        organization_id=integration.organization_id,
        integration_id=integration.id,
        event="integration.disconnected",
        status="success",
    )
    audit.log_action(
        db,
        action="integration.disconnected",
        organization_id=integration.organization_id,
        user_id=user_id,
        resource_type="integration",
        resource_id=integration.id,
        changes={"provider": integration.provider},
    )
    db.commit()
    db.refresh(integration)
    return IntegrationOut.model_validate(integration)


def sync_integration(
    db: Session, integration: Integration, *, user_id: str | None = None
) -> IntegrationOut:
    """Probe the provider and persist the result on the tenant record."""
    info = registry.describe(integration.provider)
    integration.last_synced_at = utcnow()
    if info["healthy"]:
        integration.status = str(IntegrationStatus.CONNECTED)
        integration.last_error = None
        outcome = "success"
        message = None
    else:
        integration.status = str(IntegrationStatus.ERROR)
        integration.last_error = info["detail"]
        outcome = "failed"
        message = info["detail"]

    _log_event(
        db,
        organization_id=integration.organization_id,
        integration_id=integration.id,
        event="integration.sync",
        status=outcome,
        error=message,
        response_payload={"configured": info["configured"], "missing": info["missing_settings"]},
    )
    db.commit()
    db.refresh(integration)
    return IntegrationOut.model_validate(integration)


def _store_credentials(
    db: Session, integration: Integration, credentials: dict[str, str]
) -> None:
    existing = {cred.key: cred for cred in integration.credentials}
    for key, value in (credentials or {}).items():
        if _SECRET_KEYS.intersection(key.lower().split("_")) and not value.startswith(
            ENV_REF_PREFIX
        ):
            # Raw secret supplied: keep it out of the database.
            logger.warning(
                "integration_secret_redacted",
                integration_id=integration.id,
                key=key,
            )
            env_name = f"{integration.provider.upper()}_{key.upper()}"
            reference = f"{ENV_REF_PREFIX}{env_name}"
        else:
            reference = value

        if key in existing:
            existing[key].secret_ref = reference
            existing[key].rotated_at = utcnow()
        else:
            db.add(
                IntegrationCredential(
                    integration_id=integration.id, key=key[:64], secret_ref=reference[:255]
                )
            )


def list_logs(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    integration_id: str | None = None,
    status: str | None = None,
) -> tuple[list[IntegrationLogOut], int]:
    stmt = select(IntegrationLog).where(IntegrationLog.organization_id == organization_id)
    if integration_id:
        stmt = stmt.where(IntegrationLog.integration_id == integration_id)
    if status:
        stmt = stmt.where(IntegrationLog.status == status)
    rows, total = paginate(db, stmt.order_by(IntegrationLog.created_at.desc()), params)
    return [IntegrationLogOut.model_validate(row) for row in rows], total


def _log_event(
    db: Session,
    *,
    organization_id: str,
    integration_id: str | None,
    event: str,
    status: str,
    request_payload: dict | None = None,
    response_payload: dict | None = None,
    error: str | None = None,
    duration_ms: int | None = None,
) -> IntegrationLog:
    row = IntegrationLog(
        organization_id=organization_id,
        integration_id=integration_id,
        event=event,
        status=status,
        request_payload=request_payload,
        response_payload=response_payload,
        error=error,
        duration_ms=duration_ms,
    )
    db.add(row)
    return row


# ---------------------------------------------------------------------------
# Workflows (automation)
# ---------------------------------------------------------------------------
def list_workflows(
    db: Session, organization_id: str, params: PageParams, *, active_only: bool = False
) -> tuple[list[WorkflowOut], int]:
    stmt = select(Workflow).where(Workflow.organization_id == organization_id)
    if active_only:
        stmt = stmt.where(Workflow.is_active.is_(True))
    rows, total = paginate(db, stmt.order_by(Workflow.created_at.desc()), params)
    return [WorkflowOut.model_validate(row) for row in rows], total


def get_workflow(db: Session, organization_id: str, workflow_id: str) -> Workflow:
    return scoped(db, Workflow, workflow_id, organization_id, label="Workflow")


def create_workflow(
    db: Session, organization: Organization, payload: WorkflowCreate, *, user_id: str | None
) -> WorkflowOut:
    if not payload.actions and payload.trigger_type not in {"manual", "webhook"}:
        raise ValidationError("A workflow needs at least one action.")

    workflow = Workflow(
        organization_id=organization.id,
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config or {},
        actions=payload.actions,
        is_active=payload.is_active,
    )
    db.add(workflow)
    db.flush()

    audit.log_action(
        db,
        action="workflow.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="workflow",
        resource_id=workflow.id,
        changes={"name": workflow.name, "trigger": workflow.trigger_type},
    )
    db.commit()
    db.refresh(workflow)
    return WorkflowOut.model_validate(workflow)


def update_workflow(
    db: Session, workflow: Workflow, payload: WorkflowCreate, *, user_id: str | None
) -> WorkflowOut:
    workflow.name = payload.name
    workflow.description = payload.description
    workflow.trigger_type = payload.trigger_type
    workflow.trigger_config = payload.trigger_config or {}
    workflow.actions = payload.actions
    workflow.is_active = payload.is_active
    workflow.version += 1

    audit.log_action(
        db,
        action="workflow.updated",
        organization_id=workflow.organization_id,
        user_id=user_id,
        resource_type="workflow",
        resource_id=workflow.id,
        changes={"version": workflow.version},
    )
    db.commit()
    db.refresh(workflow)
    return WorkflowOut.model_validate(workflow)


def delete_workflow(db: Session, workflow: Workflow, *, user_id: str | None) -> None:
    organization_id, workflow_id = workflow.organization_id, workflow.id
    db.delete(workflow)
    audit.log_action(
        db,
        action="workflow.deleted",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="workflow",
        resource_id=workflow_id,
    )
    db.commit()


def execute_workflow(
    db: Session, workflow: Workflow, trigger_payload: dict[str, Any] | None = None
) -> WorkflowExecutionOut:
    """Run a workflow. Delegates to n8n when configured, otherwise simulates."""
    if not workflow.is_active:
        raise ConflictError(
            "Activate the workflow before running it.", details={"workflow_id": workflow.id}
        )

    execution = WorkflowExecution(
        organization_id=workflow.organization_id,
        workflow_id=workflow.id,
        status="running",
        trigger_payload=trigger_payload or {},
        started_at=utcnow(),
    )
    db.add(execution)
    db.flush()

    payload = {
        "workflow_id": workflow.id,
        "trigger_type": workflow.trigger_type,
        "actions": workflow.actions,
        **(trigger_payload or {}),
    }

    if n8n.configured() and workflow.n8n_workflow_id:
        response = n8n.trigger(settings_webhook(workflow), payload)
    elif n8n.configured():
        response = n8n.emit_followup_due(payload)
    else:
        response = None

    if response is not None and response.ok:
        execution.status = "completed"
        execution.result = {"provider": "n8n", "response": response.data}
    elif response is not None:
        execution.status = "failed"
        execution.error = response.error or "n8n rejected the workflow."
        execution.result = {"provider": "n8n"}
    else:
        execution.status = "completed"
        execution.result = {
            "provider": "simulated",
            "note": "n8n is not configured; the workflow ran in preview mode.",
            "actions": len(workflow.actions),
        }

    execution.finished_at = utcnow()
    _log_event(
        db,
        organization_id=workflow.organization_id,
        integration_id=None,
        event="workflow.executed",
        status=execution.status,
        request_payload=payload,
        response_payload=execution.result,
        error=execution.error,
    )
    db.commit()
    db.refresh(execution)
    return WorkflowExecutionOut.model_validate(execution)


def settings_webhook(workflow: Workflow) -> str:
    """Resolve the n8n webhook URL for a workflow."""
    configured = (workflow.trigger_config or {}).get("webhook_url")
    if configured:
        return str(configured)
    return settings.n8n_lead_webhook_url or ""


def list_executions(
    db: Session, organization_id: str, params: PageParams, *, workflow_id: str | None = None
) -> tuple[list[WorkflowExecutionOut], int]:
    stmt = select(WorkflowExecution).where(WorkflowExecution.organization_id == organization_id)
    if workflow_id:
        stmt = stmt.where(WorkflowExecution.workflow_id == workflow_id)
    rows, total = paginate(db, stmt.order_by(WorkflowExecution.created_at.desc()), params)
    return [WorkflowExecutionOut.model_validate(row) for row in rows], total


# ---------------------------------------------------------------------------
# Webhooks (inbound)
# ---------------------------------------------------------------------------
def list_webhooks(db: Session, organization_id: str) -> list[WebhookOut]:
    rows = db.execute(
        select(Webhook)
        .where(Webhook.organization_id == organization_id)
        .order_by(Webhook.created_at.desc())
    ).scalars().all()
    return [WebhookOut.model_validate(row) for row in rows]


def create_webhook(
    db: Session, organization: Organization, payload: WebhookCreate, *, user_id: str | None
) -> WebhookOut:
    if not payload.url.startswith(("http://", "https://")):
        raise ValidationError("The webhook URL must be an absolute http(s) URL.")

    row = Webhook(
        organization_id=organization.id,
        provider=payload.provider,
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
        is_active=True,
    )
    db.add(row)
    db.flush()

    audit.log_action(
        db,
        action="webhook.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="webhook",
        resource_id=row.id,
        changes={"provider": payload.provider, "events": payload.events},
    )
    db.commit()
    db.refresh(row)
    return WebhookOut.model_validate(row)


def delete_webhook(db: Session, webhook: Webhook, *, user_id: str | None) -> None:
    organization_id, webhook_id = webhook.organization_id, webhook.id
    db.delete(webhook)
    audit.log_action(
        db,
        action="webhook.deleted",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="webhook",
        resource_id=webhook_id,
    )
    db.commit()


def find_webhook(db: Session, organization_id: str, webhook_id: str) -> Webhook:
    return scoped(db, Webhook, webhook_id, organization_id, label="Webhook")


def receive_webhook(
    db: Session, organization_id: str, provider: str, event: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Record an inbound webhook so deliveries are auditable."""
    hook = db.execute(
        select(Webhook).where(
            Webhook.organization_id == organization_id,
            Webhook.provider == provider,
            Webhook.is_active.is_(True),
        )
    ).scalars().first()

    if hook is not None:
        hook.last_received_at = utcnow()

    _log_event(
        db,
        organization_id=organization_id,
        integration_id=None,
        event=f"webhook.received.{provider}",
        status="success",
        request_payload={"event": event, **payload},
    )
    db.commit()
    return {"received": True, "provider": provider, "event": event}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
def list_notifications(
    db: Session, organization_id: str, params: PageParams, *, channel: str | None = None
) -> tuple[list[NotificationLogOut], int]:
    stmt = select(NotificationLog).where(NotificationLog.organization_id == organization_id)
    if channel:
        stmt = stmt.where(NotificationLog.channel == channel)
    rows, total = paginate(db, stmt.order_by(NotificationLog.created_at.desc()), params)
    return [NotificationLogOut.model_validate(row) for row in rows], total


def send_whatsapp(
    db: Session,
    organization_id: str,
    *,
    to: str,
    body: str,
    template: str | None = None,
) -> NotificationLogOut:
    """Send a WhatsApp message and always write a notification log row."""
    row = NotificationLog(
        organization_id=organization_id,
        channel="whatsapp",
        recipient=to[:64],
        template=(template or "")[:120] or None,
        status="queued",
        payload={"body": body[:1000]},
    )
    db.add(row)
    db.flush()

    response = whatsapp.send_text(to, body)
    if response.ok:
        row.status = "sent"
        row.provider_message_id = str(
            response.data.get("message_id") or response.data.get("messages") or ""
        )[:160] or None
        row.sent_at = utcnow()
    else:
        row.status = "failed"
        row.error = response.error or "WhatsApp delivery failed."

    db.commit()
    db.refresh(row)
    return NotificationLogOut.model_validate(row)


def notification_stats(db: Session, organization_id: str) -> dict[str, int]:
    rows = db.execute(
        select(NotificationLog.status, func.count())
        .where(NotificationLog.organization_id == organization_id)
        .group_by(NotificationLog.status)
    ).all()
    return {str(status): int(count) for status, count in rows}
