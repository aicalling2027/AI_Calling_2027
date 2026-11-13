"""Voice catalogue and preview samples served to the public site.

The catalogue itself is static reference data (``VOICE_PROFILES``). The only
work here that reaches a provider is :func:`preview`, which asks Sarvam to
synthesise a fixed sentence per voice. Samples are cached in-process because
every visitor plays the same handful of clips, and the preview text never comes
from the caller.

``catalog()`` lists only the marketing voices, but ``preview()`` also answers for
the dashboard speakers in ``PREVIEW_SPEAKERS``: an operator choosing a voice has
to hear it before committing. A catalogue id whose speaker is unknown is refused
before it reaches the provider - synthesis is requested by speaker name, so
forwarding the id could only ever produce a provider error.
"""

from __future__ import annotations

import re
import threading
import time
from collections.abc import Iterable

from app.core.constants import (
    PREVIEW_SPEAKERS,
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
        )
        for profile in VOICE_PROFILES
    ]


#: Speakers an operator can pick in the dashboard have no marketing profile,
#: so their sample is a neutral line rather than a curated one. The point of a
#: preview is hearing the speaker, not the copy.
_FALLBACK_SAMPLE = "Hello, this is a short sample of how this voice sounds."
_FALLBACK_LANGUAGE = "en-IN"


#: Catalogue ids are UUIDs; speaker names are words. That shape is the line
#: between "a voice we can hear" and "an entry we can only store".
_CATALOGUE_ID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def _sample_text(voice_id: str, language: str | None) -> tuple[str, str]:
    """Resolve the sentence and language to synthesise for ``voice_id``.

    A sample can only be made from a speaker name, so three answers follow:
    an id with a profile or listed in ``PREVIEW_SPEAKERS`` is synthesised, an
    id the catalogue knows but that is not a speaker is a 404 saying so, and
    anything else is a plain 404. Nothing unvetted is forwarded, so this cannot
    be turned into a probe for arbitrary provider speakers.
    """
    profile = next((item for item in VOICE_PROFILES if item["id"] == voice_id), None)

    if profile is None:
        if voice_id not in SUPPORTED_VOICES and voice_id not in PREVIEW_SPEAKERS:
            raise NotFoundError(
                f"Unknown voice '{voice_id}'.",
                code="voice_not_found",
            )
        if _CATALOGUE_ID.match(voice_id):
            # The voice is selectable, but the catalogue publishes no speaker
            # for it. Forwarding the id would come back as a provider error and
            # read as an outage; "no sample yet" is the truth.
            raise NotFoundError(
                f"No sample is available for voice '{voice_id}' yet.",
                code="voice_sample_unavailable",
            )
        chosen = language or _FALLBACK_LANGUAGE
        if chosen not in SUPPORTED_LANGUAGES:
            raise ValidationError(
                f"'{chosen}' is not a supported language.",
                details={"languages": sorted(SUPPORTED_LANGUAGES)},
            )
        return _FALLBACK_SAMPLE, chosen

    offered = [str(code) for code in profile["languages"]]  # type: ignore[union-attr]
    chosen = language or str(profile["preview_language"])
    if chosen not in offered:
        raise ValidationError(
            f"'{voice_id}' is not offered in {chosen}.",
            details={"languages": offered},
        )
    return str(profile["sample"]), chosen


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

    result = sarvam.synthesize(sample_text, speaker=voice_id, language=chosen)

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
