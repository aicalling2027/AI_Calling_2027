"""AI employee (voice agent) configuration use cases - PRD modules 02-04."""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.constants import (
    DEFAULT_MODEL,
    EMPLOYEE_TEMPLATES,
    SUPPORTED_LANGUAGES,
    SUPPORTED_MODELS,
    SUPPORTED_VOICES,
    EmployeeStatus,
)
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    ProviderError,
    ProviderNotConfiguredError,
    ValidationError,
)
from app.core.pagination import PageParams, apply_sorting, paginate
from app.database.base import utcnow
from app.database.models.employee import (
    Employee,
    EmployeeAction,
    EmployeeAgentBinding,
    EmployeeLanguage,
    EmployeePromptVersion,
)
from app.database.models.organization import Organization
from app.database.models.training import EmployeeKnowledgeSource
from app.integrations import sarvam, sarvam_agents
from app.modules import audit, billing
from app.modules.common import as_dict, ensure_unique, scoped
from app.schemas.employee import (
    CallingStatusOut,
    EmployeeActionIn,
    EmployeeCreate,
    EmployeeDedupeOut,
    EmployeeDetail,
    EmployeeImportItem,
    EmployeeImportOut,
    EmployeeLanguageIn,
    EmployeeOut,
    EmployeeStatusUpdate,
    EmployeeTemplateOut,
    EmployeeTestRequest,
    EmployeeTestResponse,
    EmployeeUpdate,
    LanguageCatalogItem,
    PromptVersionOut,
    VoiceCatalogItem,
)

# Lifecycle states in which the provider deployment must stay down.
_STOPPED_STATES = (str(EmployeeStatus.PAUSED), str(EmployeeStatus.ARCHIVED))

PROMPT_FIELDS = (
    "system_prompt",
    "personality",
    "role_description",
    "business_instructions",
    "conversation_objectives",
    "greeting_instruction",
    "interaction_rules",
    "response_style",
    "closing_instruction",
)

# -- Calling states ---------------------------------------------------------
# These are the only words a customer sees about the phone line. The vendor's
# own vocabulary (pending/active/paused/failed) never leaves this module.
CALLING_NOT_CONFIGURED = "not_configured"
CALLING_PENDING = "configuration_pending"
CALLING_SYNCING = "syncing"
CALLING_READY = "ready_to_deploy"
CALLING_LIVE = "live"
CALLING_PAUSED = "paused"
CALLING_FAILED = "sync_failed"

#: Editing any of these makes the deployed configuration stale.
CONFIG_FIELDS = PROMPT_FIELDS + (
    "voice",
    "model",
    "default_language",
    "temperature",
    "max_tokens",
    "first_message",
    "end_call_message",
)

#: States that claim a working line, and so must fall back to "pending" when
#: the saved configuration no longer matches what was deployed.
_STALEABLE_STATES = (CALLING_LIVE, CALLING_READY)

#: Everything whose edit invalidates the deployed configuration. The language
#: set counts even though it is rows, not a column on the employee.
_STALENESS_FIELDS = frozenset(CONFIG_FIELDS) | {"languages"}

_ACTION_HINTS = {
    CALLING_PENDING: "apply_configuration",
    CALLING_READY: "provider_not_configured",
    CALLING_FAILED: "provider_error",
}


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------
def list_employees(
    db: Session,
    organization_id: str,
    params: PageParams,
    *,
    status: str | None = None,
    category: str | None = None,
    search: str | None = None,
) -> tuple[list[EmployeeOut], int]:
    stmt = select(Employee).where(Employee.organization_id == organization_id)
    if status:
        stmt = stmt.where(Employee.status == status)
    else:
        # Archiving is a soft delete: the row stays for audit and call history
        # but drops out of the workspace list, so a de-duplicated name cannot
        # reappear as a second card. ``?status=archived`` still finds them.
        stmt = stmt.where(Employee.status != str(EmployeeStatus.ARCHIVED))
    if category:
        stmt = stmt.where(Employee.business_category == category)
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Employee.name).like(pattern),
                func.lower(func.coalesce(Employee.description, "")).like(pattern),
                func.lower(func.coalesce(Employee.purpose, "")).like(pattern),
            )
        )
    stmt = apply_sorting(stmt, params, Employee, default_column="created_at")
    stmt = stmt.options(selectinload(Employee.languages))
    rows, total = paginate(db, stmt, params)

    items = [EmployeeOut.model_validate(row) for row in rows]
    bindings = _bindings_for(db, [item.id for item in items])
    sources = {row.id: row for row in rows}
    for item in items:
        item.calling = _calling_out(sources[item.id], bindings.get(item.id))
    return items, total


def get_employee(db: Session, organization_id: str, employee_id: str) -> Employee:
    employee = db.execute(
        select(Employee)
        .where(Employee.id == employee_id, Employee.organization_id == organization_id)
        .options(
            selectinload(Employee.languages),
            selectinload(Employee.actions),
            selectinload(Employee.prompt_versions),
        )
    ).scalar_one_or_none()
    if employee is None:
        raise NotFoundError("Employee not found.", details={"id": employee_id})
    return employee


def employee_detail(db: Session, employee: Employee) -> EmployeeDetail:
    knowledge_ids = list(
        db.execute(
            select(EmployeeKnowledgeSource.training_source_id).where(
                EmployeeKnowledgeSource.employee_id == employee.id,
                EmployeeKnowledgeSource.is_active.is_(True),
            )
        ).scalars()
    )
    detail = EmployeeDetail.model_validate(employee)
    detail.knowledge_source_ids = knowledge_ids
    detail.calling = _calling_out(
        employee, _bindings_for(db, [employee.id]).get(employee.id)
    )
    return detail


