"""ASGI middleware stack.

Starlette builds middleware in reverse registration order, so the last one
added is the outermost. ``app.main`` registers them to produce this inbound
order::

    request-context -> CORS -> gzip -> security-headers -> rate-limit -> route
"""

from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

__all__ = [
    "RateLimitMiddleware",
    "RequestContextMiddleware",
    "SecurityHeadersMiddleware",
]
