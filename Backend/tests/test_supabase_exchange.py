"""The identity bridge between Supabase sign-in and this API's own tokens.

``POST /auth/supabase/exchange`` is the only endpoint that reads a Supabase
token. It can produce three outcomes - provision a workspace, link an existing
password account, or recognise a returning subject - and it must refuse every
token whose signature, issuer, audience or expiry does not hold up.

The endpoint never trusts a client-supplied identity: there is no user or
organization field to send, and a token from another project is just a string.
"""

from __future__ import annotations

import base64
import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pytest
from sqlalchemy import select

from app.core import supabase_auth
from app.core.config import settings
from app.database.models.organization import OrganizationMember, User
from app.database.session import SessionLocal
from tests.conftest import API

ISSUER = "https://sso-test.supabase.co/auth/v1"
SECRET = "unit-test-only-signing-secret-0123456789"
AUDIENCE = "authenticated"
PASSWORD = "Str0ngPassw0rd"


@pytest.fixture()
def sso(monkeypatch: pytest.MonkeyPatch) -> None:
    """Point verification at a throw-away auth project for one test."""
    monkeypatch.setattr(settings, "supabase_url", ISSUER.removesuffix("/auth/v1"))
    monkeypatch.setattr(settings, "supabase_jwt_secret", SECRET)
    monkeypatch.setattr(settings, "supabase_jwt_audience", AUDIENCE)


def token(**overrides: Any) -> str:
    """A Supabase-shaped access token, signed the way a project would sign it."""
    now = datetime.now(timezone.utc)
    claims: dict[str, Any] = {
        "sub": f"sb-{uuid.uuid4().hex[:12]}",
        "aud": AUDIENCE,
        "iss": ISSUER,
        "role": "authenticated",
        "email": f"sso-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified": True,
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    claims.update(overrides)
    secret = str(claims.pop("secret", SECRET))
    return jwt.encode(claims, secret, algorithm="HS256")


def es256_shaped_token() -> str:
    """A token whose header asks for ES256; the signature is never reached."""

    def segment(payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = {"alg": "ES256", "typ": "JWT", "kid": "key-this-host-cannot-build"}
    claims = {
        "sub": "sb-probe",
        "aud": AUDIENCE,
        "iss": ISSUER,
        "exp": int(time.time()) + 300,
    }
    # A base64url of "placeholder": well-formed enough that the header is read.
    return f"{segment(header)}.{segment(claims)}.cGxhY2Vob2xkZXI"


def exchange(client: Any, access_token: str) -> Any:
    return client.post(
        f"{API}/auth/supabase/exchange", json={"access_token": access_token}
    )


def register(client: Any, email: str) -> dict:
    response = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Existing Owner"},
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Provisioning: the first sign-in only
# ---------------------------------------------------------------------------
def test_first_sign_in_provisions_one_owner_workspace(client: Any, sso: None) -> None:
    subject = f"sb-{uuid.uuid4().hex[:12]}"

    response = exchange(client, token(sub=subject))
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["role"] == "owner"
    assert body["token_type"] == "bearer"
    assert body["organization"]["id"]
    assert body["user"]["email"].startswith("sso-")

    with SessionLocal() as db:
        user = db.execute(
            select(User).where(User.supabase_user_id == subject)
        ).scalar_one()
        memberships = (
            db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == user.id
                )
            )
            .scalars()
            .all()
        )

    assert len(memberships) == 1
    assert memberships[0].role == "owner"
    assert memberships[0].organization_id == body["organization"]["id"]


def test_second_sign_in_reuses_the_same_account_and_workspace(
    client: Any, sso: None
) -> None:
    subject = f"sb-{uuid.uuid4().hex[:12]}"
    email = f"sso-{uuid.uuid4().hex[:10]}@example.com"

    first = exchange(client, token(sub=subject, email=email))
    second = exchange(client, token(sub=subject, email=email))
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert first.json()["organization"]["id"] == second.json()["organization"]["id"]


def test_the_subject_identifies_the_account_not_the_email(
    client: Any, sso: None
) -> None:
    """A changed email must not fork one person into two tenants."""
    subject = f"sb-{uuid.uuid4().hex[:12]}"
    original = f"sso-{uuid.uuid4().hex[:10]}@example.com"

    first = exchange(client, token(sub=subject, email=original))
    renamed = exchange(
        client,
        token(sub=subject, email=f"renamed-{uuid.uuid4().hex[:8]}@example.com"),
    )
    assert first.status_code == 200, first.text
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["user"]["id"] == first.json()["user"]["id"]
    assert renamed.json()["user"]["email"] == original


