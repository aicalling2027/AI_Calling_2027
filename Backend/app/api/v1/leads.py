"""Leads, contacts, activities and follow-ups."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import LeadSource, Perm
from app.integrations import google_sheets
from app.modules import leads
from app.schemas.common import MessageResponse, Page
from app.schemas.lead import (
    BulkImportResult,
    BulkLeadImport,
    BulkLeadItem,
    FollowUpCreate,
    FollowUpOut,
    LeadActivityOut,
    LeadAssignRequest,
    LeadCreate,
    LeadDetail,
    LeadStatusUpdate,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["Leads"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.LEADS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.LEADS_WRITE))]


@router.get("", response_model=Page[LeadDetail], summary="Search and list leads")
def list_leads(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    status_filter: str | None = None,
    source: str | None = None,
    employee_id: str | None = None,
    campaign_id: str | None = None,
    assigned_to: str | None = None,
    search: str | None = None,
) -> Page[LeadDetail]:
    rows, total = leads.list_leads(
        db,
        principal.organization_id,
        params,
        status=status_filter,
        source=source,
        employee_id=employee_id,
        campaign_id=campaign_id,
        assigned_to=assigned_to,
        search=search,
    )
    return Page[LeadDetail].build(rows, total=total, page=params.page, page_size=params.page_size)


@router.post(
    "",
    response_model=LeadDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a lead",
)
def create_lead(payload: LeadCreate, principal: Writer, db: DbSession) -> LeadDetail:
    lead = leads.create_lead(db, principal.organization, payload, user_id=principal.user_id)
    return leads.lead_detail(db, lead)


@router.post(
    "/bulk",
    response_model=BulkImportResult,
    summary="Bulk import leads (deduplicated by phone)",
)
def bulk_import(
    payload: BulkLeadImport, principal: Writer, db: DbSession
) -> BulkImportResult:
    return leads.bulk_import(db, principal.organization, payload, user_id=principal.user_id)


@router.post(
    "/import/sheets",
    response_model=BulkImportResult,
    summary="Import leads from the connected Google Sheet",
)
def import_from_sheets(
    principal: Writer,
    db: DbSession,
    employee_id: str | None = None,
    limit: int = Query(500, ge=1, le=5000),
) -> BulkImportResult:
    """Pull rows from Google Sheets, normalise them and run the normal bulk import."""
    records = google_sheets.fetch_rows()[:limit]
    items = [BulkLeadItem(**row) for row in google_sheets.to_leads(records)]
    payload = BulkLeadImport(
        leads=items, employee_id=employee_id, source=LeadSource.API, source_detail="google_sheets"
    )
    return leads.bulk_import(db, principal.organization, payload, user_id=principal.user_id)


@router.get("/{lead_id}", response_model=LeadDetail, summary="Get a lead")
def get_lead(lead_id: str, principal: Reader, db: DbSession) -> LeadDetail:
    lead = leads.get_lead(db, principal.organization_id, lead_id)
    return leads.lead_detail(db, lead)


@router.patch("/{lead_id}", response_model=LeadDetail, summary="Update a lead")
def update_lead(
    lead_id: str, payload: LeadUpdate, principal: Writer, db: DbSession
) -> LeadDetail:
    lead = leads.get_lead(db, principal.organization_id, lead_id)
    updated = leads.update_lead(db, lead, payload, user_id=principal.user_id)
    return leads.lead_detail(db, updated)


@router.post("/{lead_id}/status", response_model=LeadDetail, summary="Move a lead through the funnel")
def update_status(
    lead_id: str, payload: LeadStatusUpdate, principal: Writer, db: DbSession
) -> LeadDetail:
    lead = leads.get_lead(db, principal.organization_id, lead_id)
    updated = leads.update_status(db, lead, payload, user_id=principal.user_id)
    return leads.lead_detail(db, updated)


@router.post("/{lead_id}/assign", response_model=LeadDetail, summary="Assign a lead to a user")
def assign_lead(
    lead_id: str, payload: LeadAssignRequest, principal: Writer, db: DbSession
) -> LeadDetail:
    lead = leads.get_lead(db, principal.organization_id, lead_id)
    updated = leads.assign_lead(db, lead, payload.assigned_to, user_id=principal.user_id)
    return leads.lead_detail(db, updated)


@router.delete("/{lead_id}", response_model=MessageResponse, summary="Delete a lead")
def delete_lead(lead_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    lead = leads.get_lead(db, principal.organization_id, lead_id)
    leads.delete_lead(db, lead, user_id=principal.user_id)
    return MessageResponse(message="Lead deleted.")


@router.get(
    "/{lead_id}/activities", response_model=list[LeadActivityOut], summary="Lead timeline"
)
def list_activities(
    lead_id: str,
    principal: Reader,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
) -> list[LeadActivityOut]:
    leads.get_lead(db, principal.organization_id, lead_id)
    return leads.list_activities(db, lead_id, limit=limit)


@router.post(
    "/{lead_id}/activities",
    response_model=LeadActivityOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log a manual activity",
)
def add_activity(
    lead_id: str,
    principal: Writer,
    db: DbSession,
    activity_type: str = Query(..., max_length=48),
    description: str | None = Query(None, max_length=2000),
) -> LeadActivityOut:
    lead = leads.get_lead(db, principal.organization_id, lead_id)
    return leads.add_activity(
        db,
        lead,
        activity_type=activity_type,
        description=description,
        actor_id=principal.user_id,
    )


# ---------------------------------------------------------------------------
# Follow-ups
# ---------------------------------------------------------------------------
followups = APIRouter(prefix="/followups", tags=["Follow-ups"])


@followups.get("", response_model=list[FollowUpOut], summary="List follow-ups")
def list_followups(
    principal: Reader,
    db: DbSession,
    status_filter: str | None = None,
    lead_id: str | None = None,
    limit: int = Query(100, ge=1, le=500),
) -> list[FollowUpOut]:
    return leads.list_followups(
        db, principal.organization_id, status=status_filter, lead_id=lead_id, limit=limit
    )


@followups.post(
    "",
    response_model=FollowUpOut,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a follow-up",
)
def create_followup(
    payload: FollowUpCreate, principal: Writer, db: DbSession
) -> FollowUpOut:
    return leads.create_followup(
        db, principal.organization_id, payload, user_id=principal.user_id
    )


@followups.post("/{followup_id}/complete", response_model=FollowUpOut, summary="Complete a follow-up")
def complete_followup(followup_id: str, principal: Writer, db: DbSession) -> FollowUpOut:
    return leads.complete_followup(
        db, principal.organization_id, followup_id, user_id=principal.user_id
    )
