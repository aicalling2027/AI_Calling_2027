"""Request correlation, timing and access logging.

Every request gets an ``X-Request-ID`` that is echoed back to the client and
embedded in the error envelope, so a user-reported error can be traced to a
single log line.
"""

from __future__ import annotations

import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.logging import get_logger

logger = get_logger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"

#: Available to code that has no access to the ``Request`` object (workers,
#: deeply nested helpers, third-party hooks).
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

#: Paths that would otherwise flood the log with probe noise.
_QUIET_PATHS = frozenset({"/health", "/ready", "/metrics", "/favicon.ico"})


def current_request_id() -> str | None:
    """Return the id of the request being served on this task/thread, if any."""
    return request_id_var.get()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Stamp a request id, time the handler and emit one access log line."""

    def __init__(self, app: ASGIApp, *, log_requests: bool = True) -> None:
        super().__init__(app)
        self.log_requests = log_requests

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming.strip()[:64] if incoming and incoming.strip() else uuid.uuid4().hex

        request.state.request_id = request_id
        token = request_id_var.set(request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)

        duration_ms = (time.perf_counter() - started) * 1000.0
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"

        if self.log_requests and request.url.path not in _QUIET_PATHS:
            level = logger.warning if response.status_code >= 500 else logger.info
            level(
                "%s %s -> %s in %.1fms rid=%s client=%s",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                request_id,
                _client_ip(request),
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 1),
                },
            )
        return response


def _client_ip(request: Request) -> str:
    """Best-effort client address, honouring one layer of proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:64]
    return request.client.host if request.client else "unknown"
