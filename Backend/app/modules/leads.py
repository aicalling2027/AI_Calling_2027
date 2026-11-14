"""Contacts, leads, activities and follow-ups - PRD modules 08-09."""

from __future__ import annotations

from typing import Any, Iterable

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.constants import LeadSource, LeadStatus
from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import PageParams, apply_sorting, paginate
from app.database.base import utcnow
from app.database.models.lead import (
    Contact,
    FollowUp,
    Lead,
    LeadActivity,
    LeadAssignment,
)
from app.database.models.organization import Organization, User
from app.integrations import n8n
from app.modules import audit
from app.modules.common import scoped
from app.schemas.lead import (
    BulkImportResult,
    BulkLeadImport,
    ContactOut,
    FollowUpCreate,
    FollowUpOut,
    LeadCreate,
    LeadDetail,
    LeadStatusUpdate,
    LeadUpdate,
)
from app.utils.phone import same_number

CONVERTING_STATUSES = frozenset({str(LeadStatus.CONVERTED)})

# Fields on ``LeadUpdate`` that belong to the contact rather than the lead.
CONTACT_FIELDS = ("full_name", "phone", "email", "identity")


def _with_identity(
    custom_fields: dict[str, Any] | None, identity: str | None
) -> dict[str, Any]:
    """Fold the sheet's Identity column into the custom-field bag.

    A value the caller already put in ``custom_fields`` is kept - the typed
    field is a convenience for the common case, not a way to overwrite a field
    whose shape we do not own. A blank cell adds nothing, so an empty column
    leaves no stray key behind.
    """
    merged = dict(custom_fields or {})
    if identity and identity.strip():
        merged.setdefault("identity", identity.strip())
    return merged


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------
def find_contact(db: Session, organization_id: str, phone: str) -> Contact | None:
    """Look up a contact by loosely-compared phone number."""
    candidates = db.execute(
        select(Contact).where(Contact.organization_id == organization_id)
    ).scalars().all()
    for contact in candidates:
        if same_number(contact.phone, phone):
            return contact
    return None


def get_or_create_contact(
    db: Session,
    organization_id: str,
    *,
    full_name: str,
    phone: str,
    email: str | None = None,
    company: str | None = None,
    city: str | None = None,
    state: str | None = None,
    country: str = "IN",
    preferred_language: str | None = None,
    tags: list[str] | None = None,
    custom_fields: dict[str, Any] | None = None,
) -> Contact:
    """Reuse an existing contact by phone, enriching the missing fields."""
    contact = find_contact(db, organization_id, phone)
    if contact is not None:
        contact.full_name = contact.full_name or full_name
        contact.email = contact.email or email
        contact.company = contact.company or company
        contact.city = contact.city or city
        contact.state = contact.state or state
        contact.preferred_language = contact.preferred_language or preferred_language
        if tags:
            merged = list(dict.fromkeys(list(contact.tags or []) + list(tags)))
            contact.tags = merged
        if custom_fields:
            combined = {**(contact.custom_fields or {}), **custom_fields}
            contact.custom_fields = combined
        db.flush()
        return contact

    contact = Contact(
        organization_id=organization_id,
        full_name=full_name[:160] or "Unknown",
        phone=phone,
        email=email,
        company=company,
        city=city,
        state=state,
        country=country[:8],
        preferred_language=preferred_language,
        tags=tags or [],
        custom_fields=custom_fields or {},
    )
    db.add(contact)
    db.flush()
    return contact


def contact_out(contact: Contact) -> ContactOut:
    return ContactOut.model_validate(contact)


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------
def create_lead(
    db: Session,
    organization: Organization,
    payload: LeadCreate,
    *,
    user_id: str | None = None,
) -> Lead:
    """Create a lead from an inline contact or an existing contact id."""
    identity: str | None = None
    if payload.contact is not None:
        # Resolved once, here, so a contact and the lead pointing at it cannot
        # end up holding different identity values.
        contact_fields = _with_identity(
            payload.contact.custom_fields, payload.contact.identity
        )
        identity = contact_fields.get("identity")
        contact = get_or_create_contact(
            db,
            organization.id,
            full_name=payload.contact.full_name,
            phone=payload.contact.phone,
            email=payload.contact.email,
            company=payload.contact.company,
            city=payload.contact.city,
            state=payload.contact.state,
            country=payload.contact.country,
            preferred_language=payload.contact.preferred_language,
            tags=payload.contact.tags,
            custom_fields=contact_fields,
        )
    elif payload.contact_id:
        contact = scoped(db, Contact, payload.contact_id, organization.id, label="Contact")
    else:
        raise ConflictError(
            "Provide either a contact object or an existing contact_id.",
            code="contact_required",
        )

    lead = Lead(
        organization_id=organization.id,
        contact_id=contact.id,
        employee_id=payload.employee_id,
        campaign_id=payload.campaign_id,
        source=str(payload.source),
        source_detail=payload.source_detail,
        external_id=payload.external_id,
        status=str(LeadStatus.DNC) if contact.is_dnc else str(LeadStatus.NEW),
        notes=payload.notes,
        custom_fields=_with_identity(payload.custom_fields, identity),
        assigned_to=payload.assigned_to,
    )
    db.add(lead)
    db.flush()

    add_activity(
        db,
        lead,
        activity_type="created",
        description=f"Lead created from {payload.source}",
        actor_id=user_id,
    )
    audit.log_action(
        db,
        action="lead.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="lead",
        resource_id=lead.id,
        changes={"source": lead.source, "employee_id": lead.employee_id},
    )
    db.commit()
    db.refresh(lead)

    n8n.emit_lead_created(
        {
            "lead_id": lead.id,
            "organization_id": organization.id,
            "name": contact.full_name,
            "phone": contact.phone,
            "source": lead.source,
            "employee_id": lead.employee_id,
        }
    )
    return lead


