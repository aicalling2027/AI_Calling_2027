"""Two organizations, one database: membership decides what a caller can reach.

Every test here signs a second owner into a workspace of their own and then
tries to touch something that belongs to the first one. The API is exercised
rather than the helpers, because the token is what decides the tenant.

Reads, writes and the provider's routing answer are all checked: a refused read
is not enough on its own, since an update that found the row by id but ignored
the workspace would still be a leak.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.constants import Role
from app.core.security import create_access_token, hash_password
from app.database.base import utcnow
from app.database.models.call import Call
from app.database.models.campaign import Campaign
from app.database.models.employee import Employee
from app.database.models.organization import (
    Organization,
    OrganizationMember,
    User,
)
from app.database.models.phone_number import PhoneNumber
from app.database.models.provider import ProviderDeployment
from app.database.session import SessionLocal
from app.modules import billing
from tests.conftest import API, unique


def _number() -> str:
    return f"+9187{uuid.uuid4().int % 10**8:08d}"


@dataclass(frozen=True)
class Workspace:
    """A signed-in owner and the organization their token names."""

    organization_id: str
    user_id: str
    headers: dict[str, str]


@pytest.fixture(autouse=True)
def _schema(client) -> None:
    """The tables are created when the app starts, which the client does."""


def _workspace(db) -> Workspace:
    suffix = uuid.uuid4().hex[:8]
    organization = Organization(name=f"Isolated {suffix}", slug=f"isolated-{suffix}")
    user = User(
        email=f"owner-{suffix}@example.test",
        hashed_password=hash_password("Not@Used12345"),
        full_name=f"Owner {suffix}",
    )
    db.add_all([organization, user])
    db.flush()
    db.add(
        OrganizationMember(
            organization_id=organization.id,
            user_id=user.id,
            role=str(Role.OWNER),
        )
    )
    db.commit()

    token = create_access_token(
        user_id=user.id, organization_id=organization.id, role=Role.OWNER
    )
    return Workspace(
        organization_id=organization.id,
        user_id=user.id,
        headers={"Authorization": f"Bearer {token}"},
    )


def _employee(db, organization_id: str, label: str = "Agent") -> Employee:
    row = Employee(
        organization_id=organization_id, name=unique(label), system_prompt=""
    )
    db.add(row)
    db.commit()
    return row


def _names(response) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------
def test_an_employee_is_invisible_to_another_organization(client: TestClient) -> None:
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        employee = _employee(db, mine.organization_id, "Mine")
        employee_id, employee_name = employee.id, employee.name

    listing = client.get(f"{API}/employees?page=1&page_size=100", headers=theirs.headers)
    assert listing.status_code == 200, listing.text
    assert employee_name not in _names(listing)

    read = client.get(f"{API}/employees/{employee_id}", headers=theirs.headers)
    assert read.status_code == 404, read.text
    assert read.json()["error"]["code"] == "not_found"
    # The refusal must not name the record it refused to show.
    assert employee_name not in read.text


def test_an_employee_cannot_be_changed_from_another_organization(
    client: TestClient,
) -> None:
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        employee = _employee(db, mine.organization_id, "Untouchable")
        employee_id, employee_name = employee.id, employee.name

    renamed = client.patch(
        f"{API}/employees/{employee_id}",
        headers=theirs.headers,
        json={"name": unique("Hijacked")},
    )
    archived = client.delete(f"{API}/employees/{employee_id}", headers=theirs.headers)

    assert renamed.status_code == 404, renamed.text
    assert archived.status_code == 404, archived.text

    kept = client.get(f"{API}/employees/{employee_id}", headers=mine.headers)
    assert kept.status_code == 200, kept.text
    assert kept.json()["name"] == employee_name


# ---------------------------------------------------------------------------
# Phone numbers
# ---------------------------------------------------------------------------
def test_a_number_attached_here_is_invisible_there(client: TestClient) -> None:
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        their_employee = _employee(db, theirs.organization_id, "Their agent")
        their_employee_id = their_employee.id

    attached = client.post(
        f"{API}/phone-numbers/attach",
        headers=mine.headers,
        json={"number": _number()},
    )
    assert attached.status_code == 200, attached.text
    number_id = attached.json()["number"]["id"]

    listing = client.get(f"{API}/phone-numbers?page=1&page_size=100", headers=theirs.headers)
    assert listing.status_code == 200, listing.text
    assert [row["id"] for row in listing.json()["items"]] == []

    read = client.get(f"{API}/phone-numbers/{number_id}", headers=theirs.headers)
    renamed = client.patch(
        f"{API}/phone-numbers/{number_id}",
        headers=theirs.headers,
        json={"label": "Hijacked"},
    )
    bound = client.post(
        f"{API}/phone-numbers/{number_id}/assign",
        headers=theirs.headers,
        json={"employee_id": their_employee_id},
    )
    released = client.delete(f"{API}/phone-numbers/{number_id}", headers=theirs.headers)

    for refused in (read, renamed, bound, released):
        assert refused.status_code == 404, refused.text
        assert refused.json()["error"]["code"] == "not_found"

    # ...and the number is still theirs to use.
    kept = client.get(f"{API}/phone-numbers/{number_id}", headers=mine.headers)
    assert kept.status_code == 200, kept.text


def test_a_confirmed_route_is_reported_without_its_provider_ids(
    client: TestClient,
) -> None:
    """The workspace sees its routing state, never the provider's handles."""
    with SessionLocal() as db:
        mine = _workspace(db)
        employee = _employee(db, mine.organization_id, "Routed")
        number = PhoneNumber(
            organization_id=mine.organization_id,
            number=_number(),
            provider="sarvam",
            status="active",
            capabilities=["inbound"],
            employee_id=employee.id,
        )
        db.add(number)
        db.flush()
        db.add(
            ProviderDeployment(
                organization_id=mine.organization_id,
                employee_id=employee.id,
                provider="sarvam",
                phone_number_id=number.id,
                channel_direction="inbound",
                deployment_status="active",
                external_deployment_id="dep-secret-123",
                external_connection_id="conn-secret-456",
                last_synced_at=utcnow(),
            )
        )
        db.commit()
        number_id = number.id

    response = client.get(f"{API}/phone-numbers/{number_id}", headers=mine.headers)

    assert response.status_code == 200, response.text
    routing = response.json()["routing"]
    assert routing["state"] == "active"
    assert routing["confirmed"] is True
    assert "dep-secret-123" not in response.text
    assert "conn-secret-456" not in response.text


