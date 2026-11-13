"""AI employee request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import SUPPORTED_LANGUAGES, SUPPORTED_MODELS, SUPPORTED_VOICES, EmployeeStatus
from app.schemas.common import APIModel, ORMModel


class EmployeeLanguageIn(APIModel):
    language_code: str = Field(max_length=16)
    is_default: bool = False
    language_prompt: str | None = None

    @field_validator("language_code")
    @classmethod
    def _known_language(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"unsupported language '{value}'; allowed: {sorted(SUPPORTED_LANGUAGES)}"
            )
        return value


class EmployeeLanguageOut(ORMModel):
    id: str
    language_code: str
    is_default: bool
    language_prompt: str | None = None


class EmployeeActionIn(APIModel):
    name: str = Field(min_length=2, max_length=120)
    action_type: str = Field(
        description="transfer_call | send_whatsapp | book_appointment | "
        "collect_information | webhook | end_call"
    )
    description: str | None = None
    config: dict = Field(default_factory=dict)
    trigger_condition: str | None = None
    is_active: bool = True


class EmployeeActionOut(ORMModel):
    id: str
    name: str
    action_type: str
    description: str | None = None
    config: dict
    trigger_condition: str | None = None
    is_active: bool


class CallingStatusOut(APIModel):
    """Whether this employee can answer a call, in the customer's vocabulary.

    Deliberately holds no provider identifier: no deployment id, no agent id, no
    workspace. A customer buys a phone line that works, not a vendor object - and
    exposing the object would hand them a way to address it out of band.
    """

    enabled: bool = False
    #: not_configured | configuration_pending | syncing | ready_for_testing |
    #: test_failed | ready_to_deploy | live | paused | sync_failed
    state: str = "not_configured"
    #: True when nothing is actually answering: the configuration exists in OWN
    #: AI but no live number is behind it yet.
    simulated: bool = False
    #: True only for a real deployment that is currently answering calls.
    connected: bool = False
    last_checked_at: datetime | None = None
    #: Neutral next-step code (missing_instructions, provider_unavailable, ...).
    action_required: str | None = None


class EmployeeBase(APIModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    avatar_url: str | None = Field(default=None, max_length=512)
    purpose: str | None = Field(default=None, max_length=255)
    business_category: str | None = Field(default=None, max_length=80)
    template_key: str | None = Field(default=None, max_length=64)

    system_prompt: str = Field(default="", description="Primary instructions for the agent")
    personality: str | None = None
    role_description: str | None = None
    business_instructions: str | None = None
    conversation_objectives: str | None = None
    greeting_instruction: str | None = None
    interaction_rules: str | None = None
    response_style: str | None = None
    closing_instruction: str | None = None

    voice: str = "anushka"
    model: str = "sarvam-m"
    default_language: str = "en-IN"
    temperature: float = Field(default=0.6, ge=0.0, le=1.5)
    max_tokens: int = Field(default=512, ge=64, le=4096)
    first_message: str | None = None
    end_call_message: str | None = None

    @field_validator("voice")
    @classmethod
    def _known_voice(cls, value: str) -> str:
        if value not in SUPPORTED_VOICES:
            raise ValueError(f"unsupported voice '{value}'; allowed: {sorted(SUPPORTED_VOICES)}")
        return value

    @field_validator("model")
    @classmethod
    def _known_model(cls, value: str) -> str:
        if value not in SUPPORTED_MODELS:
            raise ValueError(f"unsupported model '{value}'; allowed: {sorted(SUPPORTED_MODELS)}")
        return value

    @field_validator("default_language")
    @classmethod
    def _known_default_language(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(f"unsupported language '{value}'")
        return value


class EmployeeCreate(EmployeeBase):
    status: EmployeeStatus = EmployeeStatus.DRAFT
    languages: list[EmployeeLanguageIn] = Field(default_factory=list)
    actions: list[EmployeeActionIn] = Field(default_factory=list)


class EmployeeUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    avatar_url: str | None = Field(default=None, max_length=512)
    purpose: str | None = Field(default=None, max_length=255)
    business_category: str | None = Field(default=None, max_length=80)
    system_prompt: str | None = None
    personality: str | None = None
    role_description: str | None = None
    business_instructions: str | None = None
    conversation_objectives: str | None = None
    greeting_instruction: str | None = None
    interaction_rules: str | None = None
    response_style: str | None = None
    closing_instruction: str | None = None
    voice: str | None = None
    model: str | None = None
    default_language: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=1.5)
    max_tokens: int | None = Field(default=None, ge=64, le=4096)
    first_message: str | None = None
    end_call_message: str | None = None
    status: EmployeeStatus | None = None
    is_active: bool | None = None
    languages: list[EmployeeLanguageIn] | None = None
    change_note: str | None = Field(default=None, max_length=255)

    @field_validator("voice")
    @classmethod
    def _known_voice(cls, value: str | None) -> str | None:
        if value is not None and value not in SUPPORTED_VOICES:
            raise ValueError(f"unsupported voice '{value}'")
        return value

    @field_validator("model")
    @classmethod
    def _known_model(cls, value: str | None) -> str | None:
        if value is not None and value not in SUPPORTED_MODELS:
            raise ValueError(f"unsupported model '{value}'")
        return value


class EmployeeOut(ORMModel):
    id: str
    organization_id: str
    name: str
    description: str | None = None
    avatar_url: str | None = None
    purpose: str | None = None
    business_category: str | None = None
    template_key: str | None = None

    system_prompt: str
    personality: str | None = None
    role_description: str | None = None
    business_instructions: str | None = None
    conversation_objectives: str | None = None
    greeting_instruction: str | None = None
    interaction_rules: str | None = None
    response_style: str | None = None
    closing_instruction: str | None = None

    voice: str
    model: str
    default_language: str
    temperature: float
    max_tokens: int
    first_message: str | None = None
    end_call_message: str | None = None

    status: str
    is_active: bool
    total_calls: int
    successful_calls: int
    success_rate: float = 0.0
    total_duration_seconds: int
    last_active_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    languages: list[EmployeeLanguageOut] = Field(default_factory=list)

    #: Which save of the configuration this is. Bumped on every change that a
    #: caller would notice, so the UI can say "v3" without naming a provider.
    configuration_version: int = 1

    #: Everything the customer may know about the phone line behind this
    #: employee. Provider objects stay internal.
    calling: CallingStatusOut = Field(default_factory=CallingStatusOut)


class EmployeeDetail(EmployeeOut):
    actions: list[EmployeeActionOut] = Field(default_factory=list)
    knowledge_source_ids: list[str] = Field(default_factory=list)


class EmployeeDedupeOut(APIModel):
    """Result of collapsing employees that repeat an existing name."""

    scanned: int
    duplicates: int
    archived_ids: list[str] = Field(default_factory=list)


class EmployeeImportItem(APIModel):
    """One deployment from the Sarvam workspace and what the pull did with it."""

    employee_id: str
    name: str
    deployment_id: str
    app_id: str | None = None
    app_version: int = 1
    status: str
    simulated: bool = False
    #: created | updated | skipped
    action: str
    reason: str | None = None


class EmployeeImportOut(APIModel):
    """Result of pulling the agents that already exist on Sarvam."""

    fetched: int
    created: int
    updated: int
    skipped: int
    items: list[EmployeeImportItem] = Field(default_factory=list)


class EmployeeStatusUpdate(APIModel):
    status: EmployeeStatus
    is_active: bool | None = None


class PromptVersionOut(ORMModel):
    id: str
    version: int
    system_prompt: str
    prompt_config: dict
    change_note: str | None = None
    created_at: datetime


class EmployeeTestRequest(APIModel):
    """Dry-run a conversation turn without placing a real call."""

    message: str = Field(min_length=1, max_length=2000)
    language: str | None = Field(default=None, max_length=16)


class EmployeeTestResponse(APIModel):
    reply: str
    language: str
    model: str
    provider: str
    latency_ms: int
    simulated: bool = False


class EmployeeTemplateOut(APIModel):
    key: str
    category: str
    name: str
    description: str
    suggested_role: str
    default_prompt: str
    suggested_languages: list[str]
    suggested_voice: str
    conversation_guidelines: list[str]
    suggested_outcomes: list[str]


class VoiceCatalogItem(APIModel):
    id: str
    gender: str


class LanguageCatalogItem(APIModel):
    code: str
    name: str
