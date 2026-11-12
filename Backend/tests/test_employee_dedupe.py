"""De-duplication of repeated employee names.

Every other test in this suite talks HTTP only. This one cannot: the create
endpoint refuses a duplicate name (409), so a repeated row can only pre-date
that guard. Seeding those rows through the ORM is the only way to exercise the
clean-up pass the "Remove duplicates" action runs.
"""

from __future__ import annotations

from app.database.models.employee import Employee
from app.database.session import SessionLocal
from tests.conftest import API, unique


def _seed_duplicates(organization_id: str, name: str, count: int = 2) -> None:
    with SessionLocal() as db:
        for _ in range(count):
            db.add(
                Employee(
                    organization_id=organization_id,
                    name=name,
                    default_language="en-IN",
                    voice="shubh",
                    system_prompt="Seeded duplicate from before the create guard.",
                    status="draft",
                )
            )
        db.commit()


def test_dedupe_archives_a_repeated_name(client, auth, employee):
    """The oldest of each repeated name survives; the rest are archived."""
    name = unique("Duplicate")

    with SessionLocal() as db:
        organization_id = db.get(Employee, employee["id"]).organization_id
    _seed_duplicates(organization_id, name)

    body = client.post(f"{API}/employees/dedupe", headers=auth).json()
    assert body["duplicates"] == 1
    assert len(body["archived_ids"]) == 1

    rows = client.get(f"{API}/employees", headers=auth).json()["items"]
    visible = [row for row in rows if row["name"] == name]
    # One card left, and the archived row is gone from the workspace list.
    assert len(visible) == 1
    assert visible[0]["id"] not in body["archived_ids"]

    # Leave the workspace as this test found it.
    client.delete(f"{API}/employees/{visible[0]['id']}", headers=auth)