# ---------------------------------------------------------------------------
# Create / update
# ---------------------------------------------------------------------------
def create_employee(
    db: Session,
    organization: Organization,
    payload: EmployeeCreate,
    *,
    user_id: str | None,
) -> Employee:
    # A repeat of a name the workspace already has is a data-entry mistake, not
    # a plan problem, so say that before the quota is mentioned.
    name = payload.name.strip()
    _assert_name_is_free(db, organization.id, name)

    limits = billing.plan_limits(db, organization.id)
    current = int(
        db.execute(
            select(func.count())
            .select_from(Employee)
            .where(
                Employee.organization_id == organization.id,
                Employee.status != str(EmployeeStatus.ARCHIVED),
            )
        ).scalar_one()
    )
    if current >= limits["max_employees"]:
        raise ConflictError(
            f"Your plan allows {limits['max_employees']} AI employees. "
            "Upgrade the plan to add more.",
            code="plan_limit_reached",
            details={"limit": limits["max_employees"], "current": current},
        )

    data = payload.model_dump(exclude={"languages", "actions", "status"})
    data["system_prompt"] = data.get("system_prompt") or ""

    template = _template(payload.template_key)
    if template and not data["system_prompt"]:
        data["system_prompt"] = _render_template(
            str(template["default_prompt"]), organization.name
        )
    if template and not payload.business_category:
        data["business_category"] = str(template["category"])

    employee = Employee(
        organization_id=organization.id,
        status=str(payload.status),
        created_by=user_id,
        **data,
    )
    db.add(employee)
    db.flush()

    languages = payload.languages or [
        EmployeeLanguageIn(language_code=employee.default_language, is_default=True)
    ]
    _sync_languages(db, employee, languages)
    _sync_actions(db, employee, payload.actions)
    _snapshot_prompt(db, employee, user_id=user_id, note="Initial version")

    # An employee starts silent. Enabling calls is a separate, explicit action,
    # so nothing here reaches the voice provider - not even a request.
    employee.calling_enabled = False
    employee.calling_status = CALLING_NOT_CONFIGURED
    employee.configuration_version = 1
    employee.configuration_hash = _configuration_hash(
        employee, [item.language_code for item in languages]
    )

    audit.log_action(
        db,
        action="employee.created",
        organization_id=organization.id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"name": employee.name, "status": employee.status},
    )
    db.commit()
    db.refresh(employee)
    return employee


def update_employee(
    db: Session, employee: Employee, payload: EmployeeUpdate, *, user_id: str | None
) -> Employee:
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    languages = data.pop("languages", None)
    change_note = data.pop("change_note", None)

    new_name = data.get("name")
    if new_name and new_name.strip().lower() != (employee.name or "").strip().lower():
        _assert_name_is_free(
            db, employee.organization_id, new_name.strip(), exclude_id=employee.id
        )

    prompt_before = {field: getattr(employee, field) for field in PROMPT_FIELDS}
    changed_fields: list[str] = []
    for field, value in data.items():
        if getattr(employee, field, None) != value:
            setattr(employee, field, value)
            changed_fields.append(field)

    prompt_after = {field: getattr(employee, field) for field in PROMPT_FIELDS}
    prompt_changed = prompt_before != prompt_after

    if languages is not None:
        _sync_languages(db, employee, [EmployeeLanguageIn(**item) for item in languages])
        changed_fields.append("languages")

    employee.updated_at = utcnow()
    if prompt_changed:
        _snapshot_prompt(db, employee, user_id=user_id, note=change_note or "Prompt updated")

    # A name change is cosmetic; everything else alters what a caller hears.
    if not _STALENESS_FIELDS.isdisjoint(changed_fields):
        _note_configuration_change(employee)

    audit.log_action(
        db,
        action="employee.updated",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"fields": changed_fields},
    )
    db.commit()
    db.refresh(employee)
    return employee


def set_status(
    db: Session, employee: Employee, payload: EmployeeStatusUpdate, *, user_id: str | None
) -> Employee:
    employee.status = str(payload.status)
    if payload.is_active is not None:
        employee.is_active = payload.is_active
    if payload.status == EmployeeStatus.ACTIVE:
        employee.is_active = True
        if not employee.system_prompt.strip():
            raise ValidationError(
                "Add instructions to the employee before activating it.",
                details={"employee_id": employee.id},
            )

    _follow_status(db, employee)

    audit.log_action(
        db,
        action="employee.status_changed",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"status": employee.status, "is_active": employee.is_active},
    )
    db.commit()
    db.refresh(employee)
    return employee


def archive_employee(db: Session, employee: Employee, *, user_id: str | None) -> Employee:
    """Soft delete: keeps call history and audit references intact.

    The provider deployment is *paused*, never deleted, so the number binding
    and everything Sarvam recorded about past calls survive; the frontend does
    not offer this as a user-facing action any more.
    """
    employee.status = str(EmployeeStatus.ARCHIVED)
    employee.is_active = False

    binding = _bindings_for(db, [employee.id]).get(employee.id)
    if binding is not None and binding.deployment_id and binding.status != "paused":
        _apply_deployment_status(binding, "pause")

    # An archived employee is out of the workspace, so nothing should be able to
    # turn its line back on without restoring it first.
    employee.calling_enabled = False
    employee.calling_status = (
        CALLING_PAUSED
        if binding is not None and binding.deployment_id
        else CALLING_NOT_CONFIGURED
    )

    audit.log_action(
        db,
        action="employee.archived",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
    )
    db.commit()
    db.refresh(employee)
    return employee


