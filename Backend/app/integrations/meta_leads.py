"""Meta Lead Ads adapter - instant lead capture from Facebook/Instagram forms."""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

from app.core.config import settings
from app.integrations import ProviderResponse, request_json, simulated

PROVIDER = "meta_lead_ads"
GRAPH_VERSION = "v21.0"
GRAPH_URL = f"https://graph.facebook.com/{GRAPH_VERSION}"


def configured() -> bool:
    return settings.enabled(settings.meta_page_access_token)


def verify_challenge(mode: str | None, token: str | None, challenge: str | None) -> str | None:
    """Answer Meta's webhook verification GET request."""
    if mode == "subscribe" and token and token == settings.meta_verify_token:
        return challenge or ""
    return None


def verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Validate the ``X-Hub-Signature-256`` header when an app secret is set."""
    secret = (settings.meta_app_secret or "").strip()
    if not secret:
        return True  # dev mode: app secret not configured yet
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


def fetch_lead(leadgen_id: str) -> ProviderResponse:
    """Fetch the submitted field data for a lead-generation id."""
    if not configured():
        return simulated(PROVIDER, {"field_data": [], "leadgen_id": leadgen_id})

    return request_json(
        "GET",
        f"{GRAPH_URL}/{leadgen_id}",
        provider=PROVIDER,
        params={"access_token": settings.meta_page_access_token},
        timeout=20.0,
    )


def parse_field_data(payload: dict[str, Any]) -> dict[str, str]:
    """Flatten Meta's ``field_data`` array into a simple dictionary."""
    fields: dict[str, str] = {}
    for item in payload.get("field_data") or []:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        values = item.get("values")
        if not name or not values:
            continue
        fields[str(name).lower()] = str(values[0]) if isinstance(values, list) else str(values)
    return fields


def extract_leadgen_ids(body: dict[str, Any]) -> list[str]:
    """Pull every ``leadgen_id`` out of a webhook payload."""
    ids: list[str] = []
    for entry in body.get("entry") or []:
        for change in entry.get("changes") or []:
            value = (change or {}).get("value") or {}
            leadgen_id = value.get("leadgen_id")
            if leadgen_id:
                ids.append(str(leadgen_id))
    return ids


def to_lead_fields(fields: dict[str, str]) -> dict[str, Any]:
    """Map Meta form fields onto our contact/lead shape."""
    phone = fields.get("phone_number") or fields.get("phone") or fields.get("mobile")
    name = fields.get("full_name") or fields.get("name") or ""
    if not name:
        first = fields.get("first_name", "")
        last = fields.get("last_name", "")
        name = f"{first} {last}".strip()
    return {
        "full_name": name or "Meta Lead",
        "phone": phone or "",
        "email": fields.get("email"),
        "city": fields.get("city"),
        "custom_fields": {
            key: value
            for key, value in fields.items()
            if key not in {"full_name", "name", "first_name", "last_name", "email", "city", "phone_number", "phone"}
        },
    }
