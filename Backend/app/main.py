"""FastAPI application factory.

``python app.py`` (the supported entry point) imports :func:`create_app`; tests
import it directly and hand it to ``TestClient``. Nothing here performs network
I/O at import time, so the module is safe to import in a REPL or a doc build.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import api_router
from app.api.v1.health import router as health_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging, get_logger
from app.database.init_db import DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, init_database
from app.database.session import check_database
from app.integrations import registry
from app.middleware import (
    RateLimitMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
)

logger = get_logger(__name__)

DESCRIPTION = """
**OWN AI** - multilingual AI calling platform.

Create an AI employee, point a phone number at it, upload your knowledge base and
the platform will place outbound calls, answer inbound ones, capture outcomes and
push qualified leads into your CRM.

### Getting started
1. `POST /api/v1/auth/login` with the demo credentials shown in the console.
2. `POST /api/v1/employees` to create an AI employee (or use a template).
3. `POST /api/v1/leads` to add contacts, then `POST /api/v1/campaigns`.
4. Read `GET /api/v1/dashboard` for results.

Every integration degrades gracefully: without provider credentials the endpoints
still work and return clearly-marked simulated results, so the whole product can
be exercised locally.
"""

TAGS_METADATA = [
    {"name": "Health", "description": "Liveness, readiness and capability discovery."},
    {"name": "Authentication", "description": "Signup, login, tokens and profile."},
    {"name": "Organization", "description": "Tenant profile and team management."},
    {"name": "AI Employees", "description": "Voice agents: prompts, voices, languages."},
    {"name": "Phone Numbers", "description": "Numbers attached to AI employees."},
    {"name": "Leads", "description": "Contact records, imports and activity timeline."},
    {"name": "Follow-ups", "description": "Scheduled callbacks."},
    {"name": "Campaigns", "description": "Bulk outbound calling runs."},
    {"name": "Calls", "description": "Outbound placement, inbound registration, results."},
    {"name": "Conversations", "description": "Transcripts, summaries and sentiment."},
    {"name": "Knowledge Base", "description": "Training documents and semantic search."},
    {"name": "Analytics", "description": "Dashboard and per-employee performance."},
    {"name": "Billing", "description": "Plans, credits, payments and invoices."},
    {"name": "Integrations", "description": "Provider connections and readiness."},
    {"name": "Automation", "description": "Workflow triggers and execution history."},
    {"name": "Webhooks", "description": "Inbound webhook registrations."},
    {"name": "Notifications", "description": "WhatsApp and other outbound messages."},
    {"name": "Developers", "description": "API keys, audit trail and quickstart."},
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: ARG001
    """Prepare the process: schema, seed data, startup diagnostics."""
    configure_logging()
    started = time.perf_counter()

    try:
        init_database()
    except Exception:
        logger.exception("Database initialisation failed.")
        raise

    readiness = registry.summary()
    logger.info(
        "%s %s starting | env=%s | database=%s | providers ready=%d simulated=%d",
        settings.app_name,
        settings.app_version,
        settings.app_env,
        settings.database_target,
        readiness["ready"] if isinstance(readiness["ready"], int) else len(readiness["ready"]),
        readiness["simulated"] if isinstance(readiness["simulated"], int) else len(readiness["simulated"]),
    )

    if not settings.is_production:
        logger.info(
            "Interactive API docs: http://%s:%s/docs  (demo login: %s / %s)",
            settings.app_host,
            settings.app_port,
            DEMO_ADMIN_EMAIL,
            DEMO_ADMIN_PASSWORD,
        )
    else:
        _warn_insecure_production_defaults()

    logger.info("Startup complete in %.0fms", (time.perf_counter() - started) * 1000)
    yield
    logger.info("%s shutting down.", settings.app_name)


def create_app() -> FastAPI:
    """Build and configure the ASGI application."""
    configure_logging()

    app = FastAPI(
        title=f"{settings.app_name} API",
        version=settings.app_version,
        description=DESCRIPTION,
        openapi_tags=TAGS_METADATA,
        docs_url=settings.docs_url,
        redoc_url=settings.redoc_url,
        openapi_url=None if settings.is_production else "/openapi.json",
        lifespan=lifespan,
        contact={"name": "OWN AI", "url": "https://ownai.example"},
        license_info={"name": "Proprietary"},
    )

    _install_middleware(app)
    _install_exception_handlers(app)
    _install_routes(app)
    app.openapi = _build_openapi(app)  # type: ignore[method-assign]
    return app


# ---------------------------------------------------------------------------
# Middleware - registered outermost-last so the request id exists for logs
# ---------------------------------------------------------------------------
def _install_middleware(app: FastAPI) -> None:
    """Register the stack. Starlette builds it in reverse, so the *last* added
    middleware is the *outermost* one. Target inbound order:

    RequestContext -> CORS -> GZip -> SecurityHeaders -> RateLimit -> route
    """
    app.add_middleware(
        RateLimitMiddleware,
        limit=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
        enabled=settings.rate_limit_enabled,
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time-Ms", "X-RateLimit-Remaining"],
    )
    app.add_middleware(RequestContextMiddleware)


# ---------------------------------------------------------------------------
# Error envelope - one shape for every failure
# ---------------------------------------------------------------------------
def _install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        if exc.status_code >= 500:
            logger.error("app_error %s: %s", exc.code, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_payload(request_id),
            headers={"X-Request-ID": request_id} if request_id else None,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        fields = [
            {
                "field": ".".join(str(part) for part in error.get("loc", ())[1:]) or "body",
                "message": error.get("msg", "Invalid value."),
                "type": error.get("type", "value_error"),
            }
            for error in exc.errors()
        ]
        payload: dict[str, Any] = {
            "error": {
                "code": "validation_error",
                "message": "The submitted data is invalid.",
                "details": {"fields": fields},
            }
        }
        if request_id:
            payload["error"]["request_id"] = request_id
        return JSONResponse(status_code=422, content=payload)

    @app.exception_handler(IntegrityError)
    async def _integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.warning("integrity_error", extra={"error": str(exc.orig)})
        payload: dict[str, Any] = {
            "error": {
                "code": "conflict",
                "message": "The request conflicts with an existing record.",
            }
        }
        if request_id:
            payload["error"]["request_id"] = request_id
        return JSONResponse(status_code=409, content=payload)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        payload: dict[str, Any] = {
            "error": {
                "code": _reason_code(exc.status_code),
                "message": str(exc.detail),
            }
        }
        if request_id:
            payload["error"]["request_id"] = request_id
        return JSONResponse(
            status_code=exc.status_code,
            content=payload,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        payload: dict[str, Any] = {
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred. Please contact support"
                + (f" with request id {request_id}." if request_id else "."),
            }
        }
        if request_id:
            payload["error"]["request_id"] = request_id
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload
        )


def _reason_code(code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        413: "payload_too_large",
        415: "unsupported_media_type",
        422: "validation_error",
        429: "rate_limited",
        500: "internal_error",
        502: "provider_error",
        503: "service_unavailable",
    }.get(code, "error")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
def _install_routes(app: FastAPI) -> None:
    # Probes stay at the root so load balancers need no path prefix config.
    app.include_router(health_router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["Health"], summary="Service index")
    def index() -> dict[str, Any]:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "environment": settings.app_env,
            "status": "ok" if check_database() else "degraded",
            "links": {
                "health": "/health",
                "ready": "/ready",
                "capabilities": "/capabilities",
                "docs": settings.docs_url or "(disabled in production)",
                "api": settings.api_v1_prefix,
            },
        }


# ---------------------------------------------------------------------------
# OpenAPI
# ---------------------------------------------------------------------------
def _build_openapi(app: FastAPI):
    """Add the auth schemes so the Swagger UI gains an *Authorize* button."""

    def openapi(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
            tags=TAGS_METADATA,
        )
        components = schema.setdefault("components", {})
        components.setdefault("securitySchemes", {}).update(
            {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Paste the `access_token` returned by /auth/login.",
                },
                "ApiKeyAuth": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-API-Key",
                    "description": "Server-to-server key issued by /developers/api-keys.",
                },
            }
        )
        servers = schema.setdefault("servers", [])
        if settings.public_base_url:
            servers.append({"url": settings.public_base_url.rstrip("/")})
        servers.append({"url": "/", "description": "This server"})

        app.openapi_schema = schema
        return schema

    return openapi


def _warn_insecure_production_defaults() -> None:
    """Refuse to be quiet about development secrets in a production process."""
    problems: list[str] = []
    if settings.jwt_secret.startswith("dev-insecure") or len(settings.jwt_secret) < 32:
        problems.append("JWT_SECRET is a development default or shorter than 32 chars")
    if settings.telephony_webhook_secret in ("", "change-me"):
        problems.append("TELEPHONY_WEBHOOK_SECRET is not set")
    if "*" in settings.cors_origins:
        problems.append("CORS_ORIGINS allows every origin")
    for problem in problems:
        logger.warning("Insecure production configuration: %s", problem)


app = create_app()
