"""Bulk call campaigns."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.config import settings
from app.core.constants import Perm
from app.modules import campaigns
from app.schemas.campaign import (
    CampaignActionResponse,
    CampaignAddLeads,
    CampaignContactOut,
    CampaignCreate,
    CampaignDetail,
    CampaignOut,
    CampaignProgress,
    CampaignUpdate,
)
from app.schemas.common import MessageResponse, Page

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.CAMPAIGNS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.CAMPAIGNS_WRITE))]


def _webhook_base(request: Request) -> str:
    """Where the telephony provider should send call events for this deployment."""
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    return str(request.base_url).rstrip("/")


@router.get("", response_model=Page[CampaignOut], summary="List campaigns")
def list_campaigns(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    status_filter: str | None = None,
    employee_id: str | None = None,
    search: str | None = None,
) -> Page[CampaignOut]:
    rows, total = campaigns.list_campaigns(
        db,
        principal.organization_id,
        params,
        status=status_filter,
        employee_id=employee_id,
        search=search,
    )
    return Page[CampaignOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "",
    response_model=CampaignDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a campaign",
)
def create_campaign(
    payload: CampaignCreate, principal: Writer, db: DbSession
) -> CampaignDetail:
    return campaigns.create_campaign(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.get("/{campaign_id}", response_model=CampaignDetail, summary="Get a campaign")
def get_campaign(campaign_id: str, principal: Reader, db: DbSession) -> CampaignDetail:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.campaign_detail(db, campaign)


@router.patch("/{campaign_id}", response_model=CampaignDetail, summary="Update a campaign")
def update_campaign(
    campaign_id: str, payload: CampaignUpdate, principal: Writer, db: DbSession
) -> CampaignDetail:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.update_campaign(db, campaign, payload, user_id=principal.user_id)


@router.get(
    "/{campaign_id}/progress", response_model=CampaignProgress, summary="Campaign progress"
)
def campaign_progress(campaign_id: str, principal: Reader, db: DbSession) -> CampaignProgress:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.progress(db, campaign)


@router.get(
    "/{campaign_id}/contacts",
    response_model=Page[CampaignContactOut],
    summary="Campaign queue",
)
def list_contacts(
    campaign_id: str,
    principal: Reader,
    db: DbSession,
    params: Pagination,
    status_filter: str | None = None,
) -> Page[CampaignContactOut]:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    rows, total = campaigns.list_contacts(db, campaign, params, status=status_filter)
    return Page[CampaignContactOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "/{campaign_id}/leads",
    response_model=CampaignDetail,
    summary="Add leads to the queue",
)
def add_leads(
    campaign_id: str, payload: CampaignAddLeads, principal: Writer, db: DbSession
) -> CampaignDetail:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.add_leads(db, campaign, payload, user_id=principal.user_id)


@router.delete(
    "/{campaign_id}/leads/{lead_id}",
    response_model=MessageResponse,
    summary="Remove a lead from the queue",
)
def remove_lead(
    campaign_id: str, lead_id: str, principal: Writer, db: DbSession
) -> MessageResponse:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    campaigns.remove_lead(db, campaign, lead_id, user_id=principal.user_id)
    return MessageResponse(message="Lead removed from the campaign.")


@router.post(
    "/{campaign_id}/start",
    response_model=CampaignActionResponse,
    summary="Start (or continue) dialing",
)
def start_campaign(
    campaign_id: str, request: Request, principal: Writer, db: DbSession
) -> CampaignActionResponse:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.start_campaign(
        db,
        principal.organization,
        campaign,
        user_id=principal.user_id,
        webhook_base_url=_webhook_base(request),
    )


@router.post(
    "/{campaign_id}/pause", response_model=CampaignActionResponse, summary="Pause a campaign"
)
def pause_campaign(campaign_id: str, principal: Writer, db: DbSession) -> CampaignActionResponse:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.pause_campaign(db, campaign, user_id=principal.user_id)


@router.post(
    "/{campaign_id}/resume", response_model=CampaignActionResponse, summary="Resume a campaign"
)
def resume_campaign(
    campaign_id: str, request: Request, principal: Writer, db: DbSession
) -> CampaignActionResponse:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.resume_campaign(
        db,
        principal.organization,
        campaign,
        user_id=principal.user_id,
        webhook_base_url=_webhook_base(request),
    )


@router.post(
    "/{campaign_id}/cancel", response_model=CampaignActionResponse, summary="Cancel a campaign"
)
def cancel_campaign(campaign_id: str, principal: Writer, db: DbSession) -> CampaignActionResponse:
    campaign = campaigns.get_campaign(db, principal.organization_id, campaign_id)
    return campaigns.cancel_campaign(db, campaign, user_id=principal.user_id)