def remove_agent(
    db: Session, employee: Employee, *, user_id: str | None
) -> bool:
    """Delete the deployment on the voice platform; the employee row stays.

    The one destructive provider call: the number stops answering and the
    platform drops the deployment, so this is *not* what archiving does (that
    pauses). The link is dropped only once the provider confirms, and a
    simulated deployment - which never existed there - is dropped locally
    without a request. Returns False when there is nothing to remove.
    """
    binding = _bindings_for(db, [employee.id]).get(employee.id)
    deployment_id = binding.deployment_id if binding is not None else None
    if binding is None or not deployment_id:
        return False

    if not binding.simulated:
        result = sarvam_agents.delete_deployment(deployment_id)
        if not result.ok:
            if result.status_code in (401, 403):
                raise ProviderNotConfiguredError(
                    "The voice agent workspace rejected the API key. Replace it with a "
                    "key created in the voice agent dashboard, then try again.",
                    details={"status_code": result.status_code},
                )
            raise ProviderError(
                result.error or "The voice platform did not remove the agent.",
                details={"status_code": result.status_code, "employee_id": employee.id},
            )

    db.delete(binding)
    # No deployment means no line. Leaving the previous answer in place would
    # outlive the thing that made it true.
    employee.calling_enabled = False
    employee.calling_status = CALLING_NOT_CONFIGURED
    if employee.status != str(EmployeeStatus.ARCHIVED):
        # An employee with no deployment cannot answer, so it stops claiming it
        # is live; enabling calls again deploys a fresh one.
        employee.status = str(EmployeeStatus.PAUSED)
        employee.is_active = False

    audit.log_action(
        db,
        action="employee.agent_removed",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"deployment_id": deployment_id},
    )
    db.commit()
    db.refresh(employee)
    return True


# ---------------------------------------------------------------------------
# Sarvam deployment binding
# ---------------------------------------------------------------------------
def sync_agent(
    db: Session, employee: Employee, *, user_id: str | None = None
) -> EmployeeAgentBinding:
    """Create (or re-create) the Sarvam deployment for this employee.

    Only an explicit customer action reaches here: enabling calls, or the
    deprecated re-deploy route kept for the current dashboard. A provider
    failure is stored on the binding so the employee stays usable and the UI can
    show why the line is not live yet.
    """
    binding = _bindings_for(db, [employee.id]).get(employee.id)
    if binding is None:
        binding = EmployeeAgentBinding(
            organization_id=employee.organization_id,
            employee_id=employee.id,
            provider=sarvam_agents.PROVIDER,
            status="pending",
        )
        db.add(binding)
        db.flush()

    result = sarvam_agents.provision(
        employee_name=employee.name,
        employee_id=employee.id,
        description=employee.description or employee.purpose,
    )

    binding.synced_at = utcnow()
    if result.ok:
        binding.deployment_id = str(result.data.get("deployment_id") or "") or None
        binding.app_id = str(result.data.get("app_id") or "") or None
        binding.app_version = int(
            result.data.get("app_version") or settings.sarvam_agent_app_version
        )
        binding.simulated = bool(result.simulated)
        binding.status = "active"
        binding.last_error = None
        binding.external_agent_name = (employee.name or "")[:120] or None
        if not employee.configuration_hash:
            employee.configuration_hash = _configuration_hash(employee)
        # This is the configuration the deployment was made from. A later edit
        # moves the employee's hash, which is how the read path knows that what
        # a caller hears is one save behind.
        binding.last_configuration_hash = employee.configuration_hash
        binding.sync_status = "simulated" if binding.simulated else "in_sync"

        # A new deployment always comes back live, so re-deploying a paused or
        # archived employee would quietly put it back on the phone behind a
        # "Paused" badge. Send it straight back down instead.
        if employee.status in _STOPPED_STATES:
            _apply_deployment_status(binding, "pause")
    else:
        binding.status = "failed"
        binding.sync_status = "failed"
        binding.last_error = (
            result.error or "The voice provider rejected this deployment."
        )[:500]

    employee.calling_status = _state_for_binding(binding)

    audit.log_action(
        db,
        action="employee.agent_provisioned",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={
            "status": binding.status,
            "deployment_id": binding.deployment_id,
            "simulated": binding.simulated,
        },
    )
    db.commit()
    db.refresh(binding)
    return binding


def _follow_status(db: Session, employee: Employee) -> None:
    """Mirror a pause/resume onto a deployment that already exists.

    Activating an employee no longer deploys one. Enabling calls is its own
    action with its own endpoint, so a status change can only adjust a line that
    is already there - never buy a new one.
    """
    if employee.status == str(EmployeeStatus.ARCHIVED):
        return

    binding = _bindings_for(db, [employee.id]).get(employee.id)
    if binding is None or not binding.deployment_id or binding.status == "failed":
        return

    action = "resume" if employee.status == str(EmployeeStatus.ACTIVE) else "pause"
    wanted = "active" if action == "resume" else "paused"
    if binding.status != wanted:
        _apply_deployment_status(binding, action)

    employee.calling_status = _state_for_binding(binding)


def _apply_deployment_status(binding: EmployeeAgentBinding, action: str) -> bool:
    """Pause or resume a deployment; False when the provider refused.

    A simulated deployment exists only in this database, so its row is the whole
    truth and no request is made for it.
    """
    wanted = "active" if action == "resume" else "paused"

    if binding.simulated:
        binding.status = wanted
        binding.sync_status = "simulated"
        binding.synced_at = utcnow()
        return True

    if not binding.deployment_id:
        return False

    result = sarvam_agents.set_status(binding.deployment_id, action=action)
    binding.synced_at = utcnow()
    if not result.ok:
        binding.last_error = (result.error or f"The provider rejected the {action}.")[:500]
        return False

    binding.status = wanted
    binding.sync_status = "in_sync"
    binding.last_error = None
    return True


