"""Knowledge base / employee training - PRD module 14.

Ingestion pipeline: ``source -> extract text -> chunk -> index``. Embeddings are
optional; when no embedding provider is configured the retriever falls back to a
lexical scorer so search still returns useful hits offline.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.core.constants import TrainingJobStatus, TrainingSourceType
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.core.pagination import PageParams, paginate
from app.database.base import utcnow
from app.database.models.employee import Employee
from app.database.models.organization import Organization
from app.database.models.training import (
    EmployeeKnowledgeSource,
    KnowledgeChunk,
    TrainingDocument,
    TrainingJob,
    TrainingSource,
)
from app.modules import audit, employees
from app.modules.common import scoped
from app.schemas.training import (
    KnowledgeHit,
    KnowledgeQuery,
    KnowledgeQueryResponse,
    TrainEmployeeRequest,
    TrainingJobOut,
    TrainingSourceCreate,
    TrainingSourceOut,
)
from app.utils.text import chunk_text, estimate_tokens, lexical_score, short_hash

logger = get_logger(__name__)

STORAGE_DIR = BASE_DIR / "storage" / "training"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
TEXT_CONTENT_TYPES = frozenset(
    {"text/plain", "text/markdown", "text/csv", "application/json", "text/html"}
)


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------
def list_sources(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    source_type: str | None = None,
    status: str | None = None,
) -> tuple[list[TrainingSourceOut], int]:
    stmt = select(TrainingSource).where(TrainingSource.organization_id == organization_id)
    if source_type:
        stmt = stmt.where(TrainingSource.source_type == source_type)
    if status:
        stmt = stmt.where(TrainingSource.status == status)
    rows, total = paginate(db, stmt.order_by(TrainingSource.created_at.desc()), params)
    return [TrainingSourceOut.model_validate(row) for row in rows], total


def get_source(db: Session, organization_id: str, source_id: str) -> TrainingSource:
    return scoped(db, TrainingSource, source_id, organization_id, label="Training source")


def create_source(
    db: Session,
    organization: Organization,
    payload: TrainingSourceCreate,
    *,
    user_id: str | None,
) -> TrainingSourceOut:
    """Create a text/FAQ/URL source and ingest it immediately."""
    if payload.source_type in {TrainingSourceType.TEXT, TrainingSourceType.FAQ} and not (
        payload.raw_text or payload.location
    ):
        raise ValidationError("Provide the content for this training source.")

    source = TrainingSource(
        organization_id=organization.id,
        name=payload.name,
        source_type=str(payload.source_type),
        description=payload.description,
        location=payload.location,
        raw_text=payload.raw_text,
        status="pending",
        created_by=user_id,
    )
    db.add(source)
    db.flush()

    for employee_id in payload.employee_ids:
        _bind(db, organization.id, employee_id, source.id)

    if payload.raw_text:
        ingest_source(db, source, actor_id=user_id)
    else:
        db.commit()

    audit.log_action(
        db,
        action="training.source_created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="training_source",
        resource_id=source.id,
        changes={"name": source.name, "type": source.source_type},
    )
    db.commit()
    db.refresh(source)
    return TrainingSourceOut.model_validate(source)


def create_source_from_upload(
    db: Session,
    organization: Organization,
    *,
    filename: str,
    content_type: str | None,
    data: bytes,
    name: str | None = None,
    description: str | None = None,
    employee_ids: list[str] | None = None,
    user_id: str | None = None,
) -> TrainingSourceOut:
    """Accept an uploaded file, store it and ingest its text."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValidationError(
            "The file is larger than the 20 MB limit.",
            details={"size_bytes": len(data), "limit": MAX_UPLOAD_BYTES},
        )
    if not data:
        raise ValidationError("The uploaded file is empty.")

    text = extract_text(data, filename=filename, content_type=content_type)
    if not text.strip():
        raise ValidationError(
            "No readable text could be extracted from this file.",
            details={"filename": filename},
        )

    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    digest = short_hash(data.decode("latin-1"), length=16)
    suffix = Path(filename).suffix or ".txt"
    stored = STORAGE_DIR / f"{digest}{suffix}"
    stored.write_bytes(data)

    source_type = _source_type_for(filename, content_type)
    source = TrainingSource(
        organization_id=organization.id,
        name=(name or Path(filename).stem)[:200],
        source_type=str(source_type),
        description=description,
        location=str(stored),
        raw_text=text,
        status="pending",
        created_by=user_id,
    )
    db.add(source)
    db.flush()

    db.add(
        TrainingDocument(
            training_source_id=source.id,
            filename=filename[:255],
            content_type=(content_type or "")[:120] or None,
            storage_path=str(stored),
            size_bytes=len(data),
            checksum=digest,
            extracted_text=text,
        )
    )

    for employee_id in employee_ids or []:
        _bind(db, organization.id, employee_id, source.id)

    ingest_source(db, source, actor_id=user_id)
    audit.log_action(
        db,
        action="training.document_uploaded",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="training_source",
        resource_id=source.id,
        changes={"filename": filename, "size_bytes": len(data)},
    )
    db.commit()
    db.refresh(source)
    return TrainingSourceOut.model_validate(source)