def bulk_import(
    db: Session,
    organization: Organization,
    payload: BulkLeadImport,
    *,
    user_id: str | None = None,
) -> BulkImportResult:
    """Import up to 5000 leads, skipping duplicates and invalid numbers."""
    created = 0
    skipped = 0
    errors: list[dict[str, Any]] = []
    lead_ids: list[str] = []
    created_phones: list[str] = []

    existing = {
        row[0]
        for row in db.execute(
            select(Contact.phone).where(Contact.organization_id == organization.id)
        ).all()
    }

    for index, item in enumerate(payload.leads):
        try:
            if any(same_number(item.phone, phone) for phone in existing):
                skipped += 1
                continue

            # One bag for the row, shared by the contact and its lead, so the
            # two records cannot disagree about who this customer is.
            fields = _with_identity(item.custom_fields, item.identity)
            contact = get_or_create_contact(
                db,
                organization.id,
                full_name=item.full_name,
                phone=item.phone,
                email=item.email,
                company=item.company,
                city=item.city,
                preferred_language=item.language,
                custom_fields=fields,
            )
            lead = Lead(
                organization_id=organization.id,
                contact_id=contact.id,
                employee_id=payload.employee_id,
                source=str(payload.source),
                source_detail=payload.source_detail,
                status=str(LeadStatus.DNC) if contact.is_dnc else str(LeadStatus.NEW),
                custom_fields=fields,
            )
            db.add(lead)
            db.flush()
            lead_ids.append(lead.id)
            created_phones.append(contact.phone)
            existing.add(contact.phone)
            created += 1
        except Exception as exc:  # noqa: BLE001 - one bad row must not stop the import
            skipped += 1
            if len(errors) < 25:
                errors.append({"row": index + 1, "phone": item.phone, "error": str(exc)})

    audit.log_action(
        db,
        action="lead.bulk_imported",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="lead",
        changes={"created": created, "skipped": skipped, "source": str(payload.source)},
    )
    db.commit()
    return BulkImportResult(
        created=created,
        skipped=skipped,
        errors=errors,
        lead_ids=lead_ids,
        created_phones=created_phones,
    )


def get_lead(db: Session, organization_id: str, lead_id: str) -> Lead:
    lead = db.execute(
        select(Lead)
        .where(Lead.id == lead_id, Lead.organization_id == organization_id)
        .options(selectinload(Lead.contact))
    ).scalar_one_or_none()
    if lead is None:
        raise NotFoundError("Lead not found.", details={"id": lead_id})
    return lead


def lead_detail(db: Session, lead: Lead) -> LeadDetail:
    detail = LeadDetail.model_validate(lead)
    detail.contact = contact_out(lead.contact) if lead.contact else None
    detail.recent_activities = list_activities(db, lead.id, limit=20)
    return detail


