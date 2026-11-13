"""Sarvam model-API failures must surface as failures, never as replies.

Sarvam's model APIs answer ``403`` with ``error.code = invalid_api_key_error``
for a bad or missing key - not ``401``. These tests pin the mapping: a rejected
credential is a configuration problem (503), an upstream failure is an outage
(502), and neither may be dressed up as a successful agent answer.
"""

from __future__ import annotations

import pytest

from app.core.config import settings
from app.integrations import ProviderResponse, sanitize, sarvam
from app.modules import voices as voices_module

API = settings.api_v1_prefix


def _failure(status: int, error: str):
    """A transport stub that always fails the way the real API would."""

    def _fake(*_args, **_kwargs) -> ProviderResponse:
        return ProviderResponse(ok=False, error=error, status_code=status, latency_ms=12)

    return _fake


@pytest.fixture()
def live_credentials(monkeypatch):
    """Pretend a key is configured, so the call reaches the (stubbed) transport."""
    monkeypatch.setattr(sarvam, "configured", lambda: True)
    return monkeypatch


# ---------------------------------------------------------------------------
# Employee test message
# ---------------------------------------------------------------------------
def test_test_message_with_rejected_key_is_503(client, auth, employee, live_credentials):
    live_credentials.setattr(
        sarvam, "request_json", _failure(403, "invalid_api_key_error: Invalid API key")
    )

    response = client.post(
        f"{API}/employees/{employee['id']}/test",
        headers=auth,
        json={"message": "Are admissions open for the new term?"},
    )

    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_not_configured"
    assert "api key" in error["message"].lower()
    assert error["details"]["status_code"] == 403
    # No fabricated answer may accompany a rejected credential.
    assert "reply" not in response.json()


def test_test_message_provider_outage_is_502(client, auth, employee, live_credentials):
    live_credentials.setattr(
        sarvam, "request_json", _failure(500, "upstream inference failed")
    )

    response = client.post(
        f"{API}/employees/{employee['id']}/test",
        headers=auth,
        json={"message": "Are admissions open for the new term?"},
    )

    assert response.status_code == 502, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_error"
    # The sanitised provider text is kept, so the cause is diagnosable.
    assert "upstream inference failed" in error["details"]["error"]
    assert "reply" not in response.json()


# ---------------------------------------------------------------------------
# Demo path must keep working
# ---------------------------------------------------------------------------
def test_test_message_without_a_key_stays_simulated(client, auth, employee, monkeypatch):
    """No key is a supported demo state: answer offline and say so."""
    monkeypatch.setattr(sarvam, "configured", lambda: False)

    response = client.post(
        f"{API}/employees/{employee['id']}/test",
        headers=auth,
        json={"message": "Are admissions open for the new term?"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["simulated"] is True
    assert body["provider"] == "offline"
    assert body["reply"].strip()


# ---------------------------------------------------------------------------
# Voice samples
# ---------------------------------------------------------------------------
def test_voice_preview_with_rejected_key_is_503(client, live_credentials):
    voice_id = voices_module.catalog()[0].id
    live_credentials.setattr(
        sarvam, "request_json", _failure(403, "invalid_api_key_error: Invalid API key")
    )

    response = client.get(f"{API}/voices/{voice_id}/preview")

    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "provider_not_configured"
    assert "api key" in error["message"].lower()


# ---------------------------------------------------------------------------
# Predicate and redaction
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("ok", "status", "error", "expected"),
    [
        (False, 401, "Unauthorized", True),
        (False, 403, "invalid_api_key_error: Invalid API key", True),
        (False, 400, "invalid_api_key_error: Invalid API key", True),
        (False, 400, "bad request", False),
        (False, 500, "upstream inference failed", False),
        (False, None, "sarvam timed out after 20s.", False),
        (True, 200, None, False),
    ],
)
def test_auth_failed_matrix(ok: bool, status: int | None, error: str | None, expected: bool):
    result = ProviderResponse(ok=ok, error=error, status_code=status)
    assert sarvam.auth_failed(result) is expected


def test_credential_shaped_text_is_redacted():
    text = sanitize(
        "failed for sk_abc123456789xyz and Bearer abcdef1234567890 "
        "(X-API-Key: 01a1c197-dead-beef-0000-000000000000)"
    )
    assert "sk_abc123456789xyz" not in text
    assert "abcdef1234567890" not in text
    assert "01a1c197-dead-beef-0000-000000000000" not in text
