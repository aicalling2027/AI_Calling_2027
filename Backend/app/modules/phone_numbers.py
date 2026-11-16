"""Phone number inventory and telephony providers - PRD module 16."""

from __future__ import annotations

from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import (
    NUMBERS_PER_BLOCK,
    TELEPHONY_MARKETS,
    CampaignStatus,
    PhoneNumberStatus,
)
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.pagination import PageParams, paginate
from app.database.base import utcnow
from app.database.models.campaign import Campaign
from app.database.models.employee import Employee
from app.database.models.organization import Organization
from app.database.models.phone_number import (
    PhoneNumber,
    PhoneNumberAssignment,
    TelephonyProvider,
)
from app.database.models.provider import ProviderDeployment
from app.modules import audit, billing, number_routing
from app.modules.common import scoped
from app.schemas.phone_number import (
    AvailableNumberOut,
    CarrierCountryCount,
    MarketRegionOut,
    NumberQuotaOut,
    NumberRoutingOut,
    PhoneNumberAttach,
    PhoneNumberAttachOut,
    PhoneNumberCreate,
    PhoneNumberOut,
    PhoneNumberPurchase,
    PhoneNumberPurchaseOut,
    PhoneNumberSyncOut,
    PhoneNumberUpdate,
    TelephonyMarketOut,
    TelephonyProviderOut,
)
from app.utils.phone import digits_only, same_number

#: Campaign states that still need their number in order to dial.
_LIVE_CAMPAIGN_STATUSES = (
    str(CampaignStatus.SCHEDULED),
    str(CampaignStatus.RUNNING),
    str(CampaignStatus.PAUSED),
)

#: Deployment states that mean the provider is answering this number now.
#: A local ``pending`` or ``paused`` row is a request, not a live line, so it
#: never makes a number impossible to give up.
_LIVE_DEPLOYMENT_STATUSES = ("active",)


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------
def list_providers(db: Session) -> list[TelephonyProviderOut]:
    rows = db.execute(
        select(TelephonyProvider).order_by(TelephonyProvider.name.asc())
    ).scalars().all()
    return [TelephonyProviderOut.model_validate(row) for row in rows]


def list_markets() -> list[TelephonyMarketOut]:
    """Where a number can be bought, for the pickers in the purchase form."""
    return [
        TelephonyMarketOut(
            country_code=str(market["country_code"]),
            country=str(market["country"]),
            dial_code=str(market["dial_code"]),
            capabilities=list(market["capabilities"]),  # type: ignore[call-overload]
            regions=[
                MarketRegionOut(
                    region=str(region["region"]),
                    monthly_cost_inr=int(region["monthly_cost_inr"]),
                    setup_cost_inr=int(region["setup_cost_inr"]),
                )
                for region in market["regions"]  # type: ignore[union-attr]
            ],
        )
        for market in TELEPHONY_MARKETS
    ]


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------
def list_numbers(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    status: str | None = None,
    employee_id: str | None = None,
) -> tuple[list[PhoneNumberOut], int]:
    stmt = select(PhoneNumber).where(PhoneNumber.organization_id == organization_id)
    if status:
        stmt = stmt.where(PhoneNumber.status == status)
    if employee_id:
        stmt = stmt.where(PhoneNumber.employee_id == employee_id)
    rows, total = paginate(db, stmt.order_by(PhoneNumber.created_at.desc()), params)
    return _out_many(db, list(rows)), total


def get_number(db: Session, organization_id: str, number_id: str) -> PhoneNumber:
    return scoped(db, PhoneNumber, number_id, organization_id, label="Phone number")


def _out(db: Session, number: PhoneNumber) -> PhoneNumberOut:
    """One row as the API reports it, with its inbound routing attached."""
    routing = number_routing.routing_for(db, [number])
    view = PhoneNumberOut.model_validate(number)
    return view.model_copy(
        update={"routing": routing.get(str(number.id), NumberRoutingOut())}
    )


def _out_many(db: Session, rows: list[PhoneNumber]) -> list[PhoneNumberOut]:
    """A page of rows with routing, in two queries rather than two per row."""
    routing = number_routing.routing_for(db, rows)
    return [
        PhoneNumberOut.model_validate(row).model_copy(
            update={"routing": routing.get(str(row.id), NumberRoutingOut())}
        )
        for row in rows
    ]


