"""Call lifecycle: dialling, provider webhooks, finalisation and billing.

A call moves through ``queued -> initiated -> ringing -> in_progress ->
completed|failed|no_answer|busy``. Everything that costs money or changes a
lead happens in :func:`finalize_call`, which is idempotent so a duplicated
provider webhook cannot double-charge.
"""

from __future__ import annotations

import math
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.constants import (
    CallDirection,
    CallOutcome,
    CallStatus,
    CreditCost,
    LeadStatus,
)
from app.core.exceptions import ConflictError, NotFoundError, ProviderError
from app.core.logging import get_logger
from app.core.pagination import PageParams, apply_sorting, paginate
from app.database.base import utcnow
from app.database.models.call import (
    Call,
    CallEvent,
    Conversation,
    ConversationOutcome,
    ConversationSummary,
)
from app.database.models.employee import Employee
from app.database.models.lead import Contact, Lead
from app.database.models.organization import Organization
from app.integrations import n8n, sarvam, telephony
from app.modules import audit, billing, employees, leads, phone_numbers
from app.modules.common import as_dict
from app.schemas.call import (
    CallCreate,
    CallDetail,
    CallEventOut,
    CallOut,
    CallOutcomeUpdate,
    CallQueuedResponse,
    CallWebhookPayload,
    ConversationOut,
    InboundCallPayload,
)

logger = get_logger(__name__)

_OUTCOME_TO_LEAD: dict[str, str] = {
    str(CallOutcome.SUCCESSFUL): str(LeadStatus.QUALIFIED),
    str(CallOutcome.LEAD_CAPTURED): str(LeadStatus.QUALIFIED),
    str(CallOutcome.APPOINTMENT_BOOKED): str(LeadStatus.CONVERTED),
    str(CallOutcome.INTERESTED): str(LeadStatus.CONTACTED),
    str(CallOutcome.TRANSFERRED_TO_HUMAN): str(LeadStatus.CONTACTED),
    str(CallOutcome.NOT_INTERESTED): str(LeadStatus.NOT_INTERESTED),
    str(CallOutcome.NO_ANSWER): str(LeadStatus.UNREACHABLE),
    str(CallOutcome.BUSY): str(LeadStatus.UNREACHABLE),
    str(CallOutcome.FAILED): str(LeadStatus.UNREACHABLE),
}

_STATUS_TO_OUTCOME: dict[str, str] = {
    str(CallStatus.NO_ANSWER): str(CallOutcome.NO_ANSWER),
    str(CallStatus.BUSY): str(CallOutcome.BUSY),
    str(CallStatus.FAILED): str(CallOutcome.FAILED),
    str(CallStatus.CANCELLED): str(CallOutcome.FAILED),
}


