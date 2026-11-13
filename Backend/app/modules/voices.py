"""Voice catalogue and preview samples served to the public site.

The catalogue itself is static reference data (``VOICE_PROFILES``). The only
work here that reaches a provider is :func:`preview`, which asks Sarvam to
synthesise a fixed sentence per voice. Samples are cached in-process because
every visitor to the landing page plays the same handful of clips, and the
preview text never comes from the caller.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Iterable

from app.core.constants import SUPPORTED_LANGUAGES, VOICE_PROFILES
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


def _profile(voice_id: str) -> dict[str, object]:
    for profile in VOICE_PROFILES:
        if profile["id"] == voice_id:
            return profile
    raise NotFoundError(
        f"Unknown voice '{voice_id}'.",
        code="voice_not_found",
    )


def preview(voice_id: str, language: str | None = None) -> VoicePreview:
    """Return a short base64 sample of ``voice_id`` in ``language``."""
    profile = _profile(voice_id)
    offered = [str(code) for code in profile["languages"]]  # type: ignore[union-attr]
    chosen = language or str(profile["preview_language"])
    if chosen not in offered:
        raise ValidationError(
            f"'{voice_id}' is not offered in {chosen}.",
            details={"languages": offered},
        )

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

    result = sarvam.synthesize(str(profile["sample"]), speaker=voice_id, language=chosen)

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
