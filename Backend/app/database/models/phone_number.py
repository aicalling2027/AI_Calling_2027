"""Phone number inventory and telephony providers (PRD module 16)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import PhoneNumberStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TelephonyProvider(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Global registry of telephony vendors (Sarvam SIP, Exotel, Twilio...)."""

    __tablename__ = "telephony_providers"

    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_inbound: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_outbound: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class PhoneNumber(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A DID owned by an organization and optionally bound to an employee."""

    __tablename__ = "phone_numbers"
    __table_args__ = (UniqueConstraint("number", name="uq_phone_number_number"),)

    number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(120))
    country_code: Mapped[str] = mapped_column(String(8), default="IN", nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="sarvam", nullable=False)
    provider_number_id: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(
        String(24), default=str(PhoneNumberStatus.PENDING), nullable=False, index=True
    )
    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="SET NULL"), index=True
    )
    capabilities: Mapped[list] = mapped_column(JSON, default=lambda: ["inbound", "outbound"], nullable=False)
    inbound_webhook_url: Mapped[str | None] = mapped_column(String(512))
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime)
    released_at: Mapped[datetime | None] = mapped_column(DateTime)
    monthly_cost_inr: Mapped[int] = mapped_column(default=0, nullable=False)


class PhoneNumberAssignment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """History of employee bindings for a phone number."""

    __tablename__ = "phone_number_assignments"

    phone_number_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("phone_numbers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime)
