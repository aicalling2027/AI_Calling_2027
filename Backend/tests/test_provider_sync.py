"""Background provider synchronisation.

Nothing in the product queues a job yet, so these tests are the only callers.
That is also what lets them assert the rules without a provider: one job per
intent, one attempt per claim, a real dead letter at the end, and an unverified
capability that stops at "blocked" instead of inventing a success.

Every provider here is a fake held in memory. No test reaches Sarvam, which is
also why the unconfigured-provider test matters: it proves the executor refuses
before a request could be made.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.exceptions import (
    NotFoundError,
    ProviderCapabilityMissing,
    ValidationError,
)
from app.database.base import utcnow
from app.database.models import (
    Employee,
    EmployeeAgentBinding,
    Organization,
    ProviderSyncJob,
    ProviderSyncLog,
)
from app.database.models.billing import SubscriptionPlan
from app.database.session import SessionLocal
from app.integrations import ProviderResponse
from app.integrations.voice_provider import CapabilityReport, get_voice_provider
from app.modules import billing, provider_sync
from app.workers import tasks
from tests.conftest import API, unique


# ---------------------------------------------------------------------------
# A provider that answers from memory
# ---------------------------------------------------------------------------
class FakeProvider:
    """Implements the calls a job can make, and records them.

    Capabilities come from the real matrix: these tests are about the executor,
    not about pretending a capability exists.
    """

    code = "sarvam-voice-agents"

    def __init__(
        self,
        *,
        ok: bool = True,
        configured: bool = True,
        simulated: bool = False,
        error: str | None = None,
        status_code: int | None = None,
    ) -> None:
        self.ok = ok
        self.is_configured = configured
        self.simulated = simulated
        self.error = error
        self.status_code = status_code
        self.calls: list[tuple[str, str]] = []

    # -- Introspection -----------------------------------------------------
    def capabilities(self) -> CapabilityReport:
        return get_voice_provider().capabilities()

    def configured(self) -> bool:
        return self.is_configured

    def missing_settings(self) -> list[str]:
        return [] if self.is_configured else ["SARVAM_AGENTS_API_KEY"]

    # -- Operations --------------------------------------------------------
    def create_deployment(
        self,
        *,
        agent_id: str,
        agent_version: int,
        name: str,
        connection_id: str,
        phone_number: str,
        description: str | None = None,
    ) -> ProviderResponse:
        self.calls.append(("create_deployment", agent_id))
        return self._respond(
            {
                "deployment_id": "dep-fake-1",
                "app_id": agent_id,
                "app_version": agent_version,
            }
        )

    def pause_deployment(self, deployment_id: str) -> ProviderResponse:
        self.calls.append(("pause_deployment", deployment_id))
        return self._respond()

    def resume_deployment(self, deployment_id: str) -> ProviderResponse:
        self.calls.append(("resume_deployment", deployment_id))
        return self._respond()

    def delete_deployment(self, deployment_id: str) -> ProviderResponse:
        self.calls.append(("delete_deployment", deployment_id))
        return self._respond({"deleted": True})

    def _respond(self, data: dict | None = None) -> ProviderResponse:
        if not self.ok:
            return ProviderResponse(
                ok=False,
                error=self.error or "The provider refused the request.",
                status_code=self.status_code,
            )
        return ProviderResponse(ok=True, data=dict(data or {}), simulated=self.simulated)


# ---------------------------------------------------------------------------
# Fixtures and helpers
# ---------------------------------------------------------------------------
def _plan_of(employee: dict) -> tuple[str, int]:
    with SessionLocal() as db:
        organization_id = db.get(Employee, employee["id"]).organization_id
        subscription = billing.ensure_subscription(db, organization_id)
        plan = db.get(SubscriptionPlan, subscription.plan_id)
        return plan.id, plan.max_employees


def _set_max_employees(plan_id: str, limit: int) -> None:
    with SessionLocal() as db:
        db.get(SubscriptionPlan, plan_id).max_employees = limit
        db.commit()


@pytest.fixture(scope="module")
def sync_employee(client, auth, employee: dict) -> dict:
    """One employee for the whole file, with the trial seat cap lifted."""
    plan_id, original = _plan_of(employee)
    _set_max_employees(plan_id, 20)

    response = client.post(
        f"{API}/employees",
        headers=auth,
        json={
            "name": unique("Sync agent"),
            "business_category": "Education",
            "default_language": "en-IN",
            "voice": "shubh",
            "first_message": "Hello, how can I help?",
            "system_prompt": "You are a helpful admissions counsellor.",
        },
    )
    assert response.status_code == 201, response.text
    row = response.json()
    try:
        yield row
    finally:
        client.delete(f"{API}/employees/{row['id']}", headers=auth)
        _set_max_employees(plan_id, original)


def _org_of(employee_id: str) -> str:
    with SessionLocal() as db:
        return db.get(Employee, employee_id).organization_id


def _bind(employee_id: str, *, deployment_id: str = "dep-existing") -> None:
    """Give the employee a deployment to act on."""
    with SessionLocal() as db:
        employee = db.get(Employee, employee_id)
        binding = db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.employee_id == employee_id
            )
        ).scalar_one_or_none()
        if binding is None:
            binding = EmployeeAgentBinding(
                organization_id=employee.organization_id,
                employee_id=employee_id,
                provider=provider_sync.PROVIDER_CODE,
                status="active",
            )
            db.add(binding)
        binding.deployment_id = deployment_id
        binding.status = "active"
        binding.simulated = False
        db.commit()


def _binding_of(employee_id: str) -> EmployeeAgentBinding | None:
    with SessionLocal() as db:
        return db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.employee_id == employee_id
            )
        ).scalar_one_or_none()


def _queue(
    operation: str,
    employee_id: str,
    *,
    payload: dict | None = None,
    key: str | None = None,
) -> tuple[str, bool]:
    """Queue an operation with its own key.

    Tests that are not about idempotency use a fresh key, otherwise the first job
    for an employee would swallow every later one for the same operation. The
    two tests that are about idempotency call ``create_job`` raw.
    """
    with SessionLocal() as db:
        result = provider_sync.create_job(
            db,
            _org_of(employee_id),
            operation=operation,
            employee_id=employee_id,
            payload=payload,
            idempotency_key=key or f"test:{uuid_suffix()}",
        )
        return result.job.id, result.created


def _job(job_id: str) -> ProviderSyncJob:
    with SessionLocal() as db:
        return db.get(ProviderSyncJob, job_id)


def _logs(job_id: str) -> list[ProviderSyncLog]:
    job = _job(job_id)
    with SessionLocal() as db:
        return provider_sync.list_logs(
            db, job.organization_id, correlation_id=job.correlation_id, limit=100
        )


def _run(
    job_id: str,
    provider: FakeProvider | None = None,
    *,
    now=None,
    max_attempts: int = provider_sync.DEFAULT_MAX_ATTEMPTS,
) -> provider_sync.JobOutcome:
    with SessionLocal() as db:
        return provider_sync.execute_job(
            db, job_id, provider=provider, now=now, max_attempts=max_attempts
        )


def _force_job(organization_id: str, employee_id: str, operation: str) -> str:
    """Write a job straight into the table, bypassing the queue-time checks.

    Used to prove the executor re-checks what the queue already refused.
    """
    with SessionLocal() as db:
        job = ProviderSyncJob(
            organization_id=organization_id,
            employee_id=employee_id,
            provider=provider_sync.PROVIDER_CODE,
            operation=operation,
            idempotency_key=f"forced:{uuid_suffix()}",
            correlation_id=f"forced-{uuid_suffix()}",
            status=provider_sync.JOB_PENDING,
            attempt_count=0,
        )
        db.add(job)
        db.commit()
        return job.id


def uuid_suffix() -> str:
    import uuid

    return uuid.uuid4().hex[:8]


# ---------------------------------------------------------------------------
# Queueing and idempotency
# ---------------------------------------------------------------------------
def test_queueing_records_intent_and_a_correlation_id(sync_employee):
    job_id, created = _queue("pause", sync_employee["id"])

    job = _job(job_id)
    assert created is True
    assert job.status == provider_sync.JOB_PENDING
    assert job.attempt_count == 0
    assert job.correlation_id
    assert job.next_retry_at is None

    logs = _logs(job_id)
    assert [entry.status for entry in logs] == [provider_sync.JOB_PENDING]
    assert logs[0].correlation_id == job.correlation_id


def test_the_same_intent_twice_reuses_one_job(sync_employee):
    organization_id = _org_of(sync_employee["id"])
    with SessionLocal() as db:
        first = provider_sync.create_job(
            db, organization_id, operation="pause", employee_id=sync_employee["id"]
        )
    with SessionLocal() as db:
        second = provider_sync.create_job(
            db, organization_id, operation="pause", employee_id=sync_employee["id"]
        )

    assert first.created is True
    assert second.created is False
    assert second.job.id == first.job.id

    with SessionLocal() as db:
        rows = db.execute(
            select(ProviderSyncJob).where(
                ProviderSyncJob.id == first.job.id,
            )
        ).scalars().all()
    assert len(rows) == 1

    # The second click is recorded rather than silently dropped.
    duplicate = [
        entry for entry in _logs(first.job.id) if entry.error_code == "duplicate"
    ]
    assert len(duplicate) == 1


def test_a_job_is_attempted_once_even_if_it_is_dispatched_twice(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])
    provider = FakeProvider()

    first = _run(job_id, provider)
    second = _run(job_id, provider)

    assert first.status == provider_sync.JOB_SUCCEEDED
    assert provider.calls == [("pause_deployment", "dep-existing")]
    assert second.attempt == 1
    assert _job(job_id).attempt_count == 1


def test_a_different_payload_is_a_different_job(sync_employee):
    """Intent still separates two jobs; only identical intent collapses."""
    organization_id = _org_of(sync_employee["id"])
    with SessionLocal() as db:
        first = provider_sync.create_job(
            db,
            organization_id,
            operation="pause",
            employee_id=sync_employee["id"],
            payload={"reason": "manual"},
        )
    with SessionLocal() as db:
        second = provider_sync.create_job(
            db,
            organization_id,
            operation="pause",
            employee_id=sync_employee["id"],
            payload={"reason": "archive"},
        )

    assert first.created and second.created
    assert first.job.id != second.job.id


def test_a_payload_may_not_carry_a_credential(sync_employee):
    def hashed_jobs() -> int:
        with SessionLocal() as db:
            return len(
                db.execute(
                    select(ProviderSyncJob).where(
                        ProviderSyncJob.employee_id == sync_employee["id"],
                        ProviderSyncJob.payload_hash.is_not(None),
                    )
                ).scalars().all()
            )

    before = hashed_jobs()
    with pytest.raises(ValidationError) as exc:
        _queue("pause", sync_employee["id"], payload={"api_key": "sk_live_secret"})

    assert exc.value.details["unsupported_fields"] == ["api_key"]
    assert hashed_jobs() == before


def test_an_allowed_payload_is_hashed_not_stored(sync_employee):
    job_id, _ = _queue(
        "pause", sync_employee["id"], payload={"reason": "manual"}, key="hash-check"
    )

    job = _job(job_id)
    assert job.payload_hash is not None
    assert len(job.payload_hash) == 64
    # Nothing a caller typed survives in the row.
    assert "manual" not in str(job.to_dict())


# ---------------------------------------------------------------------------
# Retries and dead letters
# ---------------------------------------------------------------------------
def test_a_failure_schedules_an_exponential_backoff(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])
    provider = FakeProvider(ok=False, error="(500) The call router is unreachable.")
    started = utcnow()

    first = _run(job_id, provider, now=started)
    assert first.status == provider_sync.JOB_FAILED
    assert first.attempt == 1
    assert first.next_retry_at is not None
    assert abs((first.next_retry_at - started).total_seconds() - 30) < 1

    # A message that arrives early must not burn an attempt.
    early = _run(job_id, provider, now=started + timedelta(seconds=10))
    assert early.attempt == 1
    assert len(provider.calls) == 1

    second = _run(job_id, provider, now=started + timedelta(seconds=30))
    assert second.attempt == 2
    assert second.next_retry_at is not None
    assert abs((second.next_retry_at - started).total_seconds() - 90) < 1


def test_a_job_that_keeps_failing_is_dead_lettered(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])
    provider = FakeProvider(ok=False, error="(500) Still down.")
    now = utcnow()

    outcome = None
    for _ in range(provider_sync.DEFAULT_MAX_ATTEMPTS):
        outcome = _run(job_id, provider, now=now)
        now = outcome.next_retry_at or now

    assert outcome is not None
    assert outcome.status == provider_sync.JOB_DEAD_LETTER

    job = _job(job_id)
    assert job.status == provider_sync.JOB_DEAD_LETTER
    assert job.attempt_count == provider_sync.DEFAULT_MAX_ATTEMPTS
    assert job.next_retry_at is None
    assert job.completed_at is not None

    failures = [entry for entry in _logs(job_id) if entry.status == "failed"]
    assert len(failures) == provider_sync.DEFAULT_MAX_ATTEMPTS

    # Dead-lettered work is never picked up again on its own.
    with SessionLocal() as db:
        due = provider_sync.due_jobs(db, now=now + timedelta(days=1))
    assert job_id not in due


def test_a_dead_lettered_job_can_be_reopened(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])
    now = utcnow()

    for _ in range(2):
        outcome = _run(
            job_id,
            FakeProvider(ok=False, error="(500) Down."),
            now=now,
            max_attempts=2,
        )
        now = outcome.next_retry_at or now
    assert _job(job_id).status == provider_sync.JOB_DEAD_LETTER

    with SessionLocal() as db:
        reopened = provider_sync.retry_job(db, _org_of(sync_employee["id"]), job_id)
        assert reopened.status == provider_sync.JOB_PENDING
        assert reopened.attempt_count == 0
        assert reopened.next_retry_at is None

    result = _run(job_id, FakeProvider())
    assert result.status == provider_sync.JOB_SUCCEEDED


def test_an_error_message_is_sanitised_before_it_is_stored(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])
    leaked = "sk_live_9f8e7d6c5b4a"

    _run(
        job_id,
        FakeProvider(ok=False, error=f"(500) Rejected key {leaked}", status_code=500),
    )

    job = _job(job_id)
    assert leaked not in (job.last_error or "")
    assert "sk_***" in (job.last_error or "")
    assert all(leaked not in (entry.sanitized_message or "") for entry in _logs(job_id))


# ---------------------------------------------------------------------------
# Unavailable capabilities
# ---------------------------------------------------------------------------
def test_an_unverified_capability_cannot_be_queued(sync_employee):
    with pytest.raises(ProviderCapabilityMissing) as exc:
        with SessionLocal() as db:
            provider_sync.create_job(
                db,
                _org_of(sync_employee["id"]),
                operation="sync_configuration",
                employee_id=sync_employee["id"],
            )

    assert exc.value.status_code == 501
    assert exc.value.details["capability"] == "configure_agent"
    assert exc.value.details["state"] == "unverified"

    with SessionLocal() as db:
        assert (
            db.execute(
                select(ProviderSyncJob).where(
                    ProviderSyncJob.employee_id == sync_employee["id"],
                    ProviderSyncJob.operation == "sync_configuration",
                )
            ).scalar_one_or_none()
            is None
        )


def test_an_unknown_operation_is_refused(sync_employee):
    with pytest.raises(ValidationError):
        _queue("teleport_agent", sync_employee["id"])


def test_an_unavailable_job_blocks_instead_of_succeeding(sync_employee):
    """A row that got in somehow is re-checked at execution, then stopped."""
    job_id = _force_job(
        _org_of(sync_employee["id"]), sync_employee["id"], "sync_configuration"
    )
    provider = FakeProvider()

    outcome = _run(job_id, provider)

    assert outcome.status == provider_sync.JOB_BLOCKED
    assert outcome.error_code == "capability_unavailable"
    assert provider.calls == []
    assert _job(job_id).status == provider_sync.JOB_BLOCKED
    skipped = [entry for entry in _logs(job_id) if entry.status == "skipped"]
    assert skipped and skipped[-1].error_code == "capability_unavailable"


def test_an_unconfigured_provider_blocks_rather_than_faking_a_sync(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("deploy", sync_employee["id"])
    provider = FakeProvider(configured=False)

    outcome = _run(job_id, provider)

    assert outcome.status == provider_sync.JOB_BLOCKED
    assert outcome.error_code == "provider_not_configured"
    assert outcome.provider_contacted is False
    assert provider.calls == []
    assert _job(job_id).status == provider_sync.JOB_BLOCKED
    assert _binding_of(sync_employee["id"]).deployment_id == "dep-existing"


def test_a_simulated_answer_is_not_recorded_as_a_success(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("deploy", sync_employee["id"])

    outcome = _run(job_id, FakeProvider(simulated=True))

    assert outcome.status == provider_sync.JOB_BLOCKED
    assert outcome.error_code == "provider_not_configured"
    assert outcome.provider_contacted is False
    # No fabricated id: the link still points at what it pointed at before.
    assert _binding_of(sync_employee["id"]).deployment_id == "dep-existing"


def test_a_job_without_a_deployment_is_blocked_not_retried(sync_employee):
    job_id = _force_job(_org_of(sync_employee["id"]), sync_employee["id"], "resume")

    with SessionLocal() as db:
        binding = db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.employee_id == sync_employee["id"]
            )
        ).scalar_one_or_none()
        if binding is not None:
            db.delete(binding)
            db.commit()

    outcome = _run(job_id, FakeProvider())

    assert outcome.status == provider_sync.JOB_BLOCKED
    assert outcome.error_code == "no_deployment"
    assert outcome.next_retry_at is None


# ---------------------------------------------------------------------------
# A real answer
# ---------------------------------------------------------------------------
def test_a_proven_operation_writes_the_provider_answer_back(sync_employee):
    _bind(sync_employee["id"], deployment_id="dep-before")
    job_id, _ = _queue("deploy", sync_employee["id"])
    provider = FakeProvider()

    outcome = _run(job_id, provider)

    assert outcome.status == provider_sync.JOB_SUCCEEDED
    assert outcome.provider_contacted is True
    assert provider.calls and provider.calls[0][0] == "create_deployment"

    binding = _binding_of(sync_employee["id"])
    assert binding.deployment_id == "dep-fake-1"
    assert binding.status == "active"
    assert binding.sync_status == "in_sync"
    assert binding.last_error is None

    job = _job(job_id)
    assert job.status == provider_sync.JOB_SUCCEEDED
    assert job.completed_at is not None
    assert job.last_error_code is None
    assert [entry.status for entry in _logs(job_id)][-1] == provider_sync.JOB_SUCCEEDED


def test_a_rejected_credential_blocks_the_job(sync_employee):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])

    outcome = _run(
        job_id,
        FakeProvider(ok=False, error="(401) Unauthorized", status_code=401),
    )

    assert outcome.status == provider_sync.JOB_BLOCKED
    assert outcome.error_code == "provider_not_configured"


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def _other_organization() -> str:
    with SessionLocal() as db:
        suffix = uuid_suffix()
        organization = Organization(name=f"Other tenant {suffix}", slug=f"other-{suffix}")
        db.add(organization)
        db.commit()
        return organization.id


def test_jobs_are_invisible_to_another_organization(sync_employee):
    own_org = _org_of(sync_employee["id"])
    other_org = _other_organization()
    job_id, _ = _queue("pause", sync_employee["id"])

    with SessionLocal() as db:
        assert provider_sync.get_job(db, own_org, job_id).id == job_id
        with pytest.raises(NotFoundError):
            provider_sync.get_job(db, other_org, job_id)
        assert job_id not in [job.id for job in provider_sync.list_jobs(db, other_org)]
        assert job_id in [job.id for job in provider_sync.list_jobs(db, own_org)]
        assert provider_sync.list_logs(db, other_org, correlation_id=_job(job_id).correlation_id) == []


def test_the_same_key_in_two_tenants_is_two_jobs(sync_employee):
    own_org = _org_of(sync_employee["id"])
    other_org = _other_organization()

    with SessionLocal() as db:
        mine = provider_sync.create_job(
            db, own_org, operation="pause", employee_id=sync_employee["id"]
        )
    with SessionLocal() as db:
        theirs = provider_sync.create_job(
            db, other_org, operation="pause", idempotency_key=mine.job.idempotency_key
        )

    assert mine.job.id != theirs.job.id
    assert theirs.created is True


def test_a_job_cannot_run_against_another_tenants_employee(sync_employee):
    other_org = _other_organization()
    job_id = _force_job(other_org, sync_employee["id"], "pause")
    provider = FakeProvider()

    outcome = _run(job_id, provider)

    assert outcome.status == provider_sync.JOB_BLOCKED
    assert outcome.error_code == "not_found"
    assert provider.calls == []


# ---------------------------------------------------------------------------
# Worker wiring
# ---------------------------------------------------------------------------
def test_the_worker_task_runs_one_attempt(sync_employee, monkeypatch):
    _bind(sync_employee["id"])
    job_id, _ = _queue("pause", sync_employee["id"])
    provider = FakeProvider()
    monkeypatch.setattr(provider_sync, "get_voice_provider", lambda code=None: provider)

    result = tasks.run_provider_sync_job.apply(args=[job_id]).get()

    assert result["status"] == provider_sync.JOB_SUCCEEDED
    assert result["attempt"] == 1
    assert provider.calls == [("pause_deployment", "dep-existing")]


def test_the_sweep_dispatches_only_due_jobs(sync_employee, monkeypatch):
    _bind(sync_employee["id"])
    due_id, _ = _queue("pause", sync_employee["id"])

    stale_id, _ = _queue("resume", sync_employee["id"])
    with SessionLocal() as db:
        stale = db.get(ProviderSyncJob, stale_id)
        stale.status = provider_sync.JOB_FAILED
        stale.next_retry_at = utcnow() + timedelta(hours=2)
        db.commit()

    finished_id, _ = _queue("delete_deployment", sync_employee["id"])
    with SessionLocal() as db:
        finished = db.get(ProviderSyncJob, finished_id)
        finished.status = provider_sync.JOB_SUCCEEDED
        db.commit()

    sent: list[str] = []
    monkeypatch.setattr(tasks, "run_provider_sync_job", _RecordingTask(sent))

    result = tasks.sweep_provider_sync_jobs.apply().get()

    assert due_id in sent
    assert stale_id not in sent
    assert finished_id not in sent
    assert result["dispatched"] == len(sent)


class _RecordingTask:
    """Stands in for the Celery task so the sweep does not execute anything."""

    def __init__(self, sink: list[str]) -> None:
        self.sink = sink

    def delay(self, job_id: str) -> None:
        self.sink.append(job_id)
