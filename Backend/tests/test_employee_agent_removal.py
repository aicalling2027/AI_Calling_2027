"""Deleting a deployment from the voice platform.

Archiving pauses (the provider keeps its history); removing deletes, which kills
inbound calls to that number for good. These tests pin the difference: the
delete call only fires for a real deployment, a rejection leaves the link
intact so a retry is possible, and a 404 counts as already done.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.database.models.billing import SubscriptionPlan
from app.database.models.employee import Employee, EmployeeAgentBinding
from app.database.session import SessionLocal
from app.integrations import ProviderResponse
from app.modules import billing, employees
from tests.conftest import API, unique


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


def _bind(employee_id: str, *, deployment_id: str, simulated: bool) -> None:
    """Point the employee at a deployment, real or simulated.

    Creating an employee no longer deploys anything, so the link is made here
    rather than patched onto an existing row.
    """
    with SessionLocal() as db:
        binding = db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.employee_id == employee_id
            )
        ).scalar_one_or_none()
        if binding is None:
            employee = db.get(Employee, employee_id)
            binding = EmployeeAgentBinding(
                organization_id=employee.organization_id,
                employee_id=employee_id,
                provider=employees.sarvam_agents.PROVIDER,
                status="active",
            )
            db.add(binding)
        binding.deployment_id = deployment_id
        binding.simulated = simulated
        binding.status = "active"
        db.commit()


def _binding_of(employee_id: str) -> EmployeeAgentBinding | None:
    with SessionLocal() as db:
        return db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.employee_id == employee_id
            )
        ).scalar_one_or_none()


@pytest.fixture()
def agent(client, auth, employee: dict):
    """A second employee, with the trial seat cap lifted while it exists."""
    plan_id, original = _plan_of(employee)
    _set_max_employees(plan_id, 20)
    response = client.post(
        f"{API}/employees",
        headers=auth,
        json={
            "name": unique("Removable agent"),
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


def test_a_simulated_deployment_is_dropped_without_a_request(
    client, auth, agent, monkeypatch
):
    """It never existed on the platform, so there is nothing to delete there."""
    _bind(agent["id"], deployment_id="dep-sim-test", simulated=True)
    calls: list[str] = []
    monkeypatch.setattr(
        employees.sarvam_agents,
        "delete_deployment",
        lambda deployment_id: calls.append(deployment_id),
    )

    response = client.delete(f"{API}/employees/{agent['id']}/agent", headers=auth)

    assert response.status_code == 200, response.text
    assert calls == []
    detail = client.get(f"{API}/employees/{agent['id']}", headers=auth).json()
    assert detail["calling"]["state"] == "not_configured"
    assert detail["calling"]["connected"] is False
    # No agent means no calls, so the employee stops claiming to be live.
    assert detail["status"] == "paused"
    assert _binding_of(agent["id"]) is None


def test_a_live_deployment_is_deleted_on_the_platform(client, auth, agent, monkeypatch):
    _bind(agent["id"], deployment_id="dep-live-1", simulated=False)
    removed: list[str] = []

    def fake_delete(deployment_id: str) -> ProviderResponse:
        removed.append(deployment_id)
        return ProviderResponse(ok=True, data={"deployment_id": deployment_id})

    monkeypatch.setattr(employees.sarvam_agents, "delete_deployment", fake_delete)

    response = client.delete(f"{API}/employees/{agent['id']}/agent", headers=auth)

    assert response.status_code == 200, response.text
    assert removed == ["dep-live-1"]
    detail = client.get(f"{API}/employees/{agent['id']}", headers=auth).json()
    assert detail["calling"]["connected"] is False
    assert detail["calling"]["state"] == "not_configured"


def test_a_rejected_delete_keeps_the_link(client, auth, agent, monkeypatch):
    """The link is the only record of the deployment, so keep it until it is gone."""
    _bind(agent["id"], deployment_id="dep-live-2", simulated=False)
    monkeypatch.setattr(
        employees.sarvam_agents,
        "delete_deployment",
        lambda deployment_id: ProviderResponse(
            ok=False, error="(500) Could not reach the call router.", status_code=500
        ),
    )

    response = client.delete(f"{API}/employees/{agent['id']}/agent", headers=auth)

    assert response.status_code == 502, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_error"
    assert "call router" in error["message"]
    detail = client.get(f"{API}/employees/{agent['id']}", headers=auth).json()
    assert detail["calling"]["connected"] is True
    assert detail["status"] != "paused"


def test_a_rejected_key_reads_as_a_configuration_problem(
    client, auth, agent, monkeypatch
):
    _bind(agent["id"], deployment_id="dep-live-3", simulated=False)
    monkeypatch.setattr(
        employees.sarvam_agents,
        "delete_deployment",
        lambda deployment_id: ProviderResponse(
            ok=False, error="(401) Unauthorized", status_code=401
        ),
    )

    response = client.delete(f"{API}/employees/{agent['id']}/agent", headers=auth)

    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_not_configured"
    assert "api key" in error["message"].lower()
    assert "401" not in error["message"]


def test_removing_twice_is_harmless(client, auth, agent):
    """The second call has nothing to delete and says so instead of failing."""
    _bind(agent["id"], deployment_id="dep-sim-twice", simulated=True)
    first = client.delete(f"{API}/employees/{agent['id']}/agent", headers=auth)
    second = client.delete(f"{API}/employees/{agent['id']}/agent", headers=auth)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert "no agent" in second.json()["message"].lower()


def test_adapter_deletes_the_deployment_path(monkeypatch):
    captured: dict = {}

    def fake_request(method: str, url: str, **kwargs) -> ProviderResponse:
        captured.update(method=method, url=url, headers=kwargs.get("headers"))
        return ProviderResponse(ok=True, data={})

    monkeypatch.setattr(employees.sarvam_agents, "missing_workspace_settings", lambda: [])
    monkeypatch.setattr(employees.sarvam_agents, "request_json", fake_request)

    result = employees.sarvam_agents.delete_deployment("dep-9")

    assert result.ok
    assert result.data["deleted"] is True
    assert captured["method"] == "DELETE"
    assert captured["url"].endswith("/deployments/dep-9")
    assert captured["headers"]["X-API-Key"]


def test_adapter_treats_a_missing_deployment_as_done(monkeypatch):
    """A half-finished delete must not block the retry."""
    monkeypatch.setattr(employees.sarvam_agents, "missing_workspace_settings", lambda: [])
    monkeypatch.setattr(
        employees.sarvam_agents,
        "request_json",
        lambda *args, **kwargs: ProviderResponse(
            ok=False, error="(404) Not Found", status_code=404
        ),
    )

    result = employees.sarvam_agents.delete_deployment("dep-gone")

    assert result.ok
    assert result.data["already_gone"] is True
