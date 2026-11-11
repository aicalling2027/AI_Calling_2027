"""Integrations, automation workflows, webhooks and notifications.

Credential *values* are never stored in the repository; ``IntegrationCredential``
holds a reference to an encrypted secret or an environment variable name.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import IntegrationStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Integration(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """One third-party connection for an organization."""

    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("organization_id", "provider", name="uq_integration_provider"),)

    provider: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(48), default="other", nullable=False)
    status: Mapped[str] = mapped_column(
        String(24), default=str(IntegrationStatus.DISCONNECTED), nullable=False, index=True
    )
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    connected_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )

    credentials: Mapped[list["IntegrationCredential"]] = relationship(
        back_populates="integration", cascade="all, delete-orphan"
    )


class IntegrationCredential(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Secret reference for an integration (never a raw secret in the DB dump)."""

    __tablename__ = "integration_credentials"
    __table_args__ = (UniqueConstraint("integration_id", "key", name="uq_integration_credential"),)

    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    # Either an encrypted blob or the name of the env var holding the secret.
    secret_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime)

    integration: Mapped[Integration] = relationship(back_populates="credentials")


class IntegrationLog(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Request/response log for an integration call."""

    __tablename__ = "integration_logs"

    integration_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="SET NULL"), index=True
    )
    event: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), default="success", nullable=False)
    request_payload: Mapped[dict | None] = mapped_column("request", JSON)
    response_payload: Mapped[dict | None] = mapped_column("response", JSON)
    error: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)


class Workflow(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Automation definition, optionally mirrored to n8n."""

    __tablename__ = "workflows"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    trigger_type: Mapped[str] = mapped_column(String(48), nullable=False)
    trigger_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    actions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    n8n_workflow_id: Mapped[str | None] = mapped_column(String(120), index=True)


class WorkflowExecution(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Execution history for a workflow."""

    __tablename__ = "workflow_executions"

    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="running", nullable=False, index=True)
    trigger_payload: Mapped[dict | None] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class Webhook(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Inbound webhook endpoint configuration and its signing secret."""

    __tablename__ = "webhooks"

    provider: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    secret: Mapped[str | None] = mapped_column(String(255))
    events: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_received_at: Mapped[datetime | None] = mapped_column(DateTime)


class NotificationLog(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Outbound notification audit (WhatsApp, email, SMS)."""

    __tablename__ = "notification_logs"

    channel: Mapped[str] = mapped_column(String(24), default="whatsapp", nullable=False, index=True)
    recipient: Mapped[str] = mapped_column(String(64), nullable=False)
    template: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(24), default="queued", nullable=False, index=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(160))
    error: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
