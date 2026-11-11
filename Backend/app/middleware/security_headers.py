"""Static response hardening headers.

Cheap defence-in-depth for browser-facing deployments. These headers are
harmless for API consumers and stop the most common classes of attack
(sniffing, framing, referrer leakage) without needing a reverse proxy rule.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach conservative security headers to every response."""

    def __init__(self, app: ASGIApp, *, hsts: bool = True) -> None:
        super().__init__(app)
        self.hsts = hsts

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        # Interactive docs are same-origin frames; everything else must not be
        # framed, so keep the CSP loose only for the Swagger/ReDoc pages.
        if request.url.path in ("/docs", "/redoc"):
            headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: "
                "https://fastapi.tiangolo.com; style-src 'self' 'unsafe-inline' "
                "https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' "
                "https://cdn.jsdelivr.net",
            )
        else:
            # API responses are consumed by fetch/httpx, not rendered as
            # documents, so only the framing directive is meaningful here.
            headers.setdefault("Content-Security-Policy", "frame-ancestors 'none'")

        if self.hsts and request.url.scheme == "https":
            headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response
