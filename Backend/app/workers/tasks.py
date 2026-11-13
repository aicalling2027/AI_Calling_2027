"""Background tasks.

Every task is a *thin* wrapper around a service-layer function from
``app.modules``: it owns the transaction boundary and the logging, nothing else.
That keeps behaviour identical whether a job runs inline (eager mode, the
default) or on a real worker.

All tasks are safe to retry: they are idempotent with respect to their inputs.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select

from app.core.constants import CampaignStatus, CallStatus
from app.core.logging import get_logger
from app.database.base import utcnow
from app.database.models import (
    Campaign,
    Call,
    Conversation,
    Organization,
    RefreshToken,
    TrainingSource,
)
from app.database.session import session_scope
from app.modules import campaigns, conversations, integrations, provider_sync, training
from app.workers.celery_app import celery_app

logger = get_logger(__name__)

#: A call that has not progressed past ``queued`` for this long is considered
#: lost (provider never called back) and is released so the lead can be retried.
STALE_CALL_MINUTES = 30


# ---------------------------------------------------------------------------
# Campaign scheduler
# ---------------------------------------------------------------------------
@celery_app.task(name="workers.campaign_scheduler", bind=True)
def campaign_scheduler(self: Any) -> dict[str, int]:  # noqa: ARG001
    """Start scheduled campaigns and top up running ones.

    Runs every minute. Two responsibilities:

    * ``scheduled`` campaigns whose window is open (and whose
      ``scheduled_start_at`` has passed) are started;
    * ``running`` campaigns receive new calls whenever concurrency slots have
      been freed by finished calls.
    """
    started = refilled = 0
    now = utcnow()

    with session_scope() as db:
        rows = db.execute(
            select(Campaign).where(
                Campaign.status.in_(
                    [str(CampaignStatus.SCHEDULED), str(CampaignStatus.RUNNING)]
                ),
                Campaign.is_active.is_(True),
            )
        ).scalars().all()

        for campaign in rows:
            organization = db.get(Organization, campaign.organization_id)
            if organization is None:
                continue
            if (
                campaign.status == str(CampaignStatus.SCHEDULED)
                and campaign.scheduled_start_at
                and campaign.scheduled_start_at > now
            ):
                continue

            try:
                result = campaigns.start_campaign(
                    db,
                    organization,
                    campaign,
                    user_id=None,
                    webhook_base_url=None,
                    refill=True,
                )
            except Exception as exc:  # a single broken campaign must not stop the sweep
                logger.warning(
                    "campaign_scheduler_failed",
                    extra={"campaign_id": campaign.id, "error": str(exc)},
                )
                db.rollback()
                continue

            if result.queued_calls:
                if campaign.status == str(CampaignStatus.RUNNING):
                    refilled += 1
                else:
                    started += 1

    if started or refilled:
        logger.info(
            "campaign_scheduler_tick", extra={"started": started, "refilled": refilled}
        )
    return {"started": started, "refilled": refilled}


@celery_app.task(name="workers.dispatch_campaign", bind=True)
def dispatch_campaign(self: Any, campaign_id: str) -> dict[str, Any]:  # noqa: ARG001
    """Kick a single campaign immediately (used by the API after ``/start``)."""
    with session_scope() as db:
        campaign = db.get(Campaign, campaign_id)
        if campaign is None:
            return {"campaign_id": campaign_id, "status": "missing"}
        organization = db.get(Organization, campaign.organization_id)
        if organization is None:
            return {"campaign_id": campaign_id, "status": "no_organization"}

        result = campaigns.start_campaign(
            db, organization, campaign, user_id=None, refill=True
        )
        return {
            "campaign_id": campaign_id,
            "status": campaign.status,
            "calls_queued": result.queued_calls,
        }


# ---------------------------------------------------------------------------
# Knowledge base ingestion
# ---------------------------------------------------------------------------
@celery_app.task(
    name="workers.ingest_training_source", bind=True, max_retries=3, default_retry_delay=15
)
def ingest_training_source(
    self: Any, source_id: str, employee_id: str | None = None
) -> dict[str, Any]:
    """Chunk and embed a knowledge-base document outside the request cycle."""
    with session_scope() as db:
        source = db.get(TrainingSource, source_id)
        if source is None:
            return {"source_id": source_id, "status": "missing"}

        try:
            job = training.ingest_source(
                db, source, employee_id=employee_id, actor_id=None
            )
        except Exception as exc:
            logger.error(
                "training_ingest_failed",
                extra={"source_id": source_id, "error": str(exc)},
            )
            raise

        return {"source_id": source_id, "job_id": job.id, "status": job.status}


# ---------------------------------------------------------------------------
# Provider synchronisation
# ---------------------------------------------------------------------------
@celery_app.task(name="workers.run_provider_sync_job", bind=True, max_retries=0)
def run_provider_sync_job(
    self: Any,  # noqa: ARG001 - bound task keeps Celery's handle
    job_id: str,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Run one attempt of a provider sync job.

    The task does not raise for a provider failure: ``execute_job`` records the
    outcome and schedules the next attempt in ``next_retry_at``, which is the
    only retry clock. ``max_retries=0`` is asked for here, but the app-wide
    ``task_annotations`` in ``celery_app`` lifts it to 3, so a broker retry can
    still happen. That is harmless rather than useful: ``claim_job`` is a
    conditional update that returns nothing while the row is ``running`` and
    inside its lease, so a duplicate delivery is a no-op and the attempt count
    and backoff stay in the database either way.
    """
    with session_scope() as db:
        outcome = provider_sync.execute_job(db, job_id, correlation_id=correlation_id)
        return {
            "job_id": outcome.job_id,
            "status": outcome.status,
            "attempt": outcome.attempt,
            "error_code": outcome.error_code,
        }