def number_view(db: Session, number: PhoneNumber) -> PhoneNumberOut:
    """One number as the API reports it, with its inbound routing attached."""
    return _out(db, number)


# ---------------------------------------------------------------------------
# Purchase catalogue
# ---------------------------------------------------------------------------
def _formatted(dial_code: str, subscriber: str) -> str:
    """Split for reading: ``+91 22671 23001``."""
    return f"{dial_code} {subscriber[:-4]} {subscriber[-4:]}"


def _catalogue() -> list[dict[str, object]]:
    """Every number the purchase flow can sell, in market and region order.

    Built from ``TELEPHONY_MARKETS`` rather than stored: the pool is fixed, so
    the same search always answers the same numbers, and a number leaves the
    shelf only because some workspace already holds it.
    """
    shelf: list[dict[str, object]] = []
    for market in TELEPHONY_MARKETS:
        dial_code = str(market["dial_code"])
        capabilities = list(market["capabilities"])  # type: ignore[call-overload]
        for region in market["regions"]:  # type: ignore[union-attr]
            for serial in range(1, NUMBERS_PER_BLOCK + 1):
                subscriber = f"{region['block']}{serial:02d}"
                number = f"{dial_code}{subscriber}"
                shelf.append(
                    {
                        "number": number,
                        "formatted": _formatted(dial_code, subscriber),
                        "country_code": market["country_code"],
                        "country": market["country"],
                        "dial_code": dial_code,
                        "region": region["region"],
                        "provider": market["provider"],
                        "capabilities": capabilities,
                        "monthly_cost_inr": region["monthly_cost_inr"],
                        "setup_cost_inr": region["setup_cost_inr"],
                    }
                )
    return shelf


def available_numbers(
    db: Session,
    *,
    country_code: str | None = None,
    region: str | None = None,
    capability: str | None = None,
    query: str | None = None,
    limit: int = 24,
) -> list[AvailableNumberOut]:
    """The shelf, minus what any workspace already holds, filtered as asked.

    A released line keeps its row so its calls and campaigns stay readable, and
    the unique number belongs to that row, so it never goes back on the shelf.
    """
    held = [str(value) for value in db.execute(select(PhoneNumber.number)).scalars().all()]
    wanted = digits_only(query or "")
    country = (country_code or "").strip().upper()
    region_name = (region or "").strip().lower()
    budget = max(1, min(limit, 50))

    rows: list[AvailableNumberOut] = []
    for entry in _catalogue():
        if country and str(entry["country_code"]) != country:
            continue
        if region_name and str(entry["region"]).lower() != region_name:
            continue
        if capability and capability not in entry["capabilities"]:  # type: ignore[operator]
            continue
        number = str(entry["number"])
        if wanted and wanted not in digits_only(number):
            continue
        # Uniqueness is platform-wide, so another tenant's number is not for
        # sale either.
        if any(same_number(number, value) for value in held):
            continue
        rows.append(AvailableNumberOut(**entry))  # type: ignore[arg-type]
        if len(rows) >= budget:
            break
    return rows


def lock_statement(organization_id: str):
    """The row lock that serialises number attachments for one workspace.

    Kept as a builder so the statement itself can be inspected: holding this
    row is what makes the count below trustworthy when two requests try to
    attach at the same moment.
    """
    return (
        select(Organization.id)
        .where(Organization.id == organization_id)
        .with_for_update()
    )


def _lock_tenant(db: Session, organization_id: str) -> None:
    """Serialise attachments in this workspace until the transaction ends.

    Only PostgreSQL takes row locks. SQLite (what the test suite runs on) has
    none and serialises writers itself, so the statement is skipped rather
    than emulated.
    """
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    db.execute(lock_statement(organization_id)).scalar_one_or_none()


