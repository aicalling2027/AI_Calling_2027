"""Timezone-aware date helpers.

Timestamps are stored as naive UTC (see :func:`app.database.base.utcnow`) while
business rules such as calling windows are expressed in the organization's
timezone. These helpers bridge the two.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

try:  # pragma: no cover - tzdata is optional on Windows
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore[assignment]
    ZoneInfoNotFoundError = Exception  # type: ignore[misc,assignment]

from app.core.config import settings

DEFAULT_TZ = "Asia/Kolkata"


def utcnow() -> datetime:
    """Naive UTC 'now' - the canonical timestamp used by every model."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_utc(value: datetime) -> datetime:
    """Return a naive-UTC datetime, accepting aware datetimes and date objects."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, time.min)
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def get_timezone(name: str | None) -> timezone:
    """Best-effort timezone lookup; silently degrades to UTC."""
    tz_name = (name or DEFAULT_TZ).strip() or DEFAULT_TZ
    if ZoneInfo is None:
        return timezone.utc
    try:
        return ZoneInfo(tz_name)  # type: ignore[return-value]
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return timezone.utc


def local_now(name: str | None = None) -> datetime:
    """Current time in the requested timezone (naive, tz-applied)."""
    return datetime.now(get_timezone(name)).replace(tzinfo=None)


def parse_hhmm(value: str) -> time:
    """Parse a ``HH:MM`` string, raising a ValueError for malformed input."""
    hours, minutes = value.strip().split(":")
    hour, minute = int(hours), int(minutes)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"invalid 24-hour time {value!r}")
    return time(hour=hour, minute=minute)


def within_window(
    start: str, end: str, *, timezone_name: str | None = None, moment: datetime | None = None
) -> bool:
    """True when ``moment`` (default: now) falls inside the ``start``-``end`` window.

    Windows that cross midnight (e.g. ``22:00``-``06:00``) are supported.
    """
    try:
        start_t, end_t = parse_hhmm(start), parse_hhmm(end)
    except (ValueError, AttributeError):
        return True  # never block calls because of a malformed config
    now = moment or local_now(timezone_name)
    current = now.time()
    if start_t <= end_t:
        return start_t <= current <= end_t
    return current >= start_t or current <= end_t


def day_bounds(day: date, *, timezone_name: str | None = None) -> tuple[datetime, datetime]:
    """Naive-UTC (start, end) for a local calendar day."""
    tz = get_timezone(timezone_name)
    start_local = datetime.combine(day, time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return as_utc(start_local), as_utc(end_local)


def resolve_period(
    days: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    *,
    default_days: int = 30,
    timezone_name: str | None = None,
) -> tuple[datetime, datetime]:
    """Resolve an analytics/reporting window into naive-UTC bounds."""
    if start and end:
        return as_utc(start), as_utc(end)
    if start:
        return as_utc(start), utcnow()
    if end:
        return as_utc(end) - timedelta(days=days or default_days), as_utc(end)
    span = days or default_days
    today = local_now(timezone_name).date()
    period_start, _ = day_bounds(today - timedelta(days=span - 1), timezone_name=timezone_name)
    _, period_end = day_bounds(today, timezone_name=timezone_name)
    return period_start, period_end


def format_hhmm(value: time) -> str:
    return f"{value.hour:02d}:{value.minute:02d}"


def readiness_summary() -> dict[str, object]:
    """Tiny helper used by the health endpoint."""
    return {
        "environment": settings.app_env,
        "timezone_default": DEFAULT_TZ,
        "zoneinfo_available": ZoneInfo is not None,
    }
