"""Provider integration state (Option B: OWN AI owns config, provider executes).

Every table here stores a *link* to a voice provider - an external id, a status,
a hash - and never a credential. The customer-facing API must expose none of
these columns; they exist so a sync can be retried, audited and reconciled
without asking the provider what it thinks the truth is.

The provider agent itself keeps living in ``employee_agent_bindings`` (one row
per employee) so the existing code path keeps working; these tables add the
history and the job ledger around it.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin

#: Provider code used when nothing else is supplied. Kept as a literal so a
#: migration can backfill without importing the integration layer.
DEFAULT_PROVIDER = "sarvam-voice-agents"


class ProviderAgentVersion(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """One configuration snapshot that a provider has been asked to commit.

    A draft is never live: ``version_status`` stays ``draft`` until the provider
    confirms the commit, and ``commit_status`` records that confirmation
    separately so a half-finished commit cannot be mistaken for a live version.
    """

    __tablename__ = "provider_agent_versions"
    __table_args__ = (
        UniqueConstraint(
            "provider_agent_id",
            "external_version",
            name="uq_provider_agent_versions_provider_agent_id",
        ),
    )

    provider_agent_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("employee_agent_bindings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_version: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration_hash: Mapped[str | None] = mapped_column(String(64))
    #: draft | committed | failed
    version_status: Mapped[str] = mapped_column(
        String(24), default="draft", nullable=False, index=True
    )
    #: pending | committed | failed
    commit_status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    committed_at: Mapped[datetime | None] = mapped_column(DateTime)


class ProviderDeployment(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A committed agent version bound to a phone number.

    Deployment is deliberately its own record: creating one makes the number
    answer immediately, so it can never be a side effect of saving an employee.
    """

    __tablename__ = "provider_deployments"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "external_deployment_id",
            name="uq_provider_deployments_provider",
        ),
    )

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_agent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("employee_agent_bindings.id", ondelete="SET NULL"),
        index=True,
    )
    provider_agent_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("provider_agent_versions.id", ondelete="SET NULL"),
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(48), default=DEFAULT_PROVIDER, nullable=False
    )
    external_deployment_id: Mapped[str | None] = mapped_column(String(80), index=True)
    external_connection_id: Mapped[str | None] = mapped_column(String(80))
    phone_number_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("phone_numbers.id", ondelete="SET NULL"),
        index=True,
    )
    #: inbound | outbound | both
    channel_direction: Mapped[str] = mapped_column(
        String(16), default="inbound", nullable=False
    )
    #: pending | active | paused | failed | deleted
    deployment_status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)


class ProviderSyncJob(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """One queued provider operation, retryable and deduplicated.

    ``idempotency_key`` is unique per tenant so a second "enable calling" click
    attaches to the existing job instead of creating a second provider agent.
    Credentials are never stored here - only ids, a hash and a status.
    """

    __tablename__ = "provider_sync_jobs"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "idempotency_key",
            name="uq_provider_sync_jobs_organization_id",
        ),
    )

    employee_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("employees.id", ondelete="SET NULL"),
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(48), default=DEFAULT_PROVIDER, nullable=False
    )
    #: enable_calling | sync_configuration | commit_version | deploy | pause |
    #: resume | delete_deployment | import
    operation: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), index=True)
    payload_hash: Mapped[str | None] = mapped_column(String(64))
    #: pending | running | succeeded | failed | dead_letter
    status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    last_error_code: Mapped[str | None] = mapped_column(String(64))
    #: Sanitised text only - never a credential, a transcript or provider JSON.
    last_error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)


class ProviderSyncLog(Base, UUIDPrimaryKeyMixin, TenantMixin):
    """Append-only audit line for a provider operation.

    Separate from the job because a job is mutable state while a log is history:
    every attempt leaves a line even after the job is cleaned up.
    """

    __tablename__ = "provider_sync_logs"

    employee_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("employees.id", ondelete="SET NULL"),
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(48), default=DEFAULT_PROVIDER, nullable=False
    )
    operation: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    #: pending | succeeded | failed | skipped
    status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    error_code: Mapped[str | None] = mapped_column(String(64))
    #: Sanitised; safe to show an operator, never shown to a customer.
    sanitized_message: Mapped[str | None] = mapped_column(Text)
    correlation_id: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False, index=True
    )


class ProviderKnowledgeBaseBinding(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Maps one OWN AI knowledge base (``training_sources``) to a provider base.

    Kept independent of the employee mapping: a base may be shared by several
    employees, so syncing it once must not be repeated per agent.
    """

    __tablename__ = "provider_knowledge_base_bindings"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_base_id",
            "provider",
            name="uq_provider_knowledge_base_bindings_knowledge_base_id",
        ),
    )

    knowledge_base_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("training_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(48), default=DEFAULT_PROVIDER, nullable=False
    )
    external_knowledge_base_id: Mapped[str | None] = mapped_column(String(80))
    #: pending | in_sync | out_of_sync | failed
    sync_status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    content_hash: Mapped[str | None] = mapped_column(String(64))


class ProviderDocumentBinding(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Tracks one uploaded document's copy inside a provider knowledge base.

    Idempotent by checksum: re-uploading the same bytes must reuse the existing
    external file instead of creating a duplicate the provider would bill for.
    """

    __tablename__ = "provider_document_bindings"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_base_document_id",
            "provider_knowledge_base_id",
            name="uq_provider_document_bindings_knowledge_base_document_id",
        ),
    )

    knowledge_base_document_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("training_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_knowledge_base_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("provider_knowledge_base_bindings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: Only set when the provider returns its own file identifier.
    external_file_id: Mapped[str | None] = mapped_column(String(120))
    content_checksum: Mapped[str | None] = mapped_column(String(128))
    #: pending | in_sync | out_of_sync | failed
    sync_status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)


__all__ = [
    "DEFAULT_PROVIDER",
    "ProviderAgentVersion",
    "ProviderDeployment",
    "ProviderDocumentBinding",
    "ProviderKnowledgeBaseBinding",
    "ProviderSyncJob",
    "ProviderSyncLog",
]