def _held_count(db: Session, organization_id: str) -> int:
    """The numbers the plan counts: everything held and billed.

    Pending, active and inactive rows are all held, so all of them count. A
    released row is the end of a lease, so it is kept for its history only.
    """
    return int(
        db.execute(
            select(func.count())
            .select_from(PhoneNumber)
            .where(
                PhoneNumber.organization_id == organization_id,
                PhoneNumber.status != str(PhoneNumberStatus.RELEASED),
            )
        ).scalar_one()
    )


def _quota_for(db: Session, organization_id: str) -> NumberQuotaOut | None:
    """The plan allowance and how much of it is in use.

    ``None`` when the workspace has not been subscribed yet: reporting a quota
    must not create the subscription it reports on.
    """
    allowance = billing.existing_allowance(db, organization_id)
    if allowance is None:
        return None
    current = _held_count(db, organization_id)
    return NumberQuotaOut(
        plan=allowance.code,
        limit=allowance.max_phone_numbers,
        current=current,
        remaining=max(0, allowance.max_phone_numbers - current),
    )


def _assert_plan_room(db: Session, organization_id: str) -> None:
    """Refuse a new number when the plan's include is already held.

    The workspace row is locked first, so two concurrent attachments cannot
    both read the same count and both decide there is room.
    """
    _lock_tenant(db, organization_id)
    allowance = billing.plan_allowance(db, organization_id)
    current = _held_count(db, organization_id)
    if current < allowance.max_phone_numbers:
        return
    raise ConflictError(
        f"Your {allowance.code} plan includes {allowance.max_phone_numbers} "
        f"phone number(s) and {current} already held. Release a number or "
        "upgrade the plan to attach more.",
        code="phone_number_limit_reached",
        details={
            "limit": allowance.max_phone_numbers,
            "current": current,
            "plan": allowance.code,
        },
    )


def _held_rows(db: Session, number: str) -> list[PhoneNumber]:
    """Every row, in any workspace, that spells this number the same way.

    The database constraint compares the stored strings, which does not catch
    ``+91 80 6535 4620`` against ``+918065354620``, so the comparison is made on
    digits here as well.
    """
    return [
        row
        for row in db.execute(select(PhoneNumber)).scalars().all()
        if same_number(row.number, number)
    ]


def _assert_number_free(db: Session, number: str) -> None:
    """A line belongs to one workspace only, so the check ignores tenancy.

    The plain ``conflict`` code is kept here because the purchase and create
    endpoints have always answered that way; the attach and release paths
    report the more specific ``number_in_use`` instead.
    """
    if _held_rows(db, number):
        raise ConflictError(
            "This phone number is already registered on the platform.",
            details={"number": number},
        )


def number_usage(db: Session, number: PhoneNumber) -> dict[str, list[dict[str, str]]]:
    """The campaigns and inbound deployments that would break without the line.

    Only states that still dial, or still answer, are listed. A completed
    campaign keeps its own record, so it does not hold the number hostage.
    """
    campaigns = db.execute(
        select(Campaign).where(
            Campaign.phone_number_id == number.id,
            Campaign.status.in_(_LIVE_CAMPAIGN_STATUSES),
        )
    ).scalars().all()
    deployments = db.execute(
        select(ProviderDeployment).where(
            ProviderDeployment.phone_number_id == number.id,
            ProviderDeployment.deployment_status.in_(_LIVE_DEPLOYMENT_STATUSES),
        )
    ).scalars().all()
    return {
        "campaigns": [
            {"id": row.id, "name": row.name, "status": row.status}
            for row in campaigns
        ],
        "deployments": [
            {"id": row.id, "status": row.deployment_status} for row in deployments
        ],
    }


def _assert_not_in_use(db: Session, number: PhoneNumber) -> None:
    """Refuse to take a line away while something still calls through it."""
    usage = number_usage(db, number)
    busy: list[str] = []
    if usage["campaigns"]:
        busy.append(f"{len(usage['campaigns'])} campaign(s)")
    if usage["deployments"]:
        busy.append(f"{len(usage['deployments'])} inbound deployment(s)")
    if not busy:
        return
    raise ConflictError(
        "This number is still in use by " + " and ".join(busy)
        + ". Remove it from them first; its history is kept either way.",
        code="number_in_use",
        details=usage,
    )