# ---------------------------------------------------------------------------
# Calling lifecycle
# ---------------------------------------------------------------------------
def calling_status(db: Session, employee: Employee) -> CallingStatusOut:
    """What the customer may know about this employee's phone line."""
    return _calling_out(employee, _bindings_for(db, [employee.id]).get(employee.id))


def _require_dialable(employee: Employee) -> None:
    """The two things that must be true before a caller could hear anything."""
    if not (employee.system_prompt or "").strip():
        raise ValidationError(
            "Add instructions to the employee before enabling calls.",
            details={"employee_id": employee.id},
        )
    if employee.status != str(EmployeeStatus.ACTIVE):
        raise ConflictError(
            f"Employee '{employee.name}' is {employee.status}. Activate it before "
            "enabling calls.",
            details={"employee_id": employee.id, "status": employee.status},
        )


def enable_calling(db: Session, employee: Employee, *, user_id: str | None) -> Employee:
    """Put this employee on the phone.

    The one path that reaches the provider on the customer's behalf. A line that
    already exists is resumed rather than replaced - a second deployment would
    claim a second number, and the agent's instructions live on the provider, so
    a fresh deployment would not carry the edit anyway.
    """
    _require_dialable(employee)

    employee.calling_enabled = True
    binding = _bindings_for(db, [employee.id]).get(employee.id)

    if binding is not None and binding.deployment_id and binding.status != "failed":
        if binding.status != "active":
            _apply_deployment_status(binding, "resume")
        employee.calling_status = _state_for_binding(binding)
    else:
        employee.calling_status = CALLING_SYNCING
        db.flush()
        sync_agent(db, employee, user_id=user_id)

    audit.log_action(
        db,
        action="employee.calling_enabled",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"calling_status": employee.calling_status},
    )
    db.commit()
    db.refresh(employee)
    return employee


def disable_calling(db: Session, employee: Employee, *, user_id: str | None) -> Employee:
    """Stop answering calls, keeping the deployment so re-enabling is instant."""
    employee.calling_enabled = False
    binding = _bindings_for(db, [employee.id]).get(employee.id)

    if binding is not None and binding.deployment_id:
        if binding.status == "active":
            _apply_deployment_status(binding, "pause")
        # If the provider refused the pause the number is still answering, and
        # the state keeps saying so instead of pretending otherwise.
        employee.calling_status = _state_for_binding(binding)
    else:
        employee.calling_status = CALLING_NOT_CONFIGURED

    audit.log_action(
        db,
        action="employee.calling_disabled",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"calling_status": employee.calling_status},
    )
    db.commit()
    db.refresh(employee)
    return employee


def remove_calling(db: Session, employee: Employee, *, user_id: str | None) -> bool:
    """Delete the deployment on the voice platform; the employee row stays.

    Separated from :func:`disable_calling` because this one is irreversible: the
    number stops answering and cannot be recovered, so the caller has to mean it.
    Returns False when there was nothing to remove.
    """
    return remove_agent(db, employee, user_id=user_id)


# ---------------------------------------------------------------------------
# Prompt history
# ---------------------------------------------------------------------------
def list_prompt_versions(db: Session, employee_id: str) -> list[PromptVersionOut]:
    rows = db.execute(
        select(EmployeePromptVersion)
        .where(EmployeePromptVersion.employee_id == employee_id)
        .order_by(EmployeePromptVersion.version.desc())
    ).scalars().all()
    return [PromptVersionOut.model_validate(row) for row in rows]


def restore_prompt_version(
    db: Session, employee: Employee, version_id: str, *, user_id: str | None
) -> Employee:
    version = db.execute(
        select(EmployeePromptVersion).where(
            EmployeePromptVersion.id == version_id,
            EmployeePromptVersion.employee_id == employee.id,
        )
    ).scalar_one_or_none()
    if version is None:
        raise NotFoundError("Prompt version not found.", details={"id": version_id})

    employee.system_prompt = version.system_prompt
    for field, value in as_dict(version.prompt_config).items():
        if field in PROMPT_FIELDS and hasattr(employee, field):
            setattr(employee, field, value)

    _note_configuration_change(employee)
    _snapshot_prompt(db, employee, user_id=user_id, note=f"Restored v{version.version}")
    audit.log_action(
        db,
        action="employee.prompt_restored",
        organization_id=employee.organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={"restored_version": version.version},
    )
    db.commit()
    db.refresh(employee)
    return employee


# ---------------------------------------------------------------------------
# Runtime configuration & testing
# ---------------------------------------------------------------------------
def agent_config(db: Session, employee: Employee, organization: Organization) -> dict[str, Any]:
    """Everything the telephony bridge needs to run a conversation."""
    languages = [language.language_code for language in employee.languages] or [
        employee.default_language
    ]
    return {
        "employee_id": employee.id,
        "employee_name": employee.name,
        "business_name": organization.name,
        "voice": employee.voice,
        "model": employee.model,
        "language": employee.default_language,
        "languages": languages,
        "temperature": employee.temperature,
        "max_tokens": employee.max_tokens,
        "first_message": employee.first_message,
        "end_call_message": employee.end_call_message,
        "system_prompt": sarvam.build_system_prompt(
            employee_name=employee.name,
            business_name=organization.name,
            role=employee.role_description or employee.purpose,
            base_prompt=employee.system_prompt,
            languages=languages,
        ),
        "actions": [
            {"name": action.name, "type": action.action_type, "config": action.config}
            for action in employee.actions
            if action.is_active
        ],
    }


