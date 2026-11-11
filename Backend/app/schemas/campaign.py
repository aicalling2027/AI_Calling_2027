"""Campaign schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import CampaignStatus
from app.schemas.common import APIModel, ORMModel


def _validate_window(value: str) -> str:
    """Validate an ``HH:MM`` 24-hour calling-window boundary."""
    try:
        hours, minutes = value.split(":")
        if not (0 <= int(hours) <= 23 and 0 <= int(minutes) <= 59):
            raise ValueError
    except (ValueError, AttributeError) as exc:
        raise ValueError("time must use 24-hour HH:MM format") from exc
    return value


class CampaignCreate(APIModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    employee_id: str
    phone_number_id: str | None = None

    calling_window_start: str = "09:00"
    calling_window_end: str = "19:00"
    timezone: str = "Asia/Kolkata"

    max_concurrent_calls: int = Field(default=1, ge=1, le=50)
    max_attempts: int = Field(default=3, ge=1, le=10)
    retry_delay_minutes: int = Field(default=60, ge=5, le=1440)

    scheduled_start_at: datetime | None = None
    lead_ids: list[str] = Field(default_factory=list, max_length=5000)
    settings: dict = Field(default_factory=dict)

    _start = field_validator("calling_window_start")(_validate_window)
    _end = field_validator("calling_window_end")(_validate_window)

    @field_validator("calling_window_end")
    @classmethod
    def _window_ordering(cls, value: str, info) -> str:
        start = info.data.get("calling_window_start")
        if start and value <= start:
            raise ValueError("calling_window_end must be after calling_window_start")
        return value


class CampaignUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None
    phone_number_id: str | None = None
    calling_window_start: str | None = None
    calling_window_end: str | None = None
    timezone: str | None = None
    max_concurrent_calls: int | None = Field(default=None, ge=1, le=50)
    max_attempts: int | None = Field(default=None, ge=1, le=10)
    retry_delay_minutes: int | None = Field(default=None, ge=5, le=1440)
    scheduled_start_at: datetime | None = None
    settings: dict | None = None


class CampaignOut(ORMModel):
    id: str
    organization_id: str
    name: str
    description: str | None = None
    employee_id: str
    phone_number_id: str | None = None
    status: str
    calling_window_start: str
    calling_window_end: str
    timezone: str
    max_concurrent_calls: int
    max_attempts: int
    retry_delay_minutes: int
    scheduled_start_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    total_contacts: int
    completed_contacts: int
    failed_contacts: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CampaignProgress(APIModel):
    campaign_id: str
    total: int
    pending: int
    in_progress: int
    completed: int
    failed: int
    percent_complete: float


class CampaignDetail(CampaignOut):
    progress: CampaignProgress | None = None


class CampaignContactOut(ORMModel):
    id: str
    campaign_id: str
    lead_id: str
    status: str
    attempts: int
    last_attempt_at: datetime | None = None
    next_attempt_at: datetime | None = None


class CampaignAddLeads(APIModel):
    lead_ids: list[str] = Field(min_length=1, max_length=5000)


class CampaignActionResponse(APIModel):
    campaign_id: str
    status: str
    message: str
    queued_calls: int = 0