def create_number(
    db: Session,
    organization: Organization,
    payload: PhoneNumberCreate,
    *,
    user_id: str | None,
) -> PhoneNumberOut:
    _assert_plan_room(db, organization.id)
    _assert_number_free(db, payload.number)

    if payload.employee_id:
        _employee_or_404(db, organization.id, payload.employee_id)

    number = PhoneNumber(
        organization_id=organization.id,
        number=payload.number,
        label=payload.label,
        country_code=payload.country_code,
        provider=payload.provider,
        status=str(PhoneNumberStatus.ACTIVE),
        employee_id=payload.employee_id,
        capabilities=payload.capabilities,
        assigned_at=utcnow() if payload.employee_id else None,
    )
    db.add(number)
    db.flush()

    if payload.employee_id:
        db.add(
            PhoneNumberAssignment(
                phone_number_id=number.id,
                employee_id=payload.employee_id,
                assigned_by=user_id,
                assigned_at=utcnow(),
            )
        )

    audit.log_action(
        db,
        action="phone_number.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes={"number": number.number, "provider": number.provider},
    )
    db.commit()
    db.refresh(number)
    return _out(db, number)


def purchase_number(
    db: Session,
    organization: Organization,
    payload: PhoneNumberPurchase,
    *,
    user_id: str | None,
) -> PhoneNumberPurchaseOut:
    """Reserve a catalogue number for the workspace and store it as owned.

    The catalogue is the shelf, not a carrier: the lookup is what makes the
    price and the country trustworthy, so a number the shelf never offered is
    refused rather than created from the caller's text.
    """
    entry = next(
        (
            item
            for item in _catalogue()
            if same_number(str(item["number"]), payload.number)
        ),
        None,
    )
    if entry is None:
        raise NotFoundError(
            "That number is not available. Pick another one from the list.",
            code="number_not_available",
            details={"number": payload.number},
        )

    supported = [str(item) for item in entry["capabilities"]]  # type: ignore[union-attr]
    unsupported = [item for item in payload.capabilities if item not in supported]
    if unsupported:
        raise ValidationError(
            "This number does not support that: " + ", ".join(unsupported) + ".",
            details={"capabilities": supported},
        )

    _assert_plan_room(db, organization.id)
    _assert_number_free(db, str(entry["number"]))

    if payload.employee_id:
        _employee_or_404(db, organization.id, payload.employee_id)

    number = PhoneNumber(
        organization_id=organization.id,
        number=str(entry["number"]),
        label=payload.label or f"{entry['region']} line",
        country_code=str(entry["country_code"]),
        provider=str(entry["provider"]),
        status=str(
            PhoneNumberStatus.ACTIVE if payload.employee_id else PhoneNumberStatus.PENDING
        ),
        employee_id=payload.employee_id,
        capabilities=list(payload.capabilities),
        monthly_cost_inr=int(entry["monthly_cost_inr"]),
        assigned_at=utcnow() if payload.employee_id else None,
    )
    db.add(number)
    db.flush()

    if payload.employee_id:
        db.add(
            PhoneNumberAssignment(
                phone_number_id=number.id,
                employee_id=payload.employee_id,
                assigned_by=user_id,
                assigned_at=utcnow(),
            )
        )

    audit.log_action(
        db,
        action="phone_number.purchased",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes={
            "number": number.number,
            "region": entry["region"],
            "monthly_cost_inr": number.monthly_cost_inr,
        },
    )
    db.commit()
    db.refresh(number)
    return PhoneNumberPurchaseOut(
        number=_out(db, number),
        setup_cost_inr=int(entry["setup_cost_inr"]),
        # The shelf is ours until a carrier inventory API sits behind it.
        simulated=True,
    )


def _mark_released(db: Session, number: PhoneNumber) -> None:
    """Close the open assignment history and mark the row released.

    The row itself stays: call logs, campaign references and assignment history
    point at it, and the same number can be attached again later.
    """
    for open_row in db.execute(
        select(PhoneNumberAssignment).where(
            PhoneNumberAssignment.phone_number_id == number.id,
            PhoneNumberAssignment.unassigned_at.is_(None),
        )
    ).scalars():
        open_row.unassigned_at = utcnow()

    number.employee_id = None
    number.assigned_at = None
    number.status = str(PhoneNumberStatus.RELEASED)
    number.released_at = utcnow()