def test_employee(
    db: Session,
    employee: Employee,
    organization: Organization,
    payload: EmployeeTestRequest,
) -> EmployeeTestResponse:
    """Dry-run one conversation turn - no telephony, no credits consumed."""
    started = time.perf_counter()
    config = agent_config(db, employee, organization)
    language = payload.language or employee.default_language

    response = sarvam.generate_reply(
        system_prompt=config["system_prompt"],
        history=[],
        user_message=payload.message,
        model=employee.model,
        temperature=employee.temperature,
        max_tokens=employee.max_tokens,
        language=language,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    # A failed call must surface as a failure. Falling back to the offline reply
    # here would show a fabricated answer labelled as a real Sarvam response,
    # which hides a revoked key behind a working-looking console.
    sarvam.raise_for_failure(response, action="answer this test message")

    content = str(response.data.get("content") or "").strip()
    if not content:
        raise ProviderError(
            "Sarvam accepted the request but returned an empty reply.",
            details={"provider": "sarvam", "status_code": response.status_code},
        )

    return EmployeeTestResponse(
        reply=content,
        language=language,
        model=employee.model or DEFAULT_MODEL,
        provider="offline" if response.simulated else "sarvam",
        latency_ms=latency_ms,
        simulated=response.simulated,
    )


# ---------------------------------------------------------------------------
# Catalogues
# ---------------------------------------------------------------------------
def templates() -> list[EmployeeTemplateOut]:
    return [
        EmployeeTemplateOut(
            key=str(item["key"]),
            category=str(item["category"]),
            name=str(item["name"]),
            description=str(item["description"]),
            suggested_role=str(item["suggested_role"]),
            default_prompt=str(item["default_prompt"]),
            suggested_languages=list(item["suggested_languages"]),  # type: ignore[arg-type]
            suggested_voice=str(item["suggested_voice"]),
            conversation_guidelines=list(item["conversation_guidelines"]),  # type: ignore[arg-type]
            suggested_outcomes=list(item["suggested_outcomes"]),  # type: ignore[arg-type]
        )
        for item in EMPLOYEE_TEMPLATES
    ]


def voices() -> list[VoiceCatalogItem]:
    return [VoiceCatalogItem(id=code, gender=gender) for code, gender in SUPPORTED_VOICES.items()]


def languages() -> list[LanguageCatalogItem]:
    return [
        LanguageCatalogItem(code=code, name=name) for code, name in SUPPORTED_LANGUAGES.items()
    ]


def models_catalog() -> list[dict[str, Any]]:
    return [
        {"id": code, **dict(meta)}  # type: ignore[dict-item]
        for code, meta in SUPPORTED_MODELS.items()
    ]


def apply_template(
    db: Session,
    organization: Organization,
    *,
    template_key: str,
    name: str | None = None,
    user_id: str | None = None,
) -> Employee:
    """One-click employee creation from a business template."""
    template = _template(template_key)
    if template is None:
        raise NotFoundError("Template not found.", details={"template_key": template_key})

    payload = EmployeeCreate(
        name=name or str(template["name"])[:120],
        description=str(template["description"]),
        purpose=str(template["suggested_role"]),
        business_category=str(template["category"]),
        template_key=template_key,
        system_prompt=_render_template(str(template["default_prompt"]), organization.name),
        role_description=str(template["suggested_role"]),
        interaction_rules="\n".join(
            f"- {rule}" for rule in template["conversation_guidelines"]  # type: ignore[union-attr]
        ),
        voice=str(template["suggested_voice"]),
        default_language=str(list(template["suggested_languages"])[0]),  # type: ignore[arg-type]
        languages=[
            EmployeeLanguageIn(language_code=str(code), is_default=index == 0)
            for index, code in enumerate(template["suggested_languages"])  # type: ignore[arg-type]
        ],
    )
    return create_employee(db, organization, payload, user_id=user_id)


# ---------------------------------------------------------------------------
# Duplicates
# ---------------------------------------------------------------------------
def deduplicate(
    db: Session, organization_id: str, *, user_id: str | None = None
) -> EmployeeDedupeOut:
    """Collapse employees that repeat a name, keeping the oldest of each group.

    Nothing is deleted: a repeat is archived and its provider deployment is
    paused, so a mistaken import leaves neither duplicate rows in the workspace
    nor duplicate agents on the provider. Running this twice is harmless.
    """
    rows = list(
        db.execute(
            select(Employee)
            .where(
                Employee.organization_id == organization_id,
                Employee.status != str(EmployeeStatus.ARCHIVED),
            )
            .order_by(Employee.created_at.asc(), Employee.id.asc())
        ).scalars()
    )

    seen: set[str] = set()
    archived: list[str] = []
    for employee in rows:
        key = (employee.name or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            continue
        archive_employee(db, employee, user_id=user_id)
        archived.append(employee.id)

    return EmployeeDedupeOut(
        scanned=len(rows), duplicates=len(archived), archived_ids=archived
    )


# ---------------------------------------------------------------------------
# Import from Sarvam
# ---------------------------------------------------------------------------
def import_deployments(
    db: Session, organization_id: str, *, user_id: str | None = None
) -> EmployeeImportOut:
    """Pull the agents that already exist on the voice platform into this workspace.

    The provider has no "list agents" call: an agent only becomes addressable
    through the deployment that binds it to a phone number, so one deployment
    becomes one AI employee. The pull *links* to what is already there - it
    never provisions a deployment and never deletes one - so running it twice
    only refreshes the version, status and sync time.
    """
    missing = sarvam_agents.missing_workspace_settings()
    if missing:
        raise ProviderNotConfiguredError(
            "The voice agent workspace is not connected yet. Add the missing "
            "settings to the backend environment, then import again.",
            details={"missing": missing},
        )

    if sarvam_agents.key_conflicts_with_ids():
        raise ProviderNotConfiguredError(
            "The agent key field holds a workspace id instead of an API key. "
            "Replace it with the key from the voice agent dashboard's API Key "
            "settings, then import again.",
            details={"setting": "SARVAM_AGENTS_API_KEY", "conflicts_with": "id"},
        )

    result = sarvam_agents.list_deployments()
    if not result.ok:
        if result.status_code in (401, 403):
            # A bare "(401) Unauthorized" reaches the dashboard, which is no
            # help to whoever is clicking Import - say what to change.
            raise ProviderNotConfiguredError(
                "The voice agent workspace rejected the API key. Replace it with a "
                "key created in the voice agent dashboard, then import again.",
                details={"status_code": result.status_code},
            )
        raise ProviderError(
            result.error or "The voice platform did not return its agents.",
            details={
                "provider": sarvam_agents.PROVIDER,
                "status_code": result.status_code,
            },
        )

    deployments = [
        item
        for item in (result.data.get("items") or [])
        if isinstance(item, dict) and item.get("deployment_id")
    ]
    if not deployments:
        return EmployeeImportOut(fetched=0, created=0, updated=0, skipped=0, items=[])

    bindings = {
        row.deployment_id: row
        for row in db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.organization_id == organization_id,
                EmployeeAgentBinding.deployment_id.in_(
                    [str(item["deployment_id"]) for item in deployments]
                ),
            )
        ).scalars()
        if row.deployment_id
    }
    employees = {
        row.id: row
        for row in db.execute(
            select(Employee).where(Employee.organization_id == organization_id)
        ).scalars()
    }

    # Only the visible rows take a name or a seat; an archived one must stay
    # archived and must not be counted against the plan twice.
    taken_names = {
        (row.name or "").strip().lower()
        for row in employees.values()
        if row.status != str(EmployeeStatus.ARCHIVED)
    }
    limits = billing.plan_limits(db, organization_id)
    headroom = max(0, limits["max_employees"] - len(taken_names))

    items: list[EmployeeImportItem] = []
    created = updated = skipped = 0

    for deployment in deployments:
        deployment_id = str(deployment["deployment_id"])
        target = _deployment_status(deployment)
        binding = bindings.get(deployment_id)

        if binding is not None:
            employee = employees.get(binding.employee_id)
            if employee is None or employee.status == str(EmployeeStatus.ARCHIVED):
                # Archived in this workspace on purpose: a pull must not bring
                # it back, or removing an employee would not stick.
                skipped += 1
                items.append(
                    _import_item(
                        binding.employee_id,
                        employee.name if employee else "",
                        deployment,
                        binding.status,
                        "skipped",
                        "Archived in this workspace",
                    )
                )
                continue

            _refresh_binding(binding, deployment, target, employee)
            updated += 1
            items.append(
                _import_item(
                    employee.id,
                    employee.name,
                    deployment,
                    binding.status,
                    "updated",
                )
            )
            continue

        if headroom <= 0:
            skipped += 1
            items.append(
                _import_item(
                    "",
                    str(deployment.get("name") or deployment.get("app_id") or ""),
                    deployment,
                    str(deployment.get("status") or ""),
                    "skipped",
                    f"Plan limit of {limits['max_employees']} employees reached",
                )
            )
            continue

        employee, binding = _create_from_deployment(
            db, organization_id, deployment, target, taken_names, user_id
        )
        headroom -= 1
        created += 1
        items.append(
            _import_item(employee.id, employee.name, deployment, binding.status, "created")
        )

    db.commit()
    return EmployeeImportOut(
        fetched=len(deployments),
        created=created,
        updated=updated,
        skipped=skipped,
        items=items,
    )


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _bindings_for(db: Session, employee_ids: list[str]) -> dict[str, EmployeeAgentBinding]:
    """Fetch every binding for a page of employees in one query."""
    if not employee_ids:
        return {}
    rows = db.execute(
        select(EmployeeAgentBinding).where(
            EmployeeAgentBinding.employee_id.in_(employee_ids)
        )
    ).scalars()
    return {row.employee_id: row for row in rows}


