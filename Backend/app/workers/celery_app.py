"""Celery application for background and scheduled work.

Design notes
------------
* ``celery_task_always_eager`` defaults to **True** so ``python app.py`` runs
  every background job inline and the product is fully functional with zero
  infrastructure. Point ``REDIS_URL``/``CELERY_BROKER_URL`` at a real broker and
  set ``CELERY_TASK_ALWAYS_EAGER=false`` to move the work out of the API process.
* Tasks are thin wrappers: they open a session, call the same service-layer
  function the HTTP layer calls, and log the outcome. Business rules live in
  ``app/modules`` and are never duplicated here.
"""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

celery_app = Celery(
    "ownai",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    # --- Execution --------------------------------------------------------
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=False,
    task_store_eager_result=False,
    # --- Serialization ----------------------------------------------------
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # --- Time -------------------------------------------------------------
    timezone="UTC",
    enable_utc=True,
    # --- Reliability ------------------------------------------------------
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    task_time_limit=900,
    task_soft_time_limit=840,
    worker_max_tasks_per_child=200,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    result_expires=3600,
    task_default_queue="ownai",
    task_default_retry_delay=30,
    task_annotations={"*": {"max_retries": 3}},
    # --- Schedule (only fires when a real broker + beat are running) ------
    beat_schedule={
        "campaign-scheduler": {
            "task": "workers.campaign_scheduler",
            "schedule": crontab(minute="*"),
        },
        "retry-failed-notifications": {
            "task": "workers.retry_notifications",
            "schedule": crontab(minute="*/15"),
        },
        # Every job carries its own retry clock, so a short sweep is enough to
        # pick up a due retry without holding a worker in sleep.
        "provider-sync-sweep": {
            "task": "workers.sweep_provider_sync_jobs",
            "schedule": crontab(minute="*/2"),
        },
        "nightly-maintenance": {
            "task": "workers.nightly_maintenance",
            "schedule": crontab(hour=19, minute=30),  # 01:00 IST
        },
    },
)

# Register the task module. Imported late so ``celery_app`` exists first.
from app.workers import tasks  # noqa: E402,F401  (registers the tasks)

__all__ = ["celery_app", "tasks"]
