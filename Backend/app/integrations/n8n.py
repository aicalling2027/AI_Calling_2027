"""n8n automation adapter.

n8n owns the cross-system orchestration (lead routing, CRM sync, follow-up
scheduling). The backend only pushes events at it, so a workflow can be edited
without redeploying the API.
"""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.integrations import ProviderResponse, request_json, simulated

PROVIDER = "n8n"


def configured() -> bool:
    return settings.enabled(settings.n8n_base_url) and (
        settings.enabled(settings.n8n_lead_webhook_url)
        or settings.enabled(settings.n8n_followup_webhook_url)
        or settings.enabled(settings.n8n_api_key)
    )


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if settings.n8n_api_key:
        headers["Authorization"] = f"Bearer {settings.n8n_api_key}"
    return headers


def trigger(webhook_url: str, payload: dict[str, Any]) -> ProviderResponse:
    """POST an event to an n8n webhook trigger."""
    if not webhook_url:
        return simulated(PROVIDER, {"event": payload.get("event")})

    return request_json(
        "POST", webhook_url, provider=PROVIDER, headers=_headers(), json_body=payload, timeout=15.0
    )


def emit_lead_created(payload: dict[str, Any]) -> ProviderResponse:
    return trigger(settings.n8n_lead_webhook_url, {"event": "lead.created", **payload})


def emit_call_completed(payload: dict[str, Any]) -> ProviderResponse:
    return trigger(settings.n8n_lead_webhook_url, {"event": "call.completed", **payload})


def emit_followup_due(payload: dict[str, Any]) -> ProviderResponse:
    return trigger(settings.n8n_followup_webhook_url, {"event": "followup.due", **payload})


def emit_campaign_finished(payload: dict[str, Any]) -> ProviderResponse:
    return trigger(settings.n8n_followup_webhook_url, {"event": "campaign.finished", **payload})


def list_workflows(limit: int = 50) -> ProviderResponse:
    """Read workflows from the n8n public API (requires an API key)."""
    if not settings.enabled(settings.n8n_base_url, settings.n8n_api_key):
        return simulated(PROVIDER, {"data": []})

    return request_json(
        "GET",
        f"{settings.n8n_base_url.rstrip('/')}/api/v1/workflows",
        provider=PROVIDER,
        headers={"X-N8N-API-KEY": settings.n8n_api_key},
        params={"limit": limit},
        timeout=15.0,
    )


def activate_workflow(workflow_id: str) -> ProviderResponse:
    if not settings.enabled(settings.n8n_base_url, settings.n8n_api_key):
        return simulated(PROVIDER, {"id": workflow_id, "active": True})

    return request_json(
        "PATCH",
        f"{settings.n8n_base_url.rstrip('/')}/api/v1/workflows/{workflow_id}",
        provider=PROVIDER,
        headers={"X-N8N-API-KEY": settings.n8n_api_key, "Content-Type": "application/json"},
        json_body={"active": True},
        timeout=15.0,
    )