def _calling_out(
    employee: Employee, binding: EmployeeAgentBinding | None
) -> CallingStatusOut:
    """Translate internal provider state into the customer's vocabulary.

    The stored state is what the provider last reported. It is corrected on read
    in one case: a configuration saved after the deployment was made has not
    reached the live line, so claiming "live" there would be a lie the customer
    would only discover from a caller.
    """
    state = employee.calling_status or CALLING_NOT_CONFIGURED
    connected = bool(binding and binding.status == "active" and not binding.simulated)
    if state == CALLING_LIVE and _configuration_is_stale(employee, binding):
        state = CALLING_PENDING

    return CallingStatusOut(
        enabled=bool(employee.calling_enabled),
        state=state,
        simulated=bool(binding.simulated) if binding else False,
        connected=connected,
        last_checked_at=binding.synced_at if binding else None,
        action_required=_ACTION_HINTS.get(state),
    )


def _configuration_is_stale(
    employee: Employee, binding: EmployeeAgentBinding | None
) -> bool:
    """True when the saved configuration is newer than the deployed one."""
    if binding is None:
        return True
    if not binding.last_configuration_hash or not employee.configuration_hash:
        # Nothing recorded on one side means the match cannot be proven, and an
        # unproven match must not be reported as live.
        return True
    return binding.last_configuration_hash != employee.configuration_hash


