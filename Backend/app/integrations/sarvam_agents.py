"""Sarvam Voice Agents (Samvaad) deployment adapter.

The Voice Agents API does not author an agent: an agent is built in the Sarvam
workspace and identified by ``app_id`` + ``app_version``. What the API can do
programmatically is *deploy* that agent onto a telephony connection, so
"create an AI employee" maps to "create a deployment" here.

Archiving an employee pauses its deployment, so the provider keeps the call
history, transcripts and the phone-number binding. ``delete_deployment`` is the
one irreversible call - it stops inbound calls to that number immediately - and
is only reached from an explicit remove request.
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


def configured(*, app_id: str | None = None) -> bool:
    """True when the workspace can be addressed and the deployed agent is known.

    ``app_id`` lets the caller name the agent explicitly - the provider-independent
    contract always passes one, while the legacy single-agent path leaves it out
    and falls back to the environment.
    """
    return settings.enabled(
        _api_key(),
        settings.sarvam_org_id,
        settings.sarvam_workspace_id,
        app_id or settings.sarvam_agent_app_id,
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


def key_conflicts_with_ids() -> bool:
    """True when the key field was filled with an org or workspace id.

    Both are bare UUIDs and sit next to each other in the env file, so the id
    lands in the key slot easily - and the provider only answers "invalid key".
    """
    key = _api_key()
    return bool(key) and key in {
        str(settings.sarvam_org_id or "").strip(),
        str(settings.sarvam_workspace_id or "").strip(),
    }


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
    *,
    employee_name: str,
    employee_id: str,
    description: str | None = None,
    app_id: str | None = None,
    app_version: int | None = None,
    connection_id: str | None = None,
    phone_number: str | None = None,
) -> ProviderResponse:
    """Deploy the workspace agent onto its number for this employee.

    Every argument except the employee identity is optional: omitted values fall
    back to the environment, so the legacy single-agent caller keeps working
    while a caller that owns its own agent/connection/number can state them.
    """
    name = deployment_name(employee_name, employee_id)
    agent = (app_id or settings.sarvam_agent_app_id or "").strip()
    version = int(app_version or settings.sarvam_agent_app_version or 1)
    connection = (connection_id or settings.sarvam_connection_id or "").strip()
    number = (phone_number or settings.sarvam_agent_phone_number or "").strip()

    if not configured(app_id=agent):
        return simulated(
            PROVIDER,
            {
                "deployment_id": simulated_deployment_id(employee_id),
                "app_id": agent or "unconfigured",
                "app_version": version,
                "status": "simulated",
                "name": name,
            },
        )

    if not number or not connection:
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
        "app_id": agent,
        "app_version": version,
        "connection_configs": [
            {
                "connection_id": connection,
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


def delete_deployment(deployment_id: str) -> ProviderResponse:
    """Permanently delete a deployment - inbound calls to its numbers stop now.

    ``DELETE /v1/orgs/{org}/workspaces/{workspace}/deployments/{deployment}``.
    The provider forgets the deployment, its call history and the number
    binding, so this is not the archive path (which pauses instead). A 404 is
    reported as done: the deployment is already gone, and a retry after a
    half-finished delete should not fail for that.
    """
    if not deployment_id:
        return ProviderResponse(ok=False, error="There is no deployment to delete.")

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

    result = request_json(
        "DELETE",
        _deployments_url(deployment_id),
        provider=PROVIDER,
        headers=_headers(),
        timeout=float(settings.sarvam_timeout_seconds),
        retries=1,
    )
    if result.status_code == 404:
        return ProviderResponse(
            ok=True,
            data={"deployment_id": deployment_id, "deleted": True, "already_gone": True},
            status_code=404,
        )
    if result.ok:
        result.data.setdefault("deleted", True)
    return result
