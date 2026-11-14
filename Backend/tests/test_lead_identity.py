"""The Identity column on an uploaded lead sheet.

The Instant Leads screen accepts Name, Email, Phone and Identity. Identity is
the customer's own reference - a policy, application or account number - so it
is stored as metadata in ``custom_fields`` instead of becoming a column the
product has to own. These tests pin that behaviour on both write paths, single
and bulk, plus the merging rules that keep a repeat import from clobbering an
identity somebody has since corrected.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.database.models.lead import Contact
from app.database.session import SessionLocal
from tests.conftest import API, unique


def _phone() -> str:
    """A number no other test in the session can have claimed."""
    return f"+9197{uuid.uuid4().int % 10**8:08d}"


def _contact_metadata(contact_id: str) -> dict:
    """Read the stored contact row directly - there is no contacts endpoint."""
    with SessionLocal() as session:
        contact = session.execute(
            select(Contact).where(Contact.id == contact_id)
        ).scalar_one()
        return dict(contact.custom_fields or {})


# ---------------------------------------------------------------------------
# Single lead
# ---------------------------------------------------------------------------
def test_single_lead_keeps_the_identity_on_the_lead_and_the_contact(client, auth):
    phone = _phone()

    created = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {
                "full_name": unique("Identity single"),
                "phone": phone,
                "email": "buyer@example.com",
                "identity": "  POL-4471  ",
                # An unrelated field must survive the merge untouched.
                "custom_fields": {"branch": "north"},
            },
            "source": "instant",
        },
    )
    assert created.status_code == 201, created.text
    lead = created.json()

    # Trimmed, and folded in alongside the contact's own metadata.
    assert lead["custom_fields"]["identity"] == "POL-4471"
    contact_fields = _contact_metadata(lead["contact_id"])
    assert contact_fields["identity"] == "POL-4471"
    assert contact_fields["branch"] == "north"


def test_single_lead_does_not_overwrite_an_explicit_identity(client, auth):
    """The value already in ``custom_fields`` wins, on both records."""
    created = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {
                "full_name": unique("Identity collide"),
                "phone": _phone(),
                "identity": "FROM-THE-SHEET",
                "custom_fields": {"identity": "ALREADY-CORRECTED"},
            },
            "source": "instant",
        },
    )
    assert created.status_code == 201, created.text
    lead = created.json()
    # The typed field must not silently replace the caller's own value, and
    # the lead must not end up disagreeing with the contact it points at.
    assert lead["custom_fields"]["identity"] == "ALREADY-CORRECTED"
    assert _contact_metadata(lead["contact_id"])["identity"] == "ALREADY-CORRECTED"


def test_blank_identity_is_not_stored(client, auth):
    """A whitespace-only cell is an empty cell, not an empty key."""
    created = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {
                "full_name": unique("Identity blank"),
                "phone": _phone(),
                "identity": "   ",
            },
            "source": "instant",
        },
    )
    assert created.status_code == 201, created.text
    assert "identity" not in created.json()["custom_fields"]


def test_identity_is_optional_because_most_sheets_omit_it(client, auth):
    created = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {"full_name": unique("Identity absent"), "phone": _phone()},
            "source": "instant",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["custom_fields"] == {}


def test_identity_longer_than_the_column_is_rejected(client, auth):
    """64 characters is the cell budget; a longer value fails loudly."""
    response = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {
                "full_name": unique("Identity long"),
                "phone": _phone(),
                "identity": "X" * 65,
            },
            "source": "instant",
        },
    )
    assert response.status_code == 422, response.text


# ---------------------------------------------------------------------------
# Bulk import
# ---------------------------------------------------------------------------
def test_bulk_import_keeps_each_rows_identity(client, auth):
    rows = [
        (unique("Identity bulk"), _phone(), "APP-8801"),
        (unique("Identity bulk"), _phone(), "APP-8802"),
        (unique("Identity bulk"), _phone(), None),
    ]

    response = client.post(
        f"{API}/leads/bulk",
        headers=auth,
        json={
            "leads": [
                {"full_name": name, "phone": phone, "identity": identity}
                for name, phone, identity in rows
            ],
            "source": "instant",
            "source_detail": "instant_leads_upload",
        },
    )
    assert response.status_code in (200, 201), response.text
    summary = response.json()
    assert summary["created"] == 3
    assert len(summary["lead_ids"]) == 3
    # The caller is told which numbers landed, not only how many - a sheet can
    # mix duplicates with new rows, and the count alone cannot tell them apart.
    assert [phone for _, phone, _ in rows] == summary["created_phones"]

    for lead_id, (_, _, identity) in zip(summary["lead_ids"], rows):
        detail = client.get(f"{API}/leads/{lead_id}", headers=auth)
        assert detail.status_code == 200, detail.text
        stored = detail.json()["custom_fields"]
        if identity is None:
            assert "identity" not in stored
        else:
            assert stored["identity"] == identity


def test_bulk_import_skips_a_number_it_already_holds(client, auth):
    """Re-uploading the same sheet must not duplicate anyone."""
    phone = _phone()
    payload = {
        "leads": [
            {"full_name": unique("Identity repeat"), "phone": phone, "identity": "ACC-1"}
        ],
        "source": "instant",
    }

    first = client.post(f"{API}/leads/bulk", headers=auth, json=payload)
    assert first.status_code in (200, 201), first.text
    assert first.json()["created"] == 1

    second = client.post(f"{API}/leads/bulk", headers=auth, json=payload)
    assert second.status_code in (200, 201), second.text
    assert second.json()["created"] == 0
    assert second.json()["skipped"] == 1
    assert second.json()["created_phones"] == []
