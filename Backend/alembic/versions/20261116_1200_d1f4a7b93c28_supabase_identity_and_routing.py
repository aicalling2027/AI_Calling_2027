"""supabase identity and number routing

Three additive changes:

1. ``users.supabase_user_id`` - the Supabase Auth subject a row belongs to. It is
   nullable because password accounts have none, and unique because one subject
   must map to exactly one local user (anything else would let two sessions
   claim the same employee history).
2. An index on ``phone_numbers (organization_id, status)`` - the quota check and
   the list filter both read it.
3. A partial unique index keeping **one live inbound deployment per number**.
   "Live" is the provider states that still route a call: pending, active and
   paused. The service layer enforces the same rule; the index is the backstop
   for two concurrent requests.

Nothing here rewrites data: no employee, number or deployment is assigned to a
user by this revision. Rows that predate it keep their ``created_by`` and
``organization_id`` exactly as they are.

Revision ID: d1f4a7b93c28
Revises: c8d2e3f4a5b6
Create Date: 2026-11-16 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d1f4a7b93c28"
down_revision: str | None = "c8d2e3f4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USERS = "users"
NUMBERS = "phone_numbers"
DEPLOYMENTS = "provider_deployments"

USER_INDEX = "ix_users_supabase_user_id"
NUMBER_INDEX = "ix_phone_numbers_organization_id_status"
INBOUND_INDEX = "uq_provider_deployments_inbound_number"

_LIVE_INBOUND = (
    "channel_direction = 'inbound' AND "
    "deployment_status IN ('pending', 'active', 'paused')"
)


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


def _duplicate_inbound(numbers: int) -> int:
    """How many numbers hold more than one live inbound deployment.

    A populated database may predate the rule, and the index cannot be created
    over a violating row. Those numbers are left for an operator to reconcile by
    hand rather than being deleted here.
    """
    if not _has_table(DEPLOYMENTS):
        return 0
    row = op.get_bind().execute(
        sa.text(
            "SELECT COUNT(*) FROM ("
            f"  SELECT phone_number_id FROM {DEPLOYMENTS}"
            f"  WHERE {_LIVE_INBOUND} AND phone_number_id IS NOT NULL"
            "   GROUP BY phone_number_id HAVING COUNT(*) > 1"
            ") AS duplicates"
        )
    ).scalar_one()
    return int(row or 0)


def upgrade() -> None:
    if _has_table(USERS) and "supabase_user_id" not in _columns(USERS):
        op.add_column(
            USERS, sa.Column("supabase_user_id", sa.String(length=64), nullable=True)
        )
    if _has_table(USERS) and USER_INDEX not in _indexes(USERS):
        op.create_index(USER_INDEX, USERS, ["supabase_user_id"], unique=True)

    if _has_table(NUMBERS) and NUMBER_INDEX not in _indexes(NUMBERS):
        op.create_index(NUMBER_INDEX, NUMBERS, ["organization_id", "status"])

    if _has_table(DEPLOYMENTS) and INBOUND_INDEX not in _indexes(DEPLOYMENTS):
        if _duplicate_inbound(0) == 0:
            op.create_index(
                INBOUND_INDEX,
                DEPLOYMENTS,
                ["phone_number_id"],
                unique=True,
                postgresql_where=sa.text(_LIVE_INBOUND),
                sqlite_where=sa.text(_LIVE_INBOUND),
            )


def downgrade() -> None:
    if _has_table(DEPLOYMENTS) and INBOUND_INDEX in _indexes(DEPLOYMENTS):
        op.drop_index(INBOUND_INDEX, table_name=DEPLOYMENTS)
    if _has_table(NUMBERS) and NUMBER_INDEX in _indexes(NUMBERS):
        op.drop_index(NUMBER_INDEX, table_name=NUMBERS)
    if _has_table(USERS):
        with op.batch_alter_table(USERS, schema=None) as batch_op:
            if USER_INDEX in _indexes(USERS):
                batch_op.drop_index(USER_INDEX)
            if "supabase_user_id" in _columns(USERS):
                batch_op.drop_column("supabase_user_id")
