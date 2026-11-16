"""Phone number inventory and telephony providers - PRD module 16."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import (
    NUMBERS_PER_BLOCK,
    TELEPHONY_MARKETS,
    PhoneNumberStatus,
)
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.pagination import PageParams, paginate
from app.database.base import utcnow
from app.database.models.employee import Employee
from app.database.models.organization import Organization
from app.database.models.phone_number import (
    PhoneNumber,
    PhoneNumberAssignment,
    TelephonyProvider,
)
from app.modules import audit, billing
from app.modules.common import scoped
from app.schemas.phone_number import (
    AvailableNumberOut,
    MarketRegionOut,
    PhoneNumberCreate,
    PhoneNumberOut,
    PhoneNumberPurchase,
    PhoneNumberPurchaseOut,
    PhoneNumberUpdate,
    TelephonyMarketOut,
    TelephonyProviderOut,
)
from app.utils.phone import digits_only, same_number


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
    return [PhoneNumberOut.model_validate(row) for row in rows], total


def get_number(db: Session, organization_id: str, number_id: str) -> PhoneNumber:
    return scoped(db, PhoneNumber, number_id, organization_id, label="Phone number")


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
    """The shelf, minus what any workspace already holds, filtered as asked."""
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


def _assert_plan_room(db: Session, organization_id: str) -> None:
    """Refuse a new number when the plan's include is already used."""
    limits = billing.plan_limits(db, organization_id)
    current = int(
        db.execute(
            select(func.count())
            .select_from(PhoneNumber)
            .where(
                PhoneNumber.organization_id == organization_id,
                PhoneNumber.status != str(PhoneNumberStatus.RELEASED),
            )
        ).scalar_one()
    )
    if current >= limits["max_phone_numbers"]:
        raise ConflictError(
            f"Your plan allows {limits['max_phone_numbers']} phone numbers. "
            "Upgrade the plan to add more.",
            code="plan_limit_reached",
            details={"limit": limits["max_phone_numbers"], "current": current},
        )


def _assert_number_free(db: Session, number: str) -> None:
    """A line belongs to one workspace only, so the check ignores tenancy."""
    taken = db.execute(
        select(PhoneNumber).where(PhoneNumber.number == number)
    ).scalar_one_or_none()
    if taken is not None:
        raise ConflictError(
            "This phone number is already registered on the platform.",
            details={"number": number},
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
        provider_number_id=payload.provider_number_id,
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
    return PhoneNumberOut.model_validate(number)


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
        number=PhoneNumberOut.model_validate(number),
        setup_cost_inr=int(entry["setup_cost_inr"]),
        # The shelf is ours until a carrier inventory API sits behind it.
        simulated=True,
    )


def update_number(
    db: Session, number: PhoneNumber, payload: PhoneNumberUpdate, *, user_id: str | None
) -> PhoneNumberOut:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    changes: dict[str, object] = {}
    for field, value in updates.items():
        value = str(value) if field == "status" else value
        if getattr(number, field) != value:
            setattr(number, field, value)
            changes[field] = value

    audit.log_action(
        db,
        action="phone_number.updated",
        organization_id=number.organization_id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes=changes,
    )
    db.commit()
    db.refresh(number)
    return PhoneNumberOut.model_validate(number)


def assign_number(
    db: Session, number: PhoneNumber, employee_id: str | None, *, user_id: str | None
) -> PhoneNumberOut:
    """Bind the number to an employee, or release it when ``employee_id`` is null."""
    if employee_id:
        _employee_or_404(db, number.organization_id, employee_id)

    for open_row in db.execute(
        select(PhoneNumberAssignment).where(
            PhoneNumberAssignment.phone_number_id == number.id,
            PhoneNumberAssignment.unassigned_at.is_(None),
        )
    ).scalars():
        open_row.unassigned_at = utcnow()

    if employee_id:
        db.add(
            PhoneNumberAssignment(
                phone_number_id=number.id,
                employee_id=employee_id,
                assigned_by=user_id,
                assigned_at=utcnow(),
            )
        )
        number.assigned_at = utcnow()
        if number.status == str(PhoneNumberStatus.PENDING):
            number.status = str(PhoneNumberStatus.ACTIVE)
    else:
        number.assigned_at = None

    number.employee_id = employee_id
    audit.log_action(
        db,
        action="phone_number.assigned" if employee_id else "phone_number.released",
        organization_id=number.organization_id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number.id,
        changes={"employee_id": employee_id},
    )
    db.commit()
    db.refresh(number)
    return PhoneNumberOut.model_validate(number)


def delete_number(db: Session, number: PhoneNumber, *, user_id: str | None) -> None:
    number_id, organization_id = number.id, number.organization_id
    db.delete(number)
    audit.log_action(
        db,
        action="phone_number.deleted",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="phone_number",
        resource_id=number_id,
    )
    db.commit()


# ---------------------------------------------------------------------------
# Resolution helpers used by the call service
# ---------------------------------------------------------------------------
def resolve_outbound_number(
    db: Session,
    organization_id: str,
    *,
    phone_number_id: str | None = None,
    employee_id: str | None = None,
) -> PhoneNumber | None:
    """Pick the number to dial from - explicit id, else the employee's number."""
    if phone_number_id:
        return scoped(db, PhoneNumber, phone_number_id, organization_id, label="Phone number")

    if employee_id:
        bound = db.execute(
            select(PhoneNumber).where(
                PhoneNumber.organization_id == organization_id,
                PhoneNumber.employee_id == employee_id,
                PhoneNumber.status == str(PhoneNumberStatus.ACTIVE),
            )
        ).scalars().first()
        if bound is not None:
            return bound

    return db.execute(
        select(PhoneNumber).where(
            PhoneNumber.organization_id == organization_id,
            PhoneNumber.status == str(PhoneNumberStatus.ACTIVE),
        ).order_by(PhoneNumber.created_at.asc())
    ).scalars().first()


def find_by_inbound_number(db: Session, to_number: str) -> PhoneNumber | None:
    """Global lookup for an inbound DID (tenant is derived from the number)."""
    for candidate in db.execute(select(PhoneNumber)).scalars().all():
        if same_number(candidate.number, to_number):
            return candidate
    return None


def _employee_or_404(db: Session, organization_id: str, employee_id: str) -> Employee:
    employee = scoped(db, Employee, employee_id, organization_id, label="Employee")
    if employee is None:  # pragma: no cover - scoped already raises
        raise NotFoundError("Employee not found.", details={"id": employee_id})
    return employee
