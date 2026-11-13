"""Importing the agents that already exist on Sarvam.

The pull is a *link*: one remote deployment becomes one employee, and nothing
is deployed or deleted. The trial plan caps a tenant at two employees, so the
``seats`` fixture raises the limit while these tests run; the cap itself is
covered by ``test_api``.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.database.models.billing import SubscriptionPlan
from app.database.models.employee import Employee
from app.database.session import SessionLocal
from app.integrations import ProviderResponse
from app.modules import billing, employees
from tests.conftest import API, unique


def _deployment(
    deployment_id: str, name: str, *, status: str = "active", version: int = 3
) -> dict:
    return {
        "deployment_id": deployment_id,
        "app_id": "support-agent",
        "app_version": version,
        "status": status,
        "name": name,
        "description": "Pulled from the Sarvam console.",
        "phone_numbers": ["+918047168000"],
    }


def _as_workspace(monkeypatch: pytest.MonkeyPatch, deployments: list[dict]) -> None:
    """Pretend Sarvam is addressed and answered with exactly these deployments."""
    monkeypatch.setattr(employees.sarvam_agents, "missing_workspace_settings", lambda: [])
    # The developer's own .env decides this; the tests describe a valid key.
    monkeypatch.setattr(employees.sarvam_agents, "key_conflicts_with_ids", lambda: False)
    monkeypatch.setattr(
        employees.sarvam_agents,
        "list_deployments",
        lambda **_: ProviderResponse(
            ok=True, data={"items": deployments, "total": len(deployments)}
        ),
    )


@pytest.fixture()
def seats(employee: dict):
    """Widen the tenant's seat count, then put it back."""
    plan_id, original = _plan_of(employee)
    _set_max_employees(plan_id, 20)
    try:
        yield
    finally:
        _set_max_employees(plan_id, original)


def _plan_of(employee: dict) -> tuple[str, int]:
    """The tenant's plan id and its current seat count."""
    with SessionLocal() as db:
        organization_id = db.get(Employee, employee["id"]).organization_id
        subscription = billing.ensure_subscription(db, organization_id)
        plan = db.get(SubscriptionPlan, subscription.plan_id)
        return plan.id, plan.max_employees


def _set_max_employees(plan_id: str, limit: int) -> None:
    with SessionLocal() as db:
        db.get(SubscriptionPlan, plan_id).max_employees = limit
        db.commit()


def _archive(client, auth, *employee_ids: str) -> None:
    for employee_id in employee_ids:
        client.delete(f"{API}/employees/{employee_id}", headers=auth)


def test_import_explains_which_settings_are_missing(client, auth, monkeypatch):
    """Without the workspace ids there is nothing to pull, and we say which."""
    monkeypatch.setattr(
        employees.sarvam_agents,
        "missing_workspace_settings",
        lambda: ["SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID"],
    )

    response = client.post(f"{API}/employees/import", headers=auth)

    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_not_configured"
    # The operator needs the variable names; the end user just needs the gist.
    assert error["details"]["missing"] == ["SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID"]
    assert "workspace" in error["message"].lower()


def test_import_creates_one_employee_per_deployment(client, auth, seats, monkeypatch):
    active_name = unique("Sarvam support")
    paused_name = unique("Sarvam sales")
    _as_workspace(
        monkeypatch,
        [
            _deployment("dep-imp-1", active_name, status="active", version=3),
            _deployment("dep-imp-2", paused_name, status="paused", version=7),
        ],
    )

    response = client.post(f"{API}/employees/import", headers=auth)

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["fetched"], body["created"], body["updated"], body["skipped"]) == (2, 2, 0, 0)

    rows = client.get(f"{API}/employees", headers=auth).json()["items"]
    by_name = {row["name"]: row for row in rows}
    assert by_name[active_name]["calling"]["connected"] is True
    assert by_name[active_name]["calling"]["simulated"] is False
    assert by_name[paused_name]["calling"]["state"] == "paused"
    # The deployment answers, but this row does not describe what it says, so
    # the workspace does not claim the saved configuration is live.
    assert by_name[active_name]["calling"]["state"] == "configuration_pending"
    # No provider identifier leaves the building.
    assert "deployment_id" not in str(by_name[active_name]["calling"])
    # The remote state is reflected, not overwritten by a local draft.
    assert by_name[active_name]["status"] == "active"
    assert by_name[paused_name]["status"] == "paused"

    _archive(client, auth, by_name[active_name]["id"], by_name[paused_name]["id"])


