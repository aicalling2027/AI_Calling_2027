"""Attaching a number rented in the Sarvam console.

Renting happens in the console, so the platform only owns what follows: holding
the number against one workspace, refusing to duplicate it or to take another
workspace's line, and keeping the row (with its history) when the workspace
stops using it.
"""

from __future__ import annotations

import uuid

import pytest

from app.database.models.campaign import Campaign
from app.database.models.organization import Organization
from app.database.models.phone_number import PhoneNumber
from app.database.models.provider import ProviderDeployment
from app.database.session import SessionLocal
from tests.conftest import API, unique


def _number() -> str:
    """A number no other test can pick, so the unique index stays usable."""
    return f"+9197{uuid.uuid4().int % 10**8:08d}"


def _attach(client, auth: dict[str, str], number: str, **overrides: object):
    payload: dict[str, object] = {"number": number, "label": "Console line"}
    payload.update(overrides)
    return client.post(f"{API}/phone-numbers/attach", headers=auth, json=payload)


def _listed_numbers(client, auth: dict[str, str]) -> list[dict]:
    return client.get(
        f"{API}/phone-numbers", headers=auth, params={"page_size": 100}
    ).json()["items"]


@pytest.fixture(autouse=True)
def _roomy_plan(roomy_plan: None) -> None:
    """Lift the plan include: this file is about the attach lifecycle.

    It holds a dozen numbers in one workspace to exercise attaching, releasing
    and re-attaching. The include itself is enforced in its own test module.
    """


# ---------------------------------------------------------------------------
# Attaching
# ---------------------------------------------------------------------------
def test_attach_records_the_number_for_this_workspace(client, auth) -> None:
    number = _number()

    response = _attach(client, auth, number)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] is True
    assert body["source"] == "console"
    assert body["number"]["number"] == number
    # Nothing is routed until an employee answers it.
    assert body["number"]["status"] == "pending"
    assert body["number"]["employee_id"] is None


def test_attaching_twice_returns_the_same_row(client, auth) -> None:
    number = _number()

    first = _attach(client, auth, number).json()
    second = _attach(client, auth, number)

    assert second.status_code == 200, second.text
    body = second.json()
    assert body["created"] is False
    assert body["number"]["id"] == first["number"]["id"]

    stored = [row for row in _listed_numbers(client, auth) if row["number"] == number]
    assert len(stored) == 1


def test_spelling_the_number_differently_is_the_same_number(client, auth) -> None:
    """Digits decide identity, not spaces or the leading plus."""
    digits = f"9196{uuid.uuid4().int % 10**8:08d}"
    spaced = f"+{digits[:2]} {digits[2:7]} {digits[7:]}"

    first = _attach(client, auth, spaced)
    second = _attach(client, auth, digits)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json()["created"] is False
    assert second.json()["number"]["id"] == first.json()["number"]["id"]


def test_attach_can_bind_an_employee_immediately(client, auth, employee: dict) -> None:
    body = _attach(client, auth, _number(), employee_id=employee["id"]).json()

    assert body["number"]["status"] == "active"
    assert body["number"]["employee_id"] == employee["id"]


def test_another_workspace_cannot_attach_the_same_number(client, auth) -> None:
    number = _number()
    with SessionLocal() as db:
        other = Organization(name=unique("Other tenant"), slug=f"other-{uuid.uuid4().hex[:8]}")
        db.add(other)
        db.flush()
        other_id = other.id
        db.add(
            PhoneNumber(
                organization_id=other_id,
                number=number,
                provider="sarvam",
                status="active",
            )
        )
        db.commit()

    response = _attach(client, auth, number)

    assert response.status_code == 409, response.text
    gap = response.json()["error"]
    assert gap["code"] == "number_in_use"
    # The refusal must not reveal whose number it is.
    assert "another workspace" in gap["message"]
    assert other_id not in response.text


