"""Outbound/inbound telephony control.

The platform dials through a **SIP gateway bridge**: any HTTP endpoint that
accepts a JSON dial request and answers with ``{"call_id": "..."}`` works
(Sarvam SIP trunk bridge, Exotel, Twilio Function, a custom FreeSWITCH shim).

Behaviour matrix:

===========================  =========================================
Configuration                Result
===========================  =========================================
``TELEPHONY_PROVIDER=mock``  Simulated call, deterministic id
SIP domain is an HTTP URL     Real dial request against the bridge
SIP configured but no bridge  ``ProviderNotConfiguredError`` (503)
Nothing configured            Simulated call (demo mode)
===========================  =========================================
"""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import settings
from app.core.exceptions import ProviderNotConfiguredError
from app.core.logging import get_logger
from app.integrations import ProviderResponse, request_json, simulated

logger = get_logger(__name__)

PROVIDER = "telephony"
MOCK_PROVIDERS = frozenset({"mock", "simulator", ""})


def provider_code() -> str:
    return (settings.telephony_provider or "mock").strip().lower()


def is_mock() -> bool:
    return provider_code() in MOCK_PROVIDERS


def _bridge_url() -> str:
    return (settings.telephony_sip_domain or "").strip()


def configured() -> bool:
    """True when a real dial path exists."""
    if is_mock():
        return False
    return _bridge_url().startswith(("http://", "https://"))


def status() -> dict[str, Any]:
    return {
        "provider": provider_code(),
        "configured": configured(),
        "mock": is_mock(),
        "bridge": bool(_bridge_url()),
        "outbound_enabled": settings.telephony_outbound_enabled or is_mock(),
    }


def place_call(
    *,
    to_number: str,
    from_number: str | None,
    agent_config: dict[str, Any],
    webhook_url: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> ProviderResponse:
    """Dial a number and hand the call to the AI agent.

    ``agent_config`` carries the resolved employee settings (prompt, voice,
    languages) so the bridge can start the media stream without a callback.
    """
    if not settings.telephony_outbound_enabled and not is_mock():
        return simulated(
            PROVIDER,
            {
                "provider_call_id": _mock_call_id(),
                "status": "simulated",
                "reason": "TELEPHONY_OUTBOUND_ENABLED is false",
            },
        )

    if is_mock():
        return simulated(
            PROVIDER,
            {
                "provider_call_id": _mock_call_id(),
                "status": "queued",
                "to_number": to_number,
                "from_number": from_number,
            },
        )

    if not configured():
        raise ProviderNotConfiguredError(
            "Outbound dialling needs TELEPHONY_SIP_DOMAIN to be an HTTP bridge URL. "
            "Set TELEPHONY_PROVIDER=mock to run in demo mode.",
            details={"provider": provider_code()},
        )

    body = {
        "to": to_number,
        "from": from_number,
        "agent": agent_config,
        "webhook_url": webhook_url,
        "metadata": metadata or {},
        "sip": {
            "domain": settings.telephony_sip_domain,
            "username": settings.telephony_sip_username,
        },
    }
    result = request_json(
        "POST",
        f"{_bridge_url().rstrip('/')}/calls",
        provider=PROVIDER,
        headers=_auth_headers(),
        json_body=body,
        timeout=30.0,
    )
    if result.ok:
        call_id = (
            result.data.get("call_id")
            or result.data.get("provider_call_id")
            or (result.data.get("data") or {}).get("call_id")
            or _mock_call_id()
        )
        result.data["provider_call_id"] = str(call_id)
    return result


def hangup(provider_call_id: str) -> ProviderResponse:
    """Ask the bridge to terminate an active call."""
    if is_mock() or not configured():
        return simulated(PROVIDER, {"provider_call_id": provider_call_id, "status": "ended"})

    return request_json(
        "POST",
        f"{_bridge_url().rstrip('/')}/calls/{provider_call_id}/hangup",
        provider=PROVIDER,
        headers=_auth_headers(),
        timeout=15.0,
    )


def transfer_to_human(provider_call_id: str, destination: str) -> ProviderResponse:
    """Blind-transfer an active call to a human agent."""
    if is_mock() or not configured():
        return simulated(
            PROVIDER,
            {"provider_call_id": provider_call_id, "transferred_to": destination},
        )

    return request_json(
        "POST",
        f"{_bridge_url().rstrip('/')}/calls/{provider_call_id}/transfer",
        provider=PROVIDER,
        headers=_auth_headers(),
        json_body={"destination": destination},
        timeout=15.0,
    )


def _auth_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if settings.telephony_sip_username and settings.telephony_sip_password:
        token = f"{settings.telephony_sip_username}:{settings.telephony_sip_password}"
        import base64

        headers["Authorization"] = "Basic " + base64.b64encode(token.encode()).decode()
    return headers


def _mock_call_id() -> str:
    return f"mock-{uuid.uuid4().hex[:16]}"


def verify_webhook_secret(token: str | None) -> bool:
    """Validate the shared secret that providers must echo back."""
    expected = (settings.telephony_webhook_secret or "").strip()
    if not expected or expected == "change-me":
        return True  # dev default: accept unsigned callbacks
    return bool(token) and token == expected
