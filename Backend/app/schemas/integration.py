"""Integration, automation, webhook and developer tooling schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel, ORMModel


class IntegrationOut(ORMModel):
    id: str
    organization_id: str
    provider: str
    name: str
    category: str
    status: str
    config: dict
    last_synced_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime


class IntegrationConnect(APIModel):
    provider: str = Field(max_length=48)
    name: str | None = Field(default=None, max_length=120)
    config: dict = Field(default_factory=dict)
    credentials: dict[str, str] = Field(
        default_factory=dict,
        description="Secret values are written as env-var references, never stored raw",
    )


class IntegrationLogOut(ORMModel):
    id: str
    integration_id: str | None = None
    event: str
    status: str
    error: str | None = None
    duration_ms: int | None = None
    created_at: datetime


class IntegrationStatusOut(APIModel):
    provider: str
    configured: bool
    healthy: bool
    detail: str
    missing_settings: list[str] = Field(default_factory=list)


class WorkflowCreate(APIModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    trigger_type: str = Field(max_length=48)
    trigger_config: dict = Field(default_factory=dict)
    actions: list[dict] = Field(default_factory=list)
    is_active: bool = True


class WorkflowOut(ORMModel):
    id: str
    organization_id: str
    name: str
    description: str | None = None
    trigger_type: str
    trigger_config: dict
    actions: list
    is_active: bool
    version: int
    n8n_workflow_id: str | None = None
    created_at: datetime


class WorkflowExecutionOut(ORMModel):
    id: str
    workflow_id: str
    status: str
    error: str | None = None
    attempts: int
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime


class WebhookCreate(APIModel):
    provider: str = Field(max_length=48)
    url: str = Field(max_length=512)
    events: list[str] = Field(default_factory=list)
    secret: str | None = Field(default=None, max_length=255)


class WebhookOut(ORMModel):
    id: str
    organization_id: str
    provider: str
    url: str
    events: list
    is_active: bool
    last_received_at: datetime | None = None
    created_at: datetime


class ApiKeyCreate(APIModel):
    name: str = Field(min_length=2, max_length=120)
    scopes: list[str] = Field(default_factory=list)


class ApiKeyOut(ORMModel):
    id: str
    name: str
    prefix: str
    scopes: list
    last_used_at: datetime | None = None
    request_count: int
    created_at: datetime


class ApiKeyCreated(ApiKeyOut):
    """Returned once at creation time - the only time the plaintext key exists."""

    api_key: str


class NotificationLogOut(ORMModel):
    id: str
    channel: str
    recipient: str
    template: str | None = None
    status: str
    provider_message_id: str | None = None
    error: str | None = None
    sent_at: datetime | None = None
    created_at: datetime


class AuditLogOut(ORMModel):
    id: str
    user_id: str | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    description: str | None = None
    ip_address: str | None = None
    created_at: datetime
