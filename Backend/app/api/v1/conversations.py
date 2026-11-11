"""Conversations, transcripts and AI-generated summaries."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import Perm
from app.modules import conversations
from app.schemas.call import (
    ConversationOut,
    ConversationSummaryOut,
    TranscriptAppend,
    TranscriptOut,
)
from app.schemas.common import Page

router = APIRouter(prefix="/conversations", tags=["Conversations"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.CONVERSATIONS_READ))]


@router.get("", response_model=Page[ConversationOut], summary="List conversations")
def list_conversations(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    outcome: str | None = None,
    sentiment: str | None = None,
    language: str | None = None,
) -> Page[ConversationOut]:
    rows, total = conversations.list_conversations(
        db,
        principal.organization_id,
        params,
        outcome=outcome,
        sentiment=sentiment,
        language=language,
    )
    return Page[ConversationOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.get("/{conversation_id}", response_model=ConversationOut, summary="Get a conversation")
def get_conversation(
    conversation_id: str, principal: Reader, db: DbSession
) -> ConversationOut:
    conversation = conversations.get_conversation(
        db, principal.organization_id, conversation_id
    )
    return ConversationOut.model_validate(conversation)


@router.get(
    "/{conversation_id}/transcripts",
    response_model=list[TranscriptOut],
    summary="Full transcript",
)
def list_transcripts(
    conversation_id: str, principal: Reader, db: DbSession
) -> list[TranscriptOut]:
    conversations.get_conversation(db, principal.organization_id, conversation_id)
    return conversations.list_transcripts(db, conversation_id)


@router.post(
    "/{conversation_id}/transcripts",
    response_model=list[TranscriptOut],
    summary="Append transcript lines (streaming agents)",
)
def append_transcripts(
    conversation_id: str,
    payload: TranscriptAppend,
    principal: Reader,
    db: DbSession,
) -> list[TranscriptOut]:
    conversation = conversations.get_conversation(
        db, principal.organization_id, conversation_id
    )
    return conversations.append_transcripts(db, conversation, payload)


@router.get(
    "/{conversation_id}/summary",
    response_model=ConversationSummaryOut | None,
    summary="Latest summary",
)
def latest_summary(
    conversation_id: str, principal: Reader, db: DbSession
) -> ConversationSummaryOut | None:
    conversations.get_conversation(db, principal.organization_id, conversation_id)
    return conversations.latest_summary(db, conversation_id)


@router.post(
    "/{conversation_id}/summarize",
    response_model=ConversationSummaryOut,
    summary="Generate (or regenerate) the summary",
)
def summarize(
    conversation_id: str, principal: Reader, db: DbSession
) -> ConversationSummaryOut:
    conversation = conversations.get_conversation(
        db, principal.organization_id, conversation_id
    )
    return conversations.summarize(db, conversation)