def test_import_twice_updates_the_link_instead_of_duplicating(client, auth, seats, monkeypatch):
    name = unique("Sarvam renewals")
    _as_workspace(monkeypatch, [_deployment("dep-imp-3", name, version=2)])
    first = client.post(f"{API}/employees/import", headers=auth).json()
    assert first["created"] == 1

    # Same deployment, a new agent version, paused from the Sarvam console.
    _as_workspace(monkeypatch, [_deployment("dep-imp-3", name, status="paused", version=4)])
    second = client.post(f"{API}/employees/import", headers=auth).json()

    assert (second["created"], second["updated"], second["skipped"]) == (0, 1, 0)
    rows = client.get(f"{API}/employees", headers=auth).json()["items"]
    matching = [row for row in rows if row["name"] == name]
    assert len(matching) == 1
    assert matching[0]["calling"]["state"] == "paused"
    assert matching[0]["status"] == "paused"

    _archive(client, auth, matching[0]["id"])


def test_import_does_not_resurrect_an_archived_employee(client, auth, seats, monkeypatch):
    name = unique("Sarvam legacy")
    _as_workspace(monkeypatch, [_deployment("dep-imp-4", name)])
    created = client.post(f"{API}/employees/import", headers=auth).json()["items"][0]
    _archive(client, auth, created["employee_id"])

    again = client.post(f"{API}/employees/import", headers=auth)

    assert again.status_code == 200, again.text
    body = again.json()
    assert (body["created"], body["updated"], body["skipped"]) == (0, 0, 1)
    assert body["items"][0]["reason"] == "Archived in this workspace"

    visible = client.get(f"{API}/employees", headers=auth).json()["items"]
    assert name not in {row["name"] for row in visible}


def test_import_stops_at_the_plan_limit(client, auth, employee, monkeypatch):
    """A pull cannot smuggle employees past the tenant's seat count."""
    plan_id, original = _plan_of(employee)
    occupied = len(client.get(f"{API}/employees", headers=auth).json()["items"])

    _set_max_employees(plan_id, occupied + 1)
    try:
        _as_workspace(
            monkeypatch,
            [
                _deployment("dep-cap-1", unique("Sarvam one")),
                _deployment("dep-cap-2", unique("Sarvam two")),
            ],
        )
        body = client.post(f"{API}/employees/import", headers=auth).json()
    finally:
        _set_max_employees(plan_id, original)

    assert (body["created"], body["skipped"]) == (1, 1)
    skipped = [item for item in body["items"] if item["action"] == "skipped"]
    assert skipped[0]["reason"] == f"Plan limit of {occupied + 1} employees reached"

    imported = [item["employee_id"] for item in body["items"] if item["action"] == "created"]
    _archive(client, auth, *imported)


def test_import_turns_a_rejected_key_into_a_sentence(client, auth, monkeypatch):
    """A 401 from the workspace is read by a person, not a log file."""
    monkeypatch.setattr(employees.sarvam_agents, "missing_workspace_settings", lambda: [])
    monkeypatch.setattr(employees.sarvam_agents, "key_conflicts_with_ids", lambda: False)
    monkeypatch.setattr(
        employees.sarvam_agents,
        "list_deployments",
        lambda **_: ProviderResponse(ok=False, error="(401) Unauthorized", status_code=401),
    )

    response = client.post(f"{API}/employees/import", headers=auth)

    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_not_configured"
    assert "api key" in error["message"].lower()
    assert "401" not in error["message"]


def test_key_field_holds_an_id_is_caught_before_the_call(client, auth, monkeypatch):
    """The workspace id sits next to the key in .env; name the mix-up."""
    monkeypatch.setattr(employees.sarvam_agents, "missing_workspace_settings", lambda: [])
    monkeypatch.setattr(employees.sarvam_agents, "key_conflicts_with_ids", lambda: True)

    response = client.post(f"{API}/employees/import", headers=auth)

    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_not_configured"
    assert "workspace id" in error["message"]
    assert error["details"]["setting"] == "SARVAM_AGENTS_API_KEY"


def test_key_conflicts_with_ids_compares_against_both_ids(monkeypatch):
    fake = SimpleNamespace(
        sarvam_agents_api_key="ws-1",
        sarvam_api_key="model-key",
        sarvam_org_id="org-1",
        sarvam_workspace_id="ws-1",
    )
    monkeypatch.setattr(employees.sarvam_agents, "settings", fake)

    assert employees.sarvam_agents.key_conflicts_with_ids() is True

    fake.sarvam_agents_api_key = "real-key"
    assert employees.sarvam_agents.key_conflicts_with_ids() is False
