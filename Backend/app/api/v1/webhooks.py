"""Public provider callbacks (no user token - each has its own auth scheme).

These endpoints are intentionally separate from the authenticated routers:

* telephony status/inbound -> shared secret + provider call id
* WhatsApp / Meta -> Meta's GET verification handshake + HMAC signature
* Razorpay -> HMAC signature over the raw body

Every handler is idempotent because providers retry aggressively.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.exceptions import AuthenticationError
from app.core.logging import get_logger
from app.integrations import (
    google_sheets,
    meta_leads,
    razorpay,
    telephony,
    whatsapp,
)
from app.modules import billing, calls, leads
from app.schemas.call import CallWebhookPayload, InboundCallPayload

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Telephony
# ---------------------------------------------------------------------------
@router.post(
    "/telephony/status",
    summary="Provider call-status callback",
    status_code=status.HTTP_200_OK,
)
def telephony_status(
    payload: CallWebhookPayload,
    db: DbSession,
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    token: str | None = Query(default=None),
) -> dict[str, Any]:
    if not telephony.verify_webhook_secret(x_webhook_secret or token):
        raise AuthenticationError("Invalid telephony webhook secret.")

    call = calls.handle_webhook(db, payload)
    if call is None:
        # Acknowledge unknown events so the provider stops retrying them.
        return {"received": True, "matched": False}
    return {
        "received": True,
        "matched": True,
        "call_id": call.id,
        "status": call.status,
        "outcome": call.outcome,
    }


@router.post(
    "/telephony/inbound",
    summary="Provider inbound-call callback (returns the agent to bridge to)",
    status_code=status.HTTP_200_OK,
)
def telephony_inbound(
    payload: InboundCallPayload,
    db: DbSession,
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    token: str | None = Query(default=None),
) -> dict[str, Any]:
    if not telephony.verify_webhook_secret(x_webhook_secret or token):
        raise AuthenticationError("Invalid telephony webhook secret.")

    call = calls.register_inbound_call(db, payload)
    employee = call.employee_id
    return {
        "received": True,
        "call_id": call.id,
        "employee_id": employee,
        "language": call.language,
        "greeting": (call.metadata_json or {}).get("greeting"),
        "agent_config_url": f"/api/v1/employees/{employee}/agent-config" if employee else None,
    }


# ---------------------------------------------------------------------------
# WhatsApp
# ---------------------------------------------------------------------------
@router.get("/whatsapp", summary="WhatsApp webhook verification handshake")
def whatsapp_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> Response:
    answer = whatsapp.verify_webhook(hub_mode, hub_token, hub_challenge)
    if answer is None:
        raise AuthenticationError("WhatsApp verification failed.")
    return Response(content=answer, media_type="text/plain")


@router.post("/whatsapp", summary="WhatsApp inbound message")
def whatsapp_inbound(request: Request, db: DbSession, body: dict[str, Any]) -> dict[str, Any]:
    """Log the delivery; replies are handled by the automation layer."""
    logger.info("whatsapp_webhook_received", keys=sorted(body))
    return {"received": True}


# ---------------------------------------------------------------------------
# Meta Lead Ads
# ---------------------------------------------------------------------------
@router.get("/meta/leads", summary="Meta Lead Ads verification handshake")
def meta_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> Response:
    answer = meta_leads.verify_challenge(hub_mode, hub_token, hub_challenge)
    if answer is None:
        raise AuthenticationError("Meta verification failed.")
    return Response(content=answer, media_type="text/plain")


@router.post("/meta/leads", summary="Meta Lead Ads new-lead callback")
async def meta_inbound(
    request: Request,
    db: DbSession,
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
) -> dict[str, Any]:
    raw = await request.body()
    if not meta_leads.verify_signature(raw, x_hub_signature_256):
        raise AuthenticationError("Invalid Meta signature.")

    body = await request.json()
    imported = 0
    for leadgen_id in meta_leads.extract_leadgen_ids(body):
        response = meta_leads.fetch_lead(leadgen_id)
        fields = meta_leads.to_lead_fields(meta_leads.parse_field_data(response.data))
        if not fields.get("phone"):
            continue
        leads.upsert_inbound_lead(
            db,
            _organization_for_webhook(db),
            phone=fields["phone"],
            name=fields.get("full_name"),
        )
        imported += 1

    return {"received": True, "leads": imported}


# ---------------------------------------------------------------------------
# Razorpay
# ---------------------------------------------------------------------------
@router.post("/razorpay", summary="Razorpay payment webhook")
async def razorpay_inbound(
    request: Request,
    db: DbSession,
    x_razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
) -> dict[str, Any]:
    raw = await request.body()
    if not razorpay.verify_webhook_signature(raw, x_razorpay_signature):
        raise AuthenticationError("Invalid Razorpay signature.")
    return billing.handle_razorpay_webhook(db, raw, x_razorpay_signature)


# ---------------------------------------------------------------------------
# n8n / sheets round-trip helpers
# ---------------------------------------------------------------------------
@router.post("/n8n", summary="Generic n8n callback (records the event)")
def n8n_inbound(body: dict[str, Any]) -> dict[str, Any]:
    logger.info("n8n_callback_received", keys=sorted(body))
    return {"received": True}


@router.get("/sheets/rows", summary="Rows from the configured Google Sheet")
def sheets_rows(limit: int = Query(100, ge=1, le=1000)) -> dict[str, Any]:
    rows = google_sheets.fetch_rows()[:limit]
    return {
        "rows": rows,
        "count": len(rows),
        "configured": google_sheets.configured(),
    }


def _organization_for_webhook(db: Session) -> Any:
    """Resolve the tenant for provider webhooks that carry no tenant id.

    Single-tenant deployments (the common self-hosted case) have exactly one
    organization. Multi-tenant deployments must configure per-provider
    organizations in the integration record.
    """
    from sqlalchemy import select

    from app.core.exceptions import ConflictError
    from app.database.models.organization import Organization

    rows = list(db.execute(select(Organization).limit(2)).scalars())
    if not rows:
        raise ConflictError("No organization exists to receive this webhook.")
    if len(rows) > 1:
        raise ConflictError(
            "This deployment has multiple organizations; configure the webhook per tenant."
        )
    return rows[0]