# ---------------------------------------------------------------------------
# Outbound
# ---------------------------------------------------------------------------
def queue_outbound_call(
    db: Session,
    organization: Organization,
    payload: CallCreate,
    *,
    user_id: str | None = None,
    webhook_base_url: str | None = None,
) -> CallQueuedResponse:
    """Create the call record, then hand it to the telephony bridge."""
    employee = employees.require_active_employee(
        db, organization.id, payload.employee_id
    )

    lead: Lead | None = None
    contact: Contact | None = None
    if payload.lead_id:
        lead = leads.get_lead(db, organization.id, payload.lead_id)
        contact = lead.contact
        if lead.contact and lead.contact.is_dnc:
            raise ConflictError(
                "This contact is on the do-not-call list.", code="dnc_blocked"
            )
    else:
        contact = leads.find_contact(db, organization.id, payload.to_number)

    if contact is not None and contact.is_dnc:
        raise ConflictError(
            "This contact is on the do-not-call list.", code="dnc_blocked"
        )

    rate = CreditCost.OUTBOUND_CALL_PER_MINUTE
    billing.ensure_credits(db, organization.id, rate)

    number = phone_numbers.resolve_outbound_number(
        db,
        organization.id,
        phone_number_id=payload.phone_number_id,
        employee_id=employee.id,
    )
    if number is None and not telephony.is_mock():
        raise ConflictError(
            "No active phone number is available for outbound calling. "
            "Add a phone number in Settings > Phone Numbers.",
            code="phone_number_required",
        )

    now = utcnow()
    call = Call(
        organization_id=organization.id,
        employee_id=employee.id,
        lead_id=lead.id if lead else None,
        contact_id=contact.id if contact else None,
        campaign_id=payload.campaign_id,
        phone_number_id=number.id if number else None,
        direction=str(CallDirection.OUTBOUND),
        status=str(CallStatus.QUEUED),
        language=payload.language or employee.default_language,
        from_number=number.number if number else None,
        to_number=payload.to_number,
        provider=telephony.provider_code() or "mock",
        queued_at=now,
        metadata_json=payload.metadata or {},
    )
    db.add(call)
    db.flush()

    _add_event(db, call, "queued", {"to": call.to_number, "from": call.from_number})

    if lead is not None:
        lead.call_attempts += 1
        lead.last_contacted_at = now
        if lead.status in {str(LeadStatus.NEW), str(LeadStatus.QUEUED)}:
            lead.status = str(LeadStatus.CALLING)

    simulated = True
    try:
        result = telephony.place_call(
            to_number=call.to_number or "",
            from_number=call.from_number,
            agent_config=employees.agent_config(db, employee, organization),
            webhook_url=(
                f"{webhook_base_url.rstrip('/')}{settings.api_v1_prefix}/webhooks/telephony"
                if webhook_base_url
                else None
            ),
            metadata={"call_id": call.id, "organization_id": organization.id},
        )
        simulated = result.simulated
        if result.ok:
            call.provider_call_id = str(result.data.get("provider_call_id") or "") or None
            call.status = str(CallStatus.INITIATED)
            _add_event(db, call, "dial_started", result.data)
        else:
            call.status = str(CallStatus.FAILED)
            call.error_message = result.error
            call.error_code = "provider_error"
            call.ended_at = utcnow()
            _add_event(db, call, "dial_failed", {"error": result.error})
    except ProviderError as exc:
        call.status = str(CallStatus.FAILED)
        call.error_message = str(exc)
        call.error_code = exc.code
        call.ended_at = utcnow()
        _add_event(db, call, "dial_failed", {"error": str(exc)})
        simulated = False

    audit.log_action(
        db,
        action="call.queued",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="call",
        resource_id=call.id,
        changes={
            "to_number": call.to_number,
            "employee_id": employee.id,
            "status": call.status,
            "simulated": simulated,
        },
    )
    db.commit()
    db.refresh(call)

    if call.status == str(CallStatus.FAILED):
        return CallQueuedResponse(
            call_id=call.id,
            status=call.status,
            provider_call_id=call.provider_call_id,
            message=call.error_message or "The call could not be placed.",
            simulated=simulated,
        )

    return CallQueuedResponse(
        call_id=call.id,
        status=call.status,
        provider_call_id=call.provider_call_id,
        message=(
            "Call is being simulated (demo mode). Configure SIP telephony for live dialling."
            if simulated
            else "Call queued with the telephony provider."
        ),
        simulated=simulated,
    )


# ---------------------------------------------------------------------------
# Inbound
# ---------------------------------------------------------------------------
def register_inbound_call(db: Session, payload: InboundCallPayload) -> Call:
    """Create a call record for a caller who dialled one of our numbers."""
    number = phone_numbers.find_by_inbound_number(db, payload.to_number)
    if number is None:
        raise NotFoundError(
            "No phone number is registered for the dialled destination.",
            details={"to_number": payload.to_number},
        )
    if number.status != "active":
        raise ConflictError(
            "This phone number is not accepting inbound calls.",
            details={"status": number.status},
        )

    employee = db.get(Employee, number.employee_id) if number.employee_id else None
    organization = db.get(Organization, number.organization_id)
    lead = leads.upsert_inbound_lead(
        db,
        organization,  # type: ignore[arg-type]
        phone=payload.from_number,
        employee_id=employee.id if employee else None,
        language=payload.language,
    )

    now = utcnow()
    call = Call(
        organization_id=number.organization_id,
        employee_id=employee.id if employee else None,
        lead_id=lead.id,
        contact_id=lead.contact_id,
        phone_number_id=number.id,
        direction=str(CallDirection.INBOUND),
        status=str(CallStatus.IN_PROGRESS),
        language=payload.language or (employee.default_language if employee else None),
        from_number=payload.from_number,
        to_number=payload.to_number,
        provider=telephony.provider_code() or "mock",
        provider_call_id=payload.provider_call_id,
        queued_at=now,
        started_at=now,
        answered_at=now,
        metadata_json=payload.payload or {},
    )
    db.add(call)
    db.flush()
    _add_event(db, call, "inbound_received", payload.payload or {})

    audit.log_action(
        db,
        action="call.inbound",
        organization_id=number.organization_id,
        resource_type="call",
        resource_id=call.id,
        changes={"from_number": call.from_number, "to_number": call.to_number},
    )
    db.commit()
    db.refresh(call)
    return call


