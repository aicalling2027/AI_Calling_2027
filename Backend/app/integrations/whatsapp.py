"""WhatsApp Business Cloud API adapter (notifications + catalogs)."""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.integrations import ProviderResponse, bearer, request_json, simulated

PROVIDER = "whatsapp"


def configured() -> bool:
    return settings.enabled(settings.whatsapp_phone_number_id, settings.whatsapp_access_token)


def _url(path: str = "messages") -> str:
    base = f"https://graph.facebook.com/{settings.whatsapp_api_version}"
    return f"{base}/{settings.whatsapp_phone_number_id}/{path}"


def _headers() -> dict[str, str]:
    headers = bearer(settings.whatsapp_access_token)
    headers["Content-Type"] = "application/json"
    return headers


def send_text(to: str, body: str) -> ProviderResponse:
    """Send a free-form text message (valid inside a 24-hour session)."""
    if not configured():
        return simulated(PROVIDER, {"to": to, "type": "text"})

    return request_json(
        "POST",
        _url(),
        provider=PROVIDER,
        headers=_headers(),
        json_body={
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.lstrip("+"),
            "type": "text",
            "text": {"preview_url": False, "body": body[:4000]},
        },
    )


def send_template(
    to: str,
    template: str,
    *,
    language: str = "en",
    parameters: list[str] | None = None,
) -> ProviderResponse:
    """Send an approved template message (required outside the 24-hour window)."""
    if not configured():
        return simulated(PROVIDER, {"to": to, "template": template})

    components: list[dict[str, Any]] = []
    if parameters:
        components.append(
            {
                "type": "body",
                "parameters": [{"type": "text", "text": str(value)} for value in parameters],
            }
        )

    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),
        "type": "template",
        "template": {"name": template, "language": {"code": language}},
    }
    if components:
        payload["template"]["components"] = components

    return request_json("POST", _url(), provider=PROVIDER, headers=_headers(), json_body=payload)


def send_lead_followup(
    to: str, *, name: str, employee: str, business: str, summary: str
) -> ProviderResponse:
    """Business default: confirm the enquiry on WhatsApp right after a call."""
    body = (
        f"Hello {name}, thank you for speaking with {employee} from {business}.\n\n"
        f"{summary}\n\n"
        "Reply to this message if you would like us to call you again."
    )
    return send_text(to, body)


def send_document(to: str, *, link: str, filename: str, caption: str | None = None) -> ProviderResponse:
    if not configured():
        return simulated(PROVIDER, {"to": to, "link": link})

    document: dict[str, Any] = {"link": link, "filename": filename}
    if caption:
        document["caption"] = caption
    return request_json(
        "POST",
        _url(),
        provider=PROVIDER,
        headers=_headers(),
        json_body={
            "messaging_product": "whatsapp",
            "to": to.lstrip("+"),
            "type": "document",
            "document": document,
        },
    )


def verify_webhook(mode: str | None, token: str | None, challenge: str | None) -> str | None:
    """Complete Meta's GET verification handshake."""
    if mode == "subscribe" and token and token == settings.whatsapp_verify_token:
        return challenge or ""
    return None
