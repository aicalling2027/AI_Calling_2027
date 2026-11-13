"""AI employee ("agent") configuration and lifecycle."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, Principal, require_permissions
from app.core.constants import Perm
from app.modules import employees
from app.schemas.common import MessageResponse, Page
from app.schemas.employee import (
    CallingStatusOut,
    EmployeeCreate,
    EmployeeDedupeOut,
    EmployeeDetail,
    EmployeeImportOut,
    EmployeeOut,
    EmployeeStatusUpdate,
    EmployeeTestRequest,
    EmployeeTestResponse,
    EmployeeUpdate,
    PromptVersionOut,
)

router = APIRouter(prefix="/employees", tags=["AI Employees"])

Reader = Annotated[Principal, Depends(require_permissions(Perm.EMPLOYEES_READ))]
Writer = Annotated[Principal, Depends(require_permissions(Perm.EMPLOYEES_WRITE))]


@router.get("", response_model=Page[EmployeeOut], summary="List AI employees")
def list_employees(
    principal: Reader,
    db: DbSession,
    params: Pagination,
    status_filter: str | None = None,
    category: str | None = None,
    search: str | None = None,
) -> Page[EmployeeOut]:
    rows, total = employees.list_employees(
        db,
        principal.organization_id,
        params,
        status=status_filter,
        category=category,
        search=search,
    )
    return Page[EmployeeOut].build(
        rows, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "",
    response_model=EmployeeDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create an AI employee",
)
def create_employee(
    payload: EmployeeCreate, principal: Writer, db: DbSession
) -> EmployeeDetail:
    employee = employees.create_employee(
        db, principal.organization, payload, user_id=principal.user_id
    )
    return employees.employee_detail(db, employee)


@router.post(
    "/dedupe",
    response_model=EmployeeDedupeOut,
    summary="Archive employees that repeat a name",
)
def deduplicate(principal: Writer, db: DbSession) -> EmployeeDedupeOut:
    """Maintenance pass: keep the oldest of each repeated name, archive the rest."""
    return employees.deduplicate(db, principal.organization_id, user_id=principal.user_id)


@router.post(
    "/import",
    response_model=EmployeeImportOut,
    summary="Import the agents that already exist in the Sarvam workspace",
)
def import_employees(principal: Writer, db: DbSession) -> EmployeeImportOut:
    """Pull existing Sarvam deployments in as AI employees.

    One deployment becomes one employee, linked to the deployment that is
    already running - nothing is deployed or deleted, so repeating the call is
    safe and only refreshes version, status and sync time.
    """
    return employees.import_deployments(
        db, principal.organization_id, user_id=principal.user_id
    )


@router.get("/{employee_id}", response_model=EmployeeDetail, summary="Get an AI employee")
def get_employee(employee_id: str, principal: Reader, db: DbSession) -> EmployeeDetail:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    return employees.employee_detail(db, employee)


@router.patch("/{employee_id}", response_model=EmployeeDetail, summary="Update an AI employee")
def update_employee(
    employee_id: str, payload: EmployeeUpdate, principal: Writer, db: DbSession
) -> EmployeeDetail:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    updated = employees.update_employee(db, employee, payload, user_id=principal.user_id)
    return employees.employee_detail(db, updated)


@router.post(
    "/{employee_id}/status", response_model=EmployeeDetail, summary="Activate or pause an employee"
)
def set_status(
    employee_id: str, payload: EmployeeStatusUpdate, principal: Writer, db: DbSession
) -> EmployeeDetail:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    updated = employees.set_status(db, employee, payload, user_id=principal.user_id)
    return employees.employee_detail(db, updated)


@router.delete("/{employee_id}", response_model=MessageResponse, summary="Archive an employee")
def archive_employee(employee_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    employees.archive_employee(db, employee, user_id=principal.user_id)
    return MessageResponse(message="The AI employee was archived.")


@router.get(
    "/{employee_id}/calling",
    response_model=CallingStatusOut,
    summary="Whether this employee can answer a call",
)
def calling_status(employee_id: str, principal: Reader, db: DbSession) -> CallingStatusOut:
    """The line behind this employee, in the customer's vocabulary.

    Holds no provider identifier: no deployment id, no agent id, no workspace.
    A customer buys a phone line that works, not a vendor object.
    """
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    return employees.calling_status(db, employee)


@router.post(
    "/{employee_id}/calling/enable",
    response_model=EmployeeDetail,
    summary="Enable calls for this employee",
)
def enable_calling(employee_id: str, principal: Writer, db: DbSession) -> EmployeeDetail:
    """Put the employee on the phone. The only path that reaches the provider."""
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    updated = employees.enable_calling(db, employee, user_id=principal.user_id)
    return employees.employee_detail(db, updated)


@router.post(
    "/{employee_id}/calling/disable",
    response_model=EmployeeDetail,
    summary="Stop answering calls, keeping the number for later",
)
def disable_calling(employee_id: str, principal: Writer, db: DbSession) -> EmployeeDetail:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    updated = employees.disable_calling(db, employee, user_id=principal.user_id)
    return employees.employee_detail(db, updated)


@router.delete(
    "/{employee_id}/calling",
    response_model=MessageResponse,
    summary="Delete the number from the voice platform",
)
def remove_calling(employee_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    """Permanently delete the deployment - inbound calls to its number stop.

    Unlike disabling (which pauses and keeps the provider's history), this is
    irreversible on the platform. The employee record survives, paused, and can
    be given a new number later.
    """
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    if not employees.remove_calling(db, employee, user_id=principal.user_id):
        return MessageResponse(message="This AI employee has no number yet.")
    return MessageResponse(message="The number was removed from the voice platform.")


# -- Deprecated provider-named aliases --------------------------------------
# Kept so the current dashboard keeps working; both delegate to the calling
# service above and are scheduled for removal once it repoints.
@router.post(
    "/{employee_id}/agent",
    response_model=EmployeeDetail,
    summary="Deploy (or re-deploy) the Sarvam agent for this employee",
    deprecated=True,
)
def sync_agent(employee_id: str, principal: Writer, db: DbSession) -> EmployeeDetail:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    employees.sync_agent(db, employee, user_id=principal.user_id)
    return employees.employee_detail(db, employee)


@router.delete(
    "/{employee_id}/agent",
    response_model=MessageResponse,
    summary="Delete the agent deployment from the voice platform",
    deprecated=True,
)
def remove_agent(employee_id: str, principal: Writer, db: DbSession) -> MessageResponse:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    if not employees.remove_agent(db, employee, user_id=principal.user_id):
        return MessageResponse(message="This AI employee has no agent deployed.")
    return MessageResponse(message="The agent was removed from the voice platform.")


@router.get(
    "/{employee_id}/versions",
    response_model=list[PromptVersionOut],
    summary="Prompt version history",
)
def prompt_versions(
    employee_id: str, principal: Reader, db: DbSession
) -> list[PromptVersionOut]:
    employees.get_employee(db, principal.organization_id, employee_id)
    return employees.list_prompt_versions(db, employee_id)


@router.post(
    "/{employee_id}/versions/{version_id}/restore",
    response_model=EmployeeDetail,
    summary="Restore a previous prompt",
)
def restore_version(
    employee_id: str, version_id: str, principal: Writer, db: DbSession
) -> EmployeeDetail:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    restored = employees.restore_prompt_version(
        db, employee, version_id, user_id=principal.user_id
    )
    return employees.employee_detail(db, restored)


@router.get("/{employee_id}/agent-config", summary="Runtime config handed to the voice provider")
def agent_config(employee_id: str, principal: Reader, db: DbSession) -> dict:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    return employees.agent_config(db, employee, principal.organization)


@router.post(
    "/{employee_id}/test",
    response_model=EmployeeTestResponse,
    summary="Send a test message (no credits consumed)",
)
def test_employee(
    employee_id: str, payload: EmployeeTestRequest, principal: Writer, db: DbSession
) -> EmployeeTestResponse:
    employee = employees.get_employee(db, principal.organization_id, employee_id)
    return employees.test_employee(db, employee, principal.organization, payload)