# ---------------------------------------------------------------------------
# Provider webhooks
# ---------------------------------------------------------------------------
def handle_webhook(db: Session, payload: CallWebhookPayload) -> Call | None:
    """Apply a normalised provider event to the matching call.

    Returns ``None`` when no call matches. Providers retry any non-2xx answer,
    so an unrecognised event is acknowledged and logged rather than rejected.
    """
    call = db.execute(
        select(Call).where(Call.provider_call_id == payload.provider_call_id)
    ).scalar_one_or_none()
    if call is None:
        logger.warning(
            "webhook_for_unknown_call",
            provider_call_id=payload.provider_call_id,
            event_type=payload.event_type,
        )
        return None

    event_time = payload.occurred_at or utcnow()
    _add_event(db, call, payload.event_type, payload.payload or {}, occurred_at=event_time)

    if payload.direction:
        call.direction = str(payload.direction)
    if payload.from_number:
        call.from_number = payload.from_number
    if payload.to_number:
        call.to_number = payload.to_number
    if payload.recording_url:
        call.recording_url = payload.recording_url

    terminal_status = str(payload.status) if payload.status else _terminal_for(payload.event_type)

    if call.started_at is None and payload.event_type in {"initiated", "ringing", "answered"}:
        call.started_at = event_time
    if call.answered_at is None and payload.event_type == "answered":
        call.answered_at = event_time

    if terminal_status and call.status != str(CallStatus.COMPLETED):
        call.status = terminal_status

    if terminal_status in {str(s) for s in CallStatus.terminal()}:
        finalize_call(
            db,
            call,
            outcome=str(payload.outcome) if payload.outcome else _STATUS_TO_OUTCOME.get(terminal_status),
            duration_seconds=payload.duration_seconds,
            recording_url=payload.recording_url,
            ended_at=event_time,
            error_message=payload.error_message,
        )
    else:
        db.commit()
        db.refresh(call)
    return call


def _terminal_for(event_type: str) -> str | None:
    return {
        "completed": str(CallStatus.COMPLETED),
        "ended": str(CallStatus.COMPLETED),
        "failed": str(CallStatus.FAILED),
        "no_answer": str(CallStatus.NO_ANSWER),
        "busy": str(CallStatus.BUSY),
        "canceled": str(CallStatus.CANCELLED),
        "cancelled": str(CallStatus.CANCELLED),
    }.get(event_type)


