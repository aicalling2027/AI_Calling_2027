"""The dashboard's "Build my employee" request, replayed against the API.

The create form in ``frontend/src/app/dashboard/employees/new/page.tsx`` posts
through ``toCreateBody()`` in ``frontend/src/lib/api/employees.ts``. That mapper
is the only caller of ``POST /employees`` from the product, so this test pins the
body it actually produces - a voice from the current Sarvam catalogue, a template
key from ``content/workspace``, the language rows ``languageSet()`` builds -
rather than a hand-written minimal payload the UI would never send.
"""

from __future__ import annotations

from tests.conftest import API, unique

#: The first voice in the dashboard catalogue; the form preselects a template
#: that carries it, so every create without an explicit change sends this.
DEFAULT_VOICE = "01a0cf16-7021-76f7-a0cc-9d065cdb30a8"

PROMPT = (
    "You are Riya, a warm and professional insurance advisor. Greet the "
    "customer, confirm the product they are interested in, capture their "
    "age and city, and offer a callback with a licensed advisor."
)


def form_payload(**overrides) -> dict:
    """Exactly what `toCreateBody()` sends for a template-driven form state."""
    payload = {
        "name": unique("Form agent"),
        "purpose": "Insurance advisor",
        "business_category": "Insurance & Finance",
        "template_key": "insurance",
        "system_prompt": PROMPT,
        "first_message": "Namaste, main Riya bol raha hoon. Aap kaise hain?",
        "voice": DEFAULT_VOICE,
        "model": "sarvam-m",
        "default_language": "en-IN",
        "languages": [{"language_code": "en-IN", "is_default": True}],
    }
    payload.update(overrides)
    return payload


def test_create_employee_from_the_dashboard_form(client, auth):
    """One create, asserted on everything the form is responsible for.

    The free plan allows two employees per workspace and this suite shares one
    database, so the test creates exactly one - a second create would fail on
    quota rather than on the behaviour under test.
    """
    payload = form_payload(
        languages=[
            {"language_code": "en-IN", "is_default": True},
            {"language_code": "hi-IN", "is_default": False},
            {"language_code": "ta-IN", "is_default": False},
        ]
    )
    response = client.post(f"{API}/employees", headers=auth, json=payload)
    assert response.status_code == 201, response.text

    created = response.json()
    assert created["name"].startswith("Form agent")
    assert created["purpose"] == "Insurance advisor"
    assert created["default_language"] == "en-IN"

    # The calling columns arrived in the provider-state migration. A database
    # that has not run it answers this request with a generic 500, not a 201,
    # so these two assertions are the regression guard.
    assert created["calling"]["enabled"] is False
    assert created["calling"]["state"] == "not_configured"

    codes = sorted(row["language_code"] for row in created["languages"])
    assert codes == ["en-IN", "hi-IN", "ta-IN"]
    assert [
        row["language_code"] for row in created["languages"] if row["is_default"]
    ] == ["en-IN"]
