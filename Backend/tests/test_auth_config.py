"""Regression tests for the production outage caused by a blank JWT secret.

A ``JWT_SECRET`` that exists but is empty does not fall back to the default: it
overrides it with ``""``. PyJWT then refuses to sign or verify (``InvalidKeyError``,
which is not an ``InvalidTokenError``), so every login and every authenticated
request failed with an unhandled 500 instead of a clear startup error.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.exceptions import AuthenticationError
from app.core.security import create_access_token, decode_token


def test_blank_jwt_secret_is_rejected_at_startup() -> None:
    with pytest.raises(ValidationError) as caught:
        Settings(jwt_secret="")
    assert "JWT_SECRET" in str(caught.value)


def test_whitespace_jwt_secret_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(jwt_secret="   ")


def test_access_token_round_trip() -> None:
    token = create_access_token(user_id="user-1", organization_id="org-1", role="owner")
    payload = decode_token(token)
    assert payload["sub"] == "user-1"
    assert payload["org"] == "org-1"


def test_unusable_signing_key_is_reported_as_unauthorized(monkeypatch) -> None:
    """An empty key must never escape as an unhandled 500."""
    token = create_access_token(user_id="user-1", organization_id="org-1", role="owner")
    monkeypatch.setattr(settings, "jwt_secret", "")
    with pytest.raises(AuthenticationError) as caught:
        decode_token(token)
    assert caught.value.status_code == 401
