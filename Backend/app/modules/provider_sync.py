"""Background synchronisation between OWN AI and a voice provider.

The employee lifecycle in ``app.modules.employees`` answers "is this employee on
the phone?" synchronously. This module is the other half: a *ledger* for the work
that has to reach a provider, so a slow or failing platform call never blocks a
request and never disappears.

Five rules shape the file.

1. **A job is a row, not a message.** Celery is the trigger, but the job table is
   the truth: status, attempt count and the moment of the next attempt all live in
   ``provider_sync_jobs``. A lost or redelivered message therefore changes
   nothing - the claim is a conditional update, so an attempt happens once.
2. **Only a proven capability may be queued.** The provider matrix from
   ``app.integrations.voice_provider`` is consulted before a row is written, and
   consulted again when the attempt runs. An unverified operation is refused with
   a 501 or recorded as ``blocked``. It is never turned into a success.
3. **Retries are scheduled here, not by Celery.** ``next_retry_at`` is the retry
   clock: ``execute_job`` records the failure and the wait, and returns rather
   than raising, so the broker is never the thing that decides when to try
   again. A redelivered message is defused by the claim instead of prevented.
4. **Every attempt leaves a log line.** ``provider_sync_logs`` is append-only and
   is where an operator reconstructs what happened to a job, including an attempt
   whose worker died before it could report.
5. **The payload is a fingerprint, not data.** Nothing a provider call needs is
   stored: credentials, prompts, transcripts and phone numbers are read back from
   the database at execution time. A job row carries a hash of the intent, which
   is all idempotency needs and all a leak could expose.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from types import MappingProxyType
from typing import Any, Final

from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError, ConflictError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.database.base import utcnow
from app.database.models import (
    Employee,
    EmployeeAgentBinding,
    ProviderSyncJob,
    ProviderSyncLog,
)
from app.integrations import ProviderResponse, sanitize
from app.integrations.voice_provider import (
    PROVIDER_CODE,
    CapabilityReport,
    VoiceCapability,
    VoiceProvider,
    get_voice_provider,
)

logger = get_logger(__name__)

# -- Job statuses ----------------------------------------------------------
JOB_PENDING = "pending"
JOB_RUNNING = "running"
JOB_SUCCEEDED = "succeeded"
JOB_FAILED = "failed"
JOB_DEAD_LETTER = "dead_letter"
#: Not a failure and not a retry: the operation cannot be performed at all
#: (missing capability, unconfigured provider, no deployment to act on).
JOB_BLOCKED = "blocked"

#: States a claim may take over. ``running`` is included on purpose so a worker
#: that died mid-attempt can be reclaimed once its lease has expired.
OPEN_STATES: Final[tuple[str, ...]] = (JOB_PENDING, JOB_FAILED, JOB_RUNNING)
#: States nothing may revive automatically.
FINISHED_STATES: Final[tuple[str, ...]] = (JOB_SUCCEEDED, JOB_DEAD_LETTER, JOB_BLOCKED)

# -- Retry policy ----------------------------------------------------------
DEFAULT_MAX_ATTEMPTS: Final = 5
BACKOFF_BASE_SECONDS: Final = 30
BACKOFF_MAX_SECONDS: Final = 3600
#: A claim older than this is considered abandoned. Slightly above the Celery
#: task time limit (15 min) so a slow-but-alive attempt is never stolen.
STALE_LEASE_SECONDS: Final = 900

MAX_ERROR_LENGTH: Final = 500
MAX_KEY_LENGTH: Final = 120

#: Operation -> the contract capability it needs. Kept as one table so a new
#: operation cannot be queued without naming the capability it depends on.
OPERATIONS: Final[Mapping[str, VoiceCapability]] = MappingProxyType(
    {
        "deploy": VoiceCapability.CREATE_DEPLOYMENT,
        "pause": VoiceCapability.PAUSE_DEPLOYMENT,
        "resume": VoiceCapability.RESUME_DEPLOYMENT,
        "delete_deployment": VoiceCapability.DELETE_DEPLOYMENT,
        # Declared so a caller gets "not available" instead of "unknown
        # operation"; all three are unverified for the current provider.
        "sync_configuration": VoiceCapability.CONFIGURE_AGENT,
        "commit_version": VoiceCapability.COMMIT_AGENT_VERSION,
        "list_agents": VoiceCapability.LIST_AGENTS,
    }
)

#: The only fields a job may carry. Everything else a provider call needs is
#: read from the database, so a caller cannot smuggle a credential, a prompt or
#: a transcript into the ledger - and a payload hash cannot be used to probe it.
ALLOWED_PAYLOAD_KEYS: Final[frozenset[str]] = frozenset(
    {"action", "agent_version", "content_hash", "reason", "requested_by"}
)


@dataclass(frozen=True, slots=True)
class EnqueueResult:
    """``created`` is False when an equivalent job already existed."""

    job: ProviderSyncJob
    created: bool


@dataclass(frozen=True, slots=True)
class JobOutcome:
    """What one attempt left behind."""

    job_id: str
    status: str
    attempt: int
    error_code: str | None = None
    next_retry_at: datetime | None = None
    #: True only when a provider really answered.
    provider_contacted: bool = False


# ---------------------------------------------------------------------------
# Queueing
# ---------------------------------------------------------------------------
def create_job(
    db: Session,
    organization_id: str,
    *,
    operation: str,
    employee_id: str | None = None,
    payload: Mapping[str, Any] | None = None,
    idempotency_key: str | None = None,
    correlation_id: str | None = None,
    provider: str = PROVIDER_CODE,
) -> EnqueueResult:
    """Queue a provider operation once, for a capability that is proven.

    Idempotency is enforced twice: the derived key (operation + employee +
    payload fingerprint) catches a second click, and the unique constraint on
    ``(organization_id, idempotency_key)`` catches two requests racing. Both
    paths return the existing row instead of a second one, so an importer
    retried by a queue cannot create two deployments - and two numbers.
    """
    capability = capability_for(operation)
    get_voice_provider(provider).capabilities().raise_if_missing(capability)

    _employee_in_tenant(db, organization_id, employee_id)
    fingerprint = payload_fingerprint(payload)
    key = _idempotency_key(operation, employee_id, fingerprint, idempotency_key)

    existing = _by_key(db, organization_id, key)
    if existing is not None:
        _log(
            db,
            existing,
            status="skipped",
            error_code="duplicate",
            message="An equivalent job is already queued; that one is reused.",
        )
        db.commit()
        return EnqueueResult(existing, False)

    job = ProviderSyncJob(
        organization_id=organization_id,
        employee_id=employee_id,
        provider=provider,
        operation=operation,
        idempotency_key=key,
        payload_hash=fingerprint,
        correlation_id=(correlation_id or uuid.uuid4().hex)[:64],
        status=JOB_PENDING,
        attempt_count=0,
    )
    db.add(job)
    try:
        db.flush()
    except IntegrityError:
        # A concurrent request won the race. Its row is the job.
        db.rollback()
        existing = _by_key(db, organization_id, key)
        if existing is None:  # pragma: no cover - the constraint fired for another reason
            raise
        return EnqueueResult(existing, False)

    _log(db, job, status=JOB_PENDING, message="Queued.")
    db.commit()
    db.refresh(job)
    logger.info(
        "provider_sync_queued",
        extra={
            "job_id": job.id,
            "operation": job.operation,
            "correlation_id": job.correlation_id,
        },
    )
    return EnqueueResult(job, True)


def retry_job(
    db: Session,
    organization_id: str,
    job_id: str,
    *,
    now: datetime | None = None,
) -> ProviderSyncJob:
    """Re-open a finished job after a human fixed the reason it stopped.

    Only a job that is not in flight may be reopened; its history stays in
    ``provider_sync_logs``, which is why the attempt counter can restart at zero
    without losing anything.
    """
    job = get_job(db, organization_id, job_id)
    if job.status not in FINISHED_STATES:
        raise ConflictError(
            "That job is still in flight.",
            details={"job_id": job.id, "status": job.status},
        )

    job.status = JOB_PENDING
    job.attempt_count = 0
    job.next_retry_at = None
    job.completed_at = None
    job.started_at = None
    job.last_error = None
    job.last_error_code = None
    _log(db, job, status=JOB_PENDING, message="Re-opened for another attempt.")
    db.commit()
    db.refresh(job)
    return job


def capability_for(operation: str) -> VoiceCapability:
    """The contract capability an operation needs, or a 422."""
    capability = OPERATIONS.get(operation)
    if capability is None:
        raise ValidationError(
            "That synchronisation operation is not supported.",
            details={"operation": operation, "supported": sorted(OPERATIONS)},
        )
    return capability


def payload_fingerprint(payload: Mapping[str, Any] | None) -> str | None:
    """Hash the intent of a job; refuse anything that is not intent.

    A provider call is rebuilt from the database, so the payload exists only to
    make retries distinguishable. Rejecting unknown keys here is what keeps a
    credential or a transcript from being written into the ledger.
    """
    if not payload:
        return None

    unexpected = sorted(set(payload) - ALLOWED_PAYLOAD_KEYS)
    if unexpected:
        raise ValidationError(
            "A sync job may only carry the fields that describe the request.",
            details={"unsupported_fields": unexpected},
        )

    canonical = json.dumps(
        dict(payload), sort_keys=True, separators=(",", ":"), default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def backoff_delay(attempt: int) -> int:
    """Seconds to wait after ``attempt`` failed: 30, 60, 120, 240, then capped."""
    exponent = max(1, int(attempt)) - 1
    return min(BACKOFF_BASE_SECONDS * (2**exponent), BACKOFF_MAX_SECONDS)


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------
def get_job(db: Session, organization_id: str, job_id: str) -> ProviderSyncJob:
    """One job, scoped to its tenant.

    A job id from another organization is reported as missing rather than
    forbidden: an id that exists elsewhere must not be confirmed to exist.
    """
    job = db.execute(
        select(ProviderSyncJob).where(
            ProviderSyncJob.id == job_id,
            ProviderSyncJob.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if job is None:
        raise NotFoundError(
            "That synchronisation job was not found.", details={"job_id": job_id}
        )
    return job


def list_jobs(
    db: Session,
    organization_id: str,
    *,
    status: str | None = None,
    employee_id: str | None = None,
    limit: int = 100,
) -> list[ProviderSyncJob]:
    """The organisation's own jobs, newest first."""
    query = select(ProviderSyncJob).where(
        ProviderSyncJob.organization_id == organization_id
    )
    if status:
        query = query.where(ProviderSyncJob.status == status)
    if employee_id:
        query = query.where(ProviderSyncJob.employee_id == employee_id)

    return list(
        db.execute(
            query.order_by(ProviderSyncJob.created_at.desc()).limit(_limit(limit))
        ).scalars()
    )


