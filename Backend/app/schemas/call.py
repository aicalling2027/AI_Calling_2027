"""Call, transcript and conversation schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import CallDirection, CallOutcome, CallStatus
from app.schemas.common import APIModel, ORMModel
from app.schemas.lead import _normalise_phone


class CallCreate(APIModel):
    """Start an outbound call. Inbound calls arrive via the provider webhook."""

    to_number: str = Field(max_length=32)
    employee_id: str
    lead_id: str | None = None
    campaign_id: str | None = None
    phone_number_id: str | None = None
    language: str | None = Field(default=None, max_length=16)
    metadata: dict = Field(default_factory=dict)

    _to = field_validator("to_number")(_normalise_phone)


class CallOut(ORMModel):
    id: str
    organization_id: str
    employee_id: str | None = None
    lead_id: str | None = None
    contact_id: str | None = None
    campaign_id: str | None = None
    phone_number_id: str | None = None
    direction: str
    status: str
    outcome: str | None = None
    sentiment: str | None = None
    language: str | None = None
    from_number: str | None = None
    to_number: str | None = None
    provider: str
    provider_call_id: str | None = None
    started_at: datetime | None = None
    answered_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int
    cost_credits: int
    recording_url: str | None = None
    error_message: str | None = None
    created_at: datetime


class TranscriptOut(ORMModel):
    id: str
    speaker: str
    text: str
    sequence: int
    language: str | None = None
    confidence: float | None = None
    start_ms: int | None = None
    end_ms: int | None = None


class ConversationOut(ORMModel):
    id: str
    call_id: str
    turn_count: int
    language: str | None = None
    sentiment: str | None = None
    summary: str | None = None
    outcome: str | None = None
    transcripts: list[TranscriptOut] = Field(default_factory=list)


class ConversationSummaryOut(ORMModel):
    id: str
    conversation_id: str
    summary: str
    key_points: list
    action_items: list
    sentiment: str | None = None
    model: str | None = None
    generated_at: datetime | None = None


class CallEventOut(ORMModel):
    id: str
    event_type: str
    payload: dict
    occurred_at: datetime


class CallDetail(CallOut):
    conversation: ConversationOut | None = None
    events: list[CallEventOut] = Field(default_factory=list)


class CallOutcomeUpdate(APIModel):
    outcome: CallOutcome
    notes: str | None = None


class LanguageDetectionOut(APIModel):
    detected_language: str
    confidence: float
    text: str


class TranscriptIn(APIModel):
    speaker: str = Field(pattern="^(agent|customer|system)$")
    text: str = Field(min_length=1)
    language: str | None = Field(default=None, max_length=16)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    start_ms: int | None = Field(default=None, ge=0)
    end_ms: int | None = Field(default=None, ge=0)


class TranscriptAppend(APIModel):
    transcripts: list[TranscriptIn] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Provider webhook payloads
# ---------------------------------------------------------------------------
class CallWebhookPayload(APIModel):
    """Normalised telephony provider event."""

    provider_call_id: str
    event_type: str = Field(
        description="initiated | ringing | answered | completed | failed | no_answer"
    )
    status: CallStatus | None = None
    direction: CallDirection | None = None
    from_number: str | None = None
    to_number: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    recording_url: str | None = None
    outcome: CallOutcome | None = None
    error_message: str | None = None
    occurred_at: datetime | None = None
    payload: dict = Field(default_factory=dict)


class InboundCallPayload(APIModel):
    """Normalised inbound call notification."""

    provider_call_id: str
    from_number: str
    to_number: str
    language: str | None = None
    payload: dict = Field(default_factory=dict)


class CallQueuedResponse(APIModel):
    call_id: str
    status: str
    provider_call_id: str | None = None
    message: str
    simulated: bool = False
