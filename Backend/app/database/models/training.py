"""Employee training sources, documents and the knowledge base."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import TrainingJobStatus
from app.database.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TrainingSource(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A knowledge source: PDF, DOCX, URL, FAQ sheet or raw text."""

    __tablename__ = "training_sources"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), default="text", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(512))
    raw_text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )

    documents: Mapped[list["TrainingDocument"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class TrainingDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A physical file uploaded as part of a training source."""

    __tablename__ = "training_documents"

    training_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120))
    storage_path: Mapped[str | None] = mapped_column(String(512))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128))
    extracted_text: Mapped[str | None] = mapped_column(Text)

    source: Mapped[TrainingSource] = relationship(back_populates="documents")


class TrainingJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Background ingestion job: extract -> chunk -> embed -> index."""

    __tablename__ = "training_jobs"

    training_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(24), default=str(TrainingJobStatus.PENDING), nullable=False, index=True
    )
    chunks_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    stats: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class KnowledgeChunk(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A retrievable text chunk with its embedding.

    ``embedding`` is stored as JSON so the model works on SQLite (dev) and
    PostgreSQL (prod). Swap to pgvector on Supabase for large corpora.
    """

    __tablename__ = "knowledge_chunks"

    training_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    embedding: Mapped[list | None] = mapped_column(JSON)
    chunk_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)


class EmployeeKnowledgeSource(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Binds a training source to an employee."""

    __tablename__ = "employee_knowledge_sources"
    __table_args__ = (
        UniqueConstraint("employee_id", "training_source_id", name="uq_employee_training_source"),
    )

    employee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    training_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