def delete_source(db: Session, source: TrainingSource, *, user_id: str | None) -> None:
    source_id, organization_id = source.id, source.organization_id
    db.delete(source)
    audit.log_action(
        db,
        action="training.source_deleted",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="training_source",
        resource_id=source_id,
    )
    db.commit()


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------
def ingest_source(
    db: Session, source: TrainingSource, *, employee_id: str | None = None,
    actor_id: str | None = None,
) -> TrainingJob:
    """Chunk the source text and replace its knowledge chunks."""
    job = TrainingJob(
        training_source_id=source.id,
        employee_id=employee_id,
        status=str(TrainingJobStatus.PROCESSING),
        started_at=utcnow(),
    )
    db.add(job)
    db.flush()

    try:
        text = source.raw_text or ""
        if not text and source.location and str(source.location).startswith(("http://", "https://")):
            text = _fetch_url(str(source.location))
        if not text:
            raise ValidationError(
                "This source has no readable content to index.",
                details={"source_id": source.id},
            )

        # Replace previous chunks so re-ingestion is idempotent.
        for chunk in db.execute(
            select(KnowledgeChunk).where(KnowledgeChunk.training_source_id == source.id)
        ).scalars():
            db.delete(chunk)
        db.flush()

        pieces = chunk_text(text)
        tokens = 0
        for index, piece in enumerate(pieces):
            piece_tokens = estimate_tokens(piece)
            tokens += piece_tokens
            db.add(
                KnowledgeChunk(
                    organization_id=source.organization_id,
                    training_source_id=source.id,
                    employee_id=employee_id,
                    chunk_index=index,
                    content=piece,
                    tokens=piece_tokens,
                    chunk_metadata={"source_name": source.name},
                )
            )

        source.raw_text = text
        source.chunk_count = len(pieces)
        source.token_count = tokens
        source.status = str(TrainingJobStatus.COMPLETED)

        job.status = str(TrainingJobStatus.COMPLETED)
        job.chunks_created = len(pieces)
        job.stats = {"chunks": len(pieces), "tokens": tokens, "characters": len(text)}
        job.finished_at = utcnow()
    except Exception as exc:  # noqa: BLE001 - surface the failure to the caller
        source.status = str(TrainingJobStatus.FAILED)
        job.status = str(TrainingJobStatus.FAILED)
        job.error = str(exc)
        job.finished_at = utcnow()
        logger.warning("training_ingest_failed", source_id=source.id, error=str(exc))

    db.commit()
    db.refresh(job)
    return job


def extract_text(data: bytes, *, filename: str, content_type: str | None) -> str:
    """Best-effort text extraction for common upload formats."""
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf" or content_type == "application/pdf":
        return _extract_pdf(data)
    if suffix == ".docx":
        return _extract_docx(data)
    if suffix in {".txt", ".md", ".csv", ".json", ".html", ".htm"} or (
        content_type or ""
    ) in TEXT_CONTENT_TYPES:
        return _decode(data)

    # Unknown binary: try UTF-8, otherwise give up with a clear message.
    decoded = _decode(data)
    if not decoded.isprintable():
        raise ValidationError(
            f"Unsupported file type '{suffix or content_type}'. "
            "Supported: pdf, docx, txt, md, csv, json, html."
        )
    return decoded