def finalize_call(
    db: Session,
    call: Call,
    *,
    outcome: str | None = None,
    duration_seconds: int | None = None,
    recording_url: str | None = None,
    ended_at: Any = None,
    error_message: str | None = None,
) -> Call:
    """Settle a call: timings, cost, counters, lead status, notifications.

    Idempotent - a second invocation returns immediately.
    """
    if call.status == str(CallStatus.COMPLETED) and call.cost_credits:
        return call

    now = ended_at or utcnow()
    call.ended_at = call.ended_at or now
    if duration_seconds is not None:
        call.duration_seconds = max(0, duration_seconds)
    elif call.started_at and call.ended_at:
        call.duration_seconds = max(
            0, int((call.ended_at - call.started_at).total_seconds())
        )
    if recording_url:
        call.recording_url = recording_url
    if error_message:
        call.error_message = error_message

    resolved_outcome = outcome or _STATUS_TO_OUTCOME.get(call.status)
    if resolved_outcome and not call.outcome:
        call.outcome = resolved_outcome
    if call.status not in {str(s) for s in CallStatus.terminal()}:
        call.status = str(CallStatus.COMPLETED)
    if call.status == str(CallStatus.COMPLETED) and not call.outcome:
        call.outcome = str(CallOutcome.SUCCESSFUL) if call.duration_seconds >= 30 else str(
            CallOutcome.OTHER
        )

    minutes = max(1, math.ceil(call.duration_seconds / 60)) if call.duration_seconds else 0
    rate = (
        CreditCost.OUTBOUND_CALL_PER_MINUTE
        if call.direction == str(CallDirection.OUTBOUND)
        else CreditCost.INBOUND_CALL_PER_MINUTE
    )
    cost = minutes * rate
    if cost:
        try:
            billing.debit_credits(
                db,
                call.organization_id,
                cost,
                reason=f"Call {call.id[:8]} ({minutes} min)",
                reference_type="call",
                reference_id=call.id,
                allow_negative=True,
            )
            billing.record_usage(
                db,
                call.organization_id,
                usage_type="call_minute",
                quantity=minutes,
                unit="minute",
                unit_cost_credits=rate,
                reference_type="call",
                reference_id=call.id,
                occurred_at=call.ended_at,
            )
        except Exception as exc:  # noqa: BLE001 - billing must not lose the call record
            logger.warning("call_billing_failed", call_id=call.id, error=str(exc))
    call.cost_credits = cost

    _update_employee_counters(db, call)
    _sync_lead(db, call)
    conversation = _ensure_conversation(db, call)
    _write_summary(db, call, conversation)

    audit.log_action(
        db,
        action="call.finalized",
        organization_id=call.organization_id,
        resource_type="call",
        resource_id=call.id,
        changes={
            "status": call.status,
            "outcome": call.outcome,
            "duration_seconds": call.duration_seconds,
            "cost_credits": call.cost_credits,
        },
    )
    db.commit()
    db.refresh(call)

    _notify(call, conversation)
    return call


def _update_employee_counters(db: Session, call: Call) -> None:
    employee = db.get(Employee, call.employee_id) if call.employee_id else None
    if employee is None:
        return
    employee.total_calls = (employee.total_calls or 0) + 1
    employee.total_duration_seconds = (
        employee.total_duration_seconds or 0
    ) + call.duration_seconds
    if call.outcome in {
        str(CallOutcome.SUCCESSFUL),
        str(CallOutcome.LEAD_CAPTURED),
        str(CallOutcome.APPOINTMENT_BOOKED),
        str(CallOutcome.INTERESTED),
    }:
        employee.successful_calls = (employee.successful_calls or 0) + 1
    employee.last_active_at = call.ended_at or utcnow()


def _sync_lead(db: Session, call: Call) -> None:
    if not call.lead_id:
        return
    lead = db.get(Lead, call.lead_id)
    if lead is None:
        return
    lead.last_contacted_at = call.ended_at or utcnow()
    target = _OUTCOME_TO_LEAD.get(call.outcome or "")
    if target:
        lead.status = target
        if target == str(LeadStatus.CONVERTED):
            lead.converted_at = lead.converted_at or utcnow()
    leads.add_activity(
        db,
        lead,
        activity_type="call_completed",
        description=(
            f"Call {call.status} ({call.duration_seconds}s)"
            + (f" - outcome: {call.outcome}" if call.outcome else "")
        ),
        metadata={"call_id": call.id, "outcome": call.outcome},
    )


def _ensure_conversation(db: Session, call: Call) -> Conversation:
    conversation = db.execute(
        select(Conversation).where(Conversation.call_id == call.id)
    ).scalar_one_or_none()
    if conversation is not None:
        conversation.outcome = conversation.outcome or call.outcome
        conversation.ended_at = conversation.ended_at or call.ended_at
        return conversation

    conversation = Conversation(
        organization_id=call.organization_id,
        call_id=call.id,
        turn_count=0,
        language=call.language,
        sentiment=call.sentiment,
        outcome=call.outcome,
        started_at=call.started_at,
        ended_at=call.ended_at,
    )
    db.add(conversation)
    db.flush()
    return conversation


