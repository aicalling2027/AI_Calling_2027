"""Editing and deleting a lead from the screen that lists it.

"Recent instant leads" lets a person correct a row and remove it. Those two
actions reach the same endpoints a call campaign uses, so the rules pinned here
are the ones the API promises anyone: only the fields that were sent change,
an empty cell clears a value, and a deleted lead is gone for good while its
contact stays on file.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.database.models.lead import Contact
from app.database.session import SessionLocal
from tests.conftest import API, unique


def _phone() -> str:
    """A number no other test in the session can have claimed."""
    return f"+9196{uuid.uuid4().int % 10**8:08d}"


def _contact(lead: dict) -> dict:
    """The stored contact row behind a lead - there is no contacts endpoint."""
    with SessionLocal() as session:
        row = session.execute(
            select(Contact).where(Contact.id == lead["contact_id"])
        ).scalar_one()
        return {
            "full_name": row.full_name,
            "phone": row.phone,
            "email": row.email,
            "custom_fields": dict(row.custom_fields or {}),
        }


def _create(client, auth, **overrides) -> dict:
    contact = {
        "full_name": unique("Editable"),
        "phone": _phone(),
        "email": "first@example.com",
        "identity": "POL-1000",
    }
    contact.update(overrides.pop("contact", {}))
    response = client.post(
        f"{API}/leads", headers=auth, json={"contact": contact, **overrides}
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
def test_update_corrects_the_contact_and_its_identity(client, auth):
    """A typo in the name, the number or the reference is fixable in place."""
    lead = _create(client, auth)
    phone = _phone()

    response = client.patch(
        f"{API}/leads/{lead['id']}",
        headers=auth,
        json={
            "full_name": "Corrected Name",
            "phone": phone,
            "email": "second@example.com",
            "identity": "POL-2000",
        },
    )
    assert response.status_code == 200, response.text
    updated = response.json()

    assert updated["contact"]["full_name"] == "Corrected Name"
    assert updated["contact"]["phone"] == phone
    assert updated["contact"]["email"] == "second@example.com"
    # The lead's own copy follows the contact, so the two cannot disagree.
    assert updated["custom_fields"]["identity"] == "POL-2000"
    assert _contact(updated)["custom_fields"]["identity"] == "POL-2000"


def test_update_leaves_the_fields_it_was_not_given(client, auth):
    """Editing the reference alone must not blank the name or the number."""
    lead = _create(client, auth)
    before = _contact(lead)

    response = client.patch(
        f"{API}/leads/{lead['id']}", headers=auth, json={"identity": "POL-3000"}
    )
    assert response.status_code == 200, response.text

    after = _contact(response.json())
    assert after["full_name"] == before["full_name"]
    assert after["phone"] == before["phone"]
    assert after["email"] == before["email"]
    assert after["custom_fields"]["identity"] == "POL-3000"


def test_update_clears_a_value_with_an_empty_cell(client, auth):
    """A wrong reference is removable without deleting the lead and retyping it."""
    lead = _create(client, auth)

    response = client.patch(
        f"{API}/leads/{lead['id']}", headers=auth, json={"identity": "", "email": ""}
    )
    assert response.status_code == 200, response.text
    cleared = response.json()

    assert "identity" not in cleared["custom_fields"]
    stored = _contact(cleared)
    assert "identity" not in stored["custom_fields"]
    # Cleared, not stored as an empty string.
    assert stored["email"] is None


def test_a_one_character_name_is_rejected(client, auth):
    """``contacts.full_name`` is required, so the API refuses it up front."""
    lead = _create(client, auth)

    response = client.patch(
        f"{API}/leads/{lead['id']}", headers=auth, json={"full_name": "A"}
    )
    assert response.status_code == 422, response.text


def test_update_moves_the_lead_through_the_funnel(client, auth):
    """The status change is what the row's badge shows, and it is logged."""
    lead = _create(client, auth)
    assert lead["status"] == "new"

    response = client.patch(
        f"{API}/leads/{lead['id']}", headers=auth, json={"status": "contacted"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "contacted"

    activities = client.get(f"{API}/leads/{lead['id']}/activities", headers=auth)
    assert activities.status_code == 200, activities.text
    kinds = [row["activity_type"] for row in activities.json()]
    assert "status_changed" in kinds


def test_update_unassigns_the_employee(client, auth, employee):
    """Choosing "Unassigned" sends a null, which is not the same as omitting it."""
    lead = _create(client, auth, employee_id=employee["id"])
    assert lead["employee_id"] == employee["id"]

    response = client.patch(
        f"{API}/leads/{lead['id']}", headers=auth, json={"employee_id": None}
    )
    assert response.status_code == 200, response.text
    assert response.json()["employee_id"] is None


def test_a_lead_can_be_created_already_in_the_funnel(client, auth):
    """Instant Leads captures the outcome of the call it just placed."""
    lead = _create(client, auth, status="converted")
    assert lead["status"] == "converted"


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------
def test_delete_removes_the_lead_and_leaves_the_contact(client, auth):
    lead = _create(client, auth)

    removed = client.delete(f"{API}/leads/{lead['id']}", headers=auth)
    assert removed.status_code == 200, removed.text

    assert client.get(f"{API}/leads/{lead['id']}", headers=auth).status_code == 404
    # The number stays on file, so importing it again is still recognised.
    assert _contact(lead)["full_name"]


def test_deleting_twice_reports_the_lead_is_already_gone(client, auth):
    lead = _create(client, auth)
    assert client.delete(f"{API}/leads/{lead['id']}", headers=auth).status_code == 200

    again = client.delete(f"{API}/leads/{lead['id']}", headers=auth)
    assert again.status_code == 404, again.text


def test_a_deleted_lead_disappears_from_the_list(client, auth):
    """The list the screen reads must not keep handing back a deleted row."""
    lead = _create(client, auth)

    listed = client.get(f"{API}/leads?page=1&page_size=100", headers=auth)
    assert listed.status_code == 200, listed.text
    assert lead["id"] in [row["id"] for row in listed.json()["items"]]

    assert client.delete(f"{API}/leads/{lead['id']}", headers=auth).status_code == 200

    after = client.get(f"{API}/leads?page=1&page_size=100", headers=auth)
    assert after.status_code == 200, after.text
    assert lead["id"] not in [row["id"] for row in after.json()["items"]]
