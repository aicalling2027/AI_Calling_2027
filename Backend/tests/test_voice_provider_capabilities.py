"""The provider contract must refuse what the provider cannot do.

Two properties are under test and both matter more than they look:

* an unproven operation raises a typed 501 *before* any network call, so a
  customer never sees a fabricated success;
* the refusal payload names the capability and nothing else - no vendor, no
  external id, no credential.

The remaining tests pin the five deployment operations to the real endpoints and
prove that explicit agent/connection/number values reach the request body.
"""

from __future__ import annotations

import json

import pytest

from app.core.config import settings
from app.core.exceptions import AppError, ProviderCapabilityMissing
from app.integrations import ProviderResponse, sarvam_agents
from app.integrations.voice_provider import (
    PROVIDER_CODE,
    CapabilityReport,
    CapabilitySupport,
    SarvamVoiceProvider,
    VoiceCapability,
    VoiceProvider,
    get_voice_provider,
)

DEPLOYMENT_OPERATIONS = {
    VoiceCapability.CREATE_DEPLOYMENT,
    VoiceCapability.GET_DEPLOYMENT,
    VoiceCapability.PAUSE_DEPLOYMENT,
    VoiceCapability.RESUME_DEPLOYMENT,
    VoiceCapability.DELETE_DEPLOYMENT,
}


