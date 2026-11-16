"""A catalogue code states the voice's rate band, so the two are checked together.

Premium voices are printed ``PM-nn`` and every other voice ``SD-nn``. A card
that showed one band beside the other series' code would sell a call at the
wrong rate, and a speaker added to the premium set without its code following
would do exactly that. These tests pin the rule at the source the code is
derived from, and again on the payload the site renders.
"""

from __future__ import annotations

from typing import Any

from app.core.constants import _BASE_PROFILES, _PREMIUM_SPEAKERS, VOICE_PROFILES
from tests.conftest import API


def _premium() -> list[dict[str, object]]:
    return [p for p in VOICE_PROFILES if str(p["id"]) in _PREMIUM_SPEAKERS]


def _standard() -> list[dict[str, object]]:
    return [p for p in VOICE_PROFILES if str(p["id"]) not in _PREMIUM_SPEAKERS]


def test_premium_voices_are_printed_under_pm() -> None:
    assert _premium(), "the premium band should never be empty"
    wrong = [str(p["id"]) for p in _premium() if not str(p["code"]).startswith("PM-")]
    assert wrong == [], f"premium voices printed outside the PM series: {wrong}"


def test_other_voices_are_printed_under_sd() -> None:
    assert _standard()
    wrong = [str(p["id"]) for p in _standard() if not str(p["code"]).startswith("SD-")]
    assert wrong == [], f"standard voices printed outside the SD series: {wrong}"


def test_the_premium_band_is_the_base_speaker_set() -> None:
    base = frozenset(str(p["id"]) for p in _BASE_PROFILES)
    assert _PREMIUM_SPEAKERS == base


def test_pm_editions_run_without_a_gap_in_catalogue_order() -> None:
    numbers = [int(str(p["code"]).split("-")[1]) for p in _premium()]
    assert numbers == list(range(1, len(numbers) + 1))


def test_codes_are_unique() -> None:
    codes = [str(p["code"]) for p in VOICE_PROFILES]
    assert len(codes) == len(set(codes))


def test_the_api_prints_the_codes_the_catalogue_assigned(client: Any) -> None:
    response = client.get(f"{API}/voices")
    assert response.status_code == 200
    payload = response.json()

    expected = {str(p["id"]): str(p["code"]) for p in VOICE_PROFILES}
    assert {item["id"]: item["code"] for item in payload} == expected

    premium = [item for item in payload if item["id"] in _PREMIUM_SPEAKERS]
    assert len(premium) == len(_PREMIUM_SPEAKERS)
    assert all(item["code"].startswith("PM-") for item in premium)
