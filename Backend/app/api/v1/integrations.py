"""Integrations hub, automation workflows and notifications."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import Perm
from app.modules import integrations
from app.schemas.common import MessageResponse, Page
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

router = APIRouter(prefix="/integrations", tags=["Integrations"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.INTEGRATIONS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.INTEGRATIONS_WRITE))]


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------
@router.get("/catalog", summary="Providers this product can connect to")
def catalog() -> list[dict]:
    return integrations.catalog()


@router.get(
    "/status", response_model=list[IntegrationStatusOut], summary="Readiness per provider"
)
def provider_status(principal: Reader, db: DbSession) -> list[IntegrationStatusOut]:
    return integrations.provider_status(db, principal.organization)


@router.get("", response_model=Page[IntegrationOut], summary="Connected integrations")
def list_integrations(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    category: str | None = None,
) -> Page[IntegrationOut]:
    rows, total = integrations.list_integrations(
        db, principal.organization_id, params, category=category
    )
    return Page[IntegrationOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "",
    response_model=IntegrationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Connect a provider",
)
def connect_integration(
    payload: IntegrationConnect, principal: Writer, db: DbSession
) -> IntegrationOut:
    return integrations.connect_integration(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.post(
    "/{integration_id}/sync", response_model=IntegrationOut, summary="Re-check a connection"
)
def sync_integration(integration_id: str, principal: Writer, db: DbSession) -> IntegrationOut:
    row = integrations.get_integration(db, principal.organization_id, integration_id)
    return integrations.sync_integration(db, row, user_id=principal.user_id)


@router.delete(
    "/{integration_id}", response_model=IntegrationOut, summary="Disconnect a provider"
)
def disconnect_integration(
    integration_id: str, principal: Writer, db: DbSession
) -> IntegrationOut:
    row = integrations.get_integration(db, principal.organization_id, integration_id)
    return integrations.disconnect_integration(db, row, user_id=principal.user_id)


@router.get(
    "/logs", response_model=Page[IntegrationLogOut], summary="Integration call log"
)
def list_logs(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    integration_id: str | None = None,
    status_filter: str | None = None,
) -> Page[IntegrationLogOut]:
    rows, total = integrations.list_logs(
        db, principal.organization_id, params, integration_id=integration_id, status=status_filter
    )
    return Page[IntegrationLogOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------
workflows = APIRouter(prefix="/workflows", tags=["Automation"])


@workflows.get("", response_model=Page[WorkflowOut], summary="List workflows")
def list_workflows(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    active_only: bool = False,
) -> Page[WorkflowOut]:
    rows, total = integrations.list_workflows(
        db, principal.organization_id, params, active_only=active_only
    )
    return Page[WorkflowOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@workflows.post(
    "",
    response_model=WorkflowOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workflow",
)
def create_workflow(
    payload: WorkflowCreate, principal: Writer, db: DbSession
) -> WorkflowOut:
    return integrations.create_workflow(
        db, principal.organization, payload, user_id=principal.user_id
    )


@workflows.get(
    "/executions", response_model=Page[WorkflowExecutionOut], summary="Execution history"
)
def list_executions(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    workflow_id: str | None = None,
) -> Page[WorkflowExecutionOut]:
    rows, total = integrations.list_executions(
        db, principal.organization_id, params, workflow_id=workflow_id
    )
    return Page[WorkflowExecutionOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@workflows.get("/{workflow_id}", response_model=WorkflowOut, summary="Get a workflow")
def get_workflow(workflow_id: str, principal: Reader, db: DbSession) -> WorkflowOut:
    return WorkflowOut.model_validate(
        integrations.get_workflow(db, principal.organization_id, workflow_id)
    )


@workflows.put("/{workflow_id}", response_model=WorkflowOut, summary="Replace a workflow")
def update_workflow(
    workflow_id: str, payload: WorkflowCreate, principal: Writer, db: DbSession
) -> WorkflowOut:
    row = integrations.get_workflow(db, principal.organization_id, workflow_id)
    return integrations.update_workflow(db, row, payload, user_id=principal.user_id)


@workflows.delete("/{workflow_id}", response_model=MessageResponse, summary="Delete a workflow")
def delete_workflow(workflow_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    row = integrations.get_workflow(db, principal.organization_id, workflow_id)
    integrations.delete_workflow(db, row, user_id=principal.user_id)
    return MessageResponse(message="Workflow deleted.")


@workflows.post(
    "/{workflow_id}/run",
    response_model=WorkflowExecutionOut,
    summary="Run a workflow now",
)
def run_workflow(
    workflow_id: str, principal: Writer, db: DbSession, payload: dict | None = None
) -> WorkflowExecutionOut:
    row = integrations.get_workflow(db, principal.organization_id, workflow_id)
    return integrations.execute_workflow(db, row, trigger_payload=payload)


# ---------------------------------------------------------------------------
# Inbound webhook registrations + notifications
# ---------------------------------------------------------------------------
webhooks = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@webhooks.get("", response_model=list[WebhookOut], summary="Registered webhooks")
def list_webhooks(principal: Reader, db: DbSession) -> list[WebhookOut]:
    return integrations.list_webhooks(db, principal.organization_id)


@webhooks.post(
    "",
    response_model=WebhookOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a webhook",
)
def create_webhook(
    payload: WebhookCreate, principal: Writer, db: DbSession
) -> WebhookOut:
    return integrations.create_webhook(
        db, principal.organization, payload, user_id=principal.user_id
    )


@webhooks.delete("/{webhook_id}", response_model=MessageResponse, summary="Delete a webhook")
def delete_webhook(webhook_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    row = integrations.find_webhook(db, principal.organization_id, webhook_id)
    integrations.delete_webhook(db, row, user_id=principal.user_id)
    return MessageResponse(message="Webhook deleted.")


notifications = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications.get(
    "", response_model=Page[NotificationLogOut], summary="Notification history"
)
def list_notifications(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    channel: str | None = None,
) -> Page[NotificationLogOut]:
    rows, total = integrations.list_notifications(
        db, principal.organization_id, params, channel=channel
    )
    return Page[NotificationLogOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@notifications.get("/stats", summary="Delivery statistics")
def notification_stats(principal: Reader, db: DbSession) -> dict[str, int]:
    return integrations.notification_stats(db, principal.organization_id)


@notifications.post("/whatsapp", response_model=NotificationLogOut, summary="Send a WhatsApp message")
def send_whatsapp(
    principal: Writer,
    db: DbSession,
    to: str = Query(..., min_length=6, max_length=32),
    body: str = Query(..., min_length=1, max_length=4000),
    template: str | None = Query(None, max_length=120),
) -> NotificationLogOut:
    return integrations.send_whatsapp(
        db, principal.organization_id, to=to, body=body, template=template
    )
