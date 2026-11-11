"""Billing, credits, usage and payment schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel, ORMModel


class PlanOut(ORMModel):
    id: str
    code: str
    name: str
    description: str | None = None
    price_inr: int
    billing_interval: str
    included_credits: int
    max_employees: int
    max_phone_numbers: int
    features: list
    is_active: bool


class SubscriptionOut(ORMModel):
    id: str
    organization_id: str
    plan_id: str
    status: str
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool
    cancelled_at: datetime | None = None
    created_at: datetime


class SubscriptionDetail(SubscriptionOut):
    plan: PlanOut | None = None


class CreditAccountOut(ORMModel):
    id: str
    organization_id: str
    balance: int
    lifetime_credits: int
    lifetime_used: int
    low_balance_threshold: int


class CreditLedgerOut(ORMModel):
    id: str
    entry_type: str
    amount: int
    balance_after: int
    reason: str
    reference_type: str | None = None
    reference_id: str | None = None
    note: str | None = None
    created_at: datetime


class UsageRecordOut(ORMModel):
    id: str
    usage_type: str
    quantity: int
    unit: str
    unit_cost_credits: int
    total_credits: int
    reference_type: str | None = None
    reference_id: str | None = None
    occurred_at: datetime


class UsageSummary(APIModel):
    period_start: datetime
    period_end: datetime
    total_credits_used: int
    by_type: dict[str, int] = Field(default_factory=dict)
    call_minutes: int = 0
    calls: int = 0


class PaymentOut(ORMModel):
    id: str
    amount_inr: int
    currency: str
    status: str
    provider: str
    provider_payment_id: str | None = None
    method: str | None = None
    credits_granted: int
    paid_at: datetime | None = None
    created_at: datetime


class InvoiceOut(ORMModel):
    id: str
    number: str
    amount_inr: int
    tax_inr: int
    total_inr: int
    status: str
    period_start: datetime | None = None
    period_end: datetime | None = None
    issued_at: datetime | None = None
    due_at: datetime | None = None
    paid_at: datetime | None = None
    line_items: list


class PurchaseCreditsRequest(APIModel):
    credits: int = Field(ge=100, le=1_000_000)
    amount_inr: int | None = Field(
        default=None, ge=1, description="Optional explicit amount; defaults to plan rate"
    )


class CheckoutResponse(APIModel):
    order_id: str
    amount_inr: int
    currency: str = "INR"
    credits: int
    razorpay_key_id: str | None = None
    simulated: bool = False
    message: str


class ChangeSubscriptionRequest(APIModel):
    plan_code: str
