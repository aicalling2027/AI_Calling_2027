"""The calling lifecycle: something a customer turns on, not a side effect.

Option B splits "the employee exists" from "the employee answers the phone".
These tests pin that split: creation stores a configuration fingerprint and
touches nothing at the provider, enabling is the only path that deploys, an
edit demotes a live line to pending because nothing can push it into the
deployed agent, and a customer never sees a provider identifier.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.database.models.billing import SubscriptionPlan
from app.database.models.employee import Employee, EmployeeAgentBinding
from app.database.session import SessionLocal
from app.modules import billing
from tests.conftest import API, unique

#: The whole of what a customer learns about a phone line.
CALLING_KEYS = {
    "enabled",
    "state",
    "simulated",
    "connected",
    "last_checked_at",
    "action_required",
}


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------
def _plan_of(employee: dict) -> tuple[str, int]:
    with SessionLocal() as db:
        organization_id = db.get(Employee, employee["id"]).organization_id
        subscription = billing.ensure_subscription(db, organization_id)
        plan = db.get(SubscriptionPlan, subscription.plan_id)
        return plan.id, plan.max_employees


def _set_max_employees(plan_id: str, limit: int) -> None:
    with SessionLocal() as db:
        db.get(SubscriptionPlan, plan_id).max_employees = limit
        db.commit()


def _bindings(employee_id: str) -> list[EmployeeAgentBinding]:
    with SessionLocal() as db:
        return list(
            db.execute(
                select(EmployeeAgentBinding).where(
                    EmployeeAgentBinding.employee_id == employee_id
                )
            ).scalars()
        )


def _activate(client, auth, employee_id: str) -> None:
    response = client.post(
        f"{API}/employees/{employee_id}/status", headers=auth, json={"status": "active"}
    )
    assert response.status_code == 200, response.text


def _enable(client, auth, employee_id: str) -> dict:
    response = client.post(f"{API}/employees/{employee_id}/calling/enable", headers=auth)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture()
def calling_employee(client, auth, employee: dict):
    """A second employee with instructions, and the trial seat cap lifted."""
    plan_id, original = _plan_of(employee)
    _set_max_employees(plan_id, 20)
    response = client.post(
        f"{API}/employees",
        headers=auth,
        json={
            "name": unique("Calling employee"),
            "business_category": "Education",
            "default_language": "en-IN",
            "voice": "shubh",
            "first_message": "Hello, how can I help?",
            "system_prompt": "You are a helpful admissions counsellor.",
        },
    )
    assert response.status_code == 201, response.text
    row = response.json()
    try:
        yield row
    finally:
        client.delete(f"{API}/employees/{row['id']}", headers=auth)
        _set_max_employees(plan_id, original)


@pytest.fixture()
def draft_employee(client, auth, employee: dict):
    """An employee with no instructions - the state every new row starts in."""
    plan_id, original = _plan_of(employee)
    _set_max_employees(plan_id, 20)
    response = client.post(
        f"{API}/employees", headers=auth, json={"name": unique("Draft employee")}
    )
    assert response.status_code == 201, response.text
    row = response.json()
    try:
        yield row
    finally:
        client.delete(f"{API}/employees/{row['id']}", headers=auth)
        _set_max_employees(plan_id, original)


# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------
def test_creation_fingerprints_the_configuration_without_deploying(
    client, auth, calling_employee
):
    assert calling_employee["configuration_version"] == 1
    assert calling_employee["calling"]["enabled"] is False
    assert calling_employee["calling"]["state"] == "not_configured"
    assert _bindings(calling_employee["id"]) == []

    with SessionLocal() as db:
        row = db.get(Employee, calling_employee["id"])
        assert row.configuration_hash


# ---------------------------------------------------------------------------
# Enabling
# ---------------------------------------------------------------------------
def test_enabling_records_the_configuration_it_deployed(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    body = _enable(client, auth, calling_employee["id"])

    assert body["calling"]["enabled"] is True
    assert body["calling"]["state"] == "ready_to_deploy"
    assert body["calling"]["simulated"] is True
    assert body["calling"]["action_required"] == "provider_not_configured"

    bindings = _bindings(calling_employee["id"])
    assert len(bindings) == 1
    with SessionLocal() as db:
        row = db.get(Employee, calling_employee["id"])
        assert bindings[0].last_configuration_hash == row.configuration_hash
    assert bindings[0].sync_status == "simulated"
    assert bindings[0].deployment_id


def test_enabling_twice_reuses_the_same_deployment(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    _enable(client, auth, calling_employee["id"])
    first = _bindings(calling_employee["id"])[0].deployment_id

    second = _enable(client, auth, calling_employee["id"])

    assert second["calling"]["state"] == "ready_to_deploy"
    bindings = _bindings(calling_employee["id"])
    assert len(bindings) == 1
    assert bindings[0].deployment_id == first


def test_enabling_needs_instructions(client, auth, draft_employee):
    response = client.post(
        f"{API}/employees/{draft_employee['id']}/calling/enable", headers=auth
    )

    assert response.status_code == 422, response.text
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "instructions" in error["message"].lower()
    assert _bindings(draft_employee["id"]) == []


def test_enabling_a_paused_employee_is_refused(client, auth, calling_employee):
    """Turning the line on for a stopped employee would answer behind a badge."""
    _activate(client, auth, calling_employee["id"])
    _enable(client, auth, calling_employee["id"])
    client.post(
        f"{API}/employees/{calling_employee['id']}/status",
        headers=auth,
        json={"status": "paused"},
    )

    response = client.post(
        f"{API}/employees/{calling_employee['id']}/calling/enable", headers=auth
    )

    assert response.status_code == 409, response.text
    assert "activate it" in response.json()["error"]["message"].lower()


# ---------------------------------------------------------------------------
# Disabling and removing
# ---------------------------------------------------------------------------
def test_disabling_keeps_the_deployment(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    _enable(client, auth, calling_employee["id"])

    response = client.post(
        f"{API}/employees/{calling_employee['id']}/calling/disable", headers=auth
    )

    assert response.status_code == 200, response.text
    assert response.json()["calling"]["enabled"] is False
    assert response.json()["calling"]["state"] == "paused"
    # The line still exists; only the answering stopped.
    bindings = _bindings(calling_employee["id"])
    assert len(bindings) == 1
    assert bindings[0].deployment_id


def test_removing_the_number_drops_the_link(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    _enable(client, auth, calling_employee["id"])

    response = client.delete(
        f"{API}/employees/{calling_employee['id']}/calling", headers=auth
    )

    assert response.status_code == 200, response.text
    assert "number" in response.json()["message"].lower()
    assert _bindings(calling_employee["id"]) == []

    detail = client.get(f"{API}/employees/{calling_employee['id']}", headers=auth).json()
    assert detail["calling"]["state"] == "not_configured"
    assert detail["calling"]["connected"] is False
    # The employee survives, paused, ready to be given a new number.
    assert detail["status"] == "paused"


def test_removing_a_number_that_was_never_there_is_harmless(client, auth, calling_employee):
    response = client.delete(
        f"{API}/employees/{calling_employee['id']}/calling", headers=auth
    )

    assert response.status_code == 200, response.text
    assert "no number" in response.json()["message"].lower()


# ---------------------------------------------------------------------------
# Staleness
# ---------------------------------------------------------------------------
def test_a_rename_does_not_invalidate_the_deployment(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    _enable(client, auth, calling_employee["id"])

    renamed = client.patch(
        f"{API}/employees/{calling_employee['id']}",
        headers=auth,
        json={"name": unique("Renamed employee")},
    )

    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["configuration_version"] == 1
    assert renamed.json()["calling"]["state"] == "ready_to_deploy"


def test_a_voice_change_makes_the_line_one_save_behind(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    _enable(client, auth, calling_employee["id"])

    changed = client.patch(
        f"{API}/employees/{calling_employee['id']}",
        headers=auth,
        json={"voice": "tanya"},
    )

    assert changed.status_code == 200, changed.text
    assert changed.json()["configuration_version"] == 2
    assert changed.json()["calling"]["state"] == "configuration_pending"
    assert changed.json()["calling"]["action_required"] == "apply_configuration"


def test_an_unproven_configuration_is_not_reported_as_live(client, auth, calling_employee):
    """A deployment with no recorded fingerprint cannot be proven current."""
    with SessionLocal() as db:
        row = db.get(Employee, calling_employee["id"])
        row.calling_enabled = True
        row.calling_status = "live"
        db.add(
            EmployeeAgentBinding(
                organization_id=row.organization_id,
                employee_id=row.id,
                provider="sarvam-voice-agents",
                deployment_id="dep-legacy",
                status="active",
                sync_status="out_of_sync",
            )
        )
        db.commit()

    detail = client.get(f"{API}/employees/{calling_employee['id']}", headers=auth).json()

    assert detail["calling"]["state"] == "configuration_pending"
    # It really is answering; only the "your config is applied" claim is denied.
    assert detail["calling"]["connected"] is True


# ---------------------------------------------------------------------------
# White label
# ---------------------------------------------------------------------------
def test_the_calling_payload_holds_no_provider_identifiers(client, auth, calling_employee):
    _activate(client, auth, calling_employee["id"])
    detail = _enable(client, auth, calling_employee["id"])

    calling = detail["calling"]
    assert set(calling) == CALLING_KEYS
    rendered = str(calling).lower()
    for leak in ("sarvam", "deployment", "app_id", "workspace", "dep-"):
        assert leak not in rendered
