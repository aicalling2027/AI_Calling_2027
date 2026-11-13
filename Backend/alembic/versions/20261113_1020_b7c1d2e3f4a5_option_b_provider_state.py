"""option B provider state

Adds the provider link history and job ledger around ``employee_agent_bindings``,
plus the calling-activation columns on ``employees``.

Two things make this revision different from the initial one:

* ``employee_agent_bindings`` already exists in databases created by the app's
  ``create_all`` path (it was never captured by the initial revision), so the
  table is created here only when it is missing.
* every step is guarded by an inspector check, because this revision may run
  against either a migrated database or a dev database that auto-created the
  newer tables already.

Nothing is dropped and no existing column is altered, so running it on a
populated database cannot lose data.

Revision ID: b7c1d2e3f4a5
Revises: ba419386382b
Create Date: 2026-11-13 10:20:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c1d2e3f4a5"
down_revision: str | None = "ba419386382b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BINDING = "employee_agent_bindings"


# ---------------------------------------------------------------------------
# Inspector helpers - one round-trip each, but they make the revision safe to
# run twice on a half-migrated database.
# ---------------------------------------------------------------------------
def _has_table(table: str) -> bool:
    return table in sa.inspect(op.get_bind()).get_table_names()


def _columns(table: str) -> set[str]:
    if not _has_table(table):
        return set()
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _indexes(table: str) -> set[str]:
    if not _has_table(table):
        return set()
    inspector = sa.inspect(op.get_bind())
    names = {index["name"] for index in inspector.get_indexes(table)}
    names |= {item["name"] for item in inspector.get_unique_constraints(table)}
    return names


def _add_missing_columns(table: str, columns: Sequence[sa.Column]) -> None:
    existing = _columns(table)
    for column in columns:
        if column.name not in existing:
            op.add_column(table, column)


def _create_index_if_missing(
    table: str, name: str, columns: Sequence[str], *, unique: bool = False
) -> None:
    if name not in _indexes(table):
        op.create_index(name, table, list(columns), unique=unique)


def _create_table_if_missing(name: str, *args, **kwargs) -> bool:
    """Create a table and its indexes; returns False when it already existed."""
    if _has_table(name):
        return False
    op.create_table(name, *args, **kwargs)
    return True


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
def _create_binding_table() -> None:
    """The table the initial revision missed, in its final shape."""
    op.create_table(
        BINDING,
        sa.Column("employee_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=48), nullable=False),
        sa.Column("deployment_id", sa.String(length=80), nullable=True),
        sa.Column("app_id", sa.String(length=80), nullable=True),
        sa.Column("app_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("simulated", sa.Boolean(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("external_agent_name", sa.String(length=120), nullable=True),
        sa.Column("current_committed_version", sa.Integer(), nullable=True),
        sa.Column("external_agent_status", sa.String(length=32), nullable=True),
        sa.Column(
            "sync_status",
            sa.String(length=24),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("last_configuration_hash", sa.String(length=64), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"],
            name=op.f("fk_employee_agent_bindings_employee_id_employees"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_employee_agent_bindings_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_employee_agent_bindings")),
        sa.UniqueConstraint(
            "employee_id", name="uq_employee_agent_bindings_employee_id"
        ),
    )
    for name, columns, unique in (
        ("ix_employee_agent_bindings_id", ["id"], False),
        ("ix_employee_agent_bindings_organization_id", ["organization_id"], False),
        ("ix_employee_agent_bindings_employee_id", ["employee_id"], False),
        ("ix_employee_agent_bindings_status", ["status"], False),
        ("ix_employee_agent_bindings_sync_status", ["sync_status"], False),
        ("ix_employee_agent_bindings_created_at", ["created_at"], False),
        (
            "uq_employee_agent_bindings_tenant_provider",
            ["organization_id", "employee_id", "provider"],
            True,
        ),
    ):
        _create_index_if_missing(BINDING, name, columns, unique=unique)


def _create_provider_agent_versions() -> None:
    created = _create_table_if_missing(
        "provider_agent_versions",
        sa.Column("provider_agent_id", sa.String(length=36), nullable=False),
        sa.Column("external_version", sa.Integer(), nullable=False),
        sa.Column("configuration_hash", sa.String(length=64), nullable=True),
        sa.Column("version_status", sa.String(length=24), nullable=False),
        sa.Column("commit_status", sa.String(length=24), nullable=False),
        sa.Column("committed_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["provider_agent_id"],
            [f"{BINDING}.id"],
            name=op.f("fk_provider_agent_versions_provider_agent_id_employee_agent_bindings"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_provider_agent_versions_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_agent_versions")),
        sa.UniqueConstraint(
            "provider_agent_id",
            "external_version",
            name="uq_provider_agent_versions_provider_agent_id",
        ),
    )
    if not created:
        return
    for name, columns in (
        ("ix_provider_agent_versions_id", ["id"]),
        ("ix_provider_agent_versions_organization_id", ["organization_id"]),
        ("ix_provider_agent_versions_provider_agent_id", ["provider_agent_id"]),
        ("ix_provider_agent_versions_version_status", ["version_status"]),
        ("ix_provider_agent_versions_commit_status", ["commit_status"]),
        ("ix_provider_agent_versions_created_at", ["created_at"]),
    ):
        _create_index_if_missing("provider_agent_versions", name, columns)


def _create_provider_deployments() -> None:
    created = _create_table_if_missing(
        "provider_deployments",
        sa.Column("employee_id", sa.String(length=36), nullable=False),
        sa.Column("provider_agent_id", sa.String(length=36), nullable=True),
        sa.Column("provider_agent_version_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=48), nullable=False),
        sa.Column("external_deployment_id", sa.String(length=80), nullable=True),
        sa.Column("external_connection_id", sa.String(length=80), nullable=True),
        sa.Column("phone_number_id", sa.String(length=36), nullable=True),
        sa.Column("channel_direction", sa.String(length=16), nullable=False),
        sa.Column("deployment_status", sa.String(length=24), nullable=False),
        sa.Column("deployed_at", sa.DateTime(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"],
            name=op.f("fk_provider_deployments_employee_id_employees"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["provider_agent_id"],
            [f"{BINDING}.id"],
            name=op.f("fk_provider_deployments_provider_agent_id_employee_agent_bindings"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["provider_agent_version_id"],
            ["provider_agent_versions.id"],
            name=op.f("fk_provider_deployments_provider_agent_version_id_provider_agent_versions"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["phone_number_id"],
            ["phone_numbers.id"],
            name=op.f("fk_provider_deployments_phone_number_id_phone_numbers"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_provider_deployments_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_deployments")),
        sa.UniqueConstraint(
            "provider",
            "external_deployment_id",
            name="uq_provider_deployments_provider",
        ),
    )
    if not created:
        return
    for name, columns in (
        ("ix_provider_deployments_id", ["id"]),
        ("ix_provider_deployments_organization_id", ["organization_id"]),
        ("ix_provider_deployments_employee_id", ["employee_id"]),
        ("ix_provider_deployments_provider_agent_id", ["provider_agent_id"]),
        ("ix_provider_deployments_provider_agent_version_id", ["provider_agent_version_id"]),
        ("ix_provider_deployments_phone_number_id", ["phone_number_id"]),
        ("ix_provider_deployments_external_deployment_id", ["external_deployment_id"]),
        ("ix_provider_deployments_deployment_status", ["deployment_status"]),
        ("ix_provider_deployments_created_at", ["created_at"]),
    ):
        _create_index_if_missing("provider_deployments", name, columns)


def _create_provider_sync_jobs() -> None:
    created = _create_table_if_missing(
        "provider_sync_jobs",
        sa.Column("employee_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=48), nullable=False),
        sa.Column("operation", sa.String(length=48), nullable=False),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("next_retry_at", sa.DateTime(), nullable=True),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"],
            name=op.f("fk_provider_sync_jobs_employee_id_employees"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_provider_sync_jobs_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_sync_jobs")),
        sa.UniqueConstraint(
            "organization_id",
            "idempotency_key",
            name="uq_provider_sync_jobs_organization_id",
        ),
    )
    if not created:
        return
    for name, columns in (
        ("ix_provider_sync_jobs_id", ["id"]),
        ("ix_provider_sync_jobs_organization_id", ["organization_id"]),
        ("ix_provider_sync_jobs_employee_id", ["employee_id"]),
        ("ix_provider_sync_jobs_operation", ["operation"]),
        ("ix_provider_sync_jobs_status", ["status"]),
        ("ix_provider_sync_jobs_idempotency_key", ["idempotency_key"]),
        ("ix_provider_sync_jobs_next_retry_at", ["next_retry_at"]),
        ("ix_provider_sync_jobs_created_at", ["created_at"]),
    ):
        _create_index_if_missing("provider_sync_jobs", name, columns)


def _create_provider_sync_logs() -> None:
    created = _create_table_if_missing(
        "provider_sync_logs",
        sa.Column("employee_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=48), nullable=False),
        sa.Column("operation", sa.String(length=48), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("sanitized_message", sa.Text(), nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.id"],
            name=op.f("fk_provider_sync_logs_employee_id_employees"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_provider_sync_logs_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_sync_logs")),
    )
    if not created:
        return
    for name, columns in (
        ("ix_provider_sync_logs_id", ["id"]),
        ("ix_provider_sync_logs_organization_id", ["organization_id"]),
        ("ix_provider_sync_logs_employee_id", ["employee_id"]),
        ("ix_provider_sync_logs_operation", ["operation"]),
        ("ix_provider_sync_logs_status", ["status"]),
        ("ix_provider_sync_logs_correlation_id", ["correlation_id"]),
        ("ix_provider_sync_logs_created_at", ["created_at"]),
    ):
        _create_index_if_missing("provider_sync_logs", name, columns)


def _create_provider_knowledge_base_bindings() -> None:
    created = _create_table_if_missing(
        "provider_knowledge_base_bindings",
        sa.Column("knowledge_base_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=48), nullable=False),
        sa.Column("external_knowledge_base_id", sa.String(length=80), nullable=True),
        sa.Column("sync_status", sa.String(length=24), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id"],
            ["training_sources.id"],
            name=op.f(
                "fk_provider_knowledge_base_bindings_knowledge_base_id_training_sources"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f(
                "fk_provider_knowledge_base_bindings_organization_id_organizations"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id", name=op.f("pk_provider_knowledge_base_bindings")
        ),
        sa.UniqueConstraint(
            "knowledge_base_id",
            "provider",
            name="uq_provider_knowledge_base_bindings_knowledge_base_id",
        ),
    )
    if not created:
        return
    for name, columns in (
        ("ix_provider_knowledge_base_bindings_id", ["id"]),
        ("ix_provider_knowledge_base_bindings_organization_id", ["organization_id"]),
        ("ix_provider_knowledge_base_bindings_knowledge_base_id", ["knowledge_base_id"]),
        ("ix_provider_knowledge_base_bindings_sync_status", ["sync_status"]),
        ("ix_provider_knowledge_base_bindings_created_at", ["created_at"]),
    ):
        _create_index_if_missing("provider_knowledge_base_bindings", name, columns)


def _create_provider_document_bindings() -> None:
    created = _create_table_if_missing(
        "provider_document_bindings",
        sa.Column("knowledge_base_document_id", sa.String(length=36), nullable=False),
        sa.Column("provider_knowledge_base_id", sa.String(length=36), nullable=False),
        sa.Column("external_file_id", sa.String(length=120), nullable=True),
        sa.Column("content_checksum", sa.String(length=128), nullable=True),
        sa.Column("sync_status", sa.String(length=24), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_base_document_id"],
            ["training_documents.id"],
            name=op.f(
                "fk_provider_document_bindings_knowledge_base_document_id_training_documents"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["provider_knowledge_base_id"],
            ["provider_knowledge_base_bindings.id"],
            name=op.f(
                "fk_provider_document_bindings_provider_knowledge_base_id_provider_knowledge_base_bindings"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_provider_document_bindings_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_document_bindings")),
        sa.UniqueConstraint(
            "knowledge_base_document_id",
            "provider_knowledge_base_id",
            name="uq_provider_document_bindings_knowledge_base_document_id",
        ),
    )
    if not created:
        return
    for name, columns in (
        ("ix_provider_document_bindings_id", ["id"]),
        ("ix_provider_document_bindings_organization_id", ["organization_id"]),
        ("ix_provider_document_bindings_knowledge_base_document_id", ["knowledge_base_document_id"]),
        ("ix_provider_document_bindings_provider_knowledge_base_id", ["provider_knowledge_base_id"]),
        ("ix_provider_document_bindings_sync_status", ["sync_status"]),
        ("ix_provider_document_bindings_created_at", ["created_at"]),
    ):
        _create_index_if_missing("provider_document_bindings", name, columns)


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------
def upgrade() -> None:
    # 1. The binding table the initial revision never captured.
    if _has_table(BINDING):
        _add_missing_columns(
            BINDING,
            (
                sa.Column("external_agent_name", sa.String(length=120), nullable=True),
                sa.Column("current_committed_version", sa.Integer(), nullable=True),
                sa.Column("external_agent_status", sa.String(length=32), nullable=True),
                sa.Column(
                    "sync_status",
                    sa.String(length=24),
                    nullable=False,
                    server_default="pending",
                ),
                sa.Column(
                    "last_configuration_hash", sa.String(length=64), nullable=True
                ),
            ),
        )
        _create_index_if_missing(
            BINDING, "ix_employee_agent_bindings_sync_status", ["sync_status"]
        )
    else:
        _create_binding_table()

    _create_index_if_missing(
        BINDING,
        "uq_employee_agent_bindings_tenant_provider",
        ["organization_id", "employee_id", "provider"],
        unique=True,
    )

    # 2. Calling activation on the employee. Existing rows must keep reading as
    #    "calling not configured", because none of them was ever enabled.
    _add_missing_columns(
        "employees",
        (
            sa.Column(
                "calling_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column(
                "calling_status",
                sa.String(length=32),
                nullable=False,
                server_default="not_configured",
            ),
            sa.Column(
                "configuration_version",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            ),
            sa.Column("configuration_hash", sa.String(length=64), nullable=True),
        ),
    )
    _create_index_if_missing(
        "employees", "ix_employees_calling_status", ["calling_status"]
    )

    # 3. Provider history and job ledger.
    _create_provider_agent_versions()
    _create_provider_deployments()
    _create_provider_sync_jobs()
    _create_provider_sync_logs()
    _create_provider_knowledge_base_bindings()
    _create_provider_document_bindings()

    # 4. A simulated deployment never existed on the provider, so it must not be
    #    read as a normal sync. This is the only data touched by the revision.
    binding_columns = _columns(BINDING)
    if {"sync_status", "simulated"} <= binding_columns:
        op.execute(
            sa.text(
                f"UPDATE {BINDING} SET sync_status = 'simulated' WHERE simulated = :flag"
            ).bindparams(flag=True)
        )


def downgrade() -> None:
    # Drop only what this revision created. ``employee_agent_bindings`` stays:
    # it predates the revision on auto-created databases and the app still
    # needs it, so removing it here would break a working deployment.
    for table in (
        "provider_document_bindings",
        "provider_knowledge_base_bindings",
        "provider_sync_logs",
        "provider_sync_jobs",
        "provider_deployments",
        "provider_agent_versions",
    ):
        if _has_table(table):
            op.drop_table(table)

    binding_columns = _columns(BINDING)
    with op.batch_alter_table(BINDING, schema=None) as batch_op:
        if "uq_employee_agent_bindings_tenant_provider" in _indexes(BINDING):
            batch_op.drop_index("uq_employee_agent_bindings_tenant_provider")
        if "ix_employee_agent_bindings_sync_status" in _indexes(BINDING):
            batch_op.drop_index("ix_employee_agent_bindings_sync_status")
        for column in (
            "last_configuration_hash",
            "sync_status",
            "external_agent_status",
            "current_committed_version",
            "external_agent_name",
        ):
            if column in binding_columns:
                batch_op.drop_column(column)

    employee_columns = _columns("employees")
    with op.batch_alter_table("employees", schema=None) as batch_op:
        if "ix_employees_calling_status" in _indexes("employees"):
            batch_op.drop_index("ix_employees_calling_status")
        for column in (
            "configuration_hash",
            "configuration_version",
            "calling_status",
            "calling_enabled",
        ):
            if column in employee_columns:
                batch_op.drop_column(column)
