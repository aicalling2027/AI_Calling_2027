"""Conversations, transcripts and AI summaries - PRD module 10."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.core.pagination import PageParams, paginate
from app.database.base import utcnow
from app.database.models.call import (
    Call,
    Conversation,
    ConversationSummary,
    Transcript,
)
from app.integrations import sarvam
from app.schemas.call import (
    ConversationOut,
    ConversationSummaryOut,
    TranscriptAppend,
    TranscriptOut,
)
from app.utils.text import collapse_whitespace, truncate

_TERMINAL_SUMMARY_PROMPT = (
    "You are a call-quality analyst. Summarise the conversation in 3 sentences, "
    "then list the agreed next steps. Be factual and concise."
)

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------
def list_conversations(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    outcome: str | None = None,
    sentiment: str | None = None,
    language: str | None = None,
) -> tuple[list[ConversationOut], int]:
    stmt = (
        select(Conversation)
        .where(Conversation.organization_id == organization_id)
        .options(selectinload(Conversation.transcripts))
    )
    if outcome:
        stmt = stmt.where(Conversation.outcome == outcome)
    if sentiment:
        stmt = stmt.where(Conversation.sentiment == sentiment)
    if language:
        stmt = stmt.where(Conversation.language == language)

    rows, total = paginate(db, stmt.order_by(Conversation.created_at.desc()), params)
    return [ConversationOut.model_validate(row) for row in rows], total


def get_conversation(db: Session, organization_id: str, conversation_id: str) -> Conversation:
    conversation = db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.organization_id == organization_id,
        )
        .options(selectinload(Conversation.transcripts))
    ).scalar_one_or_none()
    if conversation is None:
        raise NotFoundError("Conversation not found.", details={"id": conversation_id})
    return conversation


def conversation_for_call(db: Session, call_id: str) -> Conversation | None:
    return db.execute(
        select(Conversation)
        .where(Conversation.call_id == call_id)
        .options(selectinload(Conversation.transcripts))
    ).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Transcripts
# ---------------------------------------------------------------------------
def append_transcripts(
    db: Session, conversation: Conversation, payload: TranscriptAppend
) -> list[TranscriptOut]:
    """Append utterances, continuing the sequence and recomputing the turn count."""
    current = int(
        db.execute(
            select(func.max(Transcript.sequence)).where(
                Transcript.conversation_id == conversation.id
            )
        ).scalar_one_or_none()
        or 0
    )

    created: list[Transcript] = []
    for item in payload.transcripts:
        current += 1
        transcript = Transcript(
            conversation_id=conversation.id,
            speaker=item.speaker,
            text=collapse_whitespace(item.text),
            sequence=current,
            language=item.language or conversation.language,
            confidence=item.confidence,
            start_ms=item.start_ms,
            end_ms=item.end_ms,
        )
        db.add(transcript)
        created.append(transcript)

    db.flush()
    conversation.turn_count = int(
        db.execute(
            select(func.count())
            .select_from(Transcript)
            .where(Transcript.conversation_id == conversation.id)
        ).scalar_one()
    )
    conversation.ended_at = utcnow()
    db.commit()
    return [TranscriptOut.model_validate(row) for row in created]


def list_transcripts(db: Session, conversation_id: str) -> list[TranscriptOut]:
    rows = db.execute(
        select(Transcript)
        .where(Transcript.conversation_id == conversation_id)
        .order_by(Transcript.sequence.asc())
    ).scalars().all()
    return [TranscriptOut.model_validate(row) for row in rows]


def full_text(db: Session, conversation_id: str) -> str:
    rows = db.execute(
        select(Transcript)
        .where(Transcript.conversation_id == conversation_id)
        .order_by(Transcript.sequence.asc())
    ).scalars().all()
    return "\n".join(f"{row.speaker}: {row.text}" for row in rows)


# ---------------------------------------------------------------------------
# Summaries
# ---------------------------------------------------------------------------
def latest_summary(db: Session, conversation_id: str) -> ConversationSummaryOut | None:
    row = db.execute(
        select(ConversationSummary)
        .where(ConversationSummary.conversation_id == conversation_id)
        .order_by(ConversationSummary.created_at.desc())
    ).scalars().first()
    return ConversationSummaryOut.model_validate(row) if row else None


def summarize(db: Session, conversation: Conversation) -> ConversationSummaryOut:
    """Generate (or regenerate) a summary using Sarvam, with a local fallback."""
    transcript = full_text(db, conversation.id)
    if not transcript:
        raise NotFoundError(
            "This conversation has no transcript to summarise.",
            details={"conversation_id": conversation.id},
        )

    summary_text, key_points, action_items, model = _generate(transcript, conversation)

    row = ConversationSummary(
        conversation_id=conversation.id,
        summary=summary_text,
        key_points=key_points,
        action_items=action_items,
        sentiment=conversation.sentiment or "neutral",
        model=model,
        generated_at=utcnow(),
    )
    db.add(row)
    conversation.summary = summary_text
    db.commit()
    db.refresh(row)
    return ConversationSummaryOut.model_validate(row)


def _generate(
    transcript: str, conversation: Conversation
) -> tuple[str, list[str], list[str], str]:
    if sarvam.configured():
        response = sarvam.chat_completion(
            [
                {"role": "system", "content": _TERMINAL_SUMMARY_PROMPT},
                {"role": "user", "content": transcript[:12000]},
            ],
            temperature=0.2,
            max_tokens=400,
        )
        if response.ok and response.data.get("content"):
            text = str(response.data["content"]).strip()
            return text, _bullet_points(text), _action_items(conversation), "sarvam-m"

        # The heuristic below is kept so a summary always exists, but a rejected
        # key must be visible in the logs - a silent downgrade looks like a
        # model-quality problem instead of a configuration one. Only the status
        # and the sanitised provider error are logged: never the transcript.
        if sarvam.auth_failed(response):
            logger.warning(
                "sarvam_summary_auth_rejected",
                provider="sarvam",
                status_code=response.status_code,
                fallback="offline-heuristic",
            )
        else:
            logger.warning(
                "sarvam_summary_failed",
                provider="sarvam",
                status_code=response.status_code,
                error=response.error,
                fallback="offline-heuristic",
            )

    # Heuristic fallback: still produce a useful, structured summary.
    lines = [line for line in transcript.splitlines() if line.strip()]
    speakers = {line.split(":", 1)[0] for line in lines}
    summary = (
        f"{len(lines)} utterances across {len(speakers)} speakers. "
        f"Outcome recorded as {conversation.outcome or 'unknown'}. "
        f"{truncate(lines[-1], 200) if lines else ''}"
    )
    return summary.strip(), lines[:5], _action_items(conversation), "offline-heuristic"


def _bullet_points(text: str) -> list[str]:
    points: list[str] = []
    for line in text.splitlines():
        cleaned = line.strip().lstrip("-*• ").strip()
        if cleaned:
            points.append(cleaned)
    return points[:8]


def _action_items(conversation: Conversation) -> list[str]:
    if conversation.outcome == "appointment_booked":
        return ["Confirm the appointment slot", "Send a calendar invite"]
    if conversation.outcome in {"no_answer", "busy"}:
        return ["Retry the call"]
    if conversation.outcome == "not_interested":
        return ["Close the lead"]
    return ["Review the call and assign the next step"]


# ---------------------------------------------------------------------------
# Sentiment / language helpers used by the media pipeline
# ---------------------------------------------------------------------------
def detect_language(text: str) -> dict[str, Any]:
    result = sarvam.identify_language(text)
    return {
        "detected_language": str(result.data.get("language_code") or "en-IN"),
        "confidence": float(result.data.get("confidence") or 0.5),
        "text": text,
    }


def record_sentiment(db: Session, conversation: Conversation, sentiment: str) -> None:
    conversation.sentiment = sentiment[:24]
    call = db.get(Call, conversation.call_id)
    if call is not None:
        call.sentiment = conversation.sentiment
    db.commit()
