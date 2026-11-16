"""Phone number and telephony provider schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import PhoneNumberStatus
from app.schemas.common import APIModel, ORMModel
from app.schemas.lead import _normalise_phone


def _valid_capabilities(value: list[str]) -> list[str]:
    allowed = {"inbound", "outbound"}
    invalid = set(value) - allowed
    if invalid:
        raise ValueError(f"invalid capabilities {sorted(invalid)}; allowed {sorted(allowed)}")
    return value


class PhoneNumberCreate(APIModel):
    number: str = Field(max_length=32)
    label: str | None = Field(default=None, max_length=120)
    country_code: str = Field(default="IN", max_length=8)
    provider: str = Field(default="sarvam", max_length=32)
    provider_number_id: str | None = Field(default=None, max_length=120)
    capabilities: list[str] = Field(default_factory=lambda: ["inbound", "outbound"])
    employee_id: str | None = None

    _number = field_validator("number")(_normalise_phone)
    _capabilities = field_validator("capabilities")(_valid_capabilities)


class MarketRegionOut(APIModel):
    """One city a number can be bought in, with what it costs there."""

    region: str
    monthly_cost_inr: int
    setup_cost_inr: int


class TelephonyMarketOut(APIModel):
    """A country the purchase form offers, with the regions inside it."""

    country_code: str
    country: str
    dial_code: str
    capabilities: list[str]
    regions: list[MarketRegionOut]


class AvailableNumberOut(APIModel):
    """One number the purchase flow can sell, priced as the carrier bills it."""

    number: str
    formatted: str
    country_code: str
    country: str
    dial_code: str
    region: str
    provider: str
    capabilities: list[str]
    monthly_cost_inr: int
    setup_cost_inr: int


class PhoneNumberPurchase(APIModel):
    """A number chosen from the catalogue, plus who answers it, if anyone."""

    number: str = Field(max_length=32)
    label: str | None = Field(default=None, max_length=120)
    employee_id: str | None = None
    capabilities: list[str] = Field(default_factory=lambda: ["inbound", "outbound"])

    _number = field_validator("number")(_normalise_phone)
    _capabilities = field_validator("capabilities")(_valid_capabilities)


class PhoneNumberOut(ORMModel):
    id: str
    organization_id: str
    number: str
    label: str | None = None
    country_code: str
    provider: str
    provider_number_id: str | None = None
    status: str
    employee_id: str | None = None
    capabilities: list
    inbound_webhook_url: str | None = None
    assigned_at: datetime | None = None
    monthly_cost_inr: int
    created_at: datetime


class PhoneNumberPurchaseOut(APIModel):
    """What a purchase produced: the stored row, and what it will bill."""

    number: PhoneNumberOut
    setup_cost_inr: int
    #: True while the catalogue stands in for the carrier's inventory API.
    simulated: bool


class PhoneNumberUpdate(APIModel):
    label: str | None = Field(default=None, max_length=120)
    status: PhoneNumberStatus | None = None
    capabilities: list[str] | None = None
    inbound_webhook_url: str | None = Field(default=None, max_length=512)


class AssignPhoneNumberRequest(APIModel):
    employee_id: str | None = Field(
        default=None, description="Employee to bind, or null to release the number"
    )


class TelephonyProviderOut(ORMModel):
    id: str
    code: str
    name: str
    is_active: bool
    supports_inbound: bool
    supports_outbound: bool
