"""AI employee (voice agent) configuration use cases - PRD modules 02-04."""

from __future__ import annotations

import time
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
    ProviderAgentOut,
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
    for item in items:
        item.provider_agent = _provider_agent(bindings.get(item.id))
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
    detail.provider_agent = _provider_agent(_bindings_for(db, [employee.id]).get(employee.id))
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

    _sync_languages(
        db,
        employee,
        payload.languages
        or [
            EmployeeLanguageIn(
                language_code=employee.default_language, is_default=True
            )
        ],
    )
    _sync_actions(db, employee, payload.actions)
    _snapshot_prompt(db, employee, user_id=user_id, note="Initial version")

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

    # Creating the employee is the trigger: the Sarvam deployment is created
    # straight away so the workspace never holds an agent the provider has not
    # heard of. A provider failure is recorded on the binding, not raised.
    sync_agent(db, employee, user_id=user_id)
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
    if binding is not None and binding.status != "paused":
        sarvam_agents.set_status(binding.deployment_id or "", action="pause")
        binding.status = "paused"
        binding.synced_at = utcnow()

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


# ---------------------------------------------------------------------------
# Sarvam deployment binding
# ---------------------------------------------------------------------------
def sync_agent(
    db: Session, employee: Employee, *, user_id: str | None = None
) -> EmployeeAgentBinding:
    """Create (or re-create) the Sarvam deployment for this employee.

    Called automatically on create and on demand from the workspace. A provider
    failure is stored on the binding so the employee stays usable and the UI can
    show why the agent is not live yet.
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

        # A new deployment always comes back live, so re-deploying a paused or
        # archived employee would quietly put it back on the phone behind a
        # "Paused" badge. Send it straight back down instead.
        if employee.status in _STOPPED_STATES:
            stopped = sarvam_agents.set_status(
                binding.deployment_id or "", action="pause"
            )
            if stopped.ok:
                binding.status = "paused"
            else:
                binding.last_error = (
                    stopped.error or "The provider rejected the pause after deploying."
                )[:500]
    else:
        binding.status = "failed"
        binding.last_error = (
            result.error or "The voice provider rejected this deployment."
        )[:500]

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
    """Mirror a pause/resume onto the provider deployment."""
    if employee.status == str(EmployeeStatus.ARCHIVED):
        return

    binding = _bindings_for(db, [employee.id]).get(employee.id)
    if binding is None or binding.status == "failed":
        if employee.status == str(EmployeeStatus.ACTIVE):
            sync_agent(db, employee)
        return

    if binding.deployment_id is None:
        return

    action = "resume" if employee.status == str(EmployeeStatus.ACTIVE) else "pause"
    wanted = "active" if action == "resume" else "paused"
    if binding.status == wanted:
        return

    result = sarvam_agents.set_status(binding.deployment_id, action=action)
    binding.synced_at = utcnow()
    if result.ok:
        binding.status = wanted
        binding.last_error = None
    else:
        binding.last_error = (result.error or "The provider rejected the status change.")[:500]


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
    content = str(response.data.get("content") or sarvam.offline_reply(
        [{"role": "user", "content": payload.message}], language=language
    ))

    return EmployeeTestResponse(
        reply=content,
        language=language,
        model=employee.model or DEFAULT_MODEL,
        provider="sarvam" if sarvam.configured() else "offline",
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
    """Pull the agents that already exist on Sarvam into this workspace.

    Voice Agents has no "list agents" call: an agent only becomes addressable
    through the deployment that binds it to a phone number, so one deployment
    becomes one AI employee. The pull *links* to what is already there - it
    never provisions a deployment and never deletes one - so running it twice
    only refreshes the version, status and sync time.
    """
    missing = sarvam_agents.missing_workspace_settings()
    if missing:
        raise ProviderNotConfiguredError(
            "Sarvam is not addressed yet. Set "
            f"{', '.join(missing)} in the backend environment, then import again.",
            details={"missing": missing},
        )

    result = sarvam_agents.list_deployments()
    if not result.ok:
        raise ProviderError(
            result.error or "Sarvam did not return its deployments.",
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


def _provider_agent(binding: EmployeeAgentBinding | None) -> ProviderAgentOut | None:
    if binding is None:
        return None
    return ProviderAgentOut(
        provider=binding.provider,
        deployment_id=binding.deployment_id,
        app_id=binding.app_id,
        app_version=binding.app_version,
        status=binding.status,
        simulated=binding.simulated,
        synced_at=binding.synced_at,
        error=binding.last_error,
    )


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
            str(deployment.get("name") or app_id or "Sarvam agent"), taken_names
        ),
        description=description or f"Imported from Sarvam - deployment {deployment_id}",
        purpose=(f"Sarvam agent {app_id}" if app_id else "Imported Sarvam agent")[:255],
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
    _snapshot_prompt(db, employee, user_id=user_id, note="Imported from Sarvam")

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

    # A pause made on Sarvam is a pause here. Activation is deliberately not
    # mirrored: a draft has no instructions yet, and an import must never put
    # an employee on the phone behind the workspace's back.
    if status == EmployeeStatus.PAUSED and employee.status != str(EmployeeStatus.PAUSED):
        employee.status = str(EmployeeStatus.PAUSED)
        employee.is_active = False


def _free_name(base: str, taken: set[str]) -> str:
    """A workspace-unique display name, so an import cannot fight the guard."""
    cleaned = " ".join(str(base).split())[:120] or "Sarvam agent"
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
