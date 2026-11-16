"""Phone numbers: inventory, provider catalogue and employee assignment."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import Perm
from app.modules import phone_numbers
from app.schemas.common import MessageResponse, Page
from app.schemas.phone_number import (
    AssignPhoneNumberRequest,
    AvailableNumberOut,
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

router = APIRouter(prefix="/phone-numbers", tags=["Phone Numbers"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.PHONE_NUMBERS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.PHONE_NUMBERS_WRITE))]


@router.get("/providers", response_model=list[TelephonyProviderOut], summary="Telephony providers")
def list_providers(principal: Reader, db: DbSession) -> list[TelephonyProviderOut]:
    return phone_numbers.list_providers(db)


@router.get(
    "/catalogue",
    response_model=list[TelephonyMarketOut],
    summary="Countries and regions a number can be bought in",
)
def list_markets(principal: Reader) -> list[TelephonyMarketOut]:
    return phone_numbers.list_markets()


@router.get(
    "/available",
    response_model=list[AvailableNumberOut],
    summary="Numbers available to buy",
)
def available_numbers(
    principal: Reader,
    db: DbSession,
    country_code: str | None = None,
    region: str | None = None,
    capability: str | None = None,
    q: str | None = None,
    limit: int = 24,
) -> list[AvailableNumberOut]:
    return phone_numbers.available_numbers(
        db,
        country_code=country_code,
        region=region,
        capability=capability,
        query=q,
        limit=limit,
    )


@router.get("", response_model=Page[PhoneNumberOut], summary="List phone numbers")
def list_numbers(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    status_filter: str | None = None,
    employee_id: str | None = None,
) -> Page[PhoneNumberOut]:
    rows, total = phone_numbers.list_numbers(
        db, principal.organization_id, params, status=status_filter, employee_id=employee_id
    )
    return Page[PhoneNumberOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "",
    response_model=PhoneNumberOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a phone number",
)
def create_number(
    payload: PhoneNumberCreate, principal: Writer, db: DbSession
) -> PhoneNumberOut:
    return phone_numbers.create_number(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.post(
    "/purchase",
    response_model=PhoneNumberPurchaseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Buy a number",
)
def purchase_number(
    payload: PhoneNumberPurchase, principal: Writer, db: DbSession
) -> PhoneNumberPurchaseOut:
    return phone_numbers.purchase_number(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.post(
    "/attach",
    response_model=PhoneNumberAttachOut,
    summary="Attach a number rented in the Sarvam console",
)
def attach_number(
    payload: PhoneNumberAttach, principal: Writer, db: DbSession
) -> PhoneNumberAttachOut:
    """Record a number the workspace already rents, so calls can route through it.

    Idempotent: attaching the same number twice answers with the row that
    already holds it (``created`` false). A number another workspace recorded
    is refused. Registered before ``/{number_id}`` so the path is not read as
    an id.
    """
    return phone_numbers.attach_number(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.get(
    "/sync",
    response_model=PhoneNumberSyncOut,
    summary="How this workspace's numbers are inventoried",
)
def sync_numbers(principal: Reader, db: DbSession) -> PhoneNumberSyncOut:
    """The workspace's own number list, with no carrier read behind it.

    Registered before ``/{number_id}`` so ``sync`` is not read as an id. The
    report never writes: attaching stays on ``POST /attach``, and buying,
    renewing and releasing the lease itself are Sarvam Console steps.
    """
    return phone_numbers.inventory_summary(db, principal.organization_id)


@router.get("/{number_id}", response_model=PhoneNumberOut, summary="Get a phone number")
def get_number(number_id: str, principal: Reader, db: DbSession) -> PhoneNumberOut:
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    return phone_numbers.number_view(db, number)


@router.patch("/{number_id}", response_model=PhoneNumberOut, summary="Update a phone number")
def update_number(
    number_id: str, payload: PhoneNumberUpdate, principal: Writer, db: DbSession
) -> PhoneNumberOut:
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    return phone_numbers.update_number(db, number, payload, user_id=principal.user_id)


@router.post(
    "/{number_id}/assign", response_model=PhoneNumberOut, summary="Bind to an AI employee"
)
def assign_number(
    number_id: str,
    principal: Writer,
    db: DbSession,
    payload: AssignPhoneNumberRequest | None = None,
    employee_id: str | None = None,
) -> PhoneNumberOut:
    """Bind the number to one AI employee, or unbind it with a null id.

    The body is the contract. ``employee_id`` as a query parameter is kept so
    an older client keeps working, and the body wins when both are sent.
    """
    chosen = payload.employee_id if payload is not None else employee_id
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    return phone_numbers.assign_number(db, number, chosen, user_id=principal.user_id)


@router.delete("/{number_id}", response_model=MessageResponse, summary="Release a phone number")
def delete_number(number_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    """Take the line out of service here. The row and its history are kept."""
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    phone_numbers.release_number(db, number, user_id=principal.user_id)
    return MessageResponse(message="Phone number released. Its records are kept.")
