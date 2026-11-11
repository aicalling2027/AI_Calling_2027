"""Pagination helpers shared by every list endpoint."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence, TypeVar

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")

MAX_PAGE_SIZE = 100


@dataclass(slots=True)
class PageParams:
    """Validated pagination + sorting parameters."""

    page: int = 1
    page_size: int = 20
    sort_by: str | None = None
    sort_dir: str = "desc"

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def descending(self) -> bool:
        return self.sort_dir.lower() != "asc"


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=MAX_PAGE_SIZE, description="Records per page"),
    sort_by: str | None = Query(None, description="Column name to sort by"),
    sort_dir: str = Query("desc", pattern="^(?i)(asc|desc)$"),
) -> PageParams:
    """FastAPI dependency producing :class:`PageParams`."""
    return PageParams(page=page, page_size=page_size, sort_by=sort_by, sort_dir=sort_dir)


def apply_sorting(
    stmt: Select[Any], params: PageParams, model: type[Any], default_column: str = "created_at"
) -> Select[Any]:
    """Apply a whitelisted sort column (unknown columns fall back to default)."""
    requested = params.sort_by or default_column
    column = getattr(model, requested, None)
    if column is None:
        column = getattr(model, default_column, None)
    if column is None:
        return stmt
    return stmt.order_by(column.desc() if params.descending else column.asc())


def paginate(db: Session, stmt: Select[Any], params: PageParams) -> tuple[list[Any], int]:
    """Execute a paginated query and return ``(rows, total)``."""
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int(db.execute(count_stmt).scalar_one())
    rows: Sequence[Any] = (
        db.execute(stmt.offset(params.offset).limit(params.page_size)).scalars().all()
    )
    return list(rows), total