# ---------------------------------------------------------------------------
# Linking a password account that already exists
# ---------------------------------------------------------------------------
def test_existing_password_account_is_linked_not_duplicated(
    client: Any, sso: None
) -> None:
    email = f"link-{uuid.uuid4().hex[:10]}@example.com"
    registered = register(client, email)

    response = exchange(client, token(email=email))
    assert response.status_code == 200, response.text
    assert response.json()["user"]["id"] == registered["user"]["id"]
    assert response.json()["organization"]["id"] == registered["organization"]["id"]

    # Linking must not lock the owner out of the password they already had.
    relogin = client.post(
        f"{API}/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert relogin.status_code == 200, relogin.text

    with SessionLocal() as db:
        user = db.get(User, registered["user"]["id"])
        assert user is not None
        assert user.supabase_user_id


def test_linking_an_existing_account_requires_a_verified_email(
    client: Any, sso: None
) -> None:
    email = f"unverified-{uuid.uuid4().hex[:10]}@example.com"
    registered = register(client, email)

    response = exchange(client, token(email=email, email_verified=False))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"

    with SessionLocal() as db:
        user = db.get(User, registered["user"]["id"])
        assert user is not None
        assert user.supabase_user_id is None


def test_a_second_identity_cannot_claim_an_already_linked_email(
    client: Any, sso: None
) -> None:
    email = f"owned-{uuid.uuid4().hex[:10]}@example.com"
    assert exchange(client, token(email=email)).status_code == 200

    intruder = exchange(
        client, token(email=email, sub=f"sb-{uuid.uuid4().hex[:12]}")
    )
    assert intruder.status_code == 401
    assert intruder.json()["error"]["code"] == "unauthorized"


# ---------------------------------------------------------------------------
# Claims the endpoint must refuse
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "override",
    [
        pytest.param({"secret": "another-projects-signing-secret"}, id="signature"),
        pytest.param(
            {"exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, id="expired"
        ),
        pytest.param({"aud": "anon"}, id="audience"),
        pytest.param({"iss": "https://evil.example/auth/v1"}, id="issuer"),
    ],
)
def test_invalid_tokens_are_refused(
    client: Any, sso: None, override: dict[str, Any]
) -> None:
    response = exchange(client, token(**override))
    assert response.status_code == 401, response.text
    assert response.json()["error"]["code"] == "unauthorized"


def test_a_token_without_an_expiry_is_refused(client: Any, sso: None) -> None:
    raw = jwt.encode(
        {
            "sub": f"sb-{uuid.uuid4().hex[:12]}",
            "aud": AUDIENCE,
            "iss": ISSUER,
            "email": f"sso-{uuid.uuid4().hex[:10]}@example.com",
        },
        SECRET,
        algorithm="HS256",
    )
    response = exchange(client, raw)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_a_missing_token_is_refused(client: Any, sso: None) -> None:
    response = client.post(f"{API}/auth/supabase/exchange", json={"access_token": ""})
    assert response.status_code == 422


def test_the_client_cannot_name_the_organization(client: Any, sso: None) -> None:
    """The tenant comes from the membership, so there is no field for it."""
    response = client.post(
        f"{API}/auth/supabase/exchange",
        json={"access_token": token(), "organization_id": "org-chosen-by-the-client"},
    )
    assert response.status_code == 422


def test_unconfigured_single_sign_on_is_a_server_error(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")

    response = exchange(client, token())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "provider_not_configured"


def test_a_missing_cryptography_package_is_a_server_error(
    client: Any, sso: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PyJWT needs ``cryptography`` to build a key from the published JWKS.

    A deployment that installs PyJWT alone downloads the key set and then fails
    to read it. That is this host's gap, not the caller's token, so it has to read
    as an unconfigured provider rather than as an unhandled 500.
    """

    class KeylessClient:
        def get_signing_key_from_jwt(self, raw: str) -> Any:
            raise jwt.exceptions.MissingCryptographyError(
                "ES256 requires 'cryptography' to be installed."
            )

    monkeypatch.setattr(supabase_auth, "_jwks", lambda: KeylessClient())

    response = exchange(client, es256_shaped_token())
    assert response.status_code == 503, response.text
    assert response.json()["error"]["code"] == "provider_not_configured"


def test_a_supabase_token_is_not_a_backend_credential(
    client: Any, sso: None
) -> None:
    """Signing in and authorising are separate: only the exchanged token works."""
    raw = token()
    response = client.get(
        f"{API}/auth/me", headers={"Authorization": f"Bearer {raw}"}
    )
    assert response.status_code == 401