def attach_number(
    db: Session,
    organization: Organization,
    payload: PhoneNumberAttach,
    *,
    user_id: str | None,
) -> PhoneNumberAttachOut:
    """Record a number rented in the Sarvam console against this workspace.

    Attaching is idempotent: the same number twice answers with the row that
    already holds it, so a double-click or a retried request cannot create a
    second one. A number another workspace recorded is refused rather than
    taken over, and a line this workspace released earlier is reused so its
    history stays in one row instead of splitting in two.

    The plan quota applies here too: a number attached to a workspace is a
    number that workspace holds and pays for, whether or not this app sold it.
    """
    held = _held_rows(db, payload.number)
    existing = next(
        (row for row in held if row.organization_id == organization.id), None
    )
    if existing is None and held:
        raise ConflictError(
            "This phone number is already attached to another workspace.",
            code="number_in_use",
            details={"number": payload.number},
        )

    if existing is not None and existing.status != str(PhoneNumberStatus.RELEASED):
        # Already attached: answer with the row as it stands. A repeated attach
        # is not a change, so nothing is written and nothing is audited.
        return PhoneNumberAttachOut(number=_out(db, existing), created=False)

    _assert_plan_room(db, organization.id)

    employee = (
        _employee_or_404(db, organization.id, payload.employee_id)
        if payload.employee_id
        else None
    )

    status = str(
        PhoneNumberStatus.ACTIVE if payload.employee_id else PhoneNumberStatus.PENDING
    )

    if existing is not None:
        # A released line coming back: reuse the row and its history.
        existing.label = payload.label or existing.label
        existing.country_code = payload.country_code
        existing.capabilities = list(payload.capabilities)
        existing.status = status
        existing.released_at = None
        existing.employee_id = payload.employee_id
        existing.assigned_at = utcnow() if payload.employee_id else None
        number = existing
        reactivated = True
    else:
        number = PhoneNumber(
            organization_id=organization.id,
            number=payload.number,
            label=payload.label,
            country_code=payload.country_code,
            provider="sarvam",
            status=status,
            employee_id=payload.employee_id,
            capabilities=list(payload.capabilities),
            assigned_at=utcnow() if payload.employee_id else None,
        )
        db.add(number)
        reactivated = False

    db.flush()

    if employee is not None:
        db.add(
            PhoneNumberAssignment(
                phone_number_id=number.id,
                employee_id=employee.id,
                assigned_by=user_id,
                assigned_at=utcnow(),
            )
        )
        # Recording the assignment is local. Asking the provider to answer the
        # number is the step that can make it live, and that stays unconfirmed
        # until the provider actually replies.
        number_routing.configure_inbound(
            db, number=number, employee=employee, user_id=user_id
        )

    audit.log_action(
        db,
        action="phone_number.attached",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes={
            "number": number.number,
            "source": "console",
            "reactivated": reactivated,
            "employee_id": payload.employee_id,
        },
    )
    db.commit()
    db.refresh(number)
    return PhoneNumberAttachOut(number=_out(db, number), created=True)


def update_number(
    db: Session, number: PhoneNumber, payload: PhoneNumberUpdate, *, user_id: str | None
) -> PhoneNumberOut:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    wanted_status = str(updates.get("status") or "")
    released = str(PhoneNumberStatus.RELEASED)

    if number.status == released and wanted_status and wanted_status != released:
        # Releasing ends the number's life in this workspace while keeping its
        # history, so only attaching it again can start a new one.
        raise ConflictError(
            "This number was released. Attach it again to bring it back into service.",
            code="number_released",
            details={"status": number.status},
        )

    releasing = wanted_status == released and number.status != released
    if releasing:
        # Releasing through a patch has the same consequences as the release
        # action, so it passes the same guard and stops inbound routing.
        _assert_not_in_use(db, number)
        number_routing.stop_inbound(db, number=number, user_id=user_id)

    changes: dict[str, object] = {}
    for field, value in updates.items():
        value = str(value) if field == "status" else value
        if getattr(number, field) != value:
            setattr(number, field, value)
            changes[field] = value

    released_now = changes.get("status") == released
    if released_now:
        _mark_released(db, number)

    audit.log_action(
        db,
        action="phone_number.released" if released_now else "phone_number.updated",
        organization_id=number.organization_id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes=changes,
    )
    db.commit()
    db.refresh(number)
    return _out(db, number)