def _decode(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("pdf_support_missing")
        return ""
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:  # noqa: BLE001
        logger.warning("pdf_extract_failed", error=str(exc))
        return ""


def _extract_docx(data: bytes) -> str:
    try:
        import docx  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("docx_support_missing")
        return ""
    try:
        document = docx.Document(io.BytesIO(data))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    except Exception as exc:  # noqa: BLE001
        logger.warning("docx_extract_failed", error=str(exc))
        return ""


def _fetch_url(url: str) -> str:
    import httpx

    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            response = client.get(url)
        if response.is_success:
            return response.text
    except httpx.HTTPError as exc:
        logger.warning("training_url_fetch_failed", url=url, error=str(exc))
    return ""


def _source_type_for(filename: str, content_type: str | None) -> TrainingSourceType:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf" or content_type == "application/pdf":
        return TrainingSourceType.PDF
    if suffix == ".docx":
        return TrainingSourceType.DOCX
    if suffix in {".txt", ".md"}:
        return TrainingSourceType.TXT
    return TrainingSourceType.TEXT


# ---------------------------------------------------------------------------
# Employee binding
# ---------------------------------------------------------------------------
def _bind(db: Session, organization_id: str, employee_id: str, source_id: str) -> None:
    employee = scoped(db, Employee, employee_id, organization_id, label="Employee")
    existing = db.execute(
        select(EmployeeKnowledgeSource).where(
            EmployeeKnowledgeSource.employee_id == employee.id,
            EmployeeKnowledgeSource.training_source_id == source_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.is_active = True
        return
    db.add(
        EmployeeKnowledgeSource(
            employee_id=employee.id, training_source_id=source_id, is_active=True
        )
    )


def attach_source(
    db: Session,
    organization_id: str,
    *,
    employee_id: str,
    source_id: str,
    user_id: str | None = None,
) -> None:
    get_source(db, organization_id, source_id)
    _bind(db, organization_id, employee_id, source_id)
    audit.log_action(
        db,
        action="training.source_attached",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee_id,
        changes={"training_source_id": source_id},
    )
    db.commit()


def detach_source(
    db: Session,
    organization_id: str,
    *,
    employee_id: str,
    source_id: str,
    user_id: str | None = None,
) -> None:
    row = db.execute(
        select(EmployeeKnowledgeSource).where(
            EmployeeKnowledgeSource.employee_id == employee_id,
            EmployeeKnowledgeSource.training_source_id == source_id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError(
            "This source is not attached to the employee.",
            details={"employee_id": employee_id, "training_source_id": source_id},
        )
    db.delete(row)
    audit.log_action(
        db,
        action="training.source_detached",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee_id,
        changes={"training_source_id": source_id},
    )
    db.commit()


def train_employee(
    db: Session,
    organization: Organization,
    payload: TrainEmployeeRequest,
    *,
    user_id: str | None,
) -> list[TrainingJobOut]:
    """(Re)index the requested sources for one employee."""
    employees.require_active_employee(db, organization.id, payload.employee_id)
    source_ids = payload.training_source_ids or list(
        db.execute(
            select(TrainingSource.id).where(TrainingSource.organization_id == organization.id)
        ).scalars()
    )
    if not source_ids:
        raise ConflictError(
            "There are no training sources to index. Upload a document first.",
            code="no_training_sources",
        )

    jobs: list[TrainingJobOut] = []
    for source_id in source_ids:
        source = get_source(db, organization.id, source_id)
        _bind(db, organization.id, payload.employee_id, source_id)
        job = ingest_source(db, source, employee_id=payload.employee_id, actor_id=user_id)
        jobs.append(TrainingJobOut.model_validate(job))

    audit.log_action(
        db,
        action="training.employee_trained",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="employee",
        resource_id=payload.employee_id,
        changes={"sources": len(jobs)},
    )
    return jobs


def list_jobs(
    db: Session, organization_id: str, *, source_id: str | None = None, limit: int = 50
) -> list[TrainingJobOut]:
    stmt = (
        select(TrainingJob)
        .join(TrainingSource, TrainingSource.id == TrainingJob.training_source_id)
        .where(TrainingSource.organization_id == organization_id)
    )
    if source_id:
        stmt = stmt.where(TrainingJob.training_source_id == source_id)
    rows = db.execute(
        stmt.order_by(TrainingJob.created_at.desc()).limit(limit)
    ).scalars().all()
    return [TrainingJobOut.model_validate(row) for row in rows]


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------
def query(db: Session, organization_id: str, payload: KnowledgeQuery) -> KnowledgeQueryResponse:
    """Search the knowledge base for chunks relevant to a question."""
    stmt = select(KnowledgeChunk).where(KnowledgeChunk.organization_id == organization_id)
    if payload.employee_id:
        bound = list(
            db.execute(
                select(EmployeeKnowledgeSource.training_source_id).where(
                    EmployeeKnowledgeSource.employee_id == payload.employee_id,
                    EmployeeKnowledgeSource.is_active.is_(True),
                )
            ).scalars()
        )
        if bound:
            stmt = stmt.where(KnowledgeChunk.training_source_id.in_(bound))

    chunks = db.execute(stmt).scalars().all()
    scored: list[tuple[float, KnowledgeChunk]] = []
    for chunk in chunks:
        score = lexical_score(payload.query, chunk.content)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    hits = [
        KnowledgeHit(
            chunk_id=chunk.id,
            training_source_id=chunk.training_source_id,
            content=chunk.content[:1200],
            score=score,
        )
        for score, chunk in scored[: payload.top_k]
    ]

    return KnowledgeQueryResponse(query=payload.query, hits=hits, mode="lexical")


def knowledge_stats(db: Session, organization_id: str) -> dict[str, Any]:
    sources = int(
        db.execute(
            select(func.count())
            .select_from(TrainingSource)
            .where(TrainingSource.organization_id == organization_id)
        ).scalar_one()
    )
    chunks = int(
        db.execute(
            select(func.count())
            .select_from(KnowledgeChunk)
            .where(KnowledgeChunk.organization_id == organization_id)
        ).scalar_one()
    )
    tokens = int(
        db.execute(
            select(func.coalesce(func.sum(KnowledgeChunk.tokens), 0)).where(
                KnowledgeChunk.organization_id == organization_id
            )
        ).scalar_one()
    )
    return {"sources": sources, "chunks": chunks, "tokens": tokens}


def knowledge_context(
    db: Session, organization_id: str, employee_id: str | None, question: str, top_k: int = 5
) -> str:
    """Return a prompt-ready block of relevant knowledge for a live call."""
    result = query(
        db,
        organization_id,
        KnowledgeQuery(query=question, employee_id=employee_id, top_k=top_k),
    )
    if not result.hits:
        return ""
    return "\n\n".join(f"[knowledge] {hit.content}" for hit in result.hits)
