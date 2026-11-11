"""Dashboard, analytics and performance schemas (PRD module 05 and 17)."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class AtAGlance(APIModel):
    total_calls: int = 0
    answered_calls: int = 0
    missed_calls: int = 0
    successful_calls: int = 0
    total_leads: int = 0
    qualified_leads: int = 0
    average_call_duration_seconds: float = 0.0
    credits_used: int = 0


class RecentSummary(APIModel):
    total_calls: int = 0
    leads_generated: int = 0
    successful_conversations: int = 0
    appointments_scheduled: int = 0
    pending_follow_ups: int = 0
    human_transfers: int = 0


class TrendPoint(APIModel):
    date: str
    total_calls: int = 0
    inbound_calls: int = 0
    outbound_calls: int = 0
    answered_calls: int = 0
    failed_calls: int = 0


class OutcomeSlice(APIModel):
    outcome: str
    count: int
    percent: float


class SourceSlice(APIModel):
    source: str
    count: int
    percent: float


class BusiestHour(APIModel):
    hour: int = Field(ge=0, le=23)
    count: int


class AttentionItem(APIModel):
    severity: str = Field(description="critical | warning | info")
    code: str
    title: str
    message: str
    count: int = 0


class RecentCallRow(APIModel):
    call_id: str
    contact_name: str | None = None
    phone: str | None = None
    employee_name: str | None = None
    channel: str
    outcome: str | None = None
    sentiment: str | None = None
    duration_seconds: int = 0
    started_at: datetime | None = None


class EmployeePerformanceRow(APIModel):
    employee_id: str
    employee_name: str
    total_calls: int
    successful_calls: int
    success_rate: float
    average_duration_seconds: float
    last_active_at: datetime | None = None


class ManagerInsight(APIModel):
    code: str
    message: str
    severity: str = "info"


class DashboardResponse(APIModel):
    """Everything the dashboard module needs in one round trip."""

    generated_at: datetime
    period_start: datetime
    period_end: datetime
    at_a_glance: AtAGlance
    recent_summary: RecentSummary
    trends: list[TrendPoint] = Field(default_factory=list)
    outcomes: list[OutcomeSlice] = Field(default_factory=list)
    sources: list[SourceSlice] = Field(default_factory=list)
    busiest_hours: list[BusiestHour] = Field(default_factory=list)
    needs_attention: list[AttentionItem] = Field(default_factory=list)
    recent_calls: list[RecentCallRow] = Field(default_factory=list)
    employees: list[EmployeePerformanceRow] = Field(default_factory=list)
    insights: list[ManagerInsight] = Field(default_factory=list)


class PerformanceResponse(APIModel):
    period_start: datetime
    period_end: datetime
    employees: list[EmployeePerformanceRow] = Field(default_factory=list)
    trends: list[TrendPoint] = Field(default_factory=list)
    outcomes: list[OutcomeSlice] = Field(default_factory=list)
    total_calls: int = 0
    answer_rate: float = 0.0
    success_rate: float = 0.0
