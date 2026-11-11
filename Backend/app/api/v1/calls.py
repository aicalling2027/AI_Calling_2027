"""Call lifecycle: place, monitor, cancel and record outcomes.

Provider callbacks live in :mod:`app.api.v1.webhooks` because they authenticate
with a shared secret rather than a user token.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.config import settings
from app.core.constants import Perm
from app.modules import calls
from app.schemas.call import (
    CallCreate,
    CallDetail,
    CallOut,
    CallOutcomeUpdate,
    CallQueuedResponse,
)
from app.schemas.common import Page

router = APIRouter(prefix="/calls", tags=["Calls"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.CALLS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.CALLS_WRITE))]


def _webhook_base(request: Request) -> str:
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    return str(request.base_url).rstrip("/")


@router.get("", response_model=Page[CallOut], summary="List calls")
def list_calls(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    direction: str | None = None,
    status_filter: str | None = None,
    outcome: str | None = None,
    employee_id: str | None = None,
    campaign_id: str | None = None,
    lead_id: str | None = None,
    search: str | None = None,
) -> Page[CallOut]:
    rows, total = calls.list_calls(
        db,
        principal.organization_id,
        params,
        direction=direction,
        status=status_filter,
        outcome=outcome,
        employee_id=employee_id,
        campaign_id=campaign_id,
        lead_id=lead_id,
        search=search,
    )
    return Page[CallOut].build(rows, total=total, page=params.page, page_size=params.page_size)


@router.post(
    "/outbound",
    response_model=CallQueuedResponse,
    summary="Place an outbound call",
)
def create_outbound_call(
    payload: CallCreate, request: Request, principal: Writer, db: DbSession
) -> CallQueuedResponse:
    return calls.queue_outbound_call(
        db,
        principal.organization,
        payload,
        user_id=principal.user_id,
        webhook_base_url=_webhook_base(request),
    )


@router.get("/active", summary="How many calls are live right now")
def active_calls(
    principal: Reader,
    db: DbSession,
    employee_id: str | None = None,
) -> dict[str, int]:
    return {
        "active_calls": calls.active_call_count(
            db, principal.organization_id, employee_id=employee_id
        )
    }


@router.get("/{call_id}", response_model=CallDetail, summary="Get a call")
def get_call(call_id: str, principal: Reader, db: DbSession) -> CallDetail:
    call = calls.get_call(db, principal.organization_id, call_id)
    return calls.call_detail(db, call)


@router.post("/{call_id}/outcome", response_model=CallDetail, summary="Record the outcome")
def update_outcome(
    call_id: str, payload: CallOutcomeUpdate, principal: Writer, db: DbSession
) -> CallDetail:
    call = calls.get_call(db, principal.organization_id, call_id)
    updated = calls.update_outcome(db, call, payload, user_id=principal.user_id)
    return calls.call_detail(db, updated)


@router.post("/{call_id}/cancel", response_model=CallDetail, summary="Cancel a queued call")
def cancel_call(call_id: str, principal: Writer, db: DbSession) -> CallDetail:
    call = calls.get_call(db, principal.organization_id, call_id)
    cancelled = calls.cancel_call(db, call, user_id=principal.user_id)
    return calls.call_detail(db, cancelled)
