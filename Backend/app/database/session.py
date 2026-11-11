"""Engine and session management.

Local development uses SQLite with zero configuration; production points
``DATABASE_URL`` at Supabase PostgreSQL. Both paths share the same session
factory so services never care which database is underneath.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _engine_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "echo": settings.db_echo,
        "future": True,
        "pool_pre_ping": True,
    }
    if settings.is_sqlite:
        # SQLite needs a single-thread flag relaxed for FastAPI's threadpool.
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_size"] = settings.db_pool_size
        kwargs["max_overflow"] = settings.db_max_overflow
        # Managed Postgres (Supabase, RDS, Neon) closes idle connections without
        # warning; recycling below that window keeps the first query after a
        # sleep from hitting a dead socket.
        kwargs["pool_recycle"] = 1800
        connect_args: dict[str, Any] = {
            "connect_timeout": 10,
            "application_name": "ownai-backend",
        }
        if settings.is_pooled_postgres:
            # Supavisor/pgbouncer in transaction mode reuses server sessions, so
            # psycopg's server-side prepared statements must be disabled.
            connect_args["prepare_threshold"] = None
        kwargs["connect_args"] = connect_args
    return kwargs


engine: Engine = create_engine(settings.database_url, **_engine_kwargs())

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


if settings.is_sqlite:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
        """SQLite ignores FK constraints unless explicitly enabled per connection."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope for workers, scripts and background tasks."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_database() -> bool:
    """Lightweight connectivity probe used by the health endpoint."""
    from sqlalchemy import text

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # pragma: no cover - depends on deployment
        logger.warning("Database health check failed (%s): %s", settings.database_target, exc)
        return False
