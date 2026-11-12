"""Public voice catalogue for the marketing site.

These routes are deliberately unauthenticated: the landing page lists the
catalogue and plays one cached sample per voice. Preview text is fixed
server-side, so this cannot be repurposed as a free text-to-speech proxy.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.modules import voices
from app.schemas.voice import VoiceOut, VoicePreview

router = APIRouter(prefix="/voices", tags=["Voices"])


@router.get("", response_model=list[VoiceOut], summary="List the public voice catalogue")
def list_voices() -> list[VoiceOut]:
    return voices.catalog()


@router.get(
    "/{voice_id}/preview",
    response_model=VoicePreview,
    summary="Synthesise a short sample of one voice",
)
def preview_voice(
    voice_id: str,
    language: str | None = Query(
        default=None,
        description="BCP-47 code the voice is offered in; defaults to its preview language.",
    ),
) -> VoicePreview:
    return voices.preview(voice_id, language)