def _configuration_hash(
    employee: Employee, language_codes: Sequence[str] | None = None
) -> str:
    """Fingerprint of everything that shapes a conversation.

    Language codes are passed in when the caller already knows the intended set:
    a freshly added ``EmployeeLanguage`` row is not yet on the relationship, so
    reading it back would hash the empty set and make every change look applied.
    """
    codes = language_codes
    if codes is None:
        codes = [row.language_code for row in employee.languages]

    payload = {
        "prompts": {field: getattr(employee, field) or "" for field in PROMPT_FIELDS},
        "voice": employee.voice,
        "model": employee.model,
        "language": employee.default_language,
        "languages": sorted(set(codes)),
        "temperature": round(float(employee.temperature or 0.0), 3),
        "max_tokens": int(employee.max_tokens or 0),
        "first_message": employee.first_message or "",
        "end_call_message": employee.end_call_message or "",
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _note_configuration_change(employee: Employee) -> None:
    """Bump the configuration version and stop claiming the old one is live.

    There is no API to push an edit into an agent that is already deployed, so
    a saved change makes the line one deployment behind. Saying so is the point:
    the alternative is a customer editing a prompt and believing callers hear it.
    """
    employee.configuration_version = int(employee.configuration_version or 0) + 1
    employee.configuration_hash = _configuration_hash(employee)
    if employee.calling_status in _STALEABLE_STATES:
        employee.calling_status = CALLING_PENDING


def _state_for_binding(binding: EmployeeAgentBinding) -> str:
    """The customer-visible calling state a provider result adds up to."""
    if binding.status == "failed":
        return CALLING_FAILED
    if binding.status == "paused":
        return CALLING_PAUSED
    if binding.simulated:
        # No workspace credentials, so nothing was actually deployed. "Ready"
        # is honest: the configuration exists, the phone line does not.
        return CALLING_READY
    return CALLING_LIVE


#: The two states a Sarvam deployment reports. An unknown one is not a licence
#: to activate, so it imports as a draft.
_DEPLOYMENT_STATUS = {
    "active": EmployeeStatus.ACTIVE,
    "paused": EmployeeStatus.PAUSED,
}


def _deployment_status(deployment: dict[str, Any]) -> EmployeeStatus:
    return _DEPLOYMENT_STATUS.get(
        str(deployment.get("status") or "").strip().lower(), EmployeeStatus.DRAFT
    )


def _import_item(
    employee_id: str,
    name: str,
    deployment: dict[str, Any],
    status: str,
    action: str,
    reason: str | None = None,
) -> EmployeeImportItem:
    return EmployeeImportItem(
        employee_id=employee_id,
        name=name,
        deployment_id=str(deployment.get("deployment_id") or ""),
        app_id=str(deployment.get("app_id") or "") or None,
        app_version=int(deployment.get("app_version") or 1),
        status=status,
        action=action,
        reason=reason,
    )


def _create_from_deployment(
    db: Session,
    organization_id: str,
    deployment: dict[str, Any],
    status: EmployeeStatus,
    taken_names: set[str],
    user_id: str | None,
) -> tuple[Employee, EmployeeAgentBinding]:
    """Mirror one remote deployment as a new employee, without deploying again."""
    deployment_id = str(deployment["deployment_id"])
    app_id = str(deployment.get("app_id") or "").strip() or None
    version = int(deployment.get("app_version") or 1)
    description = str(deployment.get("description") or "").strip()

    employee = Employee(
        organization_id=organization_id,
        name=_free_name(
            str(deployment.get("name") or app_id or "Imported agent"), taken_names
        ),
        description=description or "Imported from your connected voice platform.",
        purpose=(f"Voice agent {app_id}" if app_id else "Imported voice agent")[:255],
        default_language="en-IN",
        voice=_default_voice(),
        model=DEFAULT_MODEL,
        # The instructions live in Sarvam; this row is the workspace's mirror of
        # them, so there is nothing truthful to write here yet.
        system_prompt="",
        status=str(status),
        is_active=status == EmployeeStatus.ACTIVE,
        created_by=user_id,
    )
    db.add(employee)
    db.flush()

    _sync_languages(
        db,
        employee,
        [EmployeeLanguageIn(language_code="en-IN", is_default=True)],
    )
    _snapshot_prompt(db, employee, user_id=user_id, note="Imported agent")

    # The deployment is answering on the provider, so the line is real - but this
    # row does not describe it (the instructions stay on Sarvam), which is what
    # the mismatch between the two hashes will keep telling the customer.
    employee.calling_enabled = status == EmployeeStatus.ACTIVE
    employee.calling_status = (
        CALLING_LIVE if status == EmployeeStatus.ACTIVE else CALLING_PAUSED
    )
    employee.configuration_hash = _configuration_hash(employee)

    binding = EmployeeAgentBinding(
        organization_id=organization_id,
        employee_id=employee.id,
        provider=sarvam_agents.PROVIDER,
        deployment_id=deployment_id,
        app_id=app_id,
        app_version=version,
        status=str(deployment.get("status") or "").strip().lower() or "active",
        simulated=False,
        synced_at=utcnow(),
        external_agent_name=str(deployment.get("name") or "")[:120] or None,
        sync_status="out_of_sync",
    )
    db.add(binding)

    audit.log_action(
        db,
        action="employee.imported",
        organization_id=organization_id,
        user_id=user_id,
        resource_type="employee",
        resource_id=employee.id,
        changes={
            "deployment_id": deployment_id,
            "app_id": app_id,
            "app_version": version,
            "status": str(status),
        },
    )
    db.flush()
    return employee, binding


def _refresh_binding(
    binding: EmployeeAgentBinding,
    deployment: dict[str, Any],
    status: EmployeeStatus,
    employee: Employee,
) -> None:
    """Re-read one deployment. Links only: no new deployment is created."""
    binding.app_id = str(deployment.get("app_id") or "") or binding.app_id
    binding.app_version = int(deployment.get("app_version") or binding.app_version or 1)
    binding.status = str(deployment.get("status") or "").strip().lower() or binding.status
    binding.simulated = False
    binding.last_error = None
    binding.synced_at = utcnow()
    binding.external_agent_status = binding.status
    employee.calling_status = (
        CALLING_LIVE if binding.status == "active" else CALLING_PAUSED
    )

    # A pause made on Sarvam is a pause here. Activation is deliberately not
    # mirrored: a draft has no instructions yet, and an import must never put
    # an employee on the phone behind the workspace's back.
    if status == EmployeeStatus.PAUSED and employee.status != str(EmployeeStatus.PAUSED):
        employee.status = str(EmployeeStatus.PAUSED)
        employee.is_active = False


def _free_name(base: str, taken: set[str]) -> str:
    """A workspace-unique display name, so an import cannot fight the guard."""
    cleaned = " ".join(str(base).split())[:120] or "Imported agent"
    candidate = cleaned
    counter = 2
    while candidate.lower() in taken:
        suffix = f" ({counter})"
        candidate = f"{cleaned[: 120 - len(suffix)].strip()}{suffix}"
        counter += 1
    taken.add(candidate.lower())
    return candidate


def _default_voice() -> str:
    speaker = (settings.sarvam_default_speaker or "").strip()
    return speaker if speaker in SUPPORTED_VOICES else "anushka"


def _assert_name_is_free(
    db: Session, organization_id: str, name: str, *, exclude_id: str | None = None
) -> None:
    """Two employees sharing one name are indistinguishable in the workspace."""
    conditions: list[Any] = [
        Employee.organization_id == organization_id,
        func.lower(func.trim(Employee.name)) == name.strip().lower(),
        Employee.status != str(EmployeeStatus.ARCHIVED),
    ]
    if exclude_id:
        conditions.append(Employee.id != exclude_id)
    ensure_unique(
        db,
        Employee,
        *conditions,
        message=(
            f"An AI employee called '{name}' already exists in this workspace. "
            "Open that one, or give this employee a different name."
        ),
        field="name",
        value=name,
    )


def _template(key: str | None) -> dict[str, Any] | None:
    if not key:
        return None
    for item in EMPLOYEE_TEMPLATES:
        if item["key"] == key:
            return dict(item)
    return None


def _render_template(prompt: str, business_name: str) -> str:
    return prompt.replace("{business_name}", business_name)


def _sync_languages(
    db: Session, employee: Employee, languages: list[EmployeeLanguageIn]
) -> None:
    """Replace the language set, keeping one default."""
    if not languages:
        return

    codes = [item.language_code for item in languages]
    if len(set(codes)) != len(codes):
        raise ValidationError("Duplicate language codes are not allowed.")

    default_code = next(
        (item.language_code for item in languages if item.is_default), codes[0]
    )

    existing = {row.language_code: row for row in employee.languages}
    for code in list(existing):
        if code not in codes:
            db.delete(existing[code])
            existing.pop(code)

    for item in languages:
        row = existing.get(item.language_code)
        if row is None:
            row = EmployeeLanguage(
                employee_id=employee.id,
                language_code=item.language_code,
                is_default=item.language_code == default_code,
                language_prompt=item.language_prompt,
            )
            db.add(row)
        else:
            row.is_default = item.language_code == default_code
            row.language_prompt = item.language_prompt

    employee.default_language = default_code
    db.flush()


def _sync_actions(db: Session, employee: Employee, actions: list[EmployeeActionIn]) -> None:
    if not actions:
        return
    for action in actions:
        db.add(
            EmployeeAction(
                employee_id=employee.id,
                name=action.name,
                action_type=action.action_type,
                description=action.description,
                config=action.config,
                trigger_condition=action.trigger_condition,
                is_active=action.is_active,
            )
        )
    db.flush()


def _snapshot_prompt(
    db: Session, employee: Employee, *, user_id: str | None, note: str | None
) -> EmployeePromptVersion:
    """Append an immutable prompt version, incrementing the counter."""
    last = db.execute(
        select(func.max(EmployeePromptVersion.version)).where(
            EmployeePromptVersion.employee_id == employee.id
        )
    ).scalar_one_or_none()
    version = EmployeePromptVersion(
        employee_id=employee.id,
        version=int(last or 0) + 1,
        system_prompt=employee.system_prompt or "",
        prompt_config={field: getattr(employee, field) for field in PROMPT_FIELDS},
        change_note=(note or "")[:255] or None,
        created_by=user_id,
    )
    db.add(version)
    db.flush()
    return version


def resolve_employee(
    db: Session, organization_id: str, employee_id: str | None
) -> Employee | None:
    if not employee_id:
        return None
    return scoped(db, Employee, employee_id, organization_id, label="Employee")


def require_active_employee(
    db: Session, organization_id: str, employee_id: str
) -> Employee:
    employee = resolve_employee(db, organization_id, employee_id)
    if employee is None:
        raise ValidationError("An employee must be selected for this action.")
    if employee.status != str(EmployeeStatus.ACTIVE):
        raise ConflictError(
            f"Employee '{employee.name}' is {employee.status}. Activate it before calling.",
            details={"employee_id": employee.id, "status": employee.status},
        )
    return employee


def sarvam_ready() -> bool:
    return sarvam.configured() or not settings.is_production