@pytest.fixture()
def configured_workspace(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every field the deployment path needs, so no test depends on a .env file."""
    for field, value in {
        "sarvam_agents_api_key": "workspace-key",
        "sarvam_org_id": "org-1",
        "sarvam_workspace_id": "ws-1",
        "sarvam_agent_app_id": "agent-1",
        "sarvam_connection_id": "conn-1",
        "sarvam_agent_phone_number": "+911234567890",
    }.items():
        monkeypatch.setattr(settings, field, value)


@pytest.fixture()
def unconfigured_workspace(monkeypatch: pytest.MonkeyPatch) -> None:
    for field in (
        "sarvam_agents_api_key",
        "sarvam_api_key",
        "sarvam_org_id",
        "sarvam_workspace_id",
        "sarvam_agent_app_id",
    ):
        monkeypatch.setattr(settings, field, "")


# ---------------------------------------------------------------------------
# The matrix itself
# ---------------------------------------------------------------------------
def test_the_adapter_satisfies_the_protocol() -> None:
    assert isinstance(get_voice_provider(), VoiceProvider)


def test_every_capability_has_a_declared_level() -> None:
    report = get_voice_provider().capabilities()

    assert set(report.support) == set(VoiceCapability)
    assert len(VoiceCapability) == 15
    assert report.as_dict()["total"] == 15


def test_an_incomplete_matrix_is_rejected_at_construction() -> None:
    """A new contract operation cannot be silently forgotten for a provider."""
    partial = {
        capability: CapabilitySupport.SUPPORTED
        for capability in VoiceCapability
        if capability is not VoiceCapability.CREATE_AGENT
    }

    with pytest.raises(ValueError, match="create_agent"):
        CapabilityReport(PROVIDER_CODE, partial)


def test_only_deployment_operations_are_supported() -> None:
    report = get_voice_provider().capabilities()

    assert set(report.supported()) == DEPLOYMENT_OPERATIONS
    # Nothing is declared as a flat "no such operation" - these exist, they are
    # simply unproven from this backend, which is a different kind of unknown.
    assert set(report.unavailable().values()) == {CapabilitySupport.UNVERIFIED}


# ---------------------------------------------------------------------------
# Refusals
# ---------------------------------------------------------------------------
def test_unavailable_capability_is_refused_before_any_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(*args: object, **kwargs: object) -> ProviderResponse:
        raise AssertionError("a provider call was attempted")

    monkeypatch.setattr(sarvam_agents, "request_json", explode)

    with pytest.raises(ProviderCapabilityMissing) as caught:
        get_voice_provider().create_agent(name="Front desk", configuration={})

    assert caught.value.status_code == 501
    assert caught.value.code == "provider_capability_unavailable"


def test_refusal_payload_names_the_capability_and_nothing_else() -> None:
    with pytest.raises(ProviderCapabilityMissing) as caught:
        get_voice_provider().list_agents()

    payload = json.dumps(caught.value.to_payload("req-1")).lower()

    assert caught.value.details == {"capability": "list_agents", "state": "unverified"}
    assert "sarvam" not in payload
    assert "workspace" not in payload


@pytest.mark.parametrize("capability", sorted(DEPLOYMENT_OPERATIONS, key=str))
def test_supported_capabilities_pass_the_gate(capability: VoiceCapability) -> None:
    get_voice_provider().capabilities().raise_if_missing(capability)


def test_flipping_a_flag_without_an_implementation_fails_loudly() -> None:
    """Moving the button must not be easier than writing the endpoint."""
    provider = SarvamVoiceProvider()
    forged = dict(provider.capabilities().support)
    forged[VoiceCapability.CREATE_AGENT] = CapabilitySupport.SUPPORTED
    provider._capabilities = CapabilityReport(PROVIDER_CODE, forged)  # noqa: SLF001

    with pytest.raises(AssertionError, match="no implementation"):
        provider.create_agent(name="Front desk", configuration={})


def test_unknown_provider_code_is_a_typed_error() -> None:
    with pytest.raises(AppError) as caught:
        get_voice_provider("acme-voice")

    assert caught.value.status_code == 400
    assert caught.value.code == "unknown_voice_provider"


# ---------------------------------------------------------------------------
# The five operations that are real
# ---------------------------------------------------------------------------
def test_deployment_stays_simulated_when_the_workspace_is_unconfigured(
    unconfigured_workspace: None,
) -> None:
    result = get_voice_provider().create_deployment(
        agent_id="agent-1",
        agent_version=1,
        name="Front desk",
        connection_id="conn-1",
        phone_number="+911234567890",
    )

    assert result.ok and result.simulated
    # Never "active": nothing is answering a call, and the caller must be able
    # to tell that apart from a live number.
    assert result.data["status"] == "simulated"


def test_create_deployment_forwards_explicit_ids(
    configured_workspace: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, object] = {}

    def record(method: str, url: str, **kwargs: object) -> ProviderResponse:
        captured.update(method=method, url=url, body=kwargs.get("json_body"))
        return ProviderResponse(ok=True, data={"id": "dep-1"})

    monkeypatch.setattr(sarvam_agents, "request_json", record)

    result = get_voice_provider().create_deployment(
        agent_id="agent-9",
        agent_version=3,
        name="Front desk",
        connection_id="conn-9",
        phone_number="+919999999999",
    )

    assert result.ok
    body = captured["body"]
    assert isinstance(body, dict)
    assert body["app_id"] == "agent-9"
    assert body["app_version"] == 3
    assert body["connection_configs"] == [
        {"connection_id": "conn-9", "agent_phone_number": "+919999999999"}
    ]
    assert "/workspaces/ws-1/deployments" in str(captured["url"])


def test_get_deployment_finds_the_deployment_in_the_workspace_list(
    configured_workspace: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        sarvam_agents,
        "list_deployments",
        lambda **_: ProviderResponse(
            ok=True, data={"items": [{"id": "dep-1", "status": "active"}], "total": 1}
        ),
    )

    result = get_voice_provider().get_deployment("dep-1")

    assert result.ok
    assert result.data["status"] == "active"


def test_get_deployment_reports_an_unknown_id_as_404(
    configured_workspace: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        sarvam_agents,
        "list_deployments",
        lambda **_: ProviderResponse(ok=True, data={"items": [], "total": 0}),
    )

    result = get_voice_provider().get_deployment("dep-missing")

    assert not result.ok
    assert result.status_code == 404