def list_leads(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    status: str | None = None,
    source: str | None = None,
    employee_id: str | None = None,
    campaign_id: str | None = None,
    assigned_to: str | None = None,
    search: str | None = None,
) -> tuple[list[LeadDetail], int]:
    stmt = (
        select(Lead)
        .where(Lead.organization_id == organization_id)
        .options(selectinload(Lead.contact))
    )
    if status:
        stmt = stmt.where(Lead.status == status)
    if source:
        stmt = stmt.where(Lead.source == source)
    if employee_id:
        stmt = stmt.where(Lead.employee_id == employee_id)
    if campaign_id:
        stmt = stmt.where(Lead.campaign_id == campaign_id)
    if assigned_to:
        stmt = stmt.where(Lead.assigned_to == assigned_to)
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.join(Contact, Contact.id == Lead.contact_id).where(
            or_(
                func.lower(Contact.full_name).like(pattern),
                func.lower(Contact.phone).like(pattern),
                func.lower(func.coalesce(Contact.email, "")).like(pattern),
                func.lower(func.coalesce(Contact.company, "")).like(pattern),
            )
        )

    stmt = apply_sorting(stmt, params, Lead, default_column="created_at")
    rows, total = paginate(db, stmt, params)
    items: list[LeadDetail] = []
    for lead in rows:
        detail = LeadDetail.model_validate(lead)
        detail.contact = contact_out(lead.contact) if lead.contact else None
        items.append(detail)
    return items, total


def update_lead(db: Session, lead: Lead, payload: LeadUpdate, *, user_id: str | None) -> Lead:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    new_status = updates.pop("status", None)

    changes: dict[str, Any] = {}

    # Name, phone, email and identity live on the contact, so they are applied
    # there and reported back under the key the caller used.
    identity = updates.pop("identity", None)
    supplied = [field for field in CONTACT_FIELDS if field in updates]
    if supplied and lead.contact is None:
        raise ConflictError("This lead has no contact to update.", code="contact_missing")

    if lead.contact is not None:
        for field in supplied:
            if field == "identity":
                continue
            value = updates.pop(field)
            if getattr(lead.contact, field) != value:
                setattr(lead.contact, field, value)
                changes[field] = value

        if identity is not None:
            # An empty cell clears the reference, so a mistake can be undone
            # without deleting the lead and typing it again.
            value = identity.strip()
            original = dict(lead.contact.custom_fields or {})
            merged = dict(original)
            if value:
                merged["identity"] = value
            else:
                merged.pop("identity", None)
            if merged != original:
                lead.contact.custom_fields = merged
                changes["identity"] = value
            # Keep the lead's own copy in step where it already has one, rather
            # than reintroducing the identity on leads that never carried it.
            lead_fields = dict(lead.custom_fields or {})
            if "identity" in lead_fields:
                if value:
                    lead_fields["identity"] = value
                else:
                    lead_fields.pop("identity", None)
                lead.custom_fields = lead_fields

    for field, value in updates.items():
        if getattr(lead, field) != value:
            setattr(lead, field, value)
            changes[field] = value

    if new_status:
        _apply_status(db, lead, str(new_status), note=None, actor_id=user_id)
        changes["status"] = str(new_status)

    if changes:
        audit.log_action(
            db,
            action="lead.updated",
            organization_id=lead.organization_id,
            user_id=user_id,
            resource_type="lead",
            resource_id=lead.id,
            changes=changes,
        )
    db.commit()
    db.refresh(lead)
    return lead


def update_status(
    db: Session, lead: Lead, payload: LeadStatusUpdate, *, user_id: str | None
) -> Lead:
    _apply_status(db, lead, str(payload.status), note=payload.note, actor_id=user_id)
    audit.log_action(
        db,
        action="lead.status_changed",
        organization_id=lead.organization_id,
        user_id=user_id,
        resource_type="lead",
        resource_id=lead.id,
        changes={"status": lead.status},
    )
    db.commit()
    db.refresh(lead)
    return lead


def _apply_status(
    db: Session, lead: Lead, status: str, *, note: str | None, actor_id: str | None
) -> None:
    previous = lead.status
    lead.status = status
    if status in CONVERTING_STATUSES and lead.converted_at is None:
        lead.converted_at = utcnow()
    add_activity(
        db,
        lead,
        activity_type="status_changed",
        description=note or f"Status changed from {previous} to {status}",
        actor_id=actor_id,
        metadata={"from": previous, "to": status},
    )


def assign_lead(db: Session, lead: Lead, assigned_to: str | None, *, user_id: str | None) -> Lead:
    """Assign (or unassign) a lead, keeping an immutable history row."""
    if assigned_to:
        user = db.get(User, assigned_to)
        if user is None:
            raise NotFoundError("User not found.", details={"id": assigned_to})
        open_assignments: Iterable[LeadAssignment] = db.execute(
            select(LeadAssignment).where(
                LeadAssignment.lead_id == lead.id,
                LeadAssignment.unassigned_at.is_(None),
            )
        ).scalars()
        for row in open_assignments:
            row.unassigned_at = utcnow()
        db.add(
            LeadAssignment(
                lead_id=lead.id, assigned_to=assigned_to, assigned_by=user_id
            )
        )

    previous = lead.assigned_to
    lead.assigned_to = assigned_to
    add_activity(
        db,
        lead,
        activity_type="assigned",
        description=(
            f"Assigned to user {assigned_to}" if assigned_to else "Unassigned"
        ),
        actor_id=user_id,
        metadata={"from": previous, "to": assigned_to},
    )
    audit.log_action(
        db,
        action="lead.assigned",
        organization_id=lead.organization_id,
        user_id=user_id,
        resource_type="lead",
        resource_id=lead.id,
        changes={"assigned_to": assigned_to},
    )
    db.commit()
    db.refresh(lead)
    return lead


