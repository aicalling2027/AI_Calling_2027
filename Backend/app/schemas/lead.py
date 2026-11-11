"""Contact, lead and follow-up schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import LeadSource, LeadStatus
from app.schemas.common import APIModel, ORMModel


def _normalise_phone(value: str) -> str:
    """Keep digits and a leading +, drop spaces/dashes/parentheses."""
    cleaned = "".join(ch for ch in value.strip() if ch.isdigit() or ch == "+")
    if len(cleaned.lstrip("+")) < 7:
        raise ValueError("phone number is too short")
    return cleaned


class ContactCreate(APIModel):
    full_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(max_length=32)
    email: str | None = Field(default=None, max_length=255)
    company: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    country: str = Field(default="IN", max_length=8)
    preferred_language: str | None = Field(default=None, max_length=16)
    tags: list[str] = Field(default_factory=list)
    custom_fields: dict = Field(default_factory=dict)

    _phone = field_validator("phone")(_normalise_phone)


class ContactOut(ORMModel):
    id: str
    full_name: str
    phone: str
    email: str | None = None
    company: str | None = None
    city: str | None = None
    state: str | None = None
    country: str
    preferred_language: str | None = None
    is_dnc: bool
    tags: list
    created_at: datetime


class LeadCreate(APIModel):
    contact: ContactCreate | None = None
    contact_id: str | None = None
    employee_id: str | None = None
    campaign_id: str | None = None
    source: LeadSource = LeadSource.MANUAL_UPLOAD
    source_detail: str | None = Field(default=None, max_length=255)
    external_id: str | None = Field(default=None, max_length=160)
    notes: str | None = None
    custom_fields: dict = Field(default_factory=dict)
    assigned_to: str | None = None


class LeadUpdate(APIModel):
    status: LeadStatus | None = None
    employee_id: str | None = None
    assigned_to: str | None = None
    score: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None
    custom_fields: dict | None = None


class LeadStatusUpdate(APIModel):
    status: LeadStatus
    note: str | None = None


class LeadAssignRequest(APIModel):
    assigned_to: str | None = Field(default=None, description="User id, or null to unassign")


class LeadOut(ORMModel):
    id: str
    organization_id: str
    contact_id: str
    employee_id: str | None = None
    campaign_id: str | None = None
    source: str
    source_detail: str | None = None
    external_id: str | None = None
    status: str
    score: int
    notes: str | None = None
    custom_fields: dict
    assigned_to: str | None = None
    call_attempts: int
    last_contacted_at: datetime | None = None
    converted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class LeadDetail(LeadOut):
    contact: ContactOut | None = None
    recent_activities: list["LeadActivityOut"] = Field(default_factory=list)


class LeadActivityOut(ORMModel):
    id: str
    lead_id: str
    activity_type: str
    description: str | None = None
    actor_id: str | None = None
    metadata_json: dict
    created_at: datetime


class BulkLeadItem(APIModel):
    full_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(max_length=32)
    email: str | None = Field(default=None, max_length=255)
    company: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=80)
    language: str | None = Field(default=None, max_length=16)
    custom_fields: dict = Field(default_factory=dict)

    _phone = field_validator("phone")(_normalise_phone)


class BulkLeadImport(APIModel):
    leads: list[BulkLeadItem] = Field(min_length=1, max_length=5000)
    employee_id: str | None = None
    source: LeadSource = LeadSource.MANUAL_UPLOAD
    source_detail: str | None = Field(default=None, max_length=255)


class BulkImportResult(APIModel):
    created: int
    skipped: int
    errors: list[dict] = Field(default_factory=list)
    lead_ids: list[str] = Field(default_factory=list)


class FollowUpCreate(APIModel):
    lead_id: str
    scheduled_for: datetime
    channel: str = Field(default="call", max_length=24)
    notes: str | None = None
    assigned_to: str | None = None


class FollowUpOut(ORMModel):
    id: str
    lead_id: str
    call_id: str | None = None
    scheduled_for: datetime
    channel: str
    status: str
    notes: str | None = None
    assigned_to: str | None = None
    completed_at: datetime | None = None
    created_at: datetime


LeadDetail.model_rebuild()
