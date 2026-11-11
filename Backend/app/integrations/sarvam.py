"""Sarvam AI adapter: chat, TTS, STT, language ID and translation.

Sarvam is the voice brain of the platform (Indic LLM + Bulbul speakers +
Saarika transcription). When ``SARVAM_API_KEY`` is absent every helper falls
back to a deterministic offline implementation so the API surface behaves
identically in demo mode.
"""

from __future__ import annotations

import random
from typing import Any

from app.core.config import settings
from app.core.constants import DEFAULT_LANGUAGE, DEFAULT_MODEL
from app.integrations import ProviderResponse, request_json, simulated
from app.utils.text import collapse_whitespace

PROVIDER = "sarvam"


def configured() -> bool:
    return settings.enabled(settings.sarvam_api_key)


def _headers() -> dict[str, str]:
    return {
        "api-subscription-key": settings.sarvam_api_key,
        "Content-Type": "application/json",
    }


def _url(path: str) -> str:
    return f"{settings.sarvam_base_url.rstrip('/')}/{path.lstrip('/')}"


# ---------------------------------------------------------------------------
# Chat completion
# ---------------------------------------------------------------------------
def chat_completion(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.6,
    max_tokens: int = 512,
    language: str | None = None,
) -> ProviderResponse:
    """Call the Sarvam chat completion endpoint."""
    if not configured():
        return simulated(PROVIDER, {"content": offline_reply(messages, language=language)})

    body: dict[str, Any] = {
        "model": model or settings.sarvam_chat_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if language:
        body["language_code"] = language

    result = request_json(
        "POST",
        _url("/v1/chat/completions"),
        provider=PROVIDER,
        headers=_headers(),
        json_body=body,
        timeout=float(settings.sarvam_timeout_seconds),
    )
    if result.ok:
        result.data.setdefault("content", _first_message(result.data))
    return result


def _first_message(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(message, dict) and message.get("content"):
            return str(message["content"])
    return ""


# ---------------------------------------------------------------------------
# Text to speech / speech to text
# ---------------------------------------------------------------------------
def synthesize(
    text: str, *, speaker: str | None = None, language: str | None = None
) -> ProviderResponse:
    """Convert text to base64 audio using Bulbul."""
    if not configured():
        return simulated(PROVIDER, {"audios": [], "encoding": "simulated"})

    body = {
        "inputs": [collapse_whitespace(text)],
        "target_language_code": language or DEFAULT_LANGUAGE,
        "speaker": speaker or settings.sarvam_default_speaker,
        "model": settings.sarvam_tts_model,
        "speech_sample_rate": 22050,
    }
    return request_json(
        "POST",
        _url("/text-to-speech"),
        provider=PROVIDER,
        headers=_headers(),
        json_body=body,
        timeout=float(settings.sarvam_timeout_seconds),
    )


def transcribe(
    audio_base64: str, *, language: str | None = None, filename: str = "audio.wav"
) -> ProviderResponse:
    """Transcribe a recorded utterance (base64 payload)."""
    if not configured():
        return simulated(PROVIDER, {"transcript": "", "language_code": language or DEFAULT_LANGUAGE})

    body = {
        "model": settings.sarvam_stt_model,
        "language_code": language or DEFAULT_LANGUAGE,
        "audio_base64": audio_base64,
        "filename": filename,
    }
    return request_json(
        "POST",
        _url("/speech-to-text"),
        provider=PROVIDER,
        headers=_headers(),
        json_body=body,
        timeout=float(settings.sarvam_timeout_seconds),
    )


# ---------------------------------------------------------------------------
# Language identification and translation
# ---------------------------------------------------------------------------
def identify_language(text: str) -> ProviderResponse:
    """Detect the BCP-47 language of a piece of text."""
    if not configured():
        return simulated(
            PROVIDER,
            {"language_code": guess_language(text), "script_code": None, "confidence": 0.4},
        )

    result = request_json(
        "POST",
        _url("/text-lang-detection"),
        provider=PROVIDER,
        headers=_headers(),
        json_body={"input": collapse_whitespace(text)[:1000]},
        timeout=float(settings.sarvam_timeout_seconds),
    )
    if result.ok:
        result.data.setdefault("language_code", guess_language(text))
    return result


def translate(text: str, *, target: str, source: str = "auto") -> ProviderResponse:
    """Translate text between Indian languages."""
    if not configured():
        return simulated(PROVIDER, {"translated_text": text})

    return request_json(
        "POST",
        _url("/translate"),
        provider=PROVIDER,
        headers=_headers(),
        json_body={
            "input": collapse_whitespace(text)[:2000],
            "source_language_code": source,
            "target_language_code": target,
        },
        timeout=float(settings.sarvam_timeout_seconds),
    )


def generate_reply(
    *,
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    model: str | None = None,
    temperature: float = 0.6,
    max_tokens: int = 512,
    language: str | None = None,
) -> ProviderResponse:
    """Convenience wrapper used by the employee test console.

    Returns a response whose ``data['content']`` always holds a string, even in
    simulated mode, so callers never have to special-case the demo path.
    """
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})
    return chat_completion(
        messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        language=language,
    )