def _write_summary(db: Session, call: Call, conversation: Conversation) -> None:
    """Persist a summary row so the Conversations screen always has content."""
    exists = db.execute(
        select(func.count())
        .select_from(ConversationSummary)
        .where(ConversationSummary.conversation_id == conversation.id)
    ).scalar_one()
    if exists:
        return

    summary = _compose_summary(db, call, conversation)
    db.add(
        ConversationSummary(
            conversation_id=conversation.id,
            summary=summary,
            key_points=_key_points(call),
            action_items=_action_items(call),
            sentiment=call.sentiment or "neutral",
            model="sarvam-m" if sarvam.configured() else "offline-heuristic",
            generated_at=utcnow(),
        )
    )
    conversation.summary = conversation.summary or summary

    already = db.execute(
        select(func.count())
        .select_from(ConversationOutcome)
        .where(ConversationOutcome.conversation_id == conversation.id)
    ).scalar_one()
    if not already and call.outcome:
        db.add(
            ConversationOutcome(
                conversation_id=conversation.id,
                outcome=call.outcome,
                confidence=0.8 if call.duration_seconds > 30 else 0.5,
                captured_data=as_dict(call.metadata_json),
            )
        )


def _compose_summary(db: Session, call: Call, conversation: Conversation) -> str:
    contact = db.get(Contact, call.contact_id) if call.contact_id else None
    employee = db.get(Employee, call.employee_id) if call.employee_id else None
    who = contact.full_name if contact else (call.to_number or "the caller")
    agent = employee.name if employee else "the AI employee"
    direction = "Outbound" if call.direction == str(CallDirection.OUTBOUND) else "Inbound"
    outcome = (call.outcome or call.status).replace("_", " ")
    return (
        f"{direction} call between {agent} and {who} lasting {call.duration_seconds} seconds. "
        f"Outcome: {outcome}."
    )


def _key_points(call: Call) -> list[str]:
    points = [f"Status: {call.status}"]
    if call.outcome:
        points.append(f"Outcome: {call.outcome.replace('_', ' ')}")
    if call.language:
        points.append(f"Language: {call.language}")
    if call.duration_seconds:
        points.append(f"Duration: {call.duration_seconds}s")
    return points


def _action_items(call: Call) -> list[str]:
    if call.outcome == str(CallOutcome.APPOINTMENT_BOOKED):
        return ["Send the appointment confirmation on WhatsApp", "Add the meeting to the calendar"]
    if call.outcome in {str(CallOutcome.NO_ANSWER), str(CallOutcome.BUSY)}:
        return ["Retry the call in the next campaign window"]
    if call.outcome == str(CallOutcome.NOT_INTERESTED):
        return ["Mark the lead as not interested and stop follow-ups"]
    if call.outcome in {str(CallOutcome.LEAD_CAPTURED), str(CallOutcome.SUCCESSFUL)}:
        return ["Route the qualified lead to the sales team"]
    return []


def _notify(call: Call, conversation: Conversation) -> None:
    """Best-effort fan-out. Never raises into the request path."""
    try:
        n8n.emit_call_completed(
            {
                "call_id": call.id,
                "organization_id": call.organization_id,
                "employee_id": call.employee_id,
                "lead_id": call.lead_id,
                "status": call.status,
                "outcome": call.outcome,
                "duration_seconds": call.duration_seconds,
                "cost_credits": call.cost_credits,
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("call_n8n_notify_failed", call_id=call.id, error=str(exc))


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------
def list_calls(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    direction: str | None = None,
    status: str | None = None,
    outcome: str | None = None,
    employee_id: str | None = None,
    campaign_id: str | None = None,
    lead_id: str | None = None,
    search: str | None = None,
) -> tuple[list[CallOut], int]:
    stmt = select(Call).where(Call.organization_id == organization_id)
    if direction:
        stmt = stmt.where(Call.direction == direction)
    if status:
        stmt = stmt.where(Call.status == status)
    if outcome:
        stmt = stmt.where(Call.outcome == outcome)
    if employee_id:
        stmt = stmt.where(Call.employee_id == employee_id)
    if campaign_id:
        stmt = stmt.where(Call.campaign_id == campaign_id)
    if lead_id:
        stmt = stmt.where(Call.lead_id == lead_id)
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(func.coalesce(Call.from_number, "")).like(pattern),
                func.lower(func.coalesce(Call.to_number, "")).like(pattern),
                func.lower(func.coalesce(Call.provider_call_id, "")).like(pattern),
            )
        )

    stmt = apply_sorting(stmt, params, Call, default_column="created_at")
    rows, total = paginate(db, stmt, params)
    return [CallOut.model_validate(row) for row in rows], total


