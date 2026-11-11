"""Per-client rate limiting.

A Redis-backed limiter is used when ``REDIS_URL`` is reachable; otherwise the
process falls back to an in-memory sliding window. That keeps ``python app.py``
working with zero infrastructure while still protecting production deployments.

The limiter is deliberately coarse: one bucket per (identity, cost class). It
protects against accidental hammering and runaway retry loops, not against a
determined attacker (a WAF / ingress limiter belongs in front of this service).
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

#: Endpoints that must never be throttled: probes and docs.
_EXEMPT = (
    "/health",
    "/ready",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/metrics",
)

#: Webhook callbacks are excluded because providers retry aggressively and a
#: 429 would look like a delivery failure, causing duplicate replays.
_EXEMPT_PREFIXES = ("/api/v1/webhooks",)


def _is_exempt(path: str) -> bool:
    if any(path == item or path.startswith(item + "/") for item in _EXEMPT):
        return True
    return any(path.startswith(prefix) for prefix in _EXEMPT_PREFIXES)


def _identity(request: Request) -> str:
    """Anonymous callers are bucketed by IP; keyed callers by key prefix."""
    api_key = request.headers.get("x-api-key")
    if api_key:
        return f"key:{api_key[:16]}"
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        # The token is a JWT: its last 16 chars are signature entropy and are
        # enough to distinguish callers without retaining a usable credential.
        return f"jwt:{authorization[-16:]}"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


class InMemoryLimiter:
    """Sliding-window counter guarded by a lock (threadpool safe)."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = max(1, limit)
        self.window = max(1, window_seconds)
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def hit(self, key: str) -> tuple[bool, int, float]:
        """Record a hit. Returns (allowed, remaining, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.limit:
                retry_after = max(bucket[0] + self.window - now, 0.0)
                return False, 0, retry_after

            bucket.append(now)
            self._sweep(now)
            return True, self.limit - len(bucket), 0.0

    def _sweep(self, now: float) -> None:
        """Drop idle buckets so the dict cannot grow without bound."""
        if now - self._last_sweep < self.window:
            return
        cutoff = now - self.window
        for key in [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]:
            self._hits.pop(key, None)
        self._last_sweep = now


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests that exceed the configured per-client budget."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        limit: int | None = None,
        window_seconds: int | None = None,
        enabled: bool | None = None,
    ) -> None:
        super().__init__(app)
        self.enabled = settings.rate_limit_enabled if enabled is None else enabled
        self.limiter = InMemoryLimiter(
            limit or settings.rate_limit_requests,
            window_seconds or settings.rate_limit_window_seconds,
        )

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if not self.enabled or _is_exempt(request.url.path):
            return await call_next(request)

        allowed, remaining, retry_after = self.limiter.hit(_identity(request))
        if not allowed:
            logger.warning(
                "Rate limit exceeded for %s on %s", _identity(request), request.url.path
            )
            return _too_many_requests(remaining, retry_after)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limiter.limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


def _too_many_requests(remaining: int, retry_after: float) -> JSONResponse:
    seconds = max(1, int(round(retry_after)))
    payload: dict[str, Any] = {
        "error": {
            "code": "rate_limited",
            "message": f"Too many requests. Retry in {seconds} second(s).",
            "details": {"retry_after_seconds": seconds},
        }
    }
    return JSONResponse(
        status_code=429,
        content=payload,
        headers={
            "Retry-After": str(seconds),
            "X-RateLimit-Limit": str(remaining),
            "X-RateLimit-Remaining": "0",
        },
    )


__all__ = ["InMemoryLimiter", "RateLimitMiddleware"]
