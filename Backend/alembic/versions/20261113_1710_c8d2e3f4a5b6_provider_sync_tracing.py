"""provider sync tracing

Adds ``provider_sync_jobs.correlation_id``.

A job is mutable state and a log is history, and the log table deliberately
carries no foreign key back to the job. That leaves one identifier to hang the
history on: a correlation id written once when the job is queued and copied onto
every log line the job produces, including from a worker that runs hours later.

The column is nullable and additive. Rows queued before this revision keep
working - their log lines simply carry whatever id the caller supplied.

Revision ID: c8d2e3f4a5b6
Revises: b7c1d2e3f4a5
Create Date: 2026-11-13 17:10:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8d2e3f4a5b6"
down_revision: str | None = "b7c1d2e3f4a5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JOBS = "provider_sync_jobs"
INDEX = "ix_provider_sync_jobs_correlation_id"


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


def upgrade() -> None:
    if not _has_table(JOBS):
        # Too old for the job ledger to exist; the previous revision creates
        # the table in its current shape, so there is nothing to add here.
        return

    if "correlation_id" not in _columns(JOBS):
        op.add_column(
            JOBS, sa.Column("correlation_id", sa.String(length=64), nullable=True)
        )
    if INDEX not in _indexes(JOBS):
        op.create_index(INDEX, JOBS, ["correlation_id"])


def downgrade() -> None:
    if not _has_table(JOBS):
        return

    with op.batch_alter_table(JOBS, schema=None) as batch_op:
        if INDEX in _indexes(JOBS):
            batch_op.drop_index(INDEX)
        if "correlation_id" in _columns(JOBS):
            batch_op.drop_column("correlation_id")
