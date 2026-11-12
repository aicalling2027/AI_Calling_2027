"""Sarvam Voice Agents (Samvaad) deployment adapter.

The Voice Agents API does not author an agent: an agent is built in the Sarvam
workspace and identified by ``app_id`` + ``app_version``. What the API can do
programmatically is *deploy* that agent onto a telephony connection, so
"create an AI employee" maps to "create a deployment" here.

There is deliberately no ``delete`` helper. Removing an employee pauses its
deployment so the provider keeps the call history, transcripts and the phone
number binding that a re-created agent would lose.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from app.core.config import settings
from app.integrations import ProviderResponse, request_json, simulated

PROVIDER = "sarvam-voice-agents"

#: Provider rule for deployment names: alphanumeric, hyphens, underscores and
#: spaces only, 50 characters at most.
_UNSAFE_NAME = re.compile(r"[^A-Za-z0-9 _-]+")


def _api_key() -> str:
    """The workspace key, falling back to the account key for single-key setups."""
    return str(settings.sarvam_agents_api_key or settings.sarvam_api_key or "").strip()


def configured() -> bool:
    """True when the workspace can be addressed and the deployed agent is known."""
    return settings.enabled(
        _api_key(),
        settings.sarvam_org_id,
        settings.sarvam_workspace_id,
        settings.sarvam_agent_app_id,
    )


#: Reading the workspace needs the workspace key and the two ids - but no agent
#: id, because the agents are what the call returns.
_WORKSPACE_FIELDS = ("sarvam_agents_api_key", "sarvam_org_id", "sarvam_workspace_id")


def missing_workspace_settings() -> list[str]:
    """Env var names still empty, in the order they should be filled in."""
    return [
        field.upper()
        for field in _WORKSPACE_FIELDS
        if not str(getattr(settings, field, "") or "").strip()
    ]


def _headers() -> dict[str, str]:
    return {
        "X-API-Key": _api_key(),
        "Content-Type": "application/json",
    }


def _deployments_url(*segments: str) -> str:
    root = settings.sarvam_agents_base_url.rstrip("/")
    tail = f"/{'/'.join(segments)}" if segments else ""
    return (
        f"{root}/v1/orgs/{settings.sarvam_org_id}"
        f"/workspaces/{settings.sarvam_workspace_id}/deployments{tail}"
    )


def deployment_name(employee_name: str, employee_id: str) -> str:
    """A provider-safe deployment name that stays unique per employee."""
    cleaned = " ".join(_UNSAFE_NAME.sub(" ", employee_name).split()) or "AI employee"
    suffix = employee_id.replace("-", "")[-8:]
    return f"{cleaned[:39].strip()} {suffix}"[:50]


def simulated_deployment_id(employee_id: str) -> str:
    """Deterministic stand-in reference, so repeat runs look like one agent."""
    digest = hashlib.sha256(employee_id.encode("utf-8")).hexdigest()[:12]
    return f"dep-sim-{digest}"


def provision(
    *, employee_name: str, employee_id: str, description: str | None = None
) -> ProviderResponse:
    """Deploy the workspace agent onto its number for this employee."""
    name = deployment_name(employee_name, employee_id)

    if not configured():
        return simulated(
            PROVIDER,
            {
                "deployment_id": simulated_deployment_id(employee_id),
                "app_id": settings.sarvam_agent_app_id or "aotms-voice-agent",
                "app_version": settings.sarvam_agent_app_version,
                "status": "simulated",
                "name": name,
            },
        )

    number = (settings.sarvam_agent_phone_number or "").strip()
    if not number or not settings.sarvam_connection_id:
        # A deployment is agent + connection + number; without them the API can
        # only reject the call, so fail here with an actionable message.
        return ProviderResponse(
            ok=False,
            error=(
                "Set SARVAM_CONNECTION_ID and SARVAM_AGENT_PHONE_NUMBER so Sarvam "
                "can deploy this agent on a number."
            ),
        )

    body: dict[str, Any] = {
        "name": name,
        "app_id": settings.sarvam_agent_app_id,
        "app_version": settings.sarvam_agent_app_version,
        "connection_configs": [
            {
                "connection_id": settings.sarvam_connection_id,
                "agent_phone_number": number,
            }
        ],
    }
    if description:
        body["description"] = description[:150]

    result = request_json(
        "POST",
        _deployments_url(),
        provider=PROVIDER,
        headers=_headers(),
        json_body=body,
        timeout=float(settings.sarvam_timeout_seconds),
    )
    if result.ok:
        result.data.setdefault("status", "active")
    return result


def list_deployments(*, page_size: int = 100, max_pages: int = 10) -> ProviderResponse:
    """Every deployment already living in the Sarvam workspace.

    This is the only programmatic view of an agent: Voice Agents has no "list
    agents" call, an agent becomes addressable through the deployment that
    binds it to a number. Read-only - nothing is created or deleted.
    """
    missing = missing_workspace_settings()
    if missing:
        return ProviderResponse(
            ok=False,
            error=(
                "The voice agent workspace is not addressed yet - set "
                f"{', '.join(missing)} in the backend environment."
            ),
            status_code=503,
        )

    items: list[dict[str, Any]] = []
    offset = 0
    for _ in range(max(1, max_pages)):
        result = request_json(
            "GET",
            _deployments_url(),
            provider=PROVIDER,
            headers=_headers(),
            params={
                "offset": offset,
                "limit": page_size,
                "sort_by": "created_at",
                "sort_order": "asc",
            },
            timeout=float(settings.sarvam_timeout_seconds),
            retries=1,
        )
        if not result.ok:
            return result

        batch = [item for item in (result.data.get("items") or []) if isinstance(item, dict)]
        items.extend(batch)
        offset += len(batch)
        total = int(result.data.get("total") or 0)
        if len(batch) < page_size or offset >= total:
            break

    return ProviderResponse(ok=True, data={"items": items, "total": len(items)})


def set_status(deployment_id: str, *, action: str) -> ProviderResponse:
    """Pause or resume a deployment (``action`` is ``pause`` or ``resume``)."""
    if not configured() or not deployment_id:
        return simulated(
            PROVIDER, {"deployment_id": deployment_id or "", "action": action}
        )

    return request_json(
        "PUT",
        _deployments_url(deployment_id, "status"),
        provider=PROVIDER,
        headers=_headers(),
        json_body={"action": action},
        timeout=float(settings.sarvam_timeout_seconds),
    )