@celery_app.task(name="workers.sweep_provider_sync_jobs", bind=True)
def sweep_provider_sync_jobs(self: Any, limit: int = 50) -> dict[str, int]:  # noqa: ARG001
    """Dispatch every provider job that is due.

    Beat calls this; the per-job task does the work. ``due_jobs`` also returns a
    job whose worker died mid-attempt, so a lost message is recovered rather than
    stranded in ``running`` forever.
    """
    with session_scope() as db:
        job_ids = provider_sync.due_jobs(db, limit=limit)

    dispatched = 0
    for job_id in job_ids:
        run_provider_sync_job.delay(job_id)
        dispatched += 1

    if dispatched:
        logger.info(
            "provider_sync_swept", extra={"due": len(job_ids), "dispatched": dispatched}
        )
    return {"due": len(job_ids), "dispatched": dispatched}


# ---------------------------------------------------------------------------
# Conversation intelligence
# ---------------------------------------------------------------------------
@celery_app.task(name="workers.summarize_call", bind=True)
def summarize_call(self: Any, call_id: str) -> dict[str, Any]:  # noqa: ARG001
    """Produce the post-call summary and sentiment for a finished call."""
    with session_scope() as db:
        conversation = db.execute(
            select(Conversation).where(Conversation.call_id == call_id)
        ).scalar_one_or_none()
        if conversation is None:
            return {"call_id": call_id, "status": "no_conversation"}

        summary = conversations.summarize(db, conversation)
        return {"call_id": call_id, "status": "summarised", "summary": summary.summary}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@celery_app.task(name="workers.send_whatsapp", bind=True)
def send_whatsapp_task(
    self: Any,  # noqa: ARG001
    organization_id: str,
    to: str,
    body: str,
    template: str | None = None,
) -> dict[str, Any]:
    """Deliver a WhatsApp message and record it in the notification log."""
    with session_scope() as db:
        record = integrations.send_whatsapp(
            db, organization_id, to=to, body=body, template=template
        )
        return {"notification_id": record.id, "status": record.status}


@celery_app.task(name="workers.retry_notifications", bind=True)
def retry_notifications(self: Any) -> dict[str, int]:  # noqa: ARG001
    """Retry notifications the provider rejected with a transient error."""
    from app.database.models import NotificationLog

    retried = 0
    with session_scope() as db:
        pending = db.execute(
            select(NotificationLog).where(
                NotificationLog.channel == "whatsapp",
                NotificationLog.status == "failed",
            ).limit(50)
        ).scalars().all()

        for record in pending:
            payload = record.payload or {}
            text = payload.get("body")
            if not text:
                continue
            try:
                integrations.send_whatsapp(
                    db,
                    record.organization_id,
                    to=record.recipient,
                    body=text,
                    template=record.template,
                )
                retried += 1
            except Exception as exc:  # keep sweeping on individual failures
                logger.warning(
                    "notification_retry_failed",
                    extra={"notification_id": record.id, "error": str(exc)},
                )

    return {"retried": retried}


# ---------------------------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------------------------
@celery_app.task(name="workers.release_stale_calls", bind=True)
def release_stale_calls(self: Any, minutes: int = STALE_CALL_MINUTES) -> dict[str, int]:
    """Fail calls the provider never reported on, so leads become retryable."""
    cutoff = utcnow() - timedelta(minutes=minutes)
    released = 0

    with session_scope() as db:
        stale = db.execute(
            select(Call).where(
                Call.status.in_(
                    [
                        str(CallStatus.QUEUED),
                        str(CallStatus.INITIATED),
                        str(CallStatus.RINGING),
                    ]
                ),
                Call.queued_at < cutoff,
            )
        ).scalars().all()

        for call in stale:
            call.status = str(CallStatus.FAILED)
            call.error_code = "no_callback"
            call.error_message = (
                f"The provider did not report a result within {minutes} minutes."
            )
            call.ended_at = call.ended_at or utcnow()
            campaigns.sync_from_call(db, call)
            released += 1

    if released:
        logger.info("stale_calls_released", extra={"count": released})
    return {"released": released}


@celery_app.task(name="workers.nightly_maintenance", bind=True)
def nightly_maintenance(self: Any) -> dict[str, int]:  # noqa: ARG001
    """Purge expired sessions and release stale calls once a day."""
    deleted_tokens = 0
    now = utcnow()

    with session_scope() as db:
        for token in db.execute(
            select(RefreshToken).where(RefreshToken.expires_at < now)
        ).scalars().all():
            db.delete(token)
            deleted_tokens += 1

    stale = release_stale_calls()
    logger.info(
        "nightly_maintenance_done",
        extra={"tokens_deleted": deleted_tokens, "stale": stale},
    )
    return {"tokens_deleted": deleted_tokens}


__all__ = [
    "campaign_scheduler",
    "dispatch_campaign",
    "ingest_training_source",
    "nightly_maintenance",
    "release_stale_calls",
    "retry_notifications",
    "run_provider_sync_job",
    "send_whatsapp_task",
    "summarize_call",
    "sweep_provider_sync_jobs",
]
