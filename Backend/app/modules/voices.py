"""Voice catalogue and preview samples served to the public site.

The catalogue itself is static reference data (``VOICE_PROFILES``). The only
work here that reaches a provider is :func:`preview`, which asks Sarvam to
synthesise one short line per voice and language. Samples are cached in-process
because every visitor plays the same handful of clips, and the preview text
never comes from the caller.

One speaker can render every language the speech API publishes, so a preview is
available for every catalogue voice in every one of ``PREVIEW_LINES``: the
language is chosen by the caller, the sentence is not. An id the catalogue
knows but publishes no speaker for is refused before it reaches the provider -
synthesis is requested by speaker name, so forwarding the id could only ever
produce a provider error.

The catalogue spans two model families whose speaker sets are disjoint, so a
preview is synthesised with the model its speaker belongs to; the API rejects a
speaker sent to the other family.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Iterable

from app.core.constants import (
    PREVIEW_LANGUAGE,
    PREVIEW_LINES,
    SUPPORTED_LANGUAGES,
    SUPPORTED_VOICES,
    VOICE_PROFILES,
)
from app.core.exceptions import (
    NotFoundError,
    ProviderError,
    ProviderNotConfiguredError,
    ValidationError,
)
from app.integrations import sarvam
from app.schemas.voice import VoiceLanguage, VoiceOut, VoicePreview

#: Samples are deterministic; six hours keeps the edge case of a re-recorded
#: voice from being cached for the life of the process.
_PREVIEW_TTL_SECONDS = 6 * 60 * 60

_cache: dict[tuple[str, str], tuple[float, VoicePreview]] = {}
_cache_lock = threading.Lock()


def _languages(codes: Iterable[object]) -> list[VoiceLanguage]:
    return [
        VoiceLanguage(code=code, label=SUPPORTED_LANGUAGES.get(code, code))
        for code in (str(item) for item in codes)
    ]


def catalog() -> list[VoiceOut]:
    """Every voice the site may list, in curated display order."""
    return [
        VoiceOut(
            id=str(profile["id"]),
            name=str(profile["name"]),
            gender=str(profile["gender"]),
            personality=str(profile["personality"]),
            use_case=str(profile["use_case"]),
            languages=_languages(profile["languages"]),  # type: ignore[arg-type]
            preview_language=str(profile["preview_language"]),
            sample_text=str(profile["sample"]),
            featured=bool(profile["featured"]),
            model=str(profile["model"]),
        )
        for profile in VOICE_PROFILES
    ]


#: Speakers that can actually be synthesised. A catalogue id may be selectable
#: without being one of these - the frontend still carries a generation of ids
#: the provider never published a speaker for.
_SPEAKERS = frozenset(str(profile["id"]) for profile in VOICE_PROFILES)

#: The model each speaker must be synthesised with. Kept beside the speaker set
#: so the two cannot disagree about which family a voice belongs to.
_MODEL_BY_VOICE = {str(profile["id"]): str(profile["model"]) for profile in VOICE_PROFILES}


def _sample_text(voice_id: str, language: str | None) -> tuple[str, str]:
    """Resolve the sentence and language to synthesise for ``voice_id``.

    A sample can only be made from a speaker name, so two answers follow: a
    catalogue speaker gets the one fixed line in the requested language, and
    anything else is a 404 - an id the catalogue knows but publishes no speaker
    for says exactly that, and an id it has never seen is simply unknown. Nothing
    unvetted is forwarded, so this cannot be turned into a probe for arbitrary
    provider speakers.
    """
    chosen = language or PREVIEW_LANGUAGE
    if chosen not in PREVIEW_LINES:
        raise ValidationError(
            f"'{chosen}' is not a language this voice can speak.",
            details={"languages": sorted(PREVIEW_LINES)},
        )

    if voice_id in _SPEAKERS:
        return PREVIEW_LINES[chosen], chosen

    if voice_id in SUPPORTED_VOICES:
        # The voice is selectable, but the catalogue publishes no speaker
        # for it. Forwarding the id would come back as a provider error and
        # read as an outage; "no sample yet" is the truth.
        raise NotFoundError(
            f"No sample is available for voice '{voice_id}' yet.",
            code="voice_sample_unavailable",
        )

    raise NotFoundError(
        f"Unknown voice '{voice_id}'.",
        code="voice_not_found",
    )


def preview(voice_id: str, language: str | None = None) -> VoicePreview:
    """Return a short base64 sample of ``voice_id`` in ``language``."""
    sample_text, chosen = _sample_text(voice_id, language)

    key = (voice_id, chosen)
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    if not sarvam.configured():
        raise ProviderNotConfiguredError(
            "Voice previews need SARVAM_API_KEY to be configured.",
            details={"provider": "sarvam"},
        )

    result = sarvam.synthesize(
        sample_text,
        speaker=voice_id,
        language=chosen,
        model=_MODEL_BY_VOICE.get(voice_id),
    )

    # A rejected key is a configuration problem, not a synthesis failure: it has
    # to reach the operator as 503 rather than a generic 502.
    sarvam.raise_for_failure(result, action="synthesise a voice sample")

    audios = result.data.get("audios")
    if not audios:
        raise ProviderError(
            "Sarvam accepted the request but returned no audio.",
            details={"provider": "sarvam", "status_code": result.status_code},
        )

    sample = VoicePreview(
        voice_id=voice_id,
        language=chosen,
        audio_base64=str(audios[0]),
        encoding=str(result.data.get("encoding") or "wav"),
        simulated=result.simulated,
    )
    with _cache_lock:
        _cache[key] = (now + _PREVIEW_TTL_SECONDS, sample)
    return sample
