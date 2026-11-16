"""The plan's phone-number include, enforced where a number is held.

A number attached to a workspace is held and billed whether this app sold it
or the workspace rented it in the console, so the include applies to both.
Pending, active and inactive lines all count; a released line does not, because
leasing it has ended. Each test works on a workspace of its own, so the counts
are the ones the test created.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.dialects import postgresql

from app.core.exceptions import ConflictError
from app.database.models.organization import Organization
from app.database.session import SessionLocal
from app.modules import billing, phone_numbers
from app.schemas.phone_number import PhoneNumberAttach
from tests.conftest import API


def _number() -> str:
    """A number no other test can pick, so the unique index stays usable."""
    return f"+9188{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture(autouse=True)
def _schema(client) -> None:
    """The tables are created when the app starts, which the client does."""


def _workspace(db, *, plan: str = "starter") -> Organization:
    """A fresh workspace on a named plan, with its own quota."""
    organization = Organization(
        name=f"Quota {uuid.uuid4().hex[:8]}", slug=f"quota-{uuid.uuid4().hex[:8]}"
    )
    db.add(organization)
    db.flush()
    billing.ensure_subscription(db, organization.id, plan_code=plan)
    db.commit()
    return organization


def _attach(db, organization: Organization, number: str, **extra: object):
    return phone_numbers.attach_number(
        db,
        organization,
        PhoneNumberAttach(number=number, **extra),
        user_id=None,
    )


# ---------------------------------------------------------------------------
# Enforcement
# ---------------------------------------------------------------------------
def test_attaching_past_the_include_is_refused() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        first = _attach(db, organization, _number())

        with pytest.raises(ConflictError) as refusal:
            _attach(db, organization, _number())

    # An unassigned line is pending, and it still spends the include.
    assert first.number.status == "pending"
    error = refusal.value
    assert error.status_code == 409
    assert error.code == "phone_number_limit_reached"
    assert error.details == {"limit": 1, "current": 1, "plan": "starter"}


def test_an_inactive_number_still_counts() -> None:
    """The plan counts what the workspace holds, not what is switched on."""
    with SessionLocal() as db:
        organization = _workspace(db)
        created = _attach(db, organization, _number())
        row = phone_numbers.get_number(db, organization.id, created.number.id)
        row.status = "inactive"
        db.commit()

        with pytest.raises(ConflictError) as refusal:
            _attach(db, organization, _number())

    assert refusal.value.code == "phone_number_limit_reached"


def test_a_released_number_frees_its_place() -> None:
    """Releasing ends the lease, so the line no longer counts."""
    with SessionLocal() as db:
        organization = _workspace(db)
        created = _attach(db, organization, _number())
        row = phone_numbers.get_number(db, organization.id, created.number.id)
        phone_numbers.release_number(db, row, user_id=None)

        again = _attach(db, organization, _number())

    assert again.created is True
    assert again.number.status == "pending"


def test_the_include_is_per_workspace() -> None:
    """Another workspace's numbers are not this workspace's problem."""
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        _attach(db, theirs, _number())

        _attach(db, mine, _number())
        with pytest.raises(ConflictError):
            _attach(db, mine, _number())


def test_a_roomier_plan_holds_more_numbers() -> None:
    with SessionLocal() as db:
        organization = _workspace(db, plan="growth")
        for _ in range(3):
            _attach(db, organization, _number())

        allowed = billing.plan_allowance(db, organization.id).max_phone_numbers
        assert allowed > 3


# ---------------------------------------------------------------------------
# The lock behind the count
# ---------------------------------------------------------------------------
def test_the_lock_is_a_row_lock_on_the_workspace() -> None:
    """Two attachments must not both read the same count and both find room.

    The count is only trustworthy if the workspace row is held for the rest of
    the transaction, so the statement has to be a ``FOR UPDATE`` on it.
    """
    compiled = phone_numbers.lock_statement("org-1").compile(
        dialect=postgresql.dialect()
    )
    sql = str(compiled).upper()

    assert "FOR UPDATE" in sql
    assert "ORGANIZATIONS" in sql


# ---------------------------------------------------------------------------
# Through the API
# ---------------------------------------------------------------------------
def test_attach_answers_409_with_what_the_dashboard_needs(client, auth) -> None:
    """The refusal names the plan, its include, and what is already used."""
    organization_id = client.get(f"{API}/auth/me", headers=auth).json()[
        "organization"
    ]["id"]
    with SessionLocal() as db:
        # A workspace that holds numbers has a plan; make sure this one does
        # even when this module runs on its own.
        billing.ensure_subscription(db, organization_id, plan_code="starter")
        db.commit()

    quota = client.get(f"{API}/phone-numbers/sync", headers=auth).json()["quota"]
    assert quota is not None

    # Fill whatever room is left, so the refusal below is the include, not luck.
    for _ in range(max(0, int(quota["remaining"]))):
        filled = client.post(
            f"{API}/phone-numbers/attach", headers=auth, json={"number": _number()}
        )
        assert filled.status_code == 200, filled.text

    response = client.post(
        f"{API}/phone-numbers/attach", headers=auth, json={"number": _number()}
    )

    assert response.status_code == 409, response.text
    gap = response.json()["error"]
    assert gap["code"] == "phone_number_limit_reached"
    assert gap["details"]["plan"] == quota["plan"]
    assert gap["details"]["limit"] == quota["limit"]
    assert gap["details"]["current"] >= gap["details"]["limit"]
