"""Calendly adapter - appointment booking links and event reads."""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.integrations import ProviderResponse, bearer, request_json, simulated

PROVIDER = "calendly"
BASE_URL = "https://api.calendly.com"


def configured() -> bool:
    return settings.enabled(settings.calendly_api_token)


def _headers() -> dict[str, str]:
    headers = bearer(settings.calendly_api_token)
    headers["Content-Type"] = "application/json"
    return headers


def me() -> ProviderResponse:
    """Health check + owner URI discovery."""
    if not configured():
        return simulated(PROVIDER, {"resource": {"uri": "simulated://calendly/user"}})

    return request_json("GET", f"{BASE_URL}/users/me", provider=PROVIDER, headers=_headers())


def create_scheduling_link(*, max_event_count: int = 1) -> ProviderResponse:
    """Create a single-use booking link for the configured event type.

    The URL is handed to the caller by the agent (or on WhatsApp) so the booking
    happens on Calendly's side and lands in the calendar automatically.
    """
    if not configured() or not settings.calendly_event_type_uri:
        return simulated(
            PROVIDER,
            {
                "booking_url": "https://calendly.com/own-ai/demo",
                "note": "Configure CALENDLY_API_TOKEN and CALENDLY_EVENT_TYPE_URI for live links",
            },
        )

    body: dict[str, Any] = {
        "max_event_count": max_event_count,
        "owner": settings.calendly_event_type_uri,
        "owner_type": "EventType",
    }
    result = request_json(
        "POST", f"{BASE_URL}/scheduling_links", provider=PROVIDER, headers=_headers(), json_body=body
    )
    if result.ok:
        resource = result.data.get("resource") or {}
        result.data["booking_url"] = resource.get("booking_url")
    return result


def list_scheduled_events(*, count: int = 20) -> ProviderResponse:
    """Read upcoming Calendly events (requires the organization URI)."""
    if not configured():
        return simulated(PROVIDER, {"collection": []})

    return request_json(
        "GET",
        f"{BASE_URL}/scheduled_events",
        provider=PROVIDER,
        headers=_headers(),
        params={"count": count, "status": "active", "sort": "start_time:asc"},
    )
