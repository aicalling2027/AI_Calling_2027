"""Training / knowledge base schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.core.constants import TrainingSourceType
from app.schemas.common import APIModel, ORMModel


class TrainingSourceCreate(APIModel):
    name: str = Field(min_length=2, max_length=200)
    source_type: TrainingSourceType = TrainingSourceType.TEXT
    description: str | None = None
    location: str | None = Field(default=None, max_length=512)
    raw_text: str | None = Field(default=None, description="Inline content for text/FAQ sources")
    employee_ids: list[str] = Field(default_factory=list)


class TrainingSourceOut(ORMModel):
    id: str
    organization_id: str
    name: str
    source_type: str
    description: str | None = None
    location: str | None = None
    status: str
    chunk_count: int
    token_count: int
    created_at: datetime
    updated_at: datetime


class TrainingDocumentOut(ORMModel):
    id: str
    training_source_id: str
    filename: str
    content_type: str | None = None
    size_bytes: int
    created_at: datetime


class TrainingJobOut(ORMModel):
    id: str
    training_source_id: str
    employee_id: str | None = None
    status: str
    chunks_created: int
    error: str | None = None
    stats: dict
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime


class KnowledgeChunkOut(ORMModel):
    id: str
    training_source_id: str
    employee_id: str | None = None
    chunk_index: int
    content: str
    tokens: int


class AttachSourceRequest(APIModel):
    training_source_id: str


class KnowledgeQuery(APIModel):
    query: str = Field(min_length=2, max_length=1000)
    employee_id: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)


class KnowledgeHit(APIModel):
    chunk_id: str
    training_source_id: str
    content: str
    score: float


class KnowledgeQueryResponse(APIModel):
    query: str
    hits: list[KnowledgeHit] = Field(default_factory=list)
    mode: str = "lexical"


class TrainEmployeeRequest(APIModel):
    employee_id: str
    training_source_ids: list[str] = Field(default_factory=list)
