"""Service-layer building blocks shared by every module.

The service layer owns business rules; routers own HTTP. Keeping these helpers
tiny and generic means each domain module reads like a list of use cases.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Sequence, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.database.base import utcnow

T = TypeVar("T")

#: Columns that must never be bulk-assigned from a request payload.
PROTECTED_FIELDS = frozenset(
    {
        "id",
        "created_at",
        "updated_at",
        "organization_id",
        "hashed_password",
        "key_hash",
        "secret",
        "deleted_at",
    }
)


def scoped(
    db: Session,
    model: type[T],
    resource_id: str,
    organization_id: str,
    *,
    label: str | None = None,
) -> T:
    """Fetch a tenant-scoped row or raise ``NotFoundError``.

    Every read/write in the service layer goes through this function so a
    record can never leak across organizations.
    """
    name = label or getattr(model, "__name__", "Record")
    row = db.execute(
        select(model).where(  # type: ignore[arg-type]
            model.id == resource_id,  # type: ignore[attr-defined]
            model.organization_id == organization_id,  # type: ignore[attr-defined]
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError(f"{name} not found.", details={"id": resource_id})
    return row


def scoped_optional(
    db: Session, model: type[T], resource_id: str | None, organization_id: str
) -> T | None:
    if not resource_id:
        return None
    return db.execute(
        select(model).where(  # type: ignore[arg-type]
            model.id == resource_id,  # type: ignore[attr-defined]
            model.organization_id == organization_id,  # type: ignore[attr-defined]
        )
    ).scalar_one_or_none()


def get_by_id(db: Session, model: type[T], resource_id: str, *, label: str | None = None) -> T:
    """Fetch by primary key without a tenant filter (for global tables)."""
    name = label or getattr(model, "__name__", "Record")
    row = db.get(model, resource_id)  # type: ignore[arg-type]
    if row is None:
        raise NotFoundError(f"{name} not found.", details={"id": resource_id})
    return row


def apply_updates(instance: Any, payload: dict[str, Any]) -> dict[str, Any]:
    """Assign whitelisted fields and return a ``{field: new_value}`` diff."""
    changes: dict[str, Any] = {}
    for field, value in payload.items():
        if field in PROTECTED_FIELDS:
            continue
        if not hasattr(instance, field):
            continue
        current = getattr(instance, field)
        if current != value:
            changes[field] = value
            setattr(instance, field, value)
    return changes


def save(db: Session, instance: T, *, refresh: bool = True) -> T:
    """Add (if new) and flush an instance without committing the transaction."""
    db.add(instance)
    db.flush()
    if refresh:
        db.refresh(instance)
    return instance


def commit(db: Session) -> None:
    db.commit()


def count_where(db: Session, stmt: Select[Any]) -> int:
    """Count the rows a select would return."""
    subquery = stmt.order_by(None).subquery()
    return int(db.execute(select(func.count()).select_from(subquery)).scalar_one())


def exists(db: Session, model: type[T], *conditions: Any) -> bool:
    stmt = select(func.count()).select_from(model).where(*conditions)  # type: ignore[arg-type]
    return bool(db.execute(stmt).scalar_one())


def scalar(db: Session, stmt: Select[Any], default: Any = 0) -> Any:
    value = db.execute(stmt).scalar_one_or_none()
    return default if value is None else value


def ensure_unique(
    db: Session,
    model: type[T],
    *conditions: Any,
    message: str,
    field: str = "value",
    value: str | None = None,
) -> None:
    """Raise ``ConflictError`` when a uniqueness constraint would be violated."""
    if exists(db, model, *conditions):
        raise ConflictError(message, details={field: value})


def paginate_rows(db: Session, stmt: Select[Any], offset: int, limit: int) -> tuple[list[Any], int]:
    total = count_where(db, stmt)
    rows: Sequence[Any] = db.execute(stmt.offset(offset).limit(limit)).scalars().all()
    return list(rows), total


def as_list(value: Any) -> list[Any]:
    """Normalise a JSON column that may be ``None`` into a list."""
    if isinstance(value, list):
        return value
    return []


def as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def touch(instance: Any) -> None:
    """Bump ``updated_at`` even when no column value changed."""
    if hasattr(instance, "updated_at"):
        instance.updated_at = utcnow()


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
