"""Bulk campaign orchestration - PRD module 07.

A campaign is a queue of leads plus a calling policy (window, concurrency,
retries). :func:`start_campaign` dials the next slice of the queue through the
call service, which owns credits, provider dispatch and lead state.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.constants import CampaignStatus
from app.core.exceptions import ConflictError, InsufficientCreditsError, NotFoundError
from app.core.logging import get_logger
from app.core.pagination import PageParams, paginate
from app.database.base import utcnow
from app.database.models.campaign import Campaign, CampaignAttempt, CampaignContact
from app.database.models.lead import Contact, Lead
from app.database.models.organization import Organization
from app.integrations import n8n
from app.modules import audit, calls, employees, phone_numbers
from app.modules.common import scoped
from app.schemas.call import CallCreate
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
from app.utils.datetime_utils import within_window

logger = get_logger(__name__)

_TERMINAL = frozenset({str(CampaignStatus.COMPLETED), str(CampaignStatus.CANCELLED)})


# ---------------------------------------------------------------------------
# Create / read
# ---------------------------------------------------------------------------
def create_campaign(
    db: Session,
    organization: Organization,
    payload: CampaignCreate,
    *,
    user_id: str | None,
) -> CampaignDetail:
    employees.require_active_employee(db, organization.id, payload.employee_id)
    if payload.phone_number_id:
        phone_numbers.get_number(db, organization.id, payload.phone_number_id)

    campaign = Campaign(
        organization_id=organization.id,
        name=payload.name,
        description=payload.description,
        employee_id=payload.employee_id,
        phone_number_id=payload.phone_number_id,
        status=str(CampaignStatus.DRAFT),
        calling_window_start=payload.calling_window_start,
        calling_window_end=payload.calling_window_end,
        timezone=payload.timezone,
        max_concurrent_calls=payload.max_concurrent_calls,
        max_attempts=payload.max_attempts,
        retry_delay_minutes=payload.retry_delay_minutes,
        scheduled_start_at=payload.scheduled_start_at,
        settings=payload.settings,
        created_by=user_id,
    )
    db.add(campaign)
    db.flush()

    added = _add_leads(db, campaign, payload.lead_ids)
    campaign.total_contacts = added

    audit.log_action(
        db,
        action="campaign.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
        changes={"name": campaign.name, "leads": added},
    )
    db.commit()
    db.refresh(campaign)
    return campaign_detail(db, campaign)


def list_campaigns(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    status: str | None = None,
    employee_id: str | None = None,
    search: str | None = None,
) -> tuple[list[CampaignOut], int]:
    stmt = select(Campaign).where(Campaign.organization_id == organization_id)
    if status:
        stmt = stmt.where(Campaign.status == status)
    if employee_id:
        stmt = stmt.where(Campaign.employee_id == employee_id)
    if search:
        stmt = stmt.where(func.lower(Campaign.name).like(f"%{search.strip().lower()}%"))
    rows, total = paginate(db, stmt.order_by(Campaign.created_at.desc()), params)
    return [CampaignOut.model_validate(row) for row in rows], total


def get_campaign(db: Session, organization_id: str, campaign_id: str) -> Campaign:
    campaign = db.execute(
        select(Campaign)
        .where(Campaign.id == campaign_id, Campaign.organization_id == organization_id)
        .options(selectinload(Campaign.contacts))
    ).scalar_one_or_none()
    if campaign is None:
        raise NotFoundError("Campaign not found.", details={"id": campaign_id})
    return campaign


def campaign_detail(db: Session, campaign: Campaign) -> CampaignDetail:
    detail = CampaignDetail.model_validate(campaign)
    detail.progress = progress(db, campaign)
    return detail


def progress(db: Session, campaign: Campaign) -> CampaignProgress:
    rows = db.execute(
        select(CampaignContact.status, func.count())
        .where(CampaignContact.campaign_id == campaign.id)
        .group_by(CampaignContact.status)
    ).all()
    counts = {str(status): int(count) for status, count in rows}
    total = sum(counts.values())
    completed = counts.get("completed", 0)
    failed = counts.get("failed", 0)
    in_progress = counts.get("calling", 0) + counts.get("in_progress", 0)
    pending = max(0, total - completed - failed - in_progress)

    return CampaignProgress(
        campaign_id=campaign.id,
        total=total,
        pending=pending,
        in_progress=in_progress,
        completed=completed,
        failed=failed,
        percent_complete=round((completed + failed) / total * 100, 2) if total else 0.0,
    )


def list_contacts(
    db: Session, campaign: Campaign, params: PageParams, *, status: str | None = None
) -> tuple[list[CampaignContactOut], int]:
    stmt = select(CampaignContact).where(CampaignContact.campaign_id == campaign.id)
    if status:
        stmt = stmt.where(CampaignContact.status == status)
    rows, total = paginate(db, stmt.order_by(CampaignContact.created_at.asc()), params)
    return [CampaignContactOut.model_validate(row) for row in rows], total


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
def update_campaign(
    db: Session, campaign: Campaign, payload: CampaignUpdate, *, user_id: str | None
) -> CampaignDetail:
    if campaign.status == str(CampaignStatus.RUNNING):
        raise ConflictError(
            "Pause the campaign before editing it.", details={"status": campaign.status}
        )

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    changes: dict[str, Any] = {}
    for field, value in updates.items():
        if getattr(campaign, field) != value:
            setattr(campaign, field, value)
            changes[field] = value

    audit.log_action(
        db,
        action="campaign.updated",
        organization_id=campaign.organization_id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
        changes=changes,
    )
    db.commit()
    db.refresh(campaign)
    return campaign_detail(db, campaign)


def add_leads(
    db: Session, campaign: Campaign, payload: CampaignAddLeads, *, user_id: str | None
) -> CampaignDetail:
    if campaign.status in _TERMINAL:
        raise ConflictError(
            "This campaign has finished and can no longer accept leads.",
            details={"status": campaign.status},
        )
    added = _add_leads(db, campaign, payload.lead_ids)
    campaign.total_contacts = int(
        db.execute(
            select(func.count())
            .select_from(CampaignContact)
            .where(CampaignContact.campaign_id == campaign.id)
        ).scalar_one()
    )
    audit.log_action(
        db,
        action="campaign.leads_added",
        organization_id=campaign.organization_id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
        changes={"added": added},
    )
    db.commit()
    db.refresh(campaign)
    return campaign_detail(db, campaign)


def remove_lead(db: Session, campaign: Campaign, lead_id: str, *, user_id: str | None) -> None:
    row = db.execute(
        select(CampaignContact).where(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.lead_id == lead_id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Lead is not part of this campaign.", details={"lead_id": lead_id})
    db.delete(row)
    campaign.total_contacts = max(0, campaign.total_contacts - 1)
    audit.log_action(
        db,
        action="campaign.lead_removed",
        organization_id=campaign.organization_id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
        changes={"lead_id": lead_id},
    )
    db.commit()


# ---------------------------------------------------------------------------
# Execution control
# ---------------------------------------------------------------------------
def start_campaign(
    db: Session,
    organization: Organization,
    campaign: Campaign,
    *,
    user_id: str | None,
    webhook_base_url: str | None = None,
    refill: bool = False,
) -> CampaignActionResponse:
    """Dial the next slice of the queue, respecting the calling window.

    ``refill=True`` is used by the scheduler to top up a campaign that is
    already running: as calls finish, their freed concurrency slots are filled
    with the next pending contacts. Manual ``/start`` calls keep the default
    behaviour of being a no-op while the campaign is running.
    """
    if campaign.status == str(CampaignStatus.RUNNING) and not refill:
        return _action(campaign, "The campaign is already running.", 0)
    if campaign.status == str(CampaignStatus.COMPLETED):
        raise ConflictError("This campaign has already completed.")
    if campaign.status in {str(CampaignStatus.CANCELLED), str(CampaignStatus.FAILED)}:
        raise ConflictError(
            "This campaign is closed and cannot be restarted.",
            details={"status": campaign.status},
        )

    employee = employees.require_active_employee(db, organization.id, campaign.employee_id)

    if not within_window(
        campaign.calling_window_start,
        campaign.calling_window_end,
        timezone_name=campaign.timezone or organization.timezone,
    ):
        campaign.status = str(CampaignStatus.SCHEDULED)
        db.commit()
        return _action(
            campaign,
            "Outside the calling window - the campaign will start at the next window.",
            0,
        )

    campaign.status = str(CampaignStatus.RUNNING)
    campaign.started_at = campaign.started_at or utcnow()
    db.flush()

    budget = max(1, campaign.max_concurrent_calls - calls.active_call_count(
        db, organization.id, campaign.employee_id
    ))
    pending = db.execute(
        select(CampaignContact)
        .where(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.status == "pending",
        )
        .order_by(CampaignContact.created_at.asc())
        .limit(budget)
    ).scalars().all()

    queued = 0
    for row in pending:
        lead = db.get(Lead, row.lead_id)
        if lead is None:
            row.status = "failed"
            continue

        phone = _lead_phone(db, lead)
        if not phone:
            row.status = "failed"
            continue

        try:
            response = calls.queue_outbound_call(
                db,
                organization,
                CallCreate(
                    to_number=phone,
                    employee_id=campaign.employee_id,
                    lead_id=lead.id,
                    campaign_id=campaign.id,
                    phone_number_id=campaign.phone_number_id,
                    metadata={"campaign_id": campaign.id, "campaign_name": campaign.name},
                ),
                user_id=user_id,
                webhook_base_url=webhook_base_url,
            )
        except (ConflictError, InsufficientCreditsError) as exc:
            logger.warning("campaign_call_blocked", campaign_id=campaign.id, error=str(exc))
            row.status = "failed"
            campaign.failed_contacts += 1
            continue

        row.attempts += 1
        row.last_attempt_at = utcnow()
        row.status = "calling"
        db.add(
            CampaignAttempt(
                campaign_contact_id=row.id,
                call_id=response.call_id,
                attempt_number=row.attempts,
                status="queued",
                started_at=utcnow(),
            )
        )
        queued += 1

    if queued == 0 and not pending:
        _complete_if_done(db, campaign)

    audit.log_action(
        db,
        action="campaign.started",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
        changes={"queued": queued, "employee": employee.name},
    )
    db.commit()
    db.refresh(campaign)
    return _action(campaign, f"{queued} call(s) queued.", queued)


def pause_campaign(
    db: Session, campaign: Campaign, *, user_id: str | None
) -> CampaignActionResponse:
    if campaign.status not in {str(CampaignStatus.RUNNING), str(CampaignStatus.SCHEDULED)}:
        raise ConflictError(
            "Only a running or scheduled campaign can be paused.",
            details={"status": campaign.status},
        )
    campaign.status = str(CampaignStatus.PAUSED)
    audit.log_action(
        db,
        action="campaign.paused",
        organization_id=campaign.organization_id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
    )
    db.commit()
    return _action(campaign, "Campaign paused.", 0)


def resume_campaign(
    db: Session,
    organization: Organization,
    campaign: Campaign,
    *,
    user_id: str | None,
    webhook_base_url: str | None = None,
) -> CampaignActionResponse:
    if campaign.status != str(CampaignStatus.PAUSED):
        raise ConflictError(
            "Only a paused campaign can be resumed.", details={"status": campaign.status}
        )
    campaign.status = str(CampaignStatus.RUNNING)
    db.commit()
    # refill=True: the status is already RUNNING at this point, and a plain
    # start() would short-circuit without dialling anything.
    return start_campaign(
        db,
        organization,
        campaign,
        user_id=user_id,
        webhook_base_url=webhook_base_url,
        refill=True,
    )


def cancel_campaign(
    db: Session, campaign: Campaign, *, user_id: str | None
) -> CampaignActionResponse:
    campaign.status = str(CampaignStatus.CANCELLED)
    campaign.completed_at = utcnow()
    for row in db.execute(
        select(CampaignContact).where(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.status == "pending",
        )
    ).scalars():
        row.status = "skipped"
    audit.log_action(
        db,
        action="campaign.cancelled",
        organization_id=campaign.organization_id,
        user_id=user_id,
        resource_type="campaign",
        resource_id=campaign.id,
    )
    db.commit()
    return _action(campaign, "Campaign cancelled.", 0)


def sync_from_call(db: Session, call: Any) -> None:
    """Called after a campaign call finishes, to advance the counters."""
    if not call.campaign_id:
        return
    campaign = db.get(Campaign, call.campaign_id)
    if campaign is None:
        return

    row = db.execute(
        select(CampaignContact).where(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.lead_id == call.lead_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return

    if call.status == "completed":
        row.status = "completed"
        campaign.completed_contacts += 1
        _complete_attempt(db, row.id, call, status="completed")
    elif row.attempts >= campaign.max_attempts:
        row.status = "failed"
        campaign.failed_contacts += 1
        _complete_attempt(db, row.id, call, status="failed")
    else:
        row.status = "pending"
        row.next_attempt_at = utcnow() + _retry_delay(campaign.retry_delay_minutes)
        _complete_attempt(db, row.id, call, status="retry_scheduled")

    _complete_if_done(db, campaign)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _add_leads(db: Session, campaign: Campaign, lead_ids: list[str]) -> int:
    if not lead_ids:
        return 0

    existing = {
        lead_id
        for lead_id in db.execute(
            select(CampaignContact.lead_id).where(CampaignContact.campaign_id == campaign.id)
        ).scalars()
    }
    valid_ids = set(
        db.execute(
            select(Lead.id).where(
                Lead.organization_id == campaign.organization_id,
                Lead.id.in_(lead_ids),
            )
        ).scalars()
    )

    added = 0
    for lead_id in dict.fromkeys(lead_ids):  # de-duplicate, keep order
        if lead_id in existing or lead_id not in valid_ids:
            continue
        db.add(
            CampaignContact(
                campaign_id=campaign.id,
                lead_id=lead_id,
                status="pending",
            )
        )
        added += 1

    db.flush()
    return added


def _lead_phone(db: Session, lead: Lead) -> str | None:
    contact = db.get(Contact, lead.contact_id)
    if contact is None or contact.is_dnc:
        return None
    return contact.phone


def _complete_attempt(db: Session, campaign_contact_id: str, call: Any, *, status: str) -> None:
    attempt = db.execute(
        select(CampaignAttempt)
        .where(CampaignAttempt.campaign_contact_id == campaign_contact_id)
        .order_by(CampaignAttempt.created_at.desc())
    ).scalars().first()
    if attempt is None:
        return
    attempt.status = status
    attempt.ended_at = call.ended_at or utcnow()
    attempt.error = call.error_message


def _complete_if_done(db: Session, campaign: Campaign) -> None:
    remaining = int(
        db.execute(
            select(func.count())
            .select_from(CampaignContact)
            .where(
                CampaignContact.campaign_id == campaign.id,
                CampaignContact.status.in_(["pending", "calling"]),
            )
        ).scalar_one()
    )
    if remaining:
        return

    campaign.status = str(CampaignStatus.COMPLETED)
    campaign.completed_at = utcnow()
    n8n.emit_campaign_finished(
        {
            "campaign_id": campaign.id,
            "organization_id": campaign.organization_id,
            "total": campaign.total_contacts,
            "completed": campaign.completed_contacts,
            "failed": campaign.failed_contacts,
        }
    )


def _retry_delay(minutes: int) -> Any:
    return timedelta(minutes=max(5, minutes))


def _action(
    campaign: Campaign, message: str, queued: int
) -> CampaignActionResponse:
    return CampaignActionResponse(
        campaign_id=campaign.id,
        status=campaign.status,
        message=message,
        queued_calls=queued,
    )
