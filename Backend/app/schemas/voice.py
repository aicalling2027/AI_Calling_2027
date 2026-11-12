"""Voice catalogue schemas - the public list and its preview samples."""

from __future__ import annotations

from app.schemas.common import APIModel


class VoiceLanguage(APIModel):
    """One language a voice is offered in."""

    code: str
    label: str


class VoiceOut(APIModel):
    """A single catalogue entry as the marketing site renders it."""

    id: str
    name: str
    gender: str
    personality: str
    use_case: str
    languages: list[VoiceLanguage]
    preview_language: str
    #: The exact line the preview endpoint synthesises, so the site can print
    #: what the visitor is about to hear.
    sample_text: str
    featured: bool = False


class VoicePreview(APIModel):
    """A short synthesised sample for one voice."""

    voice_id: str
    language: str
    audio_base64: str
    encoding: str = "wav"
    simulated: bool = False
