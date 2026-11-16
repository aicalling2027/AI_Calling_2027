"""Phone number and telephony provider schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

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


class NumberRoutingOut(APIModel):
    """What is known about inbound routing for one number.

    ``confirmed`` is the load-bearing field: it is true only when the voice
    provider actually answered. An assignment made here is ``pending`` and
    unconfirmed until then, so a local record can never read as a live line.

    Nothing in here identifies the provider, its workspace or its deployment.
    """

    state: Literal["unconfigured", "pending", "active", "paused", "failed"] = "unconfigured"
    #: True only for a state the provider confirmed, never for a local intent.
    confirmed: bool = False
    detail: str | None = None
    #: When the provider last answered about this number; None means never.
    checked_at: datetime | None = None


class PhoneNumberOut(ORMModel):
    id: str
    organization_id: str
    number: str
    label: str | None = None
    country_code: str
    provider: str
    status: str
    employee_id: str | None = None
    capabilities: list
    inbound_webhook_url: str | None = None
    assigned_at: datetime | None = None
    monthly_cost_inr: int
    created_at: datetime
    #: Populated by the service layer; the ORM row carries no such column.
    routing: NumberRoutingOut = Field(default_factory=NumberRoutingOut)


class PhoneNumberPurchaseOut(APIModel):
    """What a purchase produced: the stored row, and what it will bill."""

    number: PhoneNumberOut
    setup_cost_inr: int
    #: True while the catalogue stands in for the carrier's inventory API.
    simulated: bool


class PhoneNumberAttach(APIModel):
    """A number rented in the Sarvam console, attached to this workspace.

    There is no price and no provider reference in the body: renting happened
    in the console at the console's price, and this call only records which
    number the workspace now answers on.
    """

    number: str = Field(max_length=32)
    label: str | None = Field(default=None, max_length=120)
    country_code: str = Field(default="IN", max_length=8)
    capabilities: list[str] = Field(default_factory=lambda: ["inbound", "outbound"])
    employee_id: str | None = None

    _number = field_validator("number")(_normalise_phone)
    _capabilities = field_validator("capabilities")(_valid_capabilities)


class PhoneNumberAttachOut(APIModel):
    """The row that now holds the number, and whether this call created it."""

    number: PhoneNumberOut
    #: False when the workspace already held this number, so a repeated attach
    #: neither creates a second row nor fails.
    created: bool
    #: Numbers are rented in the Sarvam console, so that is where they come from.
    source: Literal["console"] = "console"


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


# ---------------------------------------------------------------------------
# Number inventory
# ---------------------------------------------------------------------------
class CarrierCountryCount(APIModel):
    """How many of this workspace's numbers sit in one country."""

    country: str
    numbers: int


class NumberQuotaOut(APIModel):
    """How much of the plan's phone-number allowance is in use.

    Counts every row except a released one, so pending and switched-off lines
    are included: they are held and billed, and the plan limits what is held.
    """

    plan: str
    limit: int
    current: int
    remaining: int


class SyncedNumberOut(APIModel):
    """One number the carrier holds, plus what this workspace records for it."""

    number: str
    country: str
    region: str | None = None
    status: str
    capabilities: list[str] = Field(default_factory=list)
    voice_enabled: bool = False
    monthly_fee: int = 0
    currency: str = "INR"
    #: A shared trial line, not a dedicated number bought for this account.
    is_trial: bool = False
    application_id: str | None = None
    account_id: str | None = None
    source: str | None = None
    purchased_at: str | None = None
    #: Whether this workspace already holds the number locally.
    in_workspace: bool = False
    local_id: str | None = None
    local_status: str | None = None
    employee_id: str | None = None


class InventoryMismatchOut(APIModel):
    """One place the two records disagree, stated in a sentence."""

    number: str
    #: Machine-readable reason, e.g. ``not_in_workspace``.
    reason: str
    detail: str


class PhoneNumberSyncOut(APIModel):
    """How this workspace's numbers are inventoried.

    Sarvam publishes no server-to-server API for connections or rented numbers,
    so there is no remote half to read: numbers reach a workspace through
    ``POST /phone-numbers/attach`` after being rented in the Sarvam console.

    The field names are kept from the carrier-era contract, but the remote
    counts are ``None`` rather than ``0``: "not read" is not "none there", and
    reporting a zero would claim knowledge the service does not have.
    """

    status: Literal["manual"] = "manual"
    #: Where the list comes from. Manual attachment is the implemented source.
    inventory_source: Literal["manual"] = "manual"
    provider: str | None = None
    #: No carrier account is read, so no account label is reported.
    connection: str | None = None
    #: The voice connection the call platform dials through.
    connection_id: str | None = None
    checked_at: datetime
    remote_total: int | None = None
    remote_active: int | None = None
    remote_inactive: int | None = None
    truncated: bool = False
    local_total: int = 0
    local_active: int = 0
    local_pending: int = 0
    local_released: int = 0
    #: Numbers bound to an AI employee here, and the rest.
    assigned: int = 0
    unassigned: int = 0
    #: The plan allowance this workspace's numbers count against.
    quota: NumberQuotaOut | None = None
    by_country: list[CarrierCountryCount] = Field(default_factory=list)
    numbers: list[SyncedNumberOut] = Field(default_factory=list)
    mismatches: list[InventoryMismatchOut] = Field(default_factory=list)
    missing_settings: list[str] = Field(default_factory=list)
    error: str | None = None
