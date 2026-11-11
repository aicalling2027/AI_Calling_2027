"""Call lifecycle, conversation transcripts and outcomes."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CallDirection, CallStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Call(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A single inbound or outbound voice call handled by an AI employee."""

    __tablename__ = "calls"

    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="SET NULL"), index=True
    )
    lead_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="SET NULL"), index=True
    )
    contact_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("contacts.id", ondelete="SET NULL"), index=True
    )
    campaign_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True
    )
    phone_number_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("phone_numbers.id", ondelete="SET NULL")
    )

    direction: Mapped[str] = mapped_column(
        String(16), default=str(CallDirection.OUTBOUND), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(24), default=str(CallStatus.QUEUED), nullable=False, index=True
    )
    outcome: Mapped[str | None] = mapped_column(String(32), index=True)
    sentiment: Mapped[str | None] = mapped_column(String(24))
    language: Mapped[str | None] = mapped_column(String(16))

    from_number: Mapped[str | None] = mapped_column(String(32), index=True)
    to_number: Mapped[str | None] = mapped_column(String(32), index=True)

    provider: Mapped[str] = mapped_column(String(32), default="sarvam", nullable=False)
    provider_call_id: Mapped[str | None] = mapped_column(String(120), index=True)

    queued_at: Mapped[datetime | None] = mapped_column(DateTime)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cost_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recording_url: Mapped[str | None] = mapped_column(String(512))
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    conversation: Mapped["Conversation | None"] = relationship(
        back_populates="call", cascade="all, delete-orphan", uselist=False
    )
    events: Mapped[list["CallEvent"]] = relationship(
        back_populates="call", cascade="all, delete-orphan"
    )

    @property
    def is_terminal(self) -> bool:
        return self.status in {str(s) for s in CallStatus.terminal()}


class CallEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Raw provider/webhook event for a call - the audit trail of the dial."""

    __tablename__ = "call_events"

    call_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    call: Mapped[Call] = relationship(back_populates="events")


class Conversation(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """One conversation per call: turn statistics and rolled-up sentiment."""

    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("call_id", name="uq_conversation_call"),)

    call_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    turn_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    language: Mapped[str | None] = mapped_column(String(16))
    sentiment: Mapped[str | None] = mapped_column(String(24), index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(String(32), index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)

    call: Mapped[Call] = relationship(back_populates="conversation")
    transcripts: Mapped[list["Transcript"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Transcript(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single utterance inside a conversation."""

    __tablename__ = "transcripts"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)  # agent | customer | system
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    language: Mapped[str | None] = mapped_column(String(16))
    confidence: Mapped[float | None] = mapped_column(Float)
    start_ms: Mapped[int | None] = mapped_column(Integer)
    end_ms: Mapped[int | None] = mapped_column(Integer)

    conversation: Mapped[Conversation] = relationship(back_populates="transcripts")


class ConversationSummary(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """LLM-generated summary, key points and action items."""

    __tablename__ = "conversation_summaries"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_points: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    action_items: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    sentiment: Mapped[str | None] = mapped_column(String(24))
    model: Mapped[str | None] = mapped_column(String(64))
    generated_at: Mapped[datetime | None] = mapped_column(DateTime)


class ConversationOutcome(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Explicit outcome classification with captured business data."""

    __tablename__ = "conversation_outcomes"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    outcome: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    confidence: Mapped[float | None] = mapped_column(Float)
    captured_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class ExtractedInformation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Structured field captured during a call (name, budget, appointment...)."""

    __tablename__ = "extracted_information"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    field_value: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)


class CallRecording(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Recording metadata. The audio itself lives in Supabase Storage."""

    __tablename__ = "recordings"

    call_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_url: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_bucket: Mapped[str | None] = mapped_column(String(120))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    format: Mapped[str] = mapped_column(String(16), default="wav", nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
