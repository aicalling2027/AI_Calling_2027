"""Shared schema primitives: ORM base, pagination envelope, error envelope."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for schemas populated directly from ORM instances."""

    model_config = ConfigDict(from_attributes=True)


class APIModel(BaseModel):
    """Base for request/response bodies that are not ORM-backed."""

    model_config = ConfigDict(extra="forbid")


class PageMeta(BaseModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    pages: int = Field(ge=0)
    has_next: bool
    has_previous: bool


class Page(BaseModel, Generic[T]):
    """Standard paginated collection envelope."""

    items: list[T]
    meta: PageMeta

    @classmethod
    def build(cls, items: list[T], *, total: int, page: int, page_size: int) -> "Page[T]":
        pages = (total + page_size - 1) // page_size if page_size else 0
        return cls(
            items=items,
            meta=PageMeta(
                page=page,
                page_size=page_size,
                total=total,
                pages=pages,
                has_next=page < pages,
                has_previous=page > 1,
            ),
        )


class MessageResponse(BaseModel):
    message: str


class IdResponse(BaseModel):
    id: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class TimeRange(BaseModel):
    start: datetime | None = None
    end: datetime | None = None
