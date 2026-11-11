"""Zoom adapter - creates meeting links for booked appointments.

Uses Zoom's server-to-server OAuth (account credentials), which needs no
user interaction once the app is published internally.
"""

from __future__ import annotations

import base64
import time
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations import ProviderResponse, request_json, simulated

logger = get_logger(__name__)

PROVIDER = "zoom"
TOKEN_URL = "https://zoom.us/oauth/token"
API_URL = "https://api.zoom.us/v2"

_token_cache: dict[str, Any] = {"token": None, "expires_at": 0.0}


def configured() -> bool:
    return settings.enabled(
        settings.zoom_account_id, settings.zoom_client_id, settings.zoom_client_secret
    )


def get_access_token(force: bool = False) -> str | None:
    """Fetch (and cache) a server-to-server OAuth token."""
    if not configured():
        return None
    if not force and _token_cache["token"] and _token_cache["expires_at"] > time.time():
        return str(_token_cache["token"])

    basic = base64.b64encode(
        f"{settings.zoom_client_id}:{settings.zoom_client_secret}".encode()
    ).decode()
    result = request_json(
        "POST",
        TOKEN_URL,
        provider=PROVIDER,
        headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
        params={"grant_type": "account_credentials", "account_id": settings.zoom_account_id},
        timeout=20.0,
    )
    if not result.ok:
        logger.warning("zoom_token_failed", error=result.error)
        return None

    token = result.data.get("access_token")
    expires_in = int(result.data.get("expires_in") or 3600)
    _token_cache["token"] = token
    _token_cache["expires_at"] = time.time() + max(60, expires_in - 60)
    return str(token) if token else None


def create_meeting(
    *,
    topic: str,
    start_time: str | None = None,
    duration_minutes: int = 30,
    agenda: str | None = None,
    timezone_name: str = "Asia/Kolkata",
) -> ProviderResponse:
    """Schedule a Zoom meeting and return its join URL."""
    token = get_access_token()
    if not token:
        return simulated(
            PROVIDER,
            {
                "join_url": "https://zoom.us/j/simulated",
                "meeting_id": "simulated",
                "topic": topic,
            },
        )

    body: dict[str, Any] = {
        "topic": topic[:200],
        "type": 2 if start_time else 1,
        "duration": max(15, duration_minutes),
        "timezone": timezone_name,
        "agenda": (agenda or "")[:2000],
        "settings": {"join_before_host": True, "waiting_room": False, "mute_upon_entry": True},
    }
    if start_time:
        body["start_time"] = start_time

    result = request_json(
        "POST",
        f"{API_URL}/users/me/meetings",
        provider=PROVIDER,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json_body=body,
        timeout=25.0,
    )
    if result.ok:
        result.data.setdefault("join_url", result.data.get("join_url"))
    return result


def status() -> dict[str, Any]:
    return {
        "configured": configured(),
        "token_cached": bool(_token_cache["token"]),
    }
