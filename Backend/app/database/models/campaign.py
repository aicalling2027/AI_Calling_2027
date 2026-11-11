"""Bulk campaign models (PRD module 07)."""

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

from app.core.constants import CampaignStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Campaign(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """An outbound calling campaign executed by one AI employee."""

    __tablename__ = "campaigns"

    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    phone_number_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("phone_numbers.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(
        String(24), default=str(CampaignStatus.DRAFT), nullable=False, index=True
    )

    # Calling window in the organization's timezone, "HH:MM" 24h strings.
    calling_window_start: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    calling_window_end: Mapped[str] = mapped_column(String(5), default="19:00", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", nullable=False)

    max_concurrent_calls: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    retry_delay_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    scheduled_start_at: Mapped[datetime | None] = mapped_column(DateTime)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    total_contacts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_contacts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_contacts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )

    contacts: Mapped[list["CampaignContact"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignContact(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Join row tracking one lead's progress inside a campaign."""

    __tablename__ = "campaign_contacts"
    __table_args__ = (UniqueConstraint("campaign_id", "lead_id", name="uq_campaign_lead"),)

    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    campaign: Mapped[Campaign] = relationship(back_populates="contacts")
    attempts_log: Mapped[list["CampaignAttempt"]] = relationship(
        back_populates="campaign_contact", cascade="all, delete-orphan"
    )


class CampaignAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One dial attempt for a campaign contact."""

    __tablename__ = "campaign_attempts"

    campaign_contact_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("campaign_contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    call_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("calls.id", ondelete="SET NULL")
    )
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="queued", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    error: Mapped[str | None] = mapped_column(Text)

    campaign_contact: Mapped[CampaignContact] = relationship(back_populates="attempts_log")


class CampaignSchedule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Recurring execution window for a campaign."""

    __tablename__ = "campaign_schedules"

    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime)
    days_of_week: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
