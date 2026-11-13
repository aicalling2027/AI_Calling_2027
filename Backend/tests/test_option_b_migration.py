"""Alembic coverage for the Option B provider-state revision.

The initial revision predates ``employee_agent_bindings``, so this revision has
to create that table on an empty database *and* add it in place on a database
the app's ``create_all`` path already prepared. Both paths, plus the downgrade,
are exercised here against a throw-away SQLite file so a future migration can
never silently ship a schema the ORM does not agree with.
"""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
INITIAL_REVISION = "ba419386382b"

PROVIDER_TABLES = {
    "provider_agent_versions",
    "provider_deployments",
    "provider_document_bindings",
    "provider_knowledge_base_bindings",
    "provider_sync_jobs",
    "provider_sync_logs",
}

EMPLOYEE_COLUMNS = {
    "calling_enabled",
    "calling_status",
    "configuration_hash",
    "configuration_version",
}

BINDING_COLUMNS = {
    "current_committed_version",
    "external_agent_name",
    "external_agent_status",
    "last_configuration_hash",
    "sync_status",
}


@pytest.fixture()
def migration_db(monkeypatch: pytest.MonkeyPatch):
    """Point Alembic at a scratch file and restore the app URL afterwards."""
    path = Path(tempfile.gettempdir()) / f"ownai_migration_{uuid.uuid4().hex[:8]}.db"
    url = f"sqlite:///{path.as_posix()}"
    monkeypatch.setattr(settings, "database_url", url)

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))

    engine = create_engine(url)
    try:
        yield config, engine
    finally:
        engine.dispose()
        path.unlink(missing_ok=True)


def _tables(engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def _columns(engine, table: str) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns(table)}


def test_initial_revision_omits_the_binding_table(migration_db) -> None:
    """Guards the reason this revision exists at all."""
    config, engine = migration_db
    command.upgrade(config, INITIAL_REVISION)

    assert "employee_agent_bindings" not in _tables(engine)


def test_upgrade_creates_every_provider_table(migration_db) -> None:
    config, engine = migration_db
    command.upgrade(config, "head")

    tables = _tables(engine)
    assert PROVIDER_TABLES <= tables
    # Created by this revision because the initial one missed it.
    assert "employee_agent_bindings" in tables


def test_upgrade_adds_calling_columns_with_safe_defaults(migration_db) -> None:
    config, engine = migration_db
    command.upgrade(config, "head")

    assert EMPLOYEE_COLUMNS <= _columns(engine, "employees")
    assert BINDING_COLUMNS <= _columns(engine, "employee_agent_bindings")


def test_downgrade_removes_new_state_but_keeps_the_binding_table(migration_db) -> None:
    config, engine = migration_db
    command.upgrade(config, "head")
    command.downgrade(config, INITIAL_REVISION)

    tables = _tables(engine)
    assert not (PROVIDER_TABLES & tables)
    assert "employee_agent_bindings" in tables
    assert not (EMPLOYEE_COLUMNS & _columns(engine, "employees"))
    assert not (BINDING_COLUMNS & _columns(engine, "employee_agent_bindings"))


def test_upgrade_is_repeatable_after_downgrade(migration_db) -> None:
    config, engine = migration_db
    command.upgrade(config, "head")
    command.downgrade(config, INITIAL_REVISION)
    command.upgrade(config, "head")

    assert PROVIDER_TABLES <= _tables(engine)