def assign_number(
    db: Session, number: PhoneNumber, employee_id: str | None, *, user_id: str | None
) -> PhoneNumberOut:
    """Bind the number to an employee, or unbind it when ``employee_id`` is null.

    A released number is out of service until it is attached again, so it cannot
    be assigned. Binding records the intent here and then asks the provider to
    answer the number; the response says which of the two actually happened.
    """
    if number.status == str(PhoneNumberStatus.RELEASED):
        raise ConflictError(
            "This number was released. Attach it again to route calls through it.",
            code="number_released",
            details={"status": number.status},
        )

    employee = (
        _employee_or_404(db, number.organization_id, employee_id)
        if employee_id
        else None
    )

    for open_row in db.execute(
        select(PhoneNumberAssignment).where(
            PhoneNumberAssignment.phone_number_id == number.id,
            PhoneNumberAssignment.unassigned_at.is_(None),
        )
    ).scalars():
        open_row.unassigned_at = utcnow()

    if employee is not None:
        db.add(
            PhoneNumberAssignment(
                phone_number_id=number.id,
                employee_id=employee.id,
                assigned_by=user_id,
                assigned_at=utcnow(),
            )
        )
        number.assigned_at = utcnow()
        if number.status == str(PhoneNumberStatus.PENDING):
            number.status = str(PhoneNumberStatus.ACTIVE)
        number.employee_id = employee.id
        db.flush()
        number_routing.configure_inbound(
            db, number=number, employee=employee, user_id=user_id
        )
    else:
        number.assigned_at = None
        number.employee_id = None
        number_routing.stop_inbound(db, number=number, user_id=user_id)

    audit.log_action(
        db,
        action="phone_number.assigned" if employee_id else "phone_number.unassigned",
        organization_id=number.organization_id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes={"employee_id": employee_id},
    )
    db.commit()
    db.refresh(number)
    return _out(db, number)


def release_number(
    db: Session, number: PhoneNumber, *, user_id: str | None
) -> PhoneNumberOut:
    """Take the line out of service here, keeping the row and its history.

    Nothing is deleted: call logs, campaign references and assignment history
    point at this row, and the same number can be attached again later. The
    lease itself (stop being charged) is released in the Sarvam console; this
    only stops the workspace routing through it.
    """
    _assert_not_in_use(db, number)
    # Stop answering before the line closes: a request left with the provider
    # must not outlive this workspace's use of the number.
    number_routing.stop_inbound(db, number=number, user_id=user_id)
    _mark_released(db, number)
    audit.log_action(
        db,
        action="phone_number.released",
        organization_id=number.organization_id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes={"number": number.number},
    )
    db.commit()
    db.refresh(number)
    return _out(db, number)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
def inventory_summary(db: Session, organization_id: str) -> PhoneNumberSyncOut:
    """What this workspace holds, and how that list is maintained.

    There is no carrier half to read: Sarvam publishes no server-to-server API
    for connections or rented numbers, so a number reaches a workspace through
    ``POST /phone-numbers/attach`` after being rented in the Sarvam console.
    The counts below are therefore this workspace's own rows, and the remote
    fields stay empty rather than claiming a number the service cannot see.

    Read-only: nothing is created, imported or released by asking.
    """
    rows = list(
        db.execute(
            select(PhoneNumber).where(PhoneNumber.organization_id == organization_id)
        ).scalars()
    )
    counts = Counter(str(row.status) for row in rows)
    live = [row for row in rows if row.status != str(PhoneNumberStatus.RELEASED)]
    assigned = sum(1 for row in live if row.employee_id)
    countries = Counter((row.country_code or "IN").upper() for row in live)

    return PhoneNumberSyncOut(
        connection_id=str(settings.sarvam_connection_id or "").strip() or None,
        checked_at=utcnow(),
        local_total=len(live),
        local_active=counts[str(PhoneNumberStatus.ACTIVE)],
        local_pending=counts[str(PhoneNumberStatus.PENDING)],
        local_released=counts[str(PhoneNumberStatus.RELEASED)],
        assigned=assigned,
        unassigned=len(live) - assigned,
        quota=_quota_for(db, organization_id),
        by_country=[
            CarrierCountryCount(country=name, numbers=count)
            for name, count in countries.most_common()
        ],
    )