def list_logs(
    db: Session,
    organization_id: str,
    *,
    correlation_id: str | None = None,
    employee_id: str | None = None,
    limit: int = 200,
) -> list[ProviderSyncLog]:
    """The audit trail, oldest first.

    ``correlation_id`` is the join back from a log line to a job: the log table
    records history and deliberately carries no foreign key to mutable state.
    """
    query = select(ProviderSyncLog).where(
        ProviderSyncLog.organization_id == organization_id
    )
    if correlation_id:
        query = query.where(ProviderSyncLog.correlation_id == correlation_id)
    if employee_id:
        query = query.where(ProviderSyncLog.employee_id == employee_id)

    return list(
        db.execute(
            query.order_by(ProviderSyncLog.created_at.asc()).limit(_limit(limit))
        ).scalars()
    )


def due_jobs(
    db: Session, *, now: datetime | None = None, limit: int = 50
) -> list[str]:
    """Ids that may be attempted right now, including abandoned claims."""
    now = now or utcnow()
    return list(
        db.execute(
            select(ProviderSyncJob.id)
            .where(_claimable(now))
            .order_by(ProviderSyncJob.created_at.asc())
            .limit(_limit(limit))
        ).scalars()
    )


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------
def claim_job(
    db: Session, job_id: str, *, now: datetime | None = None
) -> ProviderSyncJob | None:
    """Take ownership of one attempt, or return None.

    The check is a single conditional ``UPDATE``: two workers racing for the same
    job produce one ``rowcount == 1`` and one zero. Doing it as read-then-write
    would let both proceed and buy two deployments.
    """
    now = now or utcnow()
    result = db.execute(
        update(ProviderSyncJob)
        .where(ProviderSyncJob.id == job_id, _claimable(now))
        .values(
            status=JOB_RUNNING,
            attempt_count=ProviderSyncJob.attempt_count + 1,
            started_at=now,
            next_retry_at=None,
            completed_at=None,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        return None

    db.commit()
    db.expire_all()
    return db.get(ProviderSyncJob, job_id)


def execute_job(
    db: Session,
    job_id: str,
    *,
    provider: VoiceProvider | None = None,
    now: datetime | None = None,
    correlation_id: str | None = None,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> JobOutcome:
    """Run at most one attempt of one job.

    Returns the resulting state. A provider failure is recorded, not raised:
    the job row is the retry clock and the worker has nothing to add. Anything
    that escapes is a failure to write the ledger, which is the one thing worth
    letting the broker retry.
    """
    now = now or utcnow()
    current = db.get(ProviderSyncJob, job_id)
    if current is None:
        return JobOutcome(job_id=job_id, status="missing", attempt=0)

    job = claim_job(db, job_id, now=now)
    if job is None:
        # Someone else owns it, it is not due yet, or it already finished.
        return JobOutcome(
            job_id=job_id,
            status=current.status,
            attempt=current.attempt_count,
            error_code=current.last_error_code,
            next_retry_at=current.next_retry_at,
        )

    attempt = job.attempt_count
    _log(
        db,
        job,
        status=JOB_PENDING,
        message=f"Attempt {attempt} started.",
        correlation_id=correlation_id,
    )
    db.commit()

    provider = provider or get_voice_provider(job.provider)

    try:
        if not _capability_is_proven(provider, job):
            return _block(
                db,
                job,
                "capability_unavailable",
                f"{job.operation} is not available for this provider; nothing was sent.",
                now,
            )

        if not provider.configured():
            return _block(
                db,
                job,
                "provider_not_configured",
                "The voice provider is not configured, so this job waits instead of "
                "pretending it ran.",
                now,
            )

        employee = _employee_in_tenant(db, job.organization_id, job.employee_id)
        response = _perform(db, job, employee, provider)

    except AppError as exc:
        # A refused request (no deployment to pause, tenant mismatch, ...) will
        # not start working on its own, so it is blocked rather than retried.
        return _block(db, job, exc.code, exc.message, now)
    except Exception as exc:  # noqa: BLE001 - an unexpected fault is still an attempt
        return _fail(
            db, job, attempt, "unexpected_error", str(exc), now, max_attempts=max_attempts
        )

    if response.ok:
        return _finish_succeeded(db, job, employee, response, now)

    if response.status_code in (401, 403):
        return _block(
            db,
            job,
            "provider_not_configured",
            "The voice platform rejected the workspace credential; replace the key "
            "and re-open this job.",
            now,
        )

    return _fail(
        db,
        job,
        attempt,
        "provider_error",
        response.error or "The voice provider rejected the request.",
        now,
        max_attempts=max_attempts,
    )


def _perform(
    db: Session, job: ProviderSyncJob, employee: Employee | None, provider: VoiceProvider
) -> ProviderResponse:
    """Turn a job row back into the provider call it describes.

    Arguments come from the employee and its binding, never from the job: the
    ledger stores intent, and the values a live call needs must be the ones a
    human can see in the product today.
    """
    if job.operation == "deploy":
        if employee is None:
            raise ValidationError("A deployment job needs an employee.")
        binding = _ensure_binding(db, employee)
        return provider.create_deployment(
            agent_id=binding.app_id or settings.sarvam_agent_app_id,
            agent_version=int(binding.app_version or settings.sarvam_agent_app_version),
            name=employee.name,
            connection_id=settings.sarvam_connection_id,
            phone_number=settings.sarvam_agent_phone_number,
            description=(employee.description or employee.purpose or None),
        )

    if employee is None:
        raise ValidationError("This job needs an employee.")

    binding = _existing_binding(db, employee)
    deployment_id = binding.deployment_id if binding is not None else None
    if not deployment_id:
        raise ValidationError(
            f"'{employee.name}' has no deployment yet, so there is nothing to "
            f"{job.operation.replace('_', ' ')}.",
            code="no_deployment",
            details={"employee_id": employee.id},
        )

    if job.operation == "pause":
        return provider.pause_deployment(deployment_id)
    if job.operation == "resume":
        return provider.resume_deployment(deployment_id)
    if job.operation == "delete_deployment":
        return provider.delete_deployment(deployment_id)

    raise ValidationError(
        "That synchronisation operation has no executor.",
        details={"operation": job.operation},
    )


def _finish_succeeded(
    db: Session,
    job: ProviderSyncJob,
    employee: Employee | None,
    response: ProviderResponse,
    now: datetime,
) -> JobOutcome:
    if response.simulated:
        # The gate above means this should not happen, but a simulated answer is
        # not a sync. Recording it as a success would be the exact lie the
        # capability matrix exists to prevent.
        return _block(
            db,
            job,
            "provider_not_configured",
            "The provider answered in simulation mode; nothing reached the platform.",
            now,
        )

    _apply_result(db, job, employee, response)

    job.status = JOB_SUCCEEDED
    job.completed_at = now
    job.next_retry_at = None
    job.last_error = None
    job.last_error_code = None
    _log(db, job, status=JOB_SUCCEEDED, message="The provider confirmed the change.")
    db.commit()
    logger.info(
        "provider_sync_succeeded",
        extra={
            "job_id": job.id,
            "operation": job.operation,
            "attempt": job.attempt_count,
            "correlation_id": job.correlation_id,
        },
    )
    return JobOutcome(
        job_id=job.id,
        status=JOB_SUCCEEDED,
        attempt=job.attempt_count,
        provider_contacted=True,
    )


def _apply_result(
    db: Session,
    job: ProviderSyncJob,
    employee: Employee | None,
    response: ProviderResponse,
) -> None:
    """Write the provider's own answer onto the link it describes.

    Only values the provider returned are stored. A missing external id stays
    missing: the row would otherwise claim a deployment that does not exist.
    """
    if employee is None:
        return

    if job.operation == "delete_deployment":
        binding = _existing_binding(db, employee)
        if binding is not None:
            db.delete(binding)
        employee.calling_enabled = False
        employee.calling_status = "not_configured"
        return

    binding = _ensure_binding(db, employee)
    binding.synced_at = utcnow()
    binding.last_error = None
    binding.simulated = False

    if job.operation == "deploy":
        external = str(response.data.get("deployment_id") or "").strip()
        if external:
            binding.deployment_id = external
        binding.app_id = str(response.data.get("app_id") or binding.app_id or "") or None
        binding.app_version = int(
            response.data.get("app_version") or binding.app_version or 1
        )
        binding.status = "active"
        binding.external_agent_name = (employee.name or "")[:120] or None
    elif job.operation == "pause":
        binding.status = "paused"
    elif job.operation == "resume":
        binding.status = "active"
    else:  # pragma: no cover - guarded by _perform
        return

    binding.sync_status = "in_sync"


def _fail(
    db: Session,
    job: ProviderSyncJob,
    attempt: int,
    error_code: str,
    message: str,
    now: datetime,
    *,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> JobOutcome:
    """Record a failed attempt and schedule the next one, or give up."""
    clean = sanitize(message)[:MAX_ERROR_LENGTH]
    job.last_error_code = error_code[:64]
    job.last_error = clean

    if attempt < max_attempts:
        job.status = JOB_FAILED
        job.next_retry_at = now + timedelta(seconds=backoff_delay(attempt))
        _log(db, job, status=JOB_FAILED, error_code=error_code, message=clean)
        db.commit()
        return JobOutcome(
            job_id=job.id,
            status=JOB_FAILED,
            attempt=attempt,
            error_code=error_code,
            next_retry_at=job.next_retry_at,
        )

    # Out of attempts: keep the job, stop the clock. The row is the only record
    # that the work never happened, so it is never deleted or retried silently.
    job.status = JOB_DEAD_LETTER
    job.completed_at = now
    job.next_retry_at = None
    _log(
        db,
        job,
        status=JOB_FAILED,
        error_code=error_code,
        message=f"Dead-lettered after {attempt} attempt(s): {clean}",
    )
    db.commit()
    logger.warning(
        "provider_sync_dead_letter",
        extra={
            "job_id": job.id,
            "operation": job.operation,
            "attempt": attempt,
            "error_code": error_code,
        },
    )
    return JobOutcome(
        job_id=job.id,
        status=JOB_DEAD_LETTER,
        attempt=attempt,
        error_code=error_code,
    )


def _block(
    db: Session, job: ProviderSyncJob, error_code: str, message: str, now: datetime
) -> JobOutcome:
    """Stop a job that cannot succeed by waiting."""
    clean = sanitize(message)[:MAX_ERROR_LENGTH]
    job.status = JOB_BLOCKED
    job.completed_at = now
    job.next_retry_at = None
    job.last_error_code = error_code[:64]
    job.last_error = clean
    _log(db, job, status="skipped", error_code=error_code, message=clean)
    db.commit()
    logger.info(
        "provider_sync_blocked",
        extra={"job_id": job.id, "operation": job.operation, "error_code": error_code},
    )
    return JobOutcome(
        job_id=job.id,
        status=JOB_BLOCKED,
        attempt=job.attempt_count,
        error_code=error_code,
    )


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _claimable(now: datetime):
    """The predicate that decides whether an attempt may start right now."""
    stale_before = now - timedelta(seconds=STALE_LEASE_SECONDS)
    return and_(
        or_(
            ProviderSyncJob.status.in_((JOB_PENDING, JOB_FAILED)),
            and_(
                ProviderSyncJob.status == JOB_RUNNING,
                ProviderSyncJob.started_at.is_not(None),
                ProviderSyncJob.started_at < stale_before,
            ),
        ),
        or_(
            ProviderSyncJob.next_retry_at.is_(None),
            ProviderSyncJob.next_retry_at <= now,
        ),
    )


def _capability_is_proven(provider: VoiceProvider, job: ProviderSyncJob) -> bool:
    """Re-check the matrix at execution time, not only at queue time.

    A job queued before a provider downgrade must not run against an operation
    that is no longer proven.
    """
    report: CapabilityReport = provider.capabilities()
    capability = OPERATIONS.get(job.operation)
    return capability is not None and report.supports(capability)


def _employee_in_tenant(
    db: Session, organization_id: str, employee_id: str | None
) -> Employee | None:
    """The employee, if it belongs to this job's tenant.

    The organization is part of the lookup rather than checked afterwards, so a
    job can never act on another tenant's employee - even one written directly
    into the table.
    """
    if employee_id is None:
        return None
    employee = db.get(Employee, employee_id)
    if employee is None or employee.organization_id != organization_id:
        raise NotFoundError(
            "That AI employee was not found.", details={"employee_id": employee_id}
        )
    return employee


def _existing_binding(
    db: Session, employee: Employee
) -> EmployeeAgentBinding | None:
    return db.execute(
        select(EmployeeAgentBinding).where(
            EmployeeAgentBinding.employee_id == employee.id
        )
    ).scalar_one_or_none()


def _ensure_binding(db: Session, employee: Employee) -> EmployeeAgentBinding:
    binding = _existing_binding(db, employee)
    if binding is None:
        binding = EmployeeAgentBinding(
            organization_id=employee.organization_id,
            employee_id=employee.id,
            provider=PROVIDER_CODE,
            status="pending",
        )
        db.add(binding)
        db.flush()
    return binding


def _by_key(
    db: Session, organization_id: str, key: str
) -> ProviderSyncJob | None:
    return db.execute(
        select(ProviderSyncJob).where(
            ProviderSyncJob.organization_id == organization_id,
            ProviderSyncJob.idempotency_key == key,
        )
    ).scalar_one_or_none()


def _idempotency_key(
    operation: str,
    employee_id: str | None,
    fingerprint: str | None,
    supplied: str | None,
) -> str:
    """Caller-supplied key, or one derived from what the job would do.

    The derived form is what makes "press enable twice" produce one job: same
    operation, same employee, same payload means the same key.
    """
    if supplied:
        return supplied[:MAX_KEY_LENGTH]
    parts = (operation, employee_id or "organization", fingerprint or "fixed")
    return ":".join(parts)[:MAX_KEY_LENGTH]


def _log(
    db: Session,
    job: ProviderSyncJob,
    *,
    status: str,
    error_code: str | None = None,
    message: str | None = None,
    correlation_id: str | None = None,
) -> ProviderSyncLog:
    """Append one line of history. Never updated, never deleted."""
    entry = ProviderSyncLog(
        organization_id=job.organization_id,
        employee_id=job.employee_id,
        provider=job.provider,
        operation=job.operation,
        status=status,
        error_code=(error_code or None) and error_code[:64],
        sanitized_message=(message or None) and sanitize(message)[:MAX_ERROR_LENGTH],
        correlation_id=(correlation_id or job.correlation_id or None),
    )
    db.add(entry)
    return entry


def _limit(value: int) -> int:
    return max(1, min(int(value), 500))


__all__ = [
    "ALLOWED_PAYLOAD_KEYS",
    "BACKOFF_BASE_SECONDS",
    "BACKOFF_MAX_SECONDS",
    "DEFAULT_MAX_ATTEMPTS",
    "EnqueueResult",
    "FINISHED_STATES",
    "JOB_BLOCKED",
    "JOB_DEAD_LETTER",
    "JOB_FAILED",
    "JOB_PENDING",
    "JOB_RUNNING",
    "JOB_SUCCEEDED",
    "JobOutcome",
    "OPERATIONS",
    "OPEN_STATES",
    "STALE_LEASE_SECONDS",
    "backoff_delay",
    "capability_for",
    "claim_job",
    "create_job",
    "due_jobs",
    "execute_job",
    "get_job",
    "list_jobs",
    "list_logs",
    "payload_fingerprint",
    "retry_job",
]
