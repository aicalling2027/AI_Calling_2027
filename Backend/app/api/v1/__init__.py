"""API v1 router aggregation.

Every business capability lives in its own module and exposes one or more
``APIRouter`` objects. This file is the single place that decides what the
public surface looks like, so adding a feature never requires touching
``main.py``.

Order matters for readability of ``/docs`` only - FastAPI resolves routes
per-router, and each module keeps its static segments before ``{id}`` paths.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    auth,
    billing,
    calls,
    campaigns,
    conversations,
    developers,
    employees,
    health,
    integrations,
    leads,
    organizations,
    phone_numbers,
    training,
    webhooks,
)

api_router = APIRouter()

# --- Platform -------------------------------------------------------------
api_router.include_router(health.router)

# --- Identity & tenancy ---------------------------------------------------
api_router.include_router(auth.router)
api_router.include_router(organizations.router)

# --- Core calling product -------------------------------------------------
api_router.include_router(employees.router)
api_router.include_router(phone_numbers.router)
api_router.include_router(leads.router)
api_router.include_router(leads.followups)
api_router.include_router(campaigns.router)
api_router.include_router(calls.router)
api_router.include_router(conversations.router)
api_router.include_router(training.router)

# --- Insights & money -----------------------------------------------------
api_router.include_router(analytics.router)
api_router.include_router(billing.router)

# --- Automation & platform extensions -------------------------------------
api_router.include_router(integrations.router)
api_router.include_router(integrations.workflows)
api_router.include_router(integrations.webhooks)
api_router.include_router(integrations.notifications)
api_router.include_router(developers.router)

# --- Public provider callbacks (unauthenticated, own signature checks) ----
api_router.include_router(webhooks.router)

__all__ = ["api_router"]
