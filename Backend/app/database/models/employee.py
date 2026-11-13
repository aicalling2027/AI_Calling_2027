"""AI employee configuration models (PRD modules 02-04)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DEFAULT_LANGUAGE, DEFAULT_MODEL, EmployeeStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Employee(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A configurable AI voice agent ("AI employee")."""

    __tablename__ = "employees"

    # -- Identity ----------------------------------------------------------
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    purpose: Mapped[str | None] = mapped_column(String(255))
    business_category: Mapped[str | None] = mapped_column(String(80))
    template_key: Mapped[str | None] = mapped_column(String(64), index=True)

    # -- Prompt configuration ---------------------------------------------
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    personality: Mapped[str | None] = mapped_column(Text)
    role_description: Mapped[str | None] = mapped_column(Text)
    business_instructions: Mapped[str | None] = mapped_column(Text)
    conversation_objectives: Mapped[str | None] = mapped_column(Text)
    greeting_instruction: Mapped[str | None] = mapped_column(Text)
    interaction_rules: Mapped[str | None] = mapped_column(Text)
    response_style: Mapped[str | None] = mapped_column(Text)
    closing_instruction: Mapped[str | None] = mapped_column(Text)

    # -- Voice / model -----------------------------------------------------
    voice: Mapped[str] = mapped_column(String(64), default="anushka", nullable=False)
    model: Mapped[str] = mapped_column(String(64), default=DEFAULT_MODEL, nullable=False)
    default_language: Mapped[str] = mapped_column(
        String(16), default=DEFAULT_LANGUAGE, nullable=False
    )
    temperature: Mapped[float] = mapped_column(Float, default=0.6, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=512, nullable=False)
    first_message: Mapped[str | None] = mapped_column(Text)
    end_call_message: Mapped[str | None] = mapped_column(Text)

    # -- Calling activation ------------------------------------------------
    # Enabling calls is an explicit customer action, never a side effect of
    # creating the employee, so this starts closed and the configuration is
    # versioned from the first save.
    calling_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    #: not_configured | configuration_pending | syncing | ready_for_testing |
    #: test_failed | ready_to_deploy | live | paused | sync_failed
    calling_status: Mapped[str] = mapped_column(
        String(32),
        default="not_configured",
        server_default="not_configured",
        nullable=False,
        index=True,
    )
    configuration_version: Mapped[int] = mapped_column(
        Integer, default=1, server_default=text("1"), nullable=False
    )
    #: Fingerprint of the configuration that version refers to.
    configuration_hash: Mapped[str | None] = mapped_column(String(64))

    # -- Lifecycle / counters ---------------------------------------------
    status: Mapped[str] = mapped_column(
        String(24), default=str(EmployeeStatus.DRAFT), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    successful_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )

    languages: Mapped[list["EmployeeLanguage"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    prompt_versions: Mapped[list["EmployeePromptVersion"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    actions: Mapped[list["EmployeeAction"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )

    @property
    def success_rate(self) -> float:
        if not self.total_calls:
            return 0.0
        return round(self.successful_calls / self.total_calls * 100, 2)


class EmployeeLanguage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Languages an employee can speak, with an optional per-language prompt."""

    __tablename__ = "employee_languages"
    __table_args__ = (
        UniqueConstraint("employee_id", "language_code", name="uq_employee_language"),
    )

    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language_code: Mapped[str] = mapped_column(String(16), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    language_prompt: Mapped[str | None] = mapped_column(Text)

    employee: Mapped[Employee] = relationship(back_populates="languages")


class EmployeePromptVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Immutable prompt history so changes can be reviewed or rolled back."""

    __tablename__ = "employee_prompt_versions"
    __table_args__ = (
        UniqueConstraint("employee_id", "version", name="uq_employee_prompt_version"),
    )

    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    change_note: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )

    employee: Mapped[Employee] = relationship(back_populates="prompt_versions")


class EmployeeAction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Structured capability the agent may invoke during a conversation."""

    __tablename__ = "employee_actions"

    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # transfer_call | send_whatsapp | book_appointment | collect_information | webhook | end_call
    action_type: Mapped[str] = mapped_column(String(48), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    trigger_condition: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    employee: Mapped[Employee] = relationship(back_populates="actions")


class EmployeeAgentBinding(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """The voice-provider deployment that runs this employee's calls.

    ``Employee`` is the definition authored here; the provider only deploys an
    agent it already knows, so this row is the proof the trigger ran and the
    place a retry reads from. Archiving pauses the deployment and keeps this
    row; removing the agent deletes the deployment on the platform and drops
    this row, so a later deploy starts from a clean link.
    """

    __tablename__ = "employee_agent_bindings"
    __table_args__ = (
        UniqueConstraint("employee_id", name="uq_employee_agent_bindings_employee_id"),
        # The documented provider identity. Redundant while one employee owns at
        # most one provider link, but it states the rule the sync relies on.
        Index(
            "uq_employee_agent_bindings_tenant_provider",
            "organization_id",
            "employee_id",
            "provider",
            unique=True,
        ),
    )

    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(48), default="sarvam-voice-agents", nullable=False
    )
    deployment_id: Mapped[str | None] = mapped_column(String(80))
    app_id: Mapped[str | None] = mapped_column(String(80))
    app_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    #: pending | active | paused | failed
    status: Mapped[str] = mapped_column(
        String(24), default="pending", nullable=False, index=True
    )
    simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime)

    # -- Sync detail added with Option B ----------------------------------
    #: Provider-side name of the agent, kept for reconciliation only.
    external_agent_name: Mapped[str | None] = mapped_column(String(120))
    #: Last version the provider confirmed as committed; None means unverified.
    current_committed_version: Mapped[int | None] = mapped_column(Integer)
    #: Status string exactly as the provider reported it.
    external_agent_status: Mapped[str | None] = mapped_column(String(32))
    #: pending | in_sync | out_of_sync | simulated | failed
    sync_status: Mapped[str] = mapped_column(
        String(24),
        default="pending",
        server_default="pending",
        nullable=False,
        index=True,
    )
    #: Hash of the configuration that produced the current provider state.
    last_configuration_hash: Mapped[str | None] = mapped_column(String(64))

    employee: Mapped[Employee] = relationship()


class ActionExecution(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Audit record of an action the agent executed during a call."""

    __tablename__ = "action_executions"

    action_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employee_actions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    call_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("calls.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime)