def get_call(db: Session, organization_id: str, call_id: str) -> Call:
    call = db.execute(
        select(Call)
        .where(Call.id == call_id, Call.organization_id == organization_id)
        .options(
            selectinload(Call.conversation),
            selectinload(Call.events),
        )
    ).scalar_one_or_none()
    if call is None:
        raise NotFoundError("Call not found.", details={"id": call_id})
    return call


def call_detail(db: Session, call: Call) -> CallDetail:
    detail = CallDetail.model_validate(call)
    if call.conversation is not None:
        detail.conversation = ConversationOut.model_validate(call.conversation)
    detail.events = [
        CallEventOut.model_validate(event)
        for event in sorted(call.events, key=lambda e: e.occurred_at)
    ]
    return detail


def update_outcome(
    db: Session, call: Call, payload: CallOutcomeUpdate, *, user_id: str | None
) -> Call:
    call.outcome = str(payload.outcome)
    if call.lead_id:
        lead = db.get(Lead, call.lead_id)
        target = _OUTCOME_TO_LEAD.get(call.outcome)
        if lead is not None and target:
            lead.status = target
            if target == str(LeadStatus.CONVERTED):
                lead.converted_at = lead.converted_at or utcnow()
        if lead is not None:
            leads.add_activity(
                db,
                lead,
                activity_type="outcome_updated",
                description=payload.notes or f"Outcome set to {call.outcome}",
                actor_id=user_id,
                metadata={"call_id": call.id},
            )
    audit.log_action(
        db,
        action="call.outcome_updated",
        organization_id=call.organization_id,
        user_id=user_id,
        resource_type="call",
        resource_id=call.id,
        changes={"outcome": call.outcome},
    )
    db.commit()
    db.refresh(call)
    return call


def cancel_call(db: Session, call: Call, *, user_id: str | None) -> Call:
    if call.status in {str(s) for s in CallStatus.terminal()}:
        raise ConflictError("This call has already finished.", details={"status": call.status})
    if call.provider_call_id:
        telephony.hangup(call.provider_call_id)
    call.status = str(CallStatus.CANCELLED)
    call.ended_at = utcnow()
    _add_event(db, call, "cancelled", {})
    audit.log_action(
        db,
        action="call.cancelled",
        organization_id=call.organization_id,
        user_id=user_id,
        resource_type="call",
        resource_id=call.id,
    )
    db.commit()
    db.refresh(call)
    return call


def active_call_count(db: Session, organization_id: str, employee_id: str | None = None) -> int:
    stmt = select(func.count()).select_from(Call).where(
        Call.organization_id == organization_id,
        Call.status.in_(
            [
                str(CallStatus.QUEUED),
                str(CallStatus.INITIATED),
                str(CallStatus.RINGING),
                str(CallStatus.IN_PROGRESS),
            ]
        ),
    )
    if employee_id:
        stmt = stmt.where(Call.employee_id == employee_id)
    return int(db.execute(stmt).scalar_one())


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _add_event(
    db: Session,
    call: Call,
    event_type: str,
    payload: dict[str, Any],
    *,
    occurred_at: Any = None,
) -> CallEvent:
    event = CallEvent(
        call_id=call.id,
        event_type=event_type[:64],
        payload=payload or {},
        occurred_at=occurred_at or utcnow(),
    )
    db.add(event)
    db.flush()
    return event
