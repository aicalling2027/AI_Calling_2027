"""Phone numbers: inventory, provider catalogue and employee assignment."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import Perm
from app.modules import phone_numbers
from app.schemas.common import MessageResponse, Page
from app.schemas.phone_number import (
    PhoneNumberCreate,
    PhoneNumberOut,
    PhoneNumberUpdate,
    TelephonyProviderOut,
)

router = APIRouter(prefix="/phone-numbers", tags=["Phone Numbers"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.PHONE_NUMBERS_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.PHONE_NUMBERS_WRITE))]


@router.get("/providers", response_model=list[TelephonyProviderOut], summary="Telephony providers")
def list_providers(principal: Reader, db: DbSession) -> list[TelephonyProviderOut]:
    return phone_numbers.list_providers(db)


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


@router.get("/{number_id}", response_model=PhoneNumberOut, summary="Get a phone number")
def get_number(number_id: str, principal: Reader, db: DbSession) -> PhoneNumberOut:
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    return PhoneNumberOut.model_validate(number)


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
    employee_id: str | None = None,
) -> PhoneNumberOut:
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    return phone_numbers.assign_number(
        db, number, employee_id, user_id=principal.user_id
    )


@router.delete("/{number_id}", response_model=MessageResponse, summary="Release a phone number")
def delete_number(number_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    number = phone_numbers.get_number(db, principal.organization_id, number_id)
    phone_numbers.delete_number(db, number, user_id=principal.user_id)
    return MessageResponse(message="Phone number released.")
