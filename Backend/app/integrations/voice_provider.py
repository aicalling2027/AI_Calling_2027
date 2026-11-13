"""Provider-independent contract for voice-agent execution.

OWN AI owns the employee definition - prompt, voice, language, knowledge and
business rules. A voice provider only *executes* that definition. This module is
the seam between the two: the fifteen operations of the Option B contract, and an
explicit statement of which of them the configured provider can actually perform.

One rule shapes the whole file. An operation the provider does not offer is
*declared* unavailable and raises
:class:`~app.core.exceptions.ProviderCapabilityMissing`. It is never stubbed with
a fabricated success, and no endpoint is invented to make it look real - the
alternative to an honest 501 is a lie the customer only discovers when a call
does not happen.

Nothing here calls the provider. The adapter methods are thin delegations to
``app.integrations.sarvam_agents``; the lifecycle decisions belong to the
service layer.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType
from typing import Any, Final, NoReturn, Protocol, runtime_checkable

from app.core.exceptions import AppError, ProviderCapabilityMissing
from app.integrations import ProviderResponse, sarvam_agents

#: Internal provider code. Stored on every binding, never sent to a customer.
PROVIDER_CODE = "sarvam-voice-agents"


class VoiceCapability(StrEnum):
    """The Option B contract, one member per operation.

    Order matters only for readability: agent authoring, then knowledge, then
    testing, then deployment.
    """

    # -- Agent authoring ---------------------------------------------------
    CREATE_AGENT = "create_agent"
    GET_AGENT = "get_agent"
    LIST_AGENTS = "list_agents"
    UPDATE_AGENT = "update_agent"
    CONFIGURE_AGENT = "configure_agent"
    COMMIT_AGENT_VERSION = "commit_agent_version"

    # -- Knowledge ---------------------------------------------------------
    CREATE_KNOWLEDGE_BASE = "create_knowledge_base"
    UPLOAD_KNOWLEDGE_BASE_DOCUMENT = "upload_knowledge_base_document"
    ATTACH_KNOWLEDGE_BASE = "attach_knowledge_base"

    # -- Testing -----------------------------------------------------------
    TEST_AGENT = "test_agent"

    # -- Deployment --------------------------------------------------------
    CREATE_DEPLOYMENT = "create_deployment"
    GET_DEPLOYMENT = "get_deployment"
    PAUSE_DEPLOYMENT = "pause_deployment"
    RESUME_DEPLOYMENT = "resume_deployment"
    DELETE_DEPLOYMENT = "delete_deployment"


class CapabilitySupport(StrEnum):
    """How far an operation is proven for one provider."""

    #: Exercised against the real API - safe to build a feature on.
    SUPPORTED = "supported"
    #: Documented or exposed over MCP, but never confirmed from this backend.
    #: Treated as unavailable everywhere, because "probably works" is not a
    #: guarantee a customer can rely on for a live phone line.
    UNVERIFIED = "unverified"
    #: The provider has no such operation at all.
    UNSUPPORTED = "unsupported"


@dataclass(frozen=True, slots=True)
class CapabilityReport:
    """Which contract operations one provider can perform.

    Constructing a report requires a level for *every* capability. That is the
    point: a new operation cannot be added to the contract and quietly forgotten
    for a provider - the omission is a programming error, raised at import time.
    """

    provider: str
    support: Mapping[VoiceCapability, CapabilitySupport]

    def __post_init__(self) -> None:
        missing = [capability for capability in VoiceCapability if capability not in self.support]
        if missing:
            raise ValueError(
                f"{self.provider} declares no support level for "
                f"{len(missing)} of {len(VoiceCapability)} capabilities: "
                + ", ".join(capability.value for capability in missing)
            )

    def level(self, capability: VoiceCapability) -> CapabilitySupport:
        return self.support[capability]

    def supports(self, capability: VoiceCapability) -> bool:
        """True only when the operation has been proven against the real API."""
        return self.support.get(capability) is CapabilitySupport.SUPPORTED

    def raise_if_missing(self, capability: VoiceCapability) -> None:
        """Refuse an operation the provider cannot perform.

        Raises :class:`ProviderCapabilityMissing` (501) so the caller gets a
        final, typed answer instead of a fabricated success. The payload names
        the capability and its state - never the vendor.
        """
        level = self.support.get(capability, CapabilitySupport.UNVERIFIED)
        if level is CapabilitySupport.SUPPORTED:
            return
        raise ProviderCapabilityMissing(
            details={"capability": capability.value, "state": level.value},
        )

    def supported(self) -> list[VoiceCapability]:
        return [c for c in VoiceCapability if self.supports(c)]

    def unavailable(self) -> dict[str, str]:
        return {
            capability.value: level.value
            for capability, level in self.support.items()
            if level is not CapabilitySupport.SUPPORTED
        }

    def as_dict(self) -> dict[str, Any]:
        """Operator-facing view - safe for logs and internal health output."""
        levels: dict[str, list[str]] = {level.value: [] for level in CapabilitySupport}
        for capability, level in self.support.items():
            levels[level.value].append(capability.value)
        return {
            "provider": self.provider,
            "total": len(VoiceCapability),
            **{name: sorted(values) for name, values in levels.items()},
        }


@runtime_checkable
class VoiceProvider(Protocol):
    """The operations OWN AI may ask a voice provider to perform.

    Every method returns a :class:`~app.integrations.ProviderResponse` so a
    transport failure and a missing capability stay distinguishable: the former
    is ``ok=False``, the latter raises before any network call is made.
    """

    #: Internal code, e.g. ``sarvam-voice-agents``.
    code: str

    def capabilities(self) -> CapabilityReport: ...

    def configured(self) -> bool: ...

    def missing_settings(self) -> list[str]: ...

    # -- Agent authoring ---------------------------------------------------
    def create_agent(
        self, *, name: str, configuration: Mapping[str, Any]
    ) -> ProviderResponse: ...

    def get_agent(self, agent_id: str) -> ProviderResponse: ...

    def list_agents(self, *, page_size: int = 100, max_pages: int = 10) -> ProviderResponse: ...

    def update_agent(
        self, agent_id: str, *, configuration: Mapping[str, Any]
    ) -> ProviderResponse: ...

    def configure_agent(
        self, agent_id: str, *, configuration: Mapping[str, Any]
    ) -> ProviderResponse: ...

    def commit_agent_version(
        self, agent_id: str, *, version: int | None = None
    ) -> ProviderResponse: ...

    # -- Knowledge ---------------------------------------------------------
    def create_knowledge_base(
        self, *, name: str, description: str | None = None
    ) -> ProviderResponse: ...

    def upload_knowledge_base_document(
        self,
        knowledge_base_id: str,
        *,
        document_id: str,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> ProviderResponse: ...

    def attach_knowledge_base(
        self, agent_id: str, *, knowledge_base_id: str
    ) -> ProviderResponse: ...

    # -- Testing -----------------------------------------------------------
    def test_agent(
        self, agent_id: str, *, message: str, language: str | None = None
    ) -> ProviderResponse: ...

    # -- Deployment --------------------------------------------------------
    def create_deployment(
        self,
        *,
        agent_id: str,
        agent_version: int,
        name: str,
        connection_id: str,
        phone_number: str,
        description: str | None = None,
    ) -> ProviderResponse: ...

    def get_deployment(self, deployment_id: str) -> ProviderResponse: ...

    def pause_deployment(self, deployment_id: str) -> ProviderResponse: ...

    def resume_deployment(self, deployment_id: str) -> ProviderResponse: ...

    def delete_deployment(self, deployment_id: str) -> ProviderResponse: ...


#: What the Voice Agents API can actually do today.
#:
#: An agent is authored in the Sarvam console and identified by ``app_id`` +
#: ``app_version``; the REST surface this backend holds starts at the deployment
#: that binds that agent to a telephony connection. Agent authoring and knowledge
#: base operations exist only behind the MCP/OAuth surface, which is an
#: interactive session - not a credential this backend can hold - so they stay
#: declared-but-unavailable until a service credential is verified.
_SARVAM_SUPPORT: Final[Mapping[VoiceCapability, CapabilitySupport]] = MappingProxyType(
    {
        VoiceCapability.CREATE_DEPLOYMENT: CapabilitySupport.SUPPORTED,
        VoiceCapability.GET_DEPLOYMENT: CapabilitySupport.SUPPORTED,
        VoiceCapability.PAUSE_DEPLOYMENT: CapabilitySupport.SUPPORTED,
        VoiceCapability.RESUME_DEPLOYMENT: CapabilitySupport.SUPPORTED,
        VoiceCapability.DELETE_DEPLOYMENT: CapabilitySupport.SUPPORTED,
        VoiceCapability.CREATE_AGENT: CapabilitySupport.UNVERIFIED,
        VoiceCapability.GET_AGENT: CapabilitySupport.UNVERIFIED,
        VoiceCapability.LIST_AGENTS: CapabilitySupport.UNVERIFIED,
        VoiceCapability.UPDATE_AGENT: CapabilitySupport.UNVERIFIED,
        VoiceCapability.CONFIGURE_AGENT: CapabilitySupport.UNVERIFIED,
        VoiceCapability.COMMIT_AGENT_VERSION: CapabilitySupport.UNVERIFIED,
        VoiceCapability.CREATE_KNOWLEDGE_BASE: CapabilitySupport.UNVERIFIED,
        VoiceCapability.UPLOAD_KNOWLEDGE_BASE_DOCUMENT: CapabilitySupport.UNVERIFIED,
        VoiceCapability.ATTACH_KNOWLEDGE_BASE: CapabilitySupport.UNVERIFIED,
        VoiceCapability.TEST_AGENT: CapabilitySupport.UNVERIFIED,
    }
)


class SarvamVoiceProvider:
    """The contract, implemented against the endpoints that are proven.

    The five deployment operations delegate to ``sarvam_agents``. The other ten
    refuse: :meth:`_unavailable` raises even if a future edit flips the support
    flag, so "make the button work" can never be solved by editing the matrix.
    """

    code = PROVIDER_CODE

    def __init__(self) -> None:
        self._capabilities = CapabilityReport(PROVIDER_CODE, _SARVAM_SUPPORT)

    # -- Introspection -----------------------------------------------------
    def capabilities(self) -> CapabilityReport:
        return self._capabilities

    def configured(self) -> bool:
        return sarvam_agents.configured()

    def missing_settings(self) -> list[str]:
        return sarvam_agents.missing_workspace_settings()

    # -- Deployment (supported) --------------------------------------------
    def create_deployment(
        self,
        *,
        agent_id: str,
        agent_version: int,
        name: str,
        connection_id: str,
        phone_number: str,
        description: str | None = None,
    ) -> ProviderResponse:
        """Bind a committed agent version to a number.

        Creating a deployment makes the number answer immediately, which is why
        this is only reachable from an explicit "enable calling" action.
        """
        self._capabilities.raise_if_missing(VoiceCapability.CREATE_DEPLOYMENT)
        return sarvam_agents.provision(
            employee_name=name,
            employee_id=agent_id,
            description=description,
            app_id=agent_id,
            app_version=agent_version,
            connection_id=connection_id,
            phone_number=phone_number,
        )

    def get_deployment(self, deployment_id: str) -> ProviderResponse:
        """Read one deployment by scanning the list.

        There is no single-deployment GET, so this reuses the one verified read
        rather than inventing a path. A missing id is reported as 404, not as a
        transport failure.
        """
        self._capabilities.raise_if_missing(VoiceCapability.GET_DEPLOYMENT)
        if not deployment_id:
            return ProviderResponse(ok=False, error="There is no deployment to read.")

        listed = sarvam_agents.list_deployments()
        if not listed.ok:
            return listed

        for item in listed.data.get("items") or []:
            if not isinstance(item, dict):
                continue
            if str(item.get("id") or item.get("deployment_id") or "") == deployment_id:
                return ProviderResponse(ok=True, data=dict(item))

        return ProviderResponse(
            ok=False,
            data={"deployment_id": deployment_id},
            error="That deployment is not present on the provider.",
            status_code=404,
        )

    def pause_deployment(self, deployment_id: str) -> ProviderResponse:
        self._capabilities.raise_if_missing(VoiceCapability.PAUSE_DEPLOYMENT)
        return sarvam_agents.set_status(deployment_id, action="pause")

    def resume_deployment(self, deployment_id: str) -> ProviderResponse:
        self._capabilities.raise_if_missing(VoiceCapability.RESUME_DEPLOYMENT)
        return sarvam_agents.set_status(deployment_id, action="resume")

    def delete_deployment(self, deployment_id: str) -> ProviderResponse:
        self._capabilities.raise_if_missing(VoiceCapability.DELETE_DEPLOYMENT)
        return sarvam_agents.delete_deployment(deployment_id)

    # -- Agent authoring (unavailable) -------------------------------------
    def create_agent(
        self, *, name: str, configuration: Mapping[str, Any]
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.CREATE_AGENT)

    def get_agent(self, agent_id: str) -> ProviderResponse:
        return self._unavailable(VoiceCapability.GET_AGENT)

    def list_agents(self, *, page_size: int = 100, max_pages: int = 10) -> ProviderResponse:
        return self._unavailable(VoiceCapability.LIST_AGENTS)

    def update_agent(
        self, agent_id: str, *, configuration: Mapping[str, Any]
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.UPDATE_AGENT)

    def configure_agent(
        self, agent_id: str, *, configuration: Mapping[str, Any]
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.CONFIGURE_AGENT)

    def commit_agent_version(
        self, agent_id: str, *, version: int | None = None
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.COMMIT_AGENT_VERSION)

    # -- Knowledge (unavailable) -------------------------------------------
    def create_knowledge_base(
        self, *, name: str, description: str | None = None
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.CREATE_KNOWLEDGE_BASE)

    def upload_knowledge_base_document(
        self,
        knowledge_base_id: str,
        *,
        document_id: str,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.UPLOAD_KNOWLEDGE_BASE_DOCUMENT)

    def attach_knowledge_base(
        self, agent_id: str, *, knowledge_base_id: str
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.ATTACH_KNOWLEDGE_BASE)

    # -- Testing (unavailable) ---------------------------------------------
    def test_agent(
        self, agent_id: str, *, message: str, language: str | None = None
    ) -> ProviderResponse:
        return self._unavailable(VoiceCapability.TEST_AGENT)

    # -- Internal ----------------------------------------------------------
    def _unavailable(self, capability: VoiceCapability) -> NoReturn:
        """Refuse a capability that has no proven implementation.

        ``raise_if_missing`` is the intended path. The trailing ``AssertionError``
        only fires if someone marks the capability supported without writing the
        method - a loud failure at the first call instead of a silent fake.
        """
        self._capabilities.raise_if_missing(capability)
        raise AssertionError(
            f"{capability.value} is declared supported but has no implementation"
        )


_FACTORIES: Final[dict[str, Callable[[], VoiceProvider]]] = {
    PROVIDER_CODE: SarvamVoiceProvider,
}


def get_voice_provider(code: str = PROVIDER_CODE) -> VoiceProvider:
    """Resolve a provider by its internal code.

    Never pass a code taken from a request body: which provider executes a call
    is a deployment decision, not a customer preference, and a caller who can
    choose the provider can also choose whose credentials it uses.
    """
    factory = _FACTORIES.get(code)
    if factory is None:
        raise AppError(
            "That voice provider is not available.",
            code="unknown_voice_provider",
            status_code=400,
        )
    return factory()


__all__ = [
    "PROVIDER_CODE",
    "CapabilityReport",
    "CapabilitySupport",
    "SarvamVoiceProvider",
    "VoiceCapability",
    "VoiceProvider",
    "get_voice_provider",
]
