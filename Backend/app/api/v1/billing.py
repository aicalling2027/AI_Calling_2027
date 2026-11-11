"""Billing: plans, subscription, credits, usage, payments and invoices."""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, Principal, require_permissions
from app.core.constants import Perm
from app.modules import billing
from app.schemas.billing import (
    ChangeSubscriptionRequest,
    CheckoutResponse,
    CreditAccountOut,
    CreditLedgerOut,
    InvoiceOut,
    PaymentOut,
    PlanOut,
    PurchaseCreditsRequest,
    SubscriptionDetail,
    UsageSummary,
)
from app.schemas.common import Page
from app.utils.datetime_utils import utcnow

router = APIRouter(prefix="/billing", tags=["Billing"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.BILLING_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.BILLING_WRITE))]


@router.get("/plans", response_model=list[PlanOut], summary="Available plans")
def list_plans(db: DbSession) -> list[PlanOut]:
    return [billing.plan_out(plan) for plan in billing.list_plans(db)]


@router.get("/subscription", response_model=SubscriptionDetail, summary="Current subscription")
def get_subscription(principal: Reader, db: DbSession) -> SubscriptionDetail:
    return billing.subscription_detail(db, principal.organization_id)


@router.post(
    "/subscription/change", response_model=SubscriptionDetail, summary="Change plan"
)
def change_plan(
    payload: ChangeSubscriptionRequest, principal: Writer, db: DbSession
) -> SubscriptionDetail:
    return billing.change_plan(
        db, principal.organization_id, payload.plan_code, user_id=principal.user_id
    )


@router.post(
    "/subscription/cancel", response_model=SubscriptionDetail, summary="Cancel at period end"
)
def cancel_subscription(
    principal: Writer, db: DbSession, immediate: bool = False
) -> SubscriptionDetail:
    return billing.cancel_subscription(
        db, principal.organization_id, immediate=immediate, user_id=principal.user_id
    )


@router.post(
    "/subscription/resume", response_model=SubscriptionDetail, summary="Undo a cancellation"
)
def resume_subscription(principal: Writer, db: DbSession) -> SubscriptionDetail:
    return billing.resume_subscription(db, principal.organization_id, user_id=principal.user_id)


@router.get("/credits", response_model=CreditAccountOut, summary="Credit balance")
def credit_account(principal: Reader, db: DbSession) -> CreditAccountOut:
    return billing.credit_account_out(db, principal.organization_id)


@router.get("/credits/ledger", response_model=Page[CreditLedgerOut], summary="Credit ledger")
def credit_ledger(
    principal: Reader,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[CreditLedgerOut]:
    rows, total = billing.list_ledger(
        db, principal.organization_id, limit=page_size, offset=(page - 1) * page_size
    )
    return Page[CreditLedgerOut].build(rows, total=total, page=page, page_size=page_size)


@router.post(
    "/credits/purchase", response_model=CheckoutResponse, summary="Buy credits"
)
def purchase_credits(
    payload: PurchaseCreditsRequest, principal: Writer, db: DbSession
) -> CheckoutResponse:
    return billing.purchase_credits(
        db,
        principal.organization_id,
        credits=payload.credits,
        amount_inr=payload.amount_inr,
        user_id=principal.user_id,
    )


@router.get("/usage", response_model=UsageSummary, summary="Usage in a period")
def usage_summary(
    principal: Reader,
    db: DbSession,
    days: int = Query(30, ge=1, le=365),
) -> UsageSummary:
    end = utcnow()
    return billing.usage_summary(db, principal.organization_id, end - timedelta(days=days), end)


@router.get("/payments", response_model=Page[PaymentOut], summary="Payment history")
def list_payments(
    principal: Reader,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[PaymentOut]:
    rows, total = billing.list_payments(
        db, principal.organization_id, limit=page_size, offset=(page - 1) * page_size
    )
    return Page[PaymentOut].build(rows, total=total, page=page, page_size=page_size)


@router.get("/invoices", response_model=Page[InvoiceOut], summary="Invoices")
def list_invoices(
    principal: Reader,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[InvoiceOut]:
    rows, total = billing.list_invoices(
        db, principal.organization_id, limit=page_size, offset=(page - 1) * page_size
    )
    return Page[InvoiceOut].build(rows, total=total, page=page, page_size=page_size)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut, summary="Download one invoice")
def get_invoice(invoice_id: str, principal: Reader, db: DbSession) -> InvoiceOut:
    return billing.get_invoice(db, principal.organization_id, invoice_id)


@router.post(
    "/payments/{order_id}/confirm",
    response_model=PaymentOut,
    summary="Confirm a checkout (server-to-server or after the Razorpay popup)",
)
def confirm_payment(
    order_id: str,
    principal: Writer,
    db: DbSession,
    payment_id: str = Query(..., min_length=4),
    signature: str | None = Query(None),
    method: str | None = Query(None),
) -> PaymentOut:
    return billing.confirm_payment(
        db,
        principal.organization_id,
        order_id=order_id,
        payment_id=payment_id,
        signature=signature,
        method=method,
    )


@router.get("/limits", summary="Plan limits enforced on this workspace")
def plan_limits(principal: Reader, db: DbSession) -> dict[str, int]:
    return billing.plan_limits(db, principal.organization_id)