# ---------------------------------------------------------------------------
# Offline fallbacks
# ---------------------------------------------------------------------------
_SCRIPT_HINTS: tuple[tuple[str, str], ...] = (
    ("\u0900-\u097F", "hi-IN"),  # Devanagari
    ("\u0B80-\u0BFF", "ta-IN"),  # Tamil
    ("\u0C00-\u0C7F", "te-IN"),  # Telugu
    ("\u0980-\u09FF", "bn-IN"),  # Bengali
    ("\u0A80-\u0AFF", "gu-IN"),  # Gujarati
    ("\u0C80-\u0CFF", "kn-IN"),  # Kannada
    ("\u0D00-\u0D7F", "ml-IN"),  # Malayalam
    ("\u0A00-\u0A7F", "pa-IN"),  # Gurmukhi
    ("\u0B00-\u0B7F", "or-IN"),  # Odia
)


def guess_language(text: str) -> str:
    """Unicode-range heuristic used when the detector is unavailable."""
    import re

    for pattern, code in _SCRIPT_HINTS:
        if re.search(f"[{pattern}]", text or ""):
            return code
    return DEFAULT_LANGUAGE


_OPENERS = {
    "hi-IN": "Namaste",
    "ta-IN": "Vanakkam",
    "te-IN": "Namaskaram",
    "bn-IN": "Nomoshkar",
    "gu-IN": "Namaste",
    "kn-IN": "Namaskara",
    "ml-IN": "Namaskaram",
    "en-IN": "Hello",
}

_CLOSERS = (
    "Could you share a little more detail so I can help you properly?",
    "Let me confirm what I have noted so far and we can take the next step.",
    "I can arrange a callback with our team - which time works best for you?",
)


def offline_reply(
    messages: list[dict[str, str]], *, language: str | None = None
) -> str:
    """Deterministic demo reply so the console is usable without an API key.

    Keeps the reply short and business-neutral, mirroring how the real agent
    would respond, and never claims to have performed a real action.
    """
    detected = language or guess_language(" ".join(m.get("content", "") for m in messages))
    opener = _OPENERS.get(detected, "Hello")
    last_user = ""
    for message in reversed(messages):
        if message.get("role") == "user":
            last_user = collapse_whitespace(message.get("content", ""))
            break

    rng = random.Random(last_user or "own-ai")
    closer = rng.choice(_CLOSERS)
    if last_user:
        snippet = last_user[:60]
        return f"{opener}! Thanks for reaching out about \"{snippet}\". {closer}"
    return f"{opener}! Thanks for calling. {closer}"


def build_system_prompt(
    *,
    employee_name: str,
    business_name: str,
    role: str | None,
    base_prompt: str,
    languages: list[str] | None = None,
    guidelines: list[str] | None = None,
) -> str:
    """Compose the final system prompt sent to the model."""
    parts = [f"You are {employee_name}, an AI voice agent for {business_name}."]
    if role:
        parts.append(f"Your role: {role}.")
    if base_prompt:
        parts.append(base_prompt.strip())
    if languages:
        parts.append(
            "You speak these languages and switch automatically to match the caller: "
            + ", ".join(languages)
            + "."
        )
    if guidelines:
        parts.append("Rules you must always follow:")
        parts.extend(f"- {rule}" for rule in guidelines)
    parts.append(
        "Keep every reply under 45 spoken words, confirm important details by repeating "
        "them back, and never invent prices, policies or availability."
    )
    return "\n".join(parts)


def default_model() -> str:
    return settings.sarvam_chat_model or DEFAULT_MODEL
