"""Choosing the line an outbound call dials from.

Validation is local and deliberate: it reads what the workspace recorded when
the number was attached, never the provider, and never places a call. A number
the caller picked is refused rather than swapped for another one, so a
workspace cannot be surprised by which line its calls came from.
"""

from __future__ import annotations

import uuid

import pytest

from app.core.exceptions import ConflictError, NotFoundError
from app.database.models.employee import Employee
from app.database.models.organization import Organization
from app.database.models.phone_number import PhoneNumber
from app.database.session import SessionLocal
from app.integrations import voice_provider
from app.modules import phone_numbers
from tests.conftest import unique


def _number() -> str:
    return f"+9186{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture(autouse=True)
def _schema(client) -> None:
    """The tables are created when the app starts, which the client does."""


def _workspace(db) -> Organization:
    organization = Organization(
        name=f"Dial {uuid.uuid4().hex[:8]}", slug=f"dial-{uuid.uuid4().hex[:8]}"
    )
    db.add(organization)
    db.commit()
    return organization


def _line(db, organization: Organization, **overrides: object) -> PhoneNumber:
    fields: dict[str, object] = {
        "organization_id": organization.id,
        "number": _number(),
        "provider": "sarvam",
        "status": "active",
        "capabilities": ["inbound", "outbound"],
    }
    fields.update(overrides)
    row = PhoneNumber(**fields)  # type: ignore[arg-type]
    db.add(row)
    db.commit()
    return row


def _refusal(db, organization_id: str, row: PhoneNumber) -> ConflictError:
    with pytest.raises(ConflictError) as caught:
        phone_numbers.resolve_outbound_number(
            db, organization_id, phone_number_id=row.id
        )
    return caught.value


# ---------------------------------------------------------------------------
# An explicit choice is validated
# ---------------------------------------------------------------------------
def test_a_line_that_supports_outbound_is_returned() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        row = _line(db, organization)

        chosen = phone_numbers.resolve_outbound_number(
            db, organization.id, phone_number_id=row.id
        )

    assert chosen is not None
    assert chosen.id == row.id


def test_a_line_attached_without_outbound_is_refused() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        row = _line(db, organization, capabilities=["inbound"])

        error = _refusal(db, organization.id, row)

    assert error.status_code == 409
    assert error.code == "phone_number_unavailable"
    assert error.details["reason"] == "outbound_not_supported"


def test_a_pending_line_is_refused() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        row = _line(db, organization, status="pending")

        error = _refusal(db, organization.id, row)

    assert error.code == "phone_number_unavailable"
    assert error.details["reason"] == "inactive"


def test_a_released_line_is_refused() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        row = _line(db, organization, status="released")

        error = _refusal(db, organization.id, row)

    assert error.code == "phone_number_unavailable"
    assert error.details["reason"] == "released"


def test_another_workspaces_line_is_not_found() -> None:
    with SessionLocal() as db:
        mine = _workspace(db)
        theirs = _workspace(db)
        foreign = _line(db, theirs)

        with pytest.raises(NotFoundError):
            phone_numbers.resolve_outbound_number(
                db, mine.id, phone_number_id=foreign.id
            )


# ---------------------------------------------------------------------------
# The fallback skips what cannot dial
# ---------------------------------------------------------------------------
def test_the_fallback_skips_a_line_that_cannot_dial() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        inbound_only = _line(db, organization, capabilities=["inbound"])
        dialable = _line(db, organization)

        chosen = phone_numbers.resolve_outbound_number(db, organization.id)

    assert chosen is not None
    assert chosen.id == dialable.id
    assert chosen.id != inbound_only.id


def test_the_fallback_prefers_the_employees_own_line() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        agent = Employee(
            organization_id=organization.id, name=unique("Dial agent"), system_prompt=""
        )
        db.add(agent)
        db.flush()
        _line(db, organization)
        bound = _line(db, organization, employee_id=agent.id)

        chosen = phone_numbers.resolve_outbound_number(
            db, organization.id, employee_id=agent.id
        )

    assert chosen is not None
    assert chosen.id == bound.id


def test_no_dialable_line_is_reported_as_none() -> None:
    with SessionLocal() as db:
        organization = _workspace(db)
        _line(db, organization, capabilities=["inbound"])

        assert phone_numbers.resolve_outbound_number(db, organization.id) is None


# ---------------------------------------------------------------------------
# No provider, no call
# ---------------------------------------------------------------------------
def test_resolving_never_reaches_the_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(*args: object, **kwargs: object) -> None:  # pragma: no cover
        raise AssertionError("choosing a number must not contact the provider")

    monkeypatch.setattr(voice_provider, "get_voice_provider", explode)

    with SessionLocal() as db:
        organization = _workspace(db)
        row = _line(db, organization)

        chosen = phone_numbers.resolve_outbound_number(
            db, organization.id, phone_number_id=row.id
        )

    assert chosen is not None
    assert chosen.id == row.id
