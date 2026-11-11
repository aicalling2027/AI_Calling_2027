"""Billing, credits, usage metering and payments.

Money is expressed in whole INR (``*_inr``); conversion to paise happens only
inside the Razorpay adapter. Credits are the internal currency for calls,
messages and embeddings.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import DEFAULT_PLANS, BillingInterval, LedgerEntryType
from app.core.exceptions import ConflictError, InsufficientCreditsError, NotFoundError
from app.core.logging import get_logger
from app.database.base import utcnow
from app.database.models.billing import (
    CreditAccount,
    CreditLedger,
    Invoice,
    Payment,
    Subscription,
    SubscriptionPlan,
    UsageRecord,
)
from app.integrations import razorpay
from app.modules import audit
from app.schemas.billing import (
    CheckoutResponse,
    CreditAccountOut,
    CreditLedgerOut,
    InvoiceOut,
    PaymentOut,
    PlanOut,
    SubscriptionDetail,
    UsageSummary,
)

logger = get_logger(__name__)

#: Default sell price of one credit, in INR. Purchases may override it.
CREDIT_UNIT_PRICE_INR = 1
DEFAULT_PLAN_CODE = "starter"


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------
def list_plans(db: Session, *, include_inactive: bool = False) -> list[SubscriptionPlan]:
    stmt = select(SubscriptionPlan)
    if not include_inactive:
        stmt = stmt.where(SubscriptionPlan.is_active.is_(True))
    stmt = stmt.order_by(SubscriptionPlan.sort_order.asc(), SubscriptionPlan.price_inr.asc())
    return list(db.execute(stmt).scalars().all())


def get_plan_by_code(db: Session, code: str) -> SubscriptionPlan:
    plan = db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.code == code)
    ).scalar_one_or_none()
    if plan is None:
        raise NotFoundError(f"Plan '{code}' does not exist.", details={"plan_code": code})
    return plan


def plan_out(plan: SubscriptionPlan) -> PlanOut:
    return PlanOut.model_validate(plan)


def seed_plans_if_empty(db: Session) -> int:
    """Insert the default catalogue when the plans table is empty."""
    if db.execute(select(func.count()).select_from(SubscriptionPlan)).scalar_one():
        return 0
    created = 0
    for order, definition in enumerate(DEFAULT_PLANS):
        db.add(
            SubscriptionPlan(
                code=str(definition["code"]),
                name=str(definition["name"]),
                description=str(definition.get("description") or ""),
                price_inr=int(definition["price_inr"]),
                billing_interval=str(definition.get("billing_interval") or BillingInterval.MONTHLY),
                included_credits=int(definition["included_credits"]),
                max_employees=int(definition["max_employees"]),
                max_phone_numbers=int(definition["max_phone_numbers"]),
                features=list(definition["features"]),  # type: ignore[arg-type]
                sort_order=order,
            )
        )
        created += 1
    db.commit()
    return created


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------
def ensure_subscription(
    db: Session, organization_id: str, *, plan_code: str | None = None
) -> Subscription:
    """Return the organization's subscription, creating a trial one if needed."""
    existing = db.execute(
        select(Subscription).where(Subscription.organization_id == organization_id)
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    plan = None
    if plan_code:
        plan = db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code)
        ).scalar_one_or_none()
    if plan is None:
        plan = db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.is_active.is_(True))
            .order_by(SubscriptionPlan.sort_order.asc())
        ).scalars().first()

    now = utcnow()
    subscription = Subscription(
        organization_id=organization_id,
        plan_id=plan.id if plan else _fallback_plan_id(db),
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(subscription)
    db.flush()
    return subscription


def _fallback_plan_id(db: Session) -> str:
    """Guarantee a plan row exists so the FK is never null."""
    seed_plans_if_empty(db)
    plan = db.execute(
        select(SubscriptionPlan).order_by(SubscriptionPlan.sort_order.asc())
    ).scalars().first()
    if plan is None:  # pragma: no cover - only if the catalogue is wiped
        raise NotFoundError("No subscription plans are configured.")
    return plan.id


def subscription_detail(db: Session, organization_id: str) -> SubscriptionDetail:
    subscription = ensure_subscription(db, organization_id)
    plan = db.get(SubscriptionPlan, subscription.plan_id)
    detail = SubscriptionDetail.model_validate(subscription)
    detail.plan = PlanOut.model_validate(plan) if plan else None
    return detail


def change_plan(
    db: Session, organization_id: str, plan_code: str, *, user_id: str | None = None
) -> SubscriptionDetail:
    plan = get_plan_by_code(db, plan_code)
    subscription = ensure_subscription(db, organization_id)
    if subscription.plan_id == plan.id:
        raise ConflictError(
            f"The organization is already on the '{plan.name}' plan.", details={"plan_code": plan_code}
        )

    previous = db.get(SubscriptionPlan, subscription.plan_id)
    now = utcnow()
    subscription.plan_id = plan.id
    subscription.status = "active"
    subscription.cancel_at_period_end = False
    subscription.cancelled_at = None
    subscription.current_period_start = now
    subscription.current_period_end = now + timedelta(
        days=365 if plan.billing_interval == BillingInterval.YEARLY else 30
    )

    if plan.included_credits:
        grant_credits(
            db,
            organization_id,
            plan.included_credits,
            reason=f"Plan change to {plan.name}",
            entry_type=LedgerEntryType.CREDIT,
            reference_type="subscription",
            reference_id=subscription.id,
            actor_id=user_id,
        )

    audit.log_action(
        db,
        action="billing.plan_changed",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="subscription",
        resource_id=subscription.id,
        changes={"from": previous.code if previous else None, "to": plan.code},
    )
    db.commit()
    return subscription_detail(db, organization_id)


def cancel_subscription(
    db: Session, organization_id: str, *, immediate: bool = False, user_id: str | None = None
) -> SubscriptionDetail:
    subscription = ensure_subscription(db, organization_id)
    now = utcnow()
    subscription.cancel_at_period_end = not immediate
    subscription.cancelled_at = now
    if immediate:
        subscription.status = "cancelled"
        subscription.current_period_end = now
    audit.log_action(
        db,
        action="billing.subscription_cancelled",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="subscription",
        resource_id=subscription.id,
        changes={"immediate": immediate},
    )
    db.commit()
    return subscription_detail(db, organization_id)


def resume_subscription(db: Session, organization_id: str, *, user_id: str | None = None) -> SubscriptionDetail:
    subscription = ensure_subscription(db, organization_id)
    subscription.cancel_at_period_end = False
    subscription.cancelled_at = None
    if subscription.status == "cancelled":
        subscription.status = "active"
    audit.log_action(
        db,
        action="billing.subscription_resumed",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="subscription",
        resource_id=subscription.id,
    )
    db.commit()
    return subscription_detail(db, organization_id)


def plan_limits(db: Session, organization_id: str) -> dict[str, int]:
    """Resolve the quotas enforced when creating employees/numbers."""
    subscription = ensure_subscription(db, organization_id)
    plan = db.get(SubscriptionPlan, subscription.plan_id)
    return {
        "max_employees": plan.max_employees if plan else 1,
        "max_phone_numbers": plan.max_phone_numbers if plan else 1,
        "included_credits": plan.included_credits if plan else 0,
    }


# ---------------------------------------------------------------------------
# Credits
# ---------------------------------------------------------------------------
def ensure_credit_account(
    db: Session, organization_id: str, *, initial_balance: int = 0
) -> CreditAccount:
    account = db.execute(
        select(CreditAccount).where(CreditAccount.organization_id == organization_id)
    ).scalar_one_or_none()
    if account is not None:
        return account

    account = CreditAccount(
        organization_id=organization_id,
        balance=initial_balance,
        lifetime_credits=initial_balance,
        lifetime_used=0,
        low_balance_threshold=100,
    )
    db.add(account)
    db.flush()

    if initial_balance:
        db.add(
            CreditLedger(
                organization_id=organization_id,
                credit_account_id=account.id,
                entry_type=str(LedgerEntryType.CREDIT),
                amount=initial_balance,
                balance_after=initial_balance,
                reason="Trial credits",
            )
        )
    return account


def credit_account_out(db: Session, organization_id: str) -> CreditAccountOut:
    account = ensure_credit_account(db, organization_id)
    db.flush()
    return CreditAccountOut.model_validate(account)


def credit_balance(db: Session, organization_id: str) -> int:
    return ensure_credit_account(db, organization_id).balance


def grant_credits(
    db: Session,
    organization_id: str,
    amount: int,
    *,
    reason: str,
    entry_type: LedgerEntryType | str = LedgerEntryType.CREDIT,
    reference_type: str | None = None,
    reference_id: str | None = None,
    actor_id: str | None = None,
    note: str | None = None,
) -> CreditLedger:
    if amount <= 0:
        raise ConflictError("The credit amount must be positive.")
    account = ensure_credit_account(db, organization_id)
    account.balance += amount
    account.lifetime_credits += amount
    entry = CreditLedger(
        organization_id=organization_id,
        credit_account_id=account.id,
        entry_type=str(entry_type),
        amount=amount,
        balance_after=account.balance,
        reason=reason[:160],
        reference_type=reference_type,
        reference_id=reference_id,
        actor_id=actor_id,
        note=note,
    )
    db.add(entry)
    db.flush()
    return entry


def ensure_credits(db: Session, organization_id: str, amount: int) -> None:
    """Raise ``InsufficientCreditsError`` when the balance is too low."""
    if amount <= 0:
        return
    balance = credit_balance(db, organization_id)
    if balance < amount:
        raise InsufficientCreditsError(
            f"This action needs {amount} credits but only {balance} are available.",
            details={"required": amount, "balance": balance},
        )


def debit_credits(
    db: Session,
    organization_id: str,
    amount: int,
    *,
    reason: str,
    reference_type: str | None = None,
    reference_id: str | None = None,
    actor_id: str | None = None,
    allow_negative: bool = False,
) -> CreditLedger | None:
    """Spend credits and write the ledger row. No-op for a zero amount."""
    if amount <= 0:
        return None
    account = ensure_credit_account(db, organization_id)
    if account.balance < amount and not allow_negative:
        raise InsufficientCreditsError(
            f"This action needs {amount} credits but only {account.balance} are available.",
            details={"required": amount, "balance": account.balance},
        )
    account.balance -= amount
    account.lifetime_used += amount
    entry = CreditLedger(
        organization_id=organization_id,
        credit_account_id=account.id,
        entry_type=str(LedgerEntryType.DEBIT),
        amount=amount,
        balance_after=account.balance,
        reason=reason[:160],
        reference_type=reference_type,
        reference_id=reference_id,
        actor_id=actor_id,
    )
    db.add(entry)
    db.flush()
    return entry


def list_ledger(
    db: Session, organization_id: str, *, limit: int = 50, offset: int = 0
) -> tuple[list[CreditLedgerOut], int]:
    stmt = select(CreditLedger).where(CreditLedger.organization_id == organization_id)
    total = int(
        db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    )
    rows = db.execute(
        stmt.order_by(CreditLedger.created_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    return [CreditLedgerOut.model_validate(row) for row in rows], total


# ---------------------------------------------------------------------------
# Usage metering
# ---------------------------------------------------------------------------
def record_usage(
    db: Session,
    organization_id: str,
    *,
    usage_type: str,
    quantity: int,
    unit: str,
    unit_cost_credits: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    occurred_at: datetime | None = None,
) -> UsageRecord:
    record = UsageRecord(
        organization_id=organization_id,
        usage_type=usage_type[:48],
        quantity=quantity,
        unit=unit[:24],
        unit_cost_credits=unit_cost_credits,
        total_credits=max(0, quantity) * max(0, unit_cost_credits),
        reference_type=reference_type,
        reference_id=reference_id,
        occurred_at=occurred_at or utcnow(),
        usage_metadata=metadata or {},
    )
    db.add(record)
    db.flush()
    return record


def usage_summary(
    db: Session, organization_id: str, start: datetime, end: datetime
) -> UsageSummary:
    rows = db.execute(
        select(
            UsageRecord.usage_type,
            func.sum(UsageRecord.total_credits),
            func.sum(UsageRecord.quantity),
        )
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.occurred_at >= start,
            UsageRecord.occurred_at <= end,
        )
        .group_by(UsageRecord.usage_type)
    ).all()

    by_type: dict[str, int] = {}
    total = 0
    call_minutes = 0
    calls = 0
    for usage_type, credits, quantity in rows:
        by_type[str(usage_type)] = int(credits or 0)
        total += int(credits or 0)
        if usage_type == "call_minute":
            call_minutes += int(quantity or 0)
        if usage_type == "call":
            calls += int(quantity or 0)

    return UsageSummary(
        period_start=start,
        period_end=end,
        total_credits_used=total,
        by_type=by_type,
        call_minutes=call_minutes,
        calls=calls,
    )


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
def purchase_credits(
    db: Session,
    organization_id: str,
    *,
    credits: int,
    amount_inr: int | None = None,
    user_id: str | None = None,
) -> CheckoutResponse:
    """Create a Razorpay order (or a simulated one) for a credit top-up."""
    total = amount_inr or credits * CREDIT_UNIT_PRICE_INR
    receipt = f"cr-{organization_id[:8]}-{int(utcnow().timestamp())}"
    order = razorpay.create_order(
        amount_inr=total,
        receipt=receipt,
        notes={"organization_id": organization_id, "credits": credits},
    )
    payload = order.require("razorpay")

    payment = Payment(
        organization_id=organization_id,
        amount_inr=total,
        currency="INR",
        status="created",
        provider="razorpay",
        provider_order_id=str(payload.get("id") or receipt),
        credits_granted=credits,
        notes=f"Credit purchase of {credits} credits",
    )
    db.add(payment)
    audit.log_action(
        db,
        action="billing.checkout_created",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="payment",
        resource_id=payment.id,
        changes={"credits": credits, "amount_inr": total},
    )
    db.commit()

    return CheckoutResponse(
        order_id=str(payload.get("id") or receipt),
        amount_inr=total,
        currency="INR",
        credits=credits,
        razorpay_key_id=razorpay.public_key(),
        simulated=order.simulated,
        message=(
            "Order created. Confirm the payment to receive the credits."
            if not order.simulated
            else "Razorpay is not configured - the order was simulated."
        ),
    )


def confirm_payment(
    db: Session,
    organization_id: str,
    *,
    order_id: str,
    payment_id: str,
    signature: str | None = None,
    method: str | None = None,
) -> PaymentOut:
    """Verify a checkout result, mark the payment paid and grant credits."""
    payment = db.execute(
        select(Payment).where(
            Payment.organization_id == organization_id,
            Payment.provider_order_id == order_id,
        )
    ).scalar_one_or_none()
    if payment is None:
        raise NotFoundError("Payment order not found.", details={"order_id": order_id})
    if payment.status == "paid":
        return PaymentOut.model_validate(payment)

    if signature and not razorpay.verify_payment_signature(
        order_id=order_id, payment_id=payment_id, signature=signature
    ):
        payment.status = "failed"
        payment.failure_reason = "Signature verification failed"
        db.commit()
        raise ConflictError("The payment signature could not be verified.")

    payment.status = "paid"
    payment.provider_payment_id = payment_id
    payment.method = method
    payment.paid_at = utcnow()

    grant_credits(
        db,
        organization_id,
        payment.credits_granted,
        reason=f"Credit purchase ({payment.credits_granted} credits)",
        reference_type="payment",
        reference_id=payment.id,
        note=payment_id,
    )
    _issue_invoice(db, payment)

    audit.log_action(
        db,
        action="billing.payment_confirmed",
        organization_id=organization_id,
        resource_type="payment",
        resource_id=payment.id,
        changes={"amount_inr": payment.amount_inr, "credits": payment.credits_granted},
    )
    db.commit()
    db.refresh(payment)
    return PaymentOut.model_validate(payment)


def _issue_invoice(db: Session, payment: Payment) -> Invoice:
    """Generate a simple tax invoice for a successful payment."""
    number = f"INV-{utcnow():%Y%m}-{payment.id[:6].upper()}"
    tax = round(payment.amount_inr * 0.18)
    invoice = Invoice(
        organization_id=payment.organization_id,
        number=number,
        amount_inr=payment.amount_inr,
        tax_inr=tax,
        total_inr=payment.amount_inr + tax,
        status="paid",
        issued_at=utcnow(),
        paid_at=payment.paid_at,
        line_items=[
            {
                "description": f"Credit top-up ({payment.credits_granted} credits)",
                "amount_inr": payment.amount_inr,
            }
        ],
    )
    db.add(invoice)
    return invoice


def handle_razorpay_webhook(db: Session, raw_body: bytes, signature: str | None) -> dict[str, Any]:
    """Process ``payment.captured`` / ``payment.failed`` webhook events."""
    if not razorpay.verify_webhook_signature(raw_body, signature):
        raise ConflictError("Invalid Razorpay webhook signature.")
    try:
        body = json.loads(raw_body or b"{}")
    except json.JSONDecodeError as exc:
        raise ConflictError("The webhook payload is not valid JSON.") from exc

    event = str(body.get("event") or "")
    entity = ((body.get("payload") or {}).get("payment") or {}).get("entity") or {}
    order_id = entity.get("order_id")
    payment_id = entity.get("id")
    status = entity.get("status")

    if not order_id:
        return {"event": event, "handled": False, "reason": "missing order_id"}

    payment = db.execute(
        select(Payment).where(Payment.provider_order_id == str(order_id))
    ).scalar_one_or_none()
    if payment is None:
        return {"event": event, "handled": False, "reason": "unknown order"}

    if event == "payment.captured" or status == "captured":
        confirm_payment(
            db,
            payment.organization_id,
            order_id=str(order_id),
            payment_id=str(payment_id or payment.provider_payment_id or ""),
            method=entity.get("method"),
        )
        return {"event": event, "handled": True, "payment_id": payment.id}

    if event == "payment.failed":
        payment.status = "failed"
        payment.failure_reason = str(entity.get("error_description") or "Payment failed")
        db.commit()
        return {"event": event, "handled": True, "payment_id": payment.id}

    return {"event": event, "handled": False}


# ---------------------------------------------------------------------------
# Read models
# ---------------------------------------------------------------------------
def list_payments(
    db: Session, organization_id: str, *, limit: int = 50, offset: int = 0
) -> tuple[list[PaymentOut], int]:
    stmt = select(Payment).where(Payment.organization_id == organization_id)
    total = int(db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one())
    rows = db.execute(
        stmt.order_by(Payment.created_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    return [PaymentOut.model_validate(row) for row in rows], total


def list_invoices(
    db: Session, organization_id: str, *, limit: int = 50, offset: int = 0
) -> tuple[list[InvoiceOut], int]:
    stmt = select(Invoice).where(Invoice.organization_id == organization_id)
    total = int(db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one())
    rows = db.execute(
        stmt.order_by(Invoice.created_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    return [InvoiceOut.model_validate(row) for row in rows], total


def get_invoice(db: Session, organization_id: str, invoice_id: str) -> InvoiceOut:
    invoice = db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id, Invoice.organization_id == organization_id
        )
    ).scalar_one_or_none()
    if invoice is None:
        raise NotFoundError("Invoice not found.", details={"id": invoice_id})
    return InvoiceOut.model_validate(invoice)
