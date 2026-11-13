"""Shared plumbing for every third-party adapter.

Design rules that keep ``python app.py`` working with zero configuration:

* No adapter imports a vendor SDK - plain ``httpx`` keeps the dependency tree
  small and the wheel install fast.
* Every adapter reports ``configured`` and degrades to a *simulated* result when
  its credentials are missing, so the product is fully explorable offline.
* Failures raise :class:`~app.core.exceptions.ProviderError` with provider
  context, never a bare ``httpx`` exception.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.exceptions import ProviderError
from app.core.logging import get_logger

logger = get_logger(__name__)

RETRY_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})
DEFAULT_TIMEOUT = 20.0
DEFAULT_RETRIES = 2


@dataclass(slots=True)
class ProviderResponse:
    """Normalised result returned by every adapter call."""

    ok: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    status_code: int | None = None
    simulated: bool = False
    latency_ms: int = 0

    def require(self, provider: str) -> dict[str, Any]:
        """Return the payload or raise a typed provider error."""
        if not self.ok:
            raise ProviderError(
                self.error or f"{provider} request failed.",
                details={"provider": provider, "status_code": self.status_code},
            )
        return self.data


def request_json(
    method: str,
    url: str,
    *,
    provider: str,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    retries: int = DEFAULT_RETRIES,
) -> ProviderResponse:
    """Perform an HTTP request with retries and uniform error handling."""
    started = time.perf_counter()
    last_error: str = ""
    last_status: int | None = None

    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                response = client.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_body,
                    data=data,
                )
            elapsed = int((time.perf_counter() - started) * 1000)

            if response.status_code in RETRY_STATUS and attempt < retries:
                last_status = response.status_code
                last_error = _extract_error(response)
                time.sleep(0.4 * (attempt + 1))
                continue

            if response.is_success:
                return ProviderResponse(
                    ok=True,
                    data=_as_dict(response),
                    status_code=response.status_code,
                    latency_ms=elapsed,
                )

            return ProviderResponse(
                ok=False,
                data=_as_dict(response),
                error=_extract_error(response),
                status_code=response.status_code,
                latency_ms=elapsed,
            )
        except httpx.TimeoutException:
            last_error = f"{provider} timed out after {timeout:.0f}s."
        except httpx.HTTPError as exc:
            last_error = f"{provider} connection error: {exc}"
        except ValueError as exc:  # malformed JSON
            last_error = f"{provider} returned invalid JSON: {exc}"

        if attempt < retries:
            time.sleep(0.4 * (attempt + 1))

    elapsed = int((time.perf_counter() - started) * 1000)
    logger.warning("provider_request_failed", provider=provider, error=last_error)
    return ProviderResponse(
        ok=False, error=last_error, status_code=last_status, latency_ms=elapsed
    )


def _as_dict(response: httpx.Response) -> dict[str, Any]:
    if not response.content:
        return {}
    content_type = response.headers.get("content-type", "")
    if "json" in content_type:
        try:
            payload = response.json()
        except (ValueError, json.JSONDecodeError):
            return {"raw": response.text[:2000]}
        if isinstance(payload, dict):
            return payload
        return {"items": payload}
    return {"raw": response.text[:2000]}


#: Vendor bodies occasionally echo the credential they rejected; never let one
#: travel into a log line or an API response.
_SECRET_PATTERNS = (
    (re.compile(r"\bsk_[A-Za-z0-9_\-]{6,}"), "sk_***"),
    (re.compile(r"(?i)\b(bearer)\s+[A-Za-z0-9._\-]{8,}"), r"\1 ***"),
    (re.compile(r"(?i)\b(x-api-key|api-subscription-key)\b\s*[:=]\s*\S+"), r"\1: ***"),
)


def sanitize(text: str | None) -> str:
    """Strip anything credential-shaped out of vendor-supplied text."""
    cleaned = str(text or "")
    for pattern, replacement in _SECRET_PATTERNS:
        cleaned = pattern.sub(replacement, cleaned)
    return cleaned


def _extract_error(response: httpx.Response) -> str:
    """Pull the most useful message out of a vendor error body.

    The machine-readable ``error.code`` is kept next to the message: Sarvam uses
    ``invalid_api_key_error`` to separate a bad credential from a permission
    problem, and losing the code would erase that distinction.
    """
    try:
        payload = response.json()
    except ValueError:
        text = (response.text or "").strip()
        return sanitize(text)[:300] or f"HTTP {response.status_code}"

    if isinstance(payload, dict):
        detail = payload.get("error")
        if isinstance(detail, dict):
            code = detail.get("code")
            message = detail.get("message") or detail.get("description")
            if message:
                text = f"{code}: {message}" if code else str(message)
                return sanitize(text)[:300]
            if code:
                return sanitize(str(code))[:300]
        for key in ("message", "detail", "error_description", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value:
                return sanitize(value)[:300]
    return f"HTTP {response.status_code}"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def simulated(provider: str, data: dict[str, Any] | None = None) -> ProviderResponse:
    """Successful no-op response used when credentials are absent."""
    logger.info("provider_simulated", provider=provider)
    payload: dict[str, Any] = {"simulated": True, "provider": provider}
    if data:
        payload.update(data)
    return ProviderResponse(ok=True, data=payload, simulated=True, latency_ms=0)
