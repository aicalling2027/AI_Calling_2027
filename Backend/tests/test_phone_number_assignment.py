"""Binding a number to an AI employee, and what that binding proves.

An assignment is a local record. The number answers only once the voice
provider agrees to route to the employee's agent, so the two are reported
separately: ``employee_id`` is what this workspace asked for, and ``routing``
is what the provider confirmed. These tests pin that difference, plus the
lifecycle rules around it.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.database.base import utcnow
from app.database.models.employee import Employee
from app.database.models.organization import Organization
from app.database.models.phone_number import PhoneNumber, PhoneNumberAssignment
from app.database.models.provider import ProviderDeployment
from app.database.session import SessionLocal
from tests.conftest import API, unique


def _number() -> str:
    return f"+9187{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture(autouse=True)
def _roomy_plan(roomy_plan: None) -> None:
    """Lift the include: these tests attach several numbers in one workspace."""


def _attach(client, auth: dict[str, str], **extra: object) -> dict:
    response = client.post(
        f"{API}/phone-numbers/attach",
        headers=auth,
        json={"number": _number(), **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()["number"]


def _assign(client, auth: dict[str, str], number_id: str, employee_id: str | None):
    return client.post(
        f"{API}/phone-numbers/{number_id}/assign",
        headers=auth,
        json={"employee_id": employee_id},
    )


def _foreign_workspace(db) -> Organization:
    organization = Organization(
        name=unique("Foreign tenant"), slug=f"foreign-{uuid.uuid4().hex[:8]}"
    )
    db.add(organization)
    db.flush()
    return organization


# ---------------------------------------------------------------------------
# The assignment itself
# ---------------------------------------------------------------------------
def test_assigning_binds_the_employee_and_records_history(
    client, auth, employee: dict
) -> None:
    number = _attach(client, auth)

    response = _assign(client, auth, number["id"], employee["id"])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["employee_id"] == employee["id"]
    assert body["status"] == "active"
    assert body["assigned_at"] is not None

    with SessionLocal() as db:
        rows = (
            db.execute(
                select(PhoneNumberAssignment).where(
                    PhoneNumberAssignment.phone_number_id == number["id"]
                )
            )
            .scalars()
            .all()
        )
    assert len(rows) == 1
    assert rows[0].unassigned_at is None


def test_a_number_has_at_most_one_open_assignment(client, auth, employee: dict) -> None:
    """Rebinding closes the previous row instead of stacking another."""
    number = _attach(client, auth)

    _assign(client, auth, number["id"], employee["id"])
    _assign(client, auth, number["id"], employee["id"])

    with SessionLocal() as db:
        rows = (
            db.execute(
                select(PhoneNumberAssignment).where(
                    PhoneNumberAssignment.phone_number_id == number["id"]
                )
            )
            .scalars()
            .all()
        )
    assert len([row for row in rows if row.unassigned_at is None]) == 1
    assert len(rows) == 2


def test_unassigning_clears_the_employee(client, auth, employee: dict) -> None:
    number = _attach(client, auth)
    _assign(client, auth, number["id"], employee["id"])

    response = _assign(client, auth, number["id"], None)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["employee_id"] is None
    assert body["assigned_at"] is None
    assert body["routing"]["state"] == "unconfigured"


def test_another_workspaces_employee_cannot_be_bound(client, auth) -> None:
    number = _attach(client, auth)
    with SessionLocal() as db:
        other = _foreign_workspace(db)
        foreign = Employee(
            organization_id=other.id, name=unique("Foreign agent"), system_prompt=""
        )
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id

    response = _assign(client, auth, number["id"], foreign_id)

    assert response.status_code == 404, response.text
    assert response.json()["error"]["code"] == "not_found"
    # The refusal must not describe the other workspace.
    assert "Foreign agent" not in response.text


# ---------------------------------------------------------------------------
# Routing is the provider's answer, never ours
# ---------------------------------------------------------------------------
def test_an_assignment_is_not_reported_as_confirmed_routing(
    client, auth, employee: dict
) -> None:
    """A local assignment must never read as a live line."""
    number = _attach(client, auth, employee_id=employee["id"])

    routing = number["routing"]
    assert routing["confirmed"] is False
    assert routing["state"] in {"pending", "failed"}
    assert routing["checked_at"] is None


def test_provider_confirmation_is_what_makes_routing_active(
    client, auth, employee: dict
) -> None:
    number = _attach(client, auth, employee_id=employee["id"])
    with SessionLocal() as db:
        deployment = (
            db.execute(
                select(ProviderDeployment).where(
                    ProviderDeployment.phone_number_id == number["id"],
                    ProviderDeployment.channel_direction == "inbound",
                )
            )
            .scalars()
            .first()
        )
        assert deployment is not None, "assigning asks the provider to route"
        deployment.deployment_status = "active"
        deployment.last_synced_at = utcnow()
        deployment.deployed_at = utcnow()
        deployment.external_deployment_id = f"dep-{uuid.uuid4().hex[:10]}"
        external_id = deployment.external_deployment_id
        db.commit()

    view = client.get(f"{API}/phone-numbers/{number['id']}", headers=auth)

    assert view.status_code == 200, view.text
    routing = view.json()["routing"]
    assert routing["state"] == "active"
    assert routing["confirmed"] is True
    assert routing["checked_at"] is not None
    assert employee["name"] in routing["detail"]
    # The provider's own identifiers stay private.
    assert external_id not in view.text
    assert "provider_number_id" not in view.text


def test_an_active_row_without_a_provider_answer_stays_pending(
    client, auth, employee: dict
) -> None:
    """``active`` locally means "asked", not "answering"."""
    number = _attach(client, auth, employee_id=employee["id"])
    with SessionLocal() as db:
        deployment = (
            db.execute(
                select(ProviderDeployment).where(
                    ProviderDeployment.phone_number_id == number["id"],
                    ProviderDeployment.channel_direction == "inbound",
                )
            )
            .scalars()
            .first()
        )
        assert deployment is not None
        deployment.deployment_status = "active"
        deployment.last_synced_at = None
        db.commit()

    routing = client.get(
        f"{API}/phone-numbers/{number['id']}", headers=auth
    ).json()["routing"]

    assert routing["state"] == "pending"
    assert routing["confirmed"] is False


def test_rebinding_reuses_the_same_deployment_row(client, auth, employee: dict) -> None:
    """One inbound record per number, not one per assignment."""
    number = _attach(client, auth, employee_id=employee["id"])
    _assign(client, auth, number["id"], None)
    _assign(client, auth, number["id"], employee["id"])

    with SessionLocal() as db:
        rows = (
            db.execute(
                select(ProviderDeployment).where(
                    ProviderDeployment.phone_number_id == number["id"],
                    ProviderDeployment.channel_direction == "inbound",
                )
            )
            .scalars()
            .all()
        )
    assert len(rows) == 1


# ---------------------------------------------------------------------------
# Released means out of service
# ---------------------------------------------------------------------------
def test_a_released_number_cannot_be_assigned(client, auth, employee: dict) -> None:
    number = _attach(client, auth)
    client.delete(f"{API}/phone-numbers/{number['id']}", headers=auth)

    response = _assign(client, auth, number["id"], employee["id"])

    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "number_released"


def test_a_released_number_cannot_be_patched_back_into_service(client, auth) -> None:
    """Only attaching again starts a new life for the number."""
    number = _attach(client, auth)
    client.delete(f"{API}/phone-numbers/{number['id']}", headers=auth)

    response = client.patch(
        f"{API}/phone-numbers/{number['id']}", headers=auth, json={"status": "active"}
    )

    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "number_released"


# ---------------------------------------------------------------------------
# Tenancy and payload shape
# ---------------------------------------------------------------------------
def test_another_workspaces_number_is_not_found(client, auth) -> None:
    number = _number()
    with SessionLocal() as db:
        other = _foreign_workspace(db)
        foreign = PhoneNumber(
            organization_id=other.id,
            number=number,
            provider="sarvam",
            status="active",
        )
        db.add(foreign)
        db.commit()
        other_id = other.id

    response = client.get(f"{API}/phone-numbers", headers=auth, params={"page_size": 100})

    assert response.status_code == 200
    assert number not in response.text
    assert other_id not in response.text


def test_a_create_body_may_not_carry_a_provider_id(client, auth) -> None:
    """Provider identifiers are ours to keep, not the caller's to set."""
    response = client.post(
        f"{API}/phone-numbers",
        headers=auth,
        json={"number": _number(), "provider_number_id": "num-123"},
    )

    assert response.status_code == 422, response.text
    assert "provider_number_id" in response.text
