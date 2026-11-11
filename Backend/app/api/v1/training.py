"""Knowledge base: sources, ingestion jobs, employee training and retrieval."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import Perm
from app.core.exceptions import ValidationError
from app.modules import training
from app.schemas.common import MessageResponse, Page
from app.schemas.training import (
    KnowledgeQuery,
    KnowledgeQueryResponse,
    TrainEmployeeRequest,
    TrainingJobOut,
    TrainingSourceCreate,
    TrainingSourceOut,
)

router = APIRouter(prefix="/training", tags=["Knowledge Base"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.TRAINING_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.TRAINING_WRITE))]


@router.get("/sources", response_model=Page[TrainingSourceOut], summary="List knowledge sources")
def list_sources(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    source_type: str | None = None,
    status_filter: str | None = None,
) -> Page[TrainingSourceOut]:
    rows, total = training.list_sources(
        db, principal.organization_id, params, source_type=source_type, status=status_filter
    )
    return Page[TrainingSourceOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "/sources",
    response_model=TrainingSourceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a text, FAQ or URL source",
)
def create_source(
    payload: TrainingSourceCreate, principal: Writer, db: DbSession
) -> TrainingSourceOut:
    return training.create_source(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.post(
    "/sources/upload",
    response_model=TrainingSourceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document (pdf, docx, txt, md, csv, json, html)",
)
async def upload_source(
    principal: Writer,
    db: DbSession,
    file: Annotated[UploadFile, File(description="Document to index")],
    name: str | None = Form(None),
    description: str | None = Form(None),
    employee_ids: str | None = Form(None, description="Comma-separated employee ids"),
) -> TrainingSourceOut:
    data = await file.read()
    if not data:
        raise ValidationError("The uploaded file is empty.")

    bound = [item.strip() for item in (employee_ids or "").split(",") if item.strip()]
    return training.create_source_from_upload(
        db,
        principal.organization,
        filename=file.filename or "upload.txt",
        content_type=file.content_type,
        data=data,
        name=name,
        description=description,
        employee_ids=bound,
        user_id=principal.user_id,
    )


@router.get("/sources/{source_id}", response_model=TrainingSourceOut, summary="Get a source")
def get_source(source_id: str, principal: Reader, db: DbSession) -> TrainingSourceOut:
    source = training.get_source(db, principal.organization_id, source_id)
    return TrainingSourceOut.model_validate(source)


@router.post(
    "/sources/{source_id}/reindex",
    response_model=TrainingJobOut,
    summary="Re-chunk and re-index a source",
)
def reindex_source(source_id: str, principal: Writer, db: DbSession) -> TrainingJobOut:
    source = training.get_source(db, principal.organization_id, source_id)
    job = training.ingest_source(db, source, actor_id=principal.user_id)
    return TrainingJobOut.model_validate(job)


@router.delete("/sources/{source_id}", response_model=MessageResponse, summary="Delete a source")
def delete_source(source_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    source = training.get_source(db, principal.organization_id, source_id)
    training.delete_source(db, source, user_id=principal.user_id)
    return MessageResponse(message="Knowledge source deleted.")


@router.get("/jobs", response_model=list[TrainingJobOut], summary="Ingestion job history")
def list_jobs(
    principal: Reader,
    db: DbSession,
    source_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> list[TrainingJobOut]:
    return training.list_jobs(
        db, principal.organization_id, source_id=source_id, limit=limit
    )


@router.post(
    "/train",
    response_model=list[TrainingJobOut],
    summary="Attach knowledge sources to an AI employee",
)
def train_employee(
    payload: TrainEmployeeRequest, principal: Writer, db: DbSession
) -> list[TrainingJobOut]:
    return training.train_employee(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.post("/query", response_model=KnowledgeQueryResponse, summary="Search the knowledge base")
def query_knowledge(
    payload: KnowledgeQuery, principal: Reader, db: DbSession
) -> KnowledgeQueryResponse:
    return training.query(db, principal.organization_id, payload)


@router.get("/stats", summary="Knowledge base size")
def knowledge_stats(principal: Reader, db: DbSession) -> dict:
    return training.knowledge_stats(db, principal.organization_id)