# ---------------------------------------------------------------------------
# Calls and campaigns
# ---------------------------------------------------------------------------
def test_calls_belong_to_the_workspace_that_handled_them(client: TestClient) -> None:
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        call = Call(
            organization_id=mine.organization_id,
            direction="inbound",
            status="completed",
            provider="sarvam",
        )
        db.add(call)
        db.commit()
        call_id = call.id

    listing = client.get(f"{API}/calls?page=1&page_size=100", headers=theirs.headers)
    assert listing.status_code == 200, listing.text
    assert call_id not in [row["id"] for row in listing.json()["items"]]

    read = client.get(f"{API}/calls/{call_id}", headers=theirs.headers)
    assert read.status_code == 404, read.text


def test_campaigns_belong_to_the_workspace_that_owns_them(client: TestClient) -> None:
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        employee = _employee(db, mine.organization_id, "Campaign agent")
        campaign = Campaign(
            organization_id=mine.organization_id,
            name=unique("Campaign"),
            employee_id=employee.id,
            status="draft",
        )
        db.add(campaign)
        db.commit()
        campaign_id = campaign.id

    listing = client.get(f"{API}/campaigns?page=1&page_size=100", headers=theirs.headers)
    assert listing.status_code == 200, listing.text
    assert campaign_id not in [row["id"] for row in listing.json()["items"]]

    read = client.get(f"{API}/campaigns/{campaign_id}", headers=theirs.headers)
    patched = client.patch(
        f"{API}/campaigns/{campaign_id}",
        headers=theirs.headers,
        json={"name": unique("Hijacked")},
    )
    assert read.status_code == 404, read.text
    assert patched.status_code == 404, patched.text


# ---------------------------------------------------------------------------
# Stale credentials
# ---------------------------------------------------------------------------
def test_a_token_stops_working_once_the_membership_does(
    client: TestClient,
) -> None:
    """A token outlives a role change, so the membership row decides."""
    with SessionLocal() as db:
        workspace = _workspace(db)

    allowed = client.get(f"{API}/employees?page=1&page_size=1", headers=workspace.headers)
    assert allowed.status_code == 200, allowed.text

    with SessionLocal() as db:
        membership = db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == workspace.organization_id,
                OrganizationMember.user_id == workspace.user_id,
            )
        ).scalar_one()
        membership.is_active = False
        db.commit()

    refused = client.get(f"{API}/employees?page=1&page_size=1", headers=workspace.headers)

    assert refused.status_code == 401, refused.text
    assert refused.json()["error"]["code"] == "unauthorized"


# ---------------------------------------------------------------------------
# The last place in a plan
# ---------------------------------------------------------------------------
def test_the_last_place_in_a_plan_cannot_be_spent_twice(client: TestClient) -> None:
    """Two attaches race for one place; only one may win and nothing half-exists.

    The refusal is the include, not a lost update: the second call re-reads the
    count under the workspace lock, so the row it would have written is absent.
    """
    with SessionLocal() as db:
        workspace = _workspace(db)
        # The report is read-only and stays empty until a plan exists, so give
        # this workspace the smallest one and measure against it.
        billing.ensure_subscription(db, workspace.organization_id, plan_code="starter")
        db.commit()
    quota = client.get(f"{API}/phone-numbers/sync", headers=workspace.headers).json()["quota"]
    assert quota is not None
    assert quota["limit"] == 1

    first = client.post(
        f"{API}/phone-numbers/attach",
        headers=workspace.headers,
        json={"number": _number()},
    )
    second = client.post(
        f"{API}/phone-numbers/attach",
        headers=workspace.headers,
        json={"number": _number()},
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 409, second.text
    gap = second.json()["error"]
    assert gap["code"] == "phone_number_limit_reached"
    assert gap["details"] == {"limit": 1, "current": 1, "plan": quota["plan"]}

    listed = client.get(f"{API}/phone-numbers?page=1&page_size=100", headers=workspace.headers)
    assert len(listed.json()["items"]) == 1