def delete_lead(db: Session, lead: Lead, *, user_id: str | None) -> None:
    lead_id, organization_id = lead.id, lead.organization_id
    db.delete(lead)
    audit.log_action(
        db,
        action="lead.deleted",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="lead",
        resource_id=lead_id,
    )
    db.commit()


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------
def add_activity(
    db: Session,
    lead: Lead,
    *,
    activity_type: str,
    description: str | None = None,
    actor_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> LeadActivity:
    activity = LeadActivity(
        lead_id=lead.id,
        activity_type=activity_type[:48],
        description=description,
        actor_id=actor_id,
        metadata_json=metadata or {},
    )
    db.add(activity)
    db.flush()
    return activity


def list_activities(db: Session, lead_id: str, *, limit: int = 50) -> list[Any]:
    from app.schemas.lead import LeadActivityOut

    rows = db.execute(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .order_by(LeadActivity.created_at.desc())
        .limit(limit)
    ).scalars().all()
    return [LeadActivityOut.model_validate(row) for row in rows]


# ---------------------------------------------------------------------------
# Follow-ups
# ---------------------------------------------------------------------------
def create_followup(
    db: Session, organization_id: str, payload: FollowUpCreate, *, user_id: str | None
) -> FollowUpOut:
    lead = scoped(db, Lead, payload.lead_id, organization_id, label="Lead")
    followup = FollowUp(
        organization_id=organization_id,
        lead_id=lead.id,
        scheduled_for=payload.scheduled_for,
        channel=payload.channel,
        status="pending",
        notes=payload.notes,
        assigned_to=payload.assigned_to or user_id,
    )
    db.add(followup)
    add_activity(
        db,
        lead,
        activity_type="followup_scheduled",
        description=f"Follow-up scheduled for {payload.scheduled_for:%d %b %Y %H:%M}",
        actor_id=user_id,
    )
    db.commit()
    db.refresh(followup)
    return FollowUpOut.model_validate(followup)


def list_followups(
    db: Session,
    organization_id: str,
    *,
    status: str | None = None,
    lead_id: str | None = None,
    limit: int = 100,
) -> list[FollowUpOut]:
    stmt = select(FollowUp).where(FollowUp.organization_id == organization_id)
    if status:
        stmt = stmt.where(FollowUp.status == status)
    if lead_id:
        stmt = stmt.where(FollowUp.lead_id == lead_id)
    rows = db.execute(
        stmt.order_by(FollowUp.scheduled_for.asc()).limit(limit)
    ).scalars().all()
    return [FollowUpOut.model_validate(row) for row in rows]


def complete_followup(
    db: Session, organization_id: str, followup_id: str, *, user_id: str | None
) -> FollowUpOut:
    followup = scoped(db, FollowUp, followup_id, organization_id, label="Follow-up")
    followup.status = "completed"
    followup.completed_at = utcnow()
    audit.log_action(
        db,
        action="followup.completed",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="followup",
        resource_id=followup.id,
    )
    db.commit()
    db.refresh(followup)
    return FollowUpOut.model_validate(followup)


def upsert_inbound_lead(
    db: Session,
    organization: Organization,
    *,
    phone: str,
    name: str | None = None,
    employee_id: str | None = None,
    language: str | None = None,
) -> Lead:
    """Create (or reuse) a lead for an inbound caller."""
    existing = db.execute(
        select(Lead)
        .join(Contact, Contact.id == Lead.contact_id)
        .where(
            Lead.organization_id == organization.id,
            Contact.phone == phone,
        )
        .order_by(Lead.created_at.desc())
    ).scalars().first()
    if existing is not None:
        return existing

    contact = get_or_create_contact(
        db,
        organization.id,
        full_name=name or f"Caller {phone[-4:]}",
        phone=phone,
        preferred_language=language,
        tags=["inbound"],
    )
    lead = Lead(
        organization_id=organization.id,
        contact_id=contact.id,
        employee_id=employee_id,
        source=str(LeadSource.INBOUND),
        status=str(LeadStatus.DNC) if contact.is_dnc else str(LeadStatus.CONTACTED),
    )
    db.add(lead)
    db.flush()
    add_activity(
        db,
        lead,
        activity_type="created",
        description="Inbound call received",
    )
    return lead