# ---------------------------------------------------------------------------
# Resolution helpers used by the call service
# ---------------------------------------------------------------------------
#: Why a number recorded here cannot carry an outbound call, in words the
#: workspace can act on.
_UNUSABLE_OUTBOUND = {
    "released": (
        "This phone number was released. Attach it again before dialling from it."
    ),
    "inactive": (
        "This phone number is not active yet. Assign an AI employee to it "
        "before dialling from it."
    ),
    "outbound_not_supported": (
        "This phone number was attached without outbound calling. Attach it "
        "with the outbound capability to dial from it."
    ),
}


def _outbound_reason(number: PhoneNumber) -> str | None:
    """Why this number cannot place an outbound call, or ``None`` if it can.

    Read from what the workspace recorded when the number was attached: no
    provider is contacted and no call is placed.
    """
    if number.status == str(PhoneNumberStatus.RELEASED):
        return "released"
    if number.status != str(PhoneNumberStatus.ACTIVE):
        return "inactive"
    capabilities = [str(capability) for capability in (number.capabilities or [])]
    if "outbound" not in capabilities:
        return "outbound_not_supported"
    return None


def _assert_outbound_ready(number: PhoneNumber) -> None:
    """Refuse an explicitly chosen number that cannot carry the call."""
    reason = _outbound_reason(number)
    if reason is None:
        return
    raise ConflictError(
        _UNUSABLE_OUTBOUND[reason],
        code="phone_number_unavailable",
        details={
            "reason": reason,
            "status": number.status,
            "capabilities": list(number.capabilities or []),
        },
    )


def resolve_outbound_number(
    db: Session,
    organization_id: str,
    *,
    phone_number_id: str | None = None,
    employee_id: str | None = None,
) -> PhoneNumber | None:
    """Pick the number to dial from - explicit id, else the employee's number.

    An explicit choice is validated rather than silently swapped for another
    line, so a workspace never dials from a number it did not pick. The
    fallback takes the first in-service number that supports outbound calling,
    preferring one bound to the employee. No provider is contacted here.
    """
    if phone_number_id:
        chosen = scoped(
            db, PhoneNumber, phone_number_id, organization_id, label="Phone number"
        )
        _assert_outbound_ready(chosen)
        return chosen

    candidates = [
        row
        for row in db.execute(
            select(PhoneNumber)
            .where(
                PhoneNumber.organization_id == organization_id,
                PhoneNumber.status == str(PhoneNumberStatus.ACTIVE),
            )
            .order_by(PhoneNumber.created_at.asc())
        )
        .scalars()
        .all()
        if _outbound_reason(row) is None
    ]
    if employee_id:
        for row in candidates:
            if row.employee_id == employee_id:
                return row
    return candidates[0] if candidates else None


def find_by_inbound_number(db: Session, to_number: str) -> PhoneNumber | None:
    """Global lookup for an inbound DID (tenant is derived from the number).

    A released row stays in the table for its history, so it must not answer a
    call any more: only lines that are still in service are returned.
    """
    for candidate in db.execute(select(PhoneNumber)).scalars().all():
        if candidate.status == str(PhoneNumberStatus.RELEASED):
            continue
        if same_number(candidate.number, to_number):
            return candidate
    return None


def _employee_or_404(db: Session, organization_id: str, employee_id: str) -> Employee:
    employee = scoped(db, Employee, employee_id, organization_id, label="Employee")
    if employee is None:  # pragma: no cover - scoped already raises
        raise NotFoundError("Employee not found.", details={"id": employee_id})
    return employee
