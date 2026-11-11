"""Subscription, credit ledger, usage and payment models (PRD module 18).

Money is stored as whole INR integers (``*_inr``) to avoid floating point
drift; conversion to paise happens only at the Razorpay boundary.
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

from app.core.constants import BillingInterval, LedgerEntryType
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class SubscriptionPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Global catalogue of purchasable plans."""

    __tablename__ = "subscription_plans"

    code: Mapped[str] = mapped_column(String(48), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_inr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    billing_interval: Mapped[str] = mapped_column(
        String(16), default=str(BillingInterval.MONTHLY), nullable=False
    )
    included_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_employees: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_phone_numbers: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    features: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Subscription(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """An organization's active plan."""

    __tablename__ = "subscriptions"

    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="active", nullable=False, index=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(120), index=True)


class CreditAccount(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Running credit balance - one per organization."""

    __tablename__ = "credit_accounts"
    __table_args__ = (UniqueConstraint("organization_id", name="uq_credit_account_org"),)

    balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lifetime_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lifetime_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_balance_threshold: Mapped[int] = mapped_column(Integer, default=100, nullable=False)


class CreditLedger(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Immutable double-entry style ledger of credit movements."""

    __tablename__ = "credit_ledger"

    credit_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("credit_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_type: Mapped[str] = mapped_column(
        String(16), default=str(LedgerEntryType.DEBIT), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(160), nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(48))
    reference_id: Mapped[str | None] = mapped_column(String(64), index=True)
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(Text)


class UsageRecord(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Per-action metered usage feeding billing and analytics."""

    __tablename__ = "usage_records"

    usage_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), default="call_minute", nullable=False)
    unit_cost_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(48))
    reference_id: Mapped[str | None] = mapped_column(String(64), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    usage_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)


class Payment(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A payment attempt/transaction."""

    __tablename__ = "payments"

    subscription_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("subscriptions.id", ondelete="SET NULL")
    )
    amount_inr: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="created", nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), default="razorpay", nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(120), index=True)
    provider_order_id: Mapped[str | None] = mapped_column(String(120), index=True)
    method: Mapped[str | None] = mapped_column(String(32))
    credits_granted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class Invoice(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Issued invoice with immutable totals."""

    __tablename__ = "invoices"

    subscription_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("subscriptions.id", ondelete="SET NULL")
    )
    number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    amount_inr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tax_inr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_inr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="open", nullable=False, index=True)
    period_start: Mapped[datetime | None] = mapped_column(DateTime)
    period_end: Mapped[datetime | None] = mapped_column(DateTime)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime)
    due_at: Mapped[datetime | None] = mapped_column(DateTime)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    line_items: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    pdf_url: Mapped[str | None] = mapped_column(String(512))
