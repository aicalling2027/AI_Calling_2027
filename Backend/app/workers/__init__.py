"""Background workers (Celery).

Import ``celery_app`` from here, not from :mod:`app.workers.celery_app`, so the
task module is always registered::

    from app.workers import celery_app
"""

from app.workers.celery_app import celery_app

__all__ = ["celery_app"]
