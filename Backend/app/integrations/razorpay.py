"""Razorpay adapter - subscriptions, credit top-ups and webhook verification.

All amounts are converted to paise here and nowhere else; the rest of the
codebase deals in whole INR integers.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import math
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations import ProviderResponse, request_json, simulated

logger = get_logger(__name__)

PROVIDER = "razorpay"
API_URL = "https://api.razorpay.com/v1"


def configured() -> bool:
    return settings.enabled(settings.razorpay_key_id, settings.razorpay_key_secret)


def _headers() -> dict[str, str]:
    token = base64.b64encode(
        f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()
    ).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


def to_paise(amount_inr: int | float) -> int:
    """Convert whole/partial rupees to paise, rounding up to the nearest paise."""
    return int(math.ceil(float(amount_inr) * 100))


def create_order(
    *,
    amount_inr: int,
    receipt: str,
    notes: dict[str, Any] | None = None,
    currency: str = "INR",
) -> ProviderResponse:
    """Create a payment order for a credit top-up."""
    if not configured():
        return simulated(
            PROVIDER,
            {
                "id": f"order_sim_{receipt}",
                "amount": to_paise(amount_inr),
                "currency": currency,
                "receipt": receipt,
            },
        )

    return request_json(
        "POST",
        f"{API_URL}/orders",
        provider=PROVIDER,
        headers=_headers(),
        json_body={
            "amount": to_paise(amount_inr),
            "currency": currency,
            "receipt": receipt[:40],
            "notes": notes or {},
            "payment_capture": 1,
        },
        timeout=25.0,
    )


def fetch_payment(payment_id: str) -> ProviderResponse:
    if not configured():
        return simulated(PROVIDER, {"id": payment_id, "status": "captured"})

    return request_json("GET", f"{API_URL}/payments/{payment_id}", provider=PROVIDER, headers=_headers())


def verify_payment_signature(
    *, order_id: str, payment_id: str, signature: str
) -> bool:
    """Verify the checkout handler's ``razorpay_signature``."""
    secret = (settings.razorpay_key_secret or "").strip()
    if not secret:
        return True  # demo mode: nothing to verify against
    expected = hmac.new(
        secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    """Verify the ``X-Razorpay-Signature`` header on webhook calls."""
    secret = (settings.razorpay_webhook_secret or "").strip()
    if not secret:
        return True
    if not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def public_key() -> str | None:
    """Key id handed to the frontend checkout widget."""
    return settings.razorpay_key_id or None


def status() -> dict[str, Any]:
    return {
        "configured": configured(),
        "webhook_secret": bool(settings.razorpay_webhook_secret),
        "key_id": settings.razorpay_key_id or None,
    }
