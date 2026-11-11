"""Dashboard and performance reporting."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, Principal, require_permissions
from app.core.constants import Perm
from app.modules import analytics
from app.schemas.analytics import DashboardResponse, PerformanceResponse

router = APIRouter(tags=["Analytics"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.ANALYTICS_READ))]


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Everything the dashboard needs in one call",
)
def get_dashboard(
    principal: Reader,
    db: DbSession,
    days: int | None = Query(None, ge=1, le=365, description="Rolling window in days"),
    start: datetime | None = None,
    end: datetime | None = None,
) -> DashboardResponse:
    return analytics.dashboard(
        db, principal.organization, days=days, start=start, end=end
    )


@router.get(
    "/performance",
    response_model=PerformanceResponse,
    summary="Per-employee performance and trends",
)
def get_performance(
    principal: Reader,
    db: DbSession,
    days: int | None = Query(None, ge=1, le=365),
    start: datetime | None = None,
    end: datetime | None = None,
    employee_id: str | None = None,
) -> PerformanceResponse:
    return analytics.performance(
        db,
        principal.organization,
        days=days,
        start=start,
        end=end,
        employee_id=employee_id,
    )
