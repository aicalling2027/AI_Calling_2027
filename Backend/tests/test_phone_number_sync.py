"""Number inventory, and the carrier adapter kept beside it.

Sarvam publishes no server-to-server API for connections or rented numbers, so
the product no longer reads a carrier: the inventory report describes what this
workspace attached, and says so. The Vobiz adapter stays in the tree (and stays
tested here) until the replacement is verified, but nothing in the product
calls it.

The adapter tests drive a fake transport, so no test reaches Vobiz.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings, settings
from app.integrations import ProviderResponse, vobiz
from tests.conftest import API


@pytest.fixture()
def carrier(monkeypatch: pytest.MonkeyPatch):
    """A configured account; the network call is stubbed per test."""
    monkeypatch.setattr(settings, "vobiz_auth_id", "MA_TESTACCOUNT")
    monkeypatch.setattr(settings, "vobiz_auth_token", "test-token")


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------
def test_normalise_translates_the_vendor_shape() -> None:
    item = vobiz.normalise(
        {
            "id": "num-9",
            "account_id": "MA_TESTACCOUNT",
            "e164": "+919876543210",
            "country": "in",
            "region": "Karnataka",
            "capabilities": {"voice": True, "sms": False, "mms": False, "fax": True},
            "status": "Active",
            "monthly_fee": "300.00",
            "currency": "inr",
            "voice_enabled": True,
            "is_trial_number": True,
        }
    )
    assert item["number"] == "+919876543210"
    assert item["country"] == "IN"
    assert item["status"] == "active"
    assert item["capabilities"] == ["voice", "fax"]
    assert item["monthly_fee"] == 300
    assert item["currency"] == "INR"
    assert item["is_trial"] is True
    assert item["provider_number_id"] == "num-9"


def test_unconfigured_account_is_refused_before_any_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "vobiz_auth_id", "")
    monkeypatch.setattr(settings, "vobiz_auth_token", "")

    def explode(*args: object, **kwargs: object) -> None:  # pragma: no cover
        raise AssertionError("an unconfigured adapter must not dial out")

    monkeypatch.setattr(vobiz, "request_json", explode)
    result = vobiz.list_numbers()

    assert result.ok is False
    assert result.status_code == 503
    assert "VOBIZ_AUTH_ID" in str(result.error)


def test_list_numbers_walks_every_page(
    carrier, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[dict] = []

    def fake_request(method: str, url: str, **kwargs: object) -> ProviderResponse:
        params = kwargs["params"]
        assert isinstance(params, dict)
        seen.append(params)
        headers = kwargs.get("headers") or {}
        assert headers["X-Auth-ID"] == "MA_TESTACCOUNT"
        assert headers["X-Auth-Token"] == "test-token"
        page = int(params["page"])
        items = [{"e164": f"+9190000{page}{index:04d}"} for index in range(2)]
        return ProviderResponse(ok=True, data={"items": items, "total": 4}, status_code=200)

    monkeypatch.setattr(vobiz, "request_json", fake_request)
    result = vobiz.list_numbers(per_page=2)

    assert result.ok is True
    assert [entry["page"] for entry in seen] == [1, 2]
    assert len(result.data["items"]) == 4
    assert result.data["truncated"] is False


def test_page_ceiling_is_reported_as_truncated(
    carrier, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_request(method: str, url: str, **kwargs: object) -> ProviderResponse:
        items = [{"e164": f"+9190000{index:04d}"} for index in range(2)]
        return ProviderResponse(ok=True, data={"items": items, "total": 99}, status_code=200)

    monkeypatch.setattr(vobiz, "request_json", fake_request)
    result = vobiz.list_numbers(per_page=2, max_pages=1)

    assert result.ok is True
    assert result.data["truncated"] is True


# ---------------------------------------------------------------------------
# Inventory report
# ---------------------------------------------------------------------------
def test_report_describes_a_manually_attached_inventory(
    client, auth, phone_number: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """No carrier is read, and the report does not pretend otherwise."""
    monkeypatch.setattr(settings, "sarvam_connection_id", "01145810-b1-9af47dd1-c543")

    response = client.get(f"{API}/phone-numbers/sync", headers=auth)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "manual"
    assert body["inventory_source"] == "manual"
    # Nothing remote is claimed: no provider, no account label, no count.
    assert body["provider"] is None
    assert body["connection"] is None
    assert body["remote_total"] is None
    assert body["remote_active"] is None
    assert body["numbers"] == []
    assert body["mismatches"] == []
    # The connection the agents dial through is still named.
    assert body["connection_id"] == "01145810-b1-9af47dd1-c543"


def test_report_counts_match_the_workspace(client, auth, phone_number: dict) -> None:
    listed = client.get(
        f"{API}/phone-numbers", headers=auth, params={"page_size": 100}
    ).json()
    body = client.get(f"{API}/phone-numbers/sync", headers=auth).json()

    live = [row for row in listed["items"] if row["status"] != "released"]
    assert body["local_total"] == len(live)
    assert body["assigned"] == len([row for row in live if row["employee_id"]])
    assert body["unassigned"] == body["local_total"] - body["assigned"]
    assert body["local_active"] >= 1
    # The fixture database is shared, so other tests may have attached numbers
    # in other countries; the counts still have to add up to the workspace.
    countries = {entry["country"]: entry["numbers"] for entry in body["by_country"]}
    assert countries.get("IN", 0) >= 1
    assert sum(countries.values()) == body["local_total"]


def test_report_does_not_write(client, auth, phone_number: dict) -> None:
    """Asking for the inventory must not create, import or release anything."""
    before = client.get(f"{API}/phone-numbers", headers=auth, params={"page_size": 1})
    report = client.get(f"{API}/phone-numbers/sync", headers=auth)
    after = client.get(f"{API}/phone-numbers", headers=auth, params={"page_size": 1})

    assert report.status_code == 200
    assert before.json()["meta"]["total"] == after.json()["meta"]["total"]


def test_sync_is_not_read_as_a_number_id(client, auth) -> None:
    assert client.get(f"{API}/phone-numbers/sync", headers=auth).status_code == 200


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
def test_phone_connection_id_env_name_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    """The deployed env file spells the connection id its own way."""
    monkeypatch.setenv("SARVAM_CONNECTION_ID", "")
    monkeypatch.setenv("SARVAM_PHONE_CONNECTION_ID", "01145810-b1-9af47dd1-c543")

    built = Settings(_env_file=None)

    assert built.sarvam_connection_id == "01145810-b1-9af47dd1-c543"