# ---------------------------------------------------------------------------
# Releasing
# ---------------------------------------------------------------------------
def test_release_keeps_the_row_and_its_history(client, auth) -> None:
    created = _attach(client, auth, _number()).json()["number"]

    released = client.delete(f"{API}/phone-numbers/{created['id']}", headers=auth)
    assert released.status_code == 200, released.text

    kept = client.get(f"{API}/phone-numbers/{created['id']}", headers=auth)
    assert kept.status_code == 200, kept.text
    assert kept.json()["status"] == "released"
    assert created["id"] in {row["id"] for row in _listed_numbers(client, auth)}


def test_a_released_number_can_be_attached_again(client, auth) -> None:
    """Re-attaching reuses the row, so its call history stays in one place."""
    number = _number()
    created = _attach(client, auth, number).json()["number"]
    client.delete(f"{API}/phone-numbers/{created['id']}", headers=auth)

    again = _attach(client, auth, number)

    assert again.status_code == 200, again.text
    body = again.json()
    assert body["created"] is True
    assert body["number"]["id"] == created["id"]
    assert body["number"]["status"] == "pending"


def test_release_is_refused_while_a_campaign_uses_the_number(
    client, auth, employee: dict
) -> None:
    created = _attach(client, auth, _number(), employee_id=employee["id"]).json()["number"]
    with SessionLocal() as db:
        db.add(
            Campaign(
                organization_id=created["organization_id"],
                name=unique("Campaign"),
                employee_id=employee["id"],
                phone_number_id=created["id"],
                status="running",
            )
        )
        db.commit()

    response = client.delete(f"{API}/phone-numbers/{created['id']}", headers=auth)

    assert response.status_code == 409, response.text
    body = response.json()["error"]
    assert body["code"] == "number_in_use"
    assert "campaign" in body["message"]
    assert body["details"]["campaigns"]
    # The line is untouched, so the campaign keeps dialing.
    kept = client.get(f"{API}/phone-numbers/{created['id']}", headers=auth).json()
    assert kept["status"] == "active"


def test_release_is_refused_while_an_inbound_deployment_uses_the_number(
    client, auth, employee: dict
) -> None:
    created = _attach(client, auth, _number(), employee_id=employee["id"]).json()["number"]
    with SessionLocal() as db:
        db.add(
            ProviderDeployment(
                organization_id=created["organization_id"],
                employee_id=employee["id"],
                phone_number_id=created["id"],
                channel_direction="inbound",
                deployment_status="active",
            )
        )
        db.commit()

    response = client.delete(f"{API}/phone-numbers/{created['id']}", headers=auth)

    assert response.status_code == 409, response.text
    body = response.json()["error"]
    assert body["code"] == "number_in_use"
    assert "deployment" in body["message"]
    assert body["details"]["deployments"]


def test_a_finished_campaign_does_not_hold_the_number(
    client, auth, employee: dict
) -> None:
    """History is not a reason to keep routing: only live work blocks a release."""
    created = _attach(client, auth, _number(), employee_id=employee["id"]).json()["number"]
    with SessionLocal() as db:
        db.add(
            Campaign(
                organization_id=created["organization_id"],
                name=unique("Campaign"),
                employee_id=employee["id"],
                phone_number_id=created["id"],
                status="completed",
            )
        )
        db.commit()

    response = client.delete(f"{API}/phone-numbers/{created['id']}", headers=auth)

    assert response.status_code == 200, response.text
    kept = client.get(f"{API}/phone-numbers/{created['id']}", headers=auth).json()
    assert kept["status"] == "released"


def test_a_patch_cannot_release_a_number_in_use(client, auth, employee: dict) -> None:
    """The status field is a second door into release, so it passes the guard."""
    created = _attach(client, auth, _number(), employee_id=employee["id"]).json()["number"]
    with SessionLocal() as db:
        db.add(
            Campaign(
                organization_id=created["organization_id"],
                name=unique("Campaign"),
                employee_id=employee["id"],
                phone_number_id=created["id"],
                status="scheduled",
            )
        )
        db.commit()

    response = client.patch(
        f"{API}/phone-numbers/{created['id']}",
        headers=auth,
        json={"status": "released"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "number_in_use"
