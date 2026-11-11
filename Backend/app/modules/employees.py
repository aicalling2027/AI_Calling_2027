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
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.pagination import PageParams, apply_sorting, paginate
from app.database.base import utcnow
from app.database.models.employee import (
    Employee,
    EmployeeAction,
    EmployeeLanguage,
    EmployeePromptVersion,
)
from app.database.models.organization import Organization
from app.database.models.training import EmployeeKnowledgeSource
from app.integrations import sarvam
from app.modules import audit, billing
from app.modules.common import as_dict, scoped
from app.schemas.employee import (
    EmployeeActionIn,
    EmployeeCreate,
    EmployeeDetail,
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
    return [EmployeeOut.model_validate(row) for row in rows], total


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
    return employee


def update_employee(
    db: Session, employee: Employee, payload: EmployeeUpdate, *, user_id: str | None
) -> Employee:
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    languages = data.pop("languages", None)
    change_note = data.pop("change_note", None)

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
    """Soft delete: keeps call history and audit references intact."""
    employee.status = str(EmployeeStatus.ARCHIVED)
    employee.is_active = False
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
# Internals
# ---------------------------------------------------------------------------
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
