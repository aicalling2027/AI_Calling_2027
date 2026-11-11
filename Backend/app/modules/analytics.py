"""Dashboard and performance analytics - PRD modules 05 and 17.

Every number on the dashboard is derived from the same primitives:

* the call ledger (``calls``) for volume, duration and outcomes,
* the lead table for funnel stages and sources,
* the credit ledger for spend,
* follow-ups for operational backlog.

Aggregations run in Python over a bounded window instead of using dialect
specific SQL (``strftime`` vs ``date_trunc``) so the same code is correct on
SQLite in development and PostgreSQL in production.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.constants import CallDirection, CallStatus, EmployeeStatus
from app.database.base import utcnow
from app.database.models.call import Call
from app.database.models.employee import Employee
from app.database.models.lead import Contact, FollowUp, Lead
from app.database.models.organization import Organization
from app.modules import billing
from app.schemas.analytics import (
    AtAGlance,
    AttentionItem,
    BusiestHour,
    DashboardResponse,
    EmployeePerformanceRow,
    ManagerInsight,
    OutcomeSlice,
    PerformanceResponse,
    RecentCallRow,
    RecentSummary,
    SourceSlice,
    TrendPoint,
)
from app.utils.datetime_utils import get_timezone, resolve_period

SUCCESS_OUTCOMES = frozenset(
    {
        "successful",
        "lead_captured",
        "appointment_booked",
        "interested",
        "transferred_to_human",
    }
)
MISSED_STATUSES = frozenset({"no_answer", "busy", "failed", "cancelled"})
QUALIFIED_LEAD_STATUSES = frozenset({"qualified", "converted"})
LOW_CREDIT_THRESHOLD = 100


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
def dashboard(
    db: Session,
    organization: Organization,
    *,
    days: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> DashboardResponse:
    period_start, period_end = resolve_period(
        days, start, end, timezone_name=organization.timezone
    )
    tz = get_timezone(organization.timezone)

    calls = _load_calls(db, organization.id, period_start, period_end)

    return DashboardResponse(
        generated_at=utcnow(),
        period_start=period_start,
        period_end=period_end,
        at_a_glance=_at_a_glance(db, organization.id, calls, period_start, period_end),
        recent_summary=_recent_summary(db, organization.id, calls, period_start, period_end),
        trends=_trends(calls, period_start, period_end, tz),
        outcomes=_outcomes(calls),
        sources=_sources(db, organization.id, period_start, period_end),
        busiest_hours=_busiest_hours(calls, tz),
        needs_attention=_needs_attention(
            db, organization, calls, period_start, period_end, tz
        ),
        recent_calls=_recent_calls(db, organization.id, limit=10),
        employees=_employee_rows(db, organization.id, period_start, period_end, limit=10),
        insights=_insights(db, organization.id, calls, period_start, period_end),
    )


def performance(
    db: Session,
    organization: Organization,
    *,
    days: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    employee_id: str | None = None,
) -> PerformanceResponse:
    period_start, period_end = resolve_period(
        days, start, end, timezone_name=organization.timezone
    )
    tz = get_timezone(organization.timezone)
    calls = _load_calls(db, organization.id, period_start, period_end, employee_id=employee_id)

    answered = sum(1 for call in calls if _is_answered(call))
    successful = sum(1 for call in calls if call.outcome in SUCCESS_OUTCOMES)
    total = len(calls)

    return PerformanceResponse(
        period_start=period_start,
        period_end=period_end,
        employees=_employee_rows(
            db, organization.id, period_start, period_end, employee_id=employee_id
        ),
        trends=_trends(calls, period_start, period_end, tz),
        outcomes=_outcomes(calls),
        total_calls=total,
        answer_rate=_percent(answered, total),
        success_rate=_percent(successful, total),
    )


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------
def _at_a_glance(
    db: Session,
    organization_id: str,
    calls: list[Call],
    period_start: datetime,
    period_end: datetime,
) -> AtAGlance:
    total = len(calls)
    answered = sum(1 for call in calls if _is_answered(call))
    successful = sum(1 for call in calls if call.outcome in SUCCESS_OUTCOMES)

    total_leads = int(
        db.execute(
            select(func.count())
            .select_from(Lead)
            .where(
                Lead.organization_id == organization_id,
                Lead.created_at >= period_start,
                Lead.created_at < period_end,
            )
        ).scalar_one()
    )
    qualified_leads = int(
        db.execute(
            select(func.count())
            .select_from(Lead)
            .where(
                Lead.organization_id == organization_id,
                Lead.created_at >= period_start,
                Lead.created_at < period_end,
                Lead.status.in_(sorted(QUALIFIED_LEAD_STATUSES)),
            )
        ).scalar_one()
    )

    duration_total = sum(call.duration_seconds or 0 for call in calls)
    answered_with_time = max(1, answered)

    return AtAGlance(
        total_calls=total,
        answered_calls=answered,
        missed_calls=total - answered,
        successful_calls=successful,
        total_leads=total_leads,
        qualified_leads=qualified_leads,
        average_call_duration_seconds=round(duration_total / answered_with_time, 2),
        credits_used=sum(call.cost_credits or 0 for call in calls),
    )


def _recent_summary(
    db: Session,
    organization_id: str,
    calls: list[Call],
    period_start: datetime,
    period_end: datetime,
) -> RecentSummary:
    leads_generated = int(
        db.execute(
            select(func.count())
            .select_from(Lead)
            .where(
                Lead.organization_id == organization_id,
                Lead.created_at >= period_start,
                Lead.created_at < period_end,
            )
        ).scalar_one()
    )
    pending_follow_ups = int(
        db.execute(
            select(func.count())
            .select_from(FollowUp)
            .where(
                FollowUp.organization_id == organization_id,
                FollowUp.status == "pending",
            )
        ).scalar_one()
    )

    return RecentSummary(
        total_calls=len(calls),
        leads_generated=leads_generated,
        successful_conversations=sum(1 for c in calls if c.outcome in SUCCESS_OUTCOMES),
        appointments_scheduled=sum(1 for c in calls if c.outcome == "appointment_booked"),
        pending_follow_ups=pending_follow_ups,
        human_transfers=sum(1 for c in calls if c.outcome == "transferred_to_human"),
    )


def _trends(
    calls: list[Call], period_start: datetime, period_end: datetime, tz: Any
) -> list[TrendPoint]:
    buckets: dict[date, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for call in calls:
        day = _local_date(call.started_at or call.created_at, tz)
        bucket = buckets[day]
        bucket["total_calls"] += 1
        if call.direction == str(CallDirection.INBOUND):
            bucket["inbound_calls"] += 1
        else:
            bucket["outbound_calls"] += 1
        if _is_answered(call):
            bucket["answered_calls"] += 1
        if call.status in {"failed", "no_answer", "busy"}:
            bucket["failed_calls"] += 1

    points: list[TrendPoint] = []
    cursor = _local_date(period_start, tz)
    last = _local_date(period_end - timedelta(seconds=1), tz)
    while cursor <= last:
        bucket = buckets.get(cursor, {})
        points.append(
            TrendPoint(
                date=cursor.isoformat(),
                total_calls=int(bucket.get("total_calls", 0)),
                inbound_calls=int(bucket.get("inbound_calls", 0)),
                outbound_calls=int(bucket.get("outbound_calls", 0)),
                answered_calls=int(bucket.get("answered_calls", 0)),
                failed_calls=int(bucket.get("failed_calls", 0)),
            )
        )
        cursor += timedelta(days=1)
    return points


def _outcomes(calls: list[Call]) -> list[OutcomeSlice]:
    counts = Counter(str(call.outcome or "unknown") for call in calls)
    total = sum(counts.values())
    return [
        OutcomeSlice(outcome=outcome, count=count, percent=_percent(count, total))
        for outcome, count in counts.most_common()
    ]


def _sources(
    db: Session, organization_id: str, period_start: datetime, period_end: datetime
) -> list[SourceSlice]:
    rows = db.execute(
        select(Lead.source, func.count())
        .where(
            Lead.organization_id == organization_id,
            Lead.created_at >= period_start,
            Lead.created_at < period_end,
        )
        .group_by(Lead.source)
    ).all()
    total = sum(int(count) for _, count in rows)
    return [
        SourceSlice(source=str(source or "other"), count=int(count), percent=_percent(int(count), total))
        for source, count in sorted(rows, key=lambda row: int(row[1]), reverse=True)
    ]


def _busiest_hours(calls: list[Call], tz: Any, limit: int = 8) -> list[BusiestHour]:
    counter: Counter[int] = Counter()
    for call in calls:
        moment = call.started_at or call.created_at
        if moment is None:
            continue
        counter[_local(moment, tz).hour] += 1
    return [
        BusiestHour(hour=hour, count=count)
        for hour, count in sorted(counter.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def _needs_attention(
    db: Session,
    organization: Organization,
    calls: list[Call],
    period_start: datetime,
    period_end: datetime,
    tz: Any,
) -> list[AttentionItem]:
    items: list[AttentionItem] = []
    total = len(calls)

    failed = [call for call in calls if call.status == "failed"]
    if failed:
        items.append(
            AttentionItem(
                severity="critical" if _percent(len(failed), max(1, total)) >= 20 else "warning",
                code="failed_calls",
                title="Failed calls",
                message=(
                    f"{len(failed)} call(s) failed in this period. "
                    "Check the telephony bridge and provider credentials."
                ),
                count=len(failed),
            )
        )

    missed = [call for call in calls if call.outcome == "no_answer" or call.status == "no_answer"]
    if missed and _percent(len(missed), max(1, total)) >= 30:
        items.append(
            AttentionItem(
                severity="warning",
                code="high_no_answer_rate",
                title="High no-answer rate",
                message=(
                    f"{_percent(len(missed), total)}% of calls went unanswered. "
                    "Consider widening the calling window or retrying at another hour."
                ),
                count=len(missed),
            )
        )

    balance = billing.credit_balance(db, organization.id)
    if balance <= LOW_CREDIT_THRESHOLD:
        items.append(
            AttentionItem(
                severity="critical" if balance <= 0 else "warning",
                code="low_credits",
                title="Credit balance is low",
                message=f"Only {balance} credits remain. Top up to keep calling.",
                count=balance,
            )
        )

    overdue = int(
        db.execute(
            select(func.count())
            .select_from(FollowUp)
            .where(
                FollowUp.organization_id == organization.id,
                FollowUp.status == "pending",
                FollowUp.scheduled_for < utcnow(),
            )
        ).scalar_one()
    )
    if overdue:
        items.append(
            AttentionItem(
                severity="warning",
                code="overdue_followups",
                title="Overdue follow-ups",
                message=f"{overdue} follow-up(s) are past their scheduled time.",
                count=overdue,
            )
        )

    paused = int(
        db.execute(
            select(func.count())
            .select_from(Employee)
            .where(
                Employee.organization_id == organization.id,
                Employee.status.in_([str(EmployeeStatus.DRAFT), str(EmployeeStatus.PAUSED)]),
            )
        ).scalar_one()
    )
    if paused:
        items.append(
            AttentionItem(
                severity="info",
                code="inactive_employees",
                title="AI employees not live",
                message=f"{paused} AI employee(s) are still in draft or paused.",
                count=paused,
            )
        )

    return items


def _recent_calls(db: Session, organization_id: str, *, limit: int = 10) -> list[RecentCallRow]:
    rows = db.execute(
        select(Call, Contact.full_name, Contact.phone, Employee.name)
        .outerjoin(Contact, Call.contact_id == Contact.id)
        .outerjoin(Employee, Call.employee_id == Employee.id)
        .where(Call.organization_id == organization_id)
        .order_by(Call.created_at.desc())
        .limit(limit)
    ).all()

    out: list[RecentCallRow] = []
    for call, contact_name, contact_phone, employee_name in rows:
        out.append(
            RecentCallRow(
                call_id=call.id,
                contact_name=contact_name,
                phone=contact_phone or call.to_number or call.from_number,
                employee_name=employee_name,
                channel=call.direction or "outbound",
                outcome=call.outcome,
                sentiment=call.sentiment,
                duration_seconds=call.duration_seconds or 0,
                started_at=call.started_at or call.queued_at,
            )
        )
    return out


def _employee_rows(
    db: Session,
    organization_id: str,
    period_start: datetime,
    period_end: datetime,
    *,
    employee_id: str | None = None,
    limit: int | None = None,
) -> list[EmployeePerformanceRow]:
    successful_case = func.sum(case((Call.outcome.in_(sorted(SUCCESS_OUTCOMES)), 1), else_=0))

    stmt = (
        select(
            Employee.id,
            Employee.name,
            func.count(Call.id).label("total_calls"),
            successful_case.label("successful_calls"),
            func.avg(Call.duration_seconds).label("avg_duration"),
            func.max(Call.ended_at).label("last_active_at"),
        )
        .join(Call, Call.employee_id == Employee.id)
        .where(
            Employee.organization_id == organization_id,
            Call.organization_id == organization_id,
            Call.created_at >= period_start,
            Call.created_at < period_end,
        )
        .group_by(Employee.id, Employee.name)
        .order_by(func.count(Call.id).desc())
    )
    if employee_id:
        stmt = stmt.where(Employee.id == employee_id)
    if limit:
        stmt = stmt.limit(limit)

    out: list[EmployeePerformanceRow] = []
    for row in db.execute(stmt).all():
        total = int(row.total_calls or 0)
        successful = int(row.successful_calls or 0)
        out.append(
            EmployeePerformanceRow(
                employee_id=row.id,
                employee_name=row.name,
                total_calls=total,
                successful_calls=successful,
                success_rate=_percent(successful, total),
                average_duration_seconds=round(float(row.avg_duration or 0), 2),
                last_active_at=row.last_active_at,
            )
        )
    return out


def _insights(
    db: Session,
    organization_id: str,
    calls: list[Call],
    period_start: datetime,
    period_end: datetime,
) -> list[ManagerInsight]:
    insights: list[ManagerInsight] = []
    total = len(calls)

    if not total:
        insights.append(
            ManagerInsight(
                code="no_activity",
                message=(
                    "No calls in this period. Create a campaign or place a test call to start "
                    "collecting performance data."
                ),
                severity="info",
            )
        )
        return insights

    answered = sum(1 for call in calls if _is_answered(call))
    insights.append(
        ManagerInsight(
            code="answer_rate",
            message=f"Your AI employees answered {_percent(answered, total)}% of calls.",
            severity="info" if _percent(answered, total) >= 60 else "warning",
        )
    )

    best = _employee_rows(db, organization_id, period_start, period_end, limit=1)
    if best and best[0].total_calls:
        top = best[0]
        insights.append(
            ManagerInsight(
                code="top_employee",
                message=(
                    f"{top.employee_name} handled {top.total_calls} calls with a "
                    f"{top.success_rate}% success rate."
                ),
                severity="info",
            )
        )

    outcome_counts = Counter(str(call.outcome or "unknown") for call in calls)
    if outcome_counts:
        top_outcome, top_count = outcome_counts.most_common(1)[0]
        insights.append(
            ManagerInsight(
                code="top_outcome",
                message=f"'{top_outcome}' was the most common outcome ({top_count} calls).",
                severity="info",
            )
        )

    inbound = sum(1 for call in calls if call.direction == str(CallDirection.INBOUND))
    if inbound and _percent(inbound, total) >= 50:
        insights.append(
            ManagerInsight(
                code="inbound_heavy",
                message=(
                    "Most traffic is inbound. Consider adding an overflow AI employee "
                    "to keep wait times low."
                ),
                severity="info",
            )
        )

    return insights


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_calls(
    db: Session,
    organization_id: str,
    period_start: datetime,
    period_end: datetime,
    *,
    employee_id: str | None = None,
) -> list[Call]:
    stmt = select(Call).where(
        Call.organization_id == organization_id,
        Call.created_at >= period_start,
        Call.created_at < period_end,
    )
    if employee_id:
        stmt = stmt.where(Call.employee_id == employee_id)
    return list(db.execute(stmt).scalars())


def _is_answered(call: Call) -> bool:
    if call.answered_at is not None:
        return True
    return call.status != str(CallStatus.FAILED) and call.status not in MISSED_STATUSES


def _local(moment: datetime, tz: Any) -> datetime:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(tz)


def _local_date(moment: datetime, tz: Any) -> date:
    return _local(moment, tz).date()


def _percent(part: int, whole: int) -> float:
    if not whole:
        return 0.0
    return round(part / whole * 100, 2)
