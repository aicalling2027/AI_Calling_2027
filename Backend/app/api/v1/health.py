"""Liveness, readiness and capability discovery.

``/health`` must answer without touching the database so Kubernetes liveness
probes never restart a pod because of a transient database blip. ``/ready``
does the real dependency checks.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.config import settings
from app.database.session import check_database
from app.integrations import registry
from app.utils.datetime_utils import readiness_summary

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness probe")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
    }


@router.get("/ready", summary="Readiness probe")
def ready() -> dict[str, Any]:
    database_ok = check_database()
    integrations = registry.summary()
    return {
        "status": "ready" if database_ok else "degraded",
        "database": {"ok": database_ok, "dialect": "sqlite" if settings.is_sqlite else "postgresql"},
        "integrations": {
            "total": integrations["total"],
            "ready": integrations["ready"],
            "simulated": integrations["simulated"],
        },
        "runtime": readiness_summary(),
    }


@router.get("/capabilities", summary="What this deployment can actually do")
def capabilities() -> dict[str, Any]:
    """Feature discovery - the frontend uses this to hide unusable controls."""
    summary = registry.summary()
    return {
        "providers": summary["detail"],
        "ready": summary["ready"],
        "simulated": summary["simulated"],
        "features": {
            "voice_calls": True,
            "inbound_calls": True,
            "campaigns": True,
            "knowledge_base": True,
            "whatsapp": "whatsapp" in summary["ready"],
            "payments": "razorpay" in summary["ready"],
            "automation": "n8n" in summary["ready"],
            "sheets_sync": "google_sheets" in summary["ready"],
            "calendar": "calendly" in summary["ready"],
            "meetings": "zoom" in summary["ready"],
        },
    }
