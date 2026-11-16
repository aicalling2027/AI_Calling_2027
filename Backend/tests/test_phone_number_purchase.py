"""Buying a number from the shelf the purchase form lists.

The dashboard's "Buy a number" dialog searches a catalogue, then reserves one
row from it. These tests pin what those endpoints promise: the shelf is stable
for a given search, a number any workspace already holds is not for sale, a
purchase is stored at the catalogue's price rather than the caller's, and the
plan's include is still the last word.
"""

from __future__ import annotations

from typing import Any

from tests.conftest import API


def _shelf(client: Any, auth: dict[str, str], **params: Any) -> list[dict]:
    response = client.get(f"{API}/phone-numbers/available", headers=auth, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _buy(client: Any, auth: dict[str, str], number: str, **extra: Any):
    return client.post(
        f"{API}/phone-numbers/purchase",
        headers=auth,
        json={"number": number, **extra},
    )


# ---------------------------------------------------------------------------
# The shelf
# ---------------------------------------------------------------------------
def test_catalogue_lists_countries_with_their_prices(client: Any, auth: dict[str, str]):
    """The form's country picker is data, not a hard-coded list in the page."""
    response = client.get(f"{API}/phone-numbers/catalogue", headers=auth)
    assert response.status_code == 200, response.text

    markets = {market["country_code"]: market for market in response.json()}
    assert {"IN", "AE", "GB"} <= set(markets)

    india = markets["IN"]
    assert india["dial_code"] == "+91"
    assert india["capabilities"] == ["inbound", "outbound"]

    regions = {region["region"]: region for region in india["regions"]}
    assert "Mumbai" in regions
    assert regions["Mumbai"]["monthly_cost_inr"] > 0


def test_shelf_filters_by_region(client: Any, auth: dict[str, str]):
    rows = _shelf(client, auth, country_code="IN", region="Delhi", limit=3)

    assert len(rows) == 3
    assert {row["region"] for row in rows} == {"Delhi"}
    assert all(row["number"].startswith("+91") for row in rows)
    assert all(row["formatted"].startswith("+91 ") for row in rows)


def test_shelf_never_offers_the_same_number_twice(client: Any, auth: dict[str, str]):
    numbers = [row["number"] for row in _shelf(client, auth, limit=50)]
    assert len(numbers) == len(set(numbers)) == 50


def test_digits_search_narrows_to_the_matching_block(client: Any, auth: dict[str, str]):
    rows = _shelf(client, auth, q="22671")

    assert rows, "a partial number should match the Mumbai block"
    assert all("22671" in row["number"] for row in rows)


# ---------------------------------------------------------------------------
# Buying
# ---------------------------------------------------------------------------
def test_purchase_stores_the_shelf_price(client: Any, auth: dict[str, str], roomy_plan):
    chosen = _shelf(client, auth, country_code="IN", region="Bengaluru", limit=1)[0]

    response = _buy(client, auth, chosen["number"])
    assert response.status_code == 201, response.text

    bought = response.json()
    number = bought["number"]
    assert number["number"] == chosen["number"]
    assert number["provider"] == chosen["provider"]
    assert number["monthly_cost_inr"] == chosen["monthly_cost_inr"]
    assert number["status"] == "pending"
    assert number["label"] == f"{chosen['region']} line"
    assert bought["setup_cost_inr"] == chosen["setup_cost_inr"]
    assert bought["simulated"] is True

    # A number leaves the shelf the moment a workspace owns it.
    still_listed = {row["number"] for row in _shelf(client, auth, region="Bengaluru")}
    assert chosen["number"] not in still_listed


def test_purchase_can_bind_the_number_to_an_employee(
    client: Any, auth: dict[str, str], roomy_plan, employee: dict
):
    chosen = _shelf(client, auth, country_code="AE", region="Dubai", limit=1)[0]

    response = _buy(
        client,
        auth,
        chosen["number"],
        employee_id=employee["id"],
        label="Dubai sales",
    )
    assert response.status_code == 201, response.text

    number = response.json()["number"]
    assert number["employee_id"] == employee["id"]
    assert number["assigned_at"] is not None
    # Answering calls is what makes a line live; an unbound one stays pending.
    assert number["status"] == "active"
    assert number["label"] == "Dubai sales"


def test_a_number_outside_the_catalogue_is_refused(
    client: Any, auth: dict[str, str], roomy_plan
):
    """The catalogue is the only source of numbers, so free text is rejected."""
    response = _buy(client, auth, "+919000000001")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "number_not_available"


def test_the_same_number_cannot_be_bought_twice(
    client: Any, auth: dict[str, str], roomy_plan
):
    chosen = _shelf(client, auth, region="Chennai", limit=1)[0]

    first = _buy(client, auth, chosen["number"])
    assert first.status_code == 201, first.text

    second = _buy(client, auth, chosen["number"])
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"


def test_purchase_still_respects_the_plan_include(client: Any, auth: dict[str, str]):
    """Without the lifted include the trial plan refuses a second number."""
    chosen = _shelf(client, auth, region="Hyderabad", limit=1)[0]

    response = _buy(client, auth, chosen["number"])

    assert response.status_code == 409
    gap = response.json()["error"]
    assert gap["code"] == "phone_number_limit_reached"
    # The refusal has to be actionable: which plan, what it allows, what is used.
    assert gap["details"]["plan"] == "starter"
    assert gap["details"]["limit"] == 1
    assert gap["details"]["current"] >= 1


def test_a_released_line_stays_off_the_shelf(client: Any, auth: dict[str, str], roomy_plan):
    """Releasing ends the use of the line but keeps the row that holds it.

    The row is what keeps the line's calls, campaigns and assignment history
    readable, and the number is unique to it, so the shelf must not offer the
    number to anyone again.
    """
    chosen = _shelf(client, auth, region="Hyderabad", limit=1)[0]

    bought = _buy(client, auth, chosen["number"])
    assert bought.status_code == 201, bought.text

    released = client.delete(
        f"{API}/phone-numbers/{bought.json()['number']['id']}", headers=auth
    )
    assert released.status_code == 200, released.text

    assert chosen["number"] not in {
        row["number"] for row in _shelf(client, auth, region="Hyderabad")
    }
