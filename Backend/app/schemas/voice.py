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
    #: What the catalogue prints in place of a name: ``PM-01``, ``SD-07``. The
    #: band and the edition are both readable from it.
    code: str
    #: The speaker's own name. Never rendered - it is kept so search can still
    #: find a voice a customer already knows by name.
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
    #: The public name of the model this speaker belongs to (``AOTMS-V 3B``).
    #: Speaker ids are not portable between models, so the site groups by it.
    model: str = "AOTMS-V 3B"


class VoicePreview(APIModel):
    """A short synthesised sample for one voice."""

    voice_id: str
    language: str
    audio_base64: str
    encoding: str = "wav"
    simulated: bool = False
