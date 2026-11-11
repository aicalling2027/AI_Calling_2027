"""Contacts, leads, activities and follow-ups."""

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

from app.core.constants import LeadSource, LeadStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Contact(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A person reachable by phone. One contact may produce many leads."""

    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("organization_id", "phone", name="uq_contact_phone"),)

    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    company: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(80))
    country: Mapped[str] = mapped_column(String(8), default="IN", nullable=False)
    preferred_language: Mapped[str | None] = mapped_column(String(16))
    is_dnc: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    leads: Mapped[list["Lead"]] = relationship(back_populates="contact")


class LeadSourceDefinition(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Configurable lead source (Google Sheets, Meta Ads, CSV, custom API...)."""

    __tablename__ = "lead_sources"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_lead_source_code"),)

    code: Mapped[str] = mapped_column(String(48), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(48), default=str(LeadSource.OTHER), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class Lead(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A callable opportunity derived from a contact."""

    __tablename__ = "leads"

    contact_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="SET NULL"), index=True
    )
    campaign_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True
    )
    lead_source_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("lead_sources.id", ondelete="SET NULL")
    )
    source: Mapped[str] = mapped_column(
        String(48), default=str(LeadSource.MANUAL_UPLOAD), nullable=False, index=True
    )
    source_detail: Mapped[str | None] = mapped_column(String(255))
    external_id: Mapped[str | None] = mapped_column(String(160), index=True)
    status: Mapped[str] = mapped_column(
        String(32), default=str(LeadStatus.NEW), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    call_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime)

    contact: Mapped[Contact] = relationship(back_populates="leads")
    activities: Mapped[list["LeadActivity"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )


class LeadAssignment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Immutable history of who owned a lead."""

    __tablename__ = "lead_assignments"

    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_to: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime)


class LeadActivity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Timeline entry for a lead (call, status change, note, import...)."""

    __tablename__ = "lead_activities"

    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    lead: Mapped[Lead] = relationship(back_populates="activities")


class FollowUp(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Scheduled follow-up action generated by automation or a manager."""

    __tablename__ = "followups"

    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    call_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("calls.id", ondelete="SET NULL")
    )
    scheduled_for: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(24), default="call", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    assigned_to: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
