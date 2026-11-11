"""Password hashing, JWT issuance/verification and RBAC.

Password hashing uses ``hashlib.pbkdf2_hmac`` from the standard library rather
than passlib/bcrypt: it is FIPS-friendly, has no native build step, and avoids
the well-known passlib/bcrypt version incompatibilities on modern Python.

Tokens are signed with HS256 via PyJWT. Access tokens are short lived and
carry the tenant (organization) plus role claims so that authorization needs
no database round-trip.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Final

import jwt

from app.core.config import settings
from app.core.constants import Role, permissions_for
from app.core.exceptions import AuthenticationError, PermissionDeniedError

_PBKDF2_ITERATIONS: Final[int] = 210_000
_PBKDF2_ALGORITHM: Final[str] = "sha256"
_SALT_BYTES: Final[int] = 16

ACCESS_TOKEN_TYPE: Final[str] = "access"
REFRESH_TOKEN_TYPE: Final[str] = "refresh"


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Return ``pbkdf2_sha256$<iterations>$<salt>$<digest>``."""
    if not password:
        raise ValueError("password must not be empty")
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        _PBKDF2_ALGORITHM, password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "$".join(
        (
            f"pbkdf2_{_PBKDF2_ALGORITHM}",
            str(_PBKDF2_ITERATIONS),
            base64.b64encode(salt).decode(),
            base64.b64encode(digest).decode(),
        )
    )


def verify_password(password: str, encoded: str) -> bool:
    """Constant-time verification of a password against a stored hash."""
    try:
        scheme, iterations, salt_b64, digest_b64 = encoded.split("$")
        if not scheme.startswith("pbkdf2_"):
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac(
            _PBKDF2_ALGORITHM, password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(expected, actual)
    except (ValueError, TypeError):
        return False


def generate_api_key() -> tuple[str, str]:
    """Return ``(plaintext_key, sha256_digest)`` for API key issuance."""
    raw = f"ownai_{secrets.token_urlsafe(32)}"
    return raw, hashlib.sha256(raw.encode()).hexdigest()


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(claims: dict[str, Any]) -> str:
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(
    *,
    user_id: str,
    organization_id: str | None,
    role: Role | str,
    scopes: list[str] | None = None,
) -> str:
    issued = _now()
    claims: dict[str, Any] = {
        "sub": user_id,
        "org": organization_id,
        "role": str(role),
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(issued.timestamp()),
        "exp": int(
            (issued + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()
        ),
        "jti": uuid.uuid4().hex,
    }
    if scopes:
        claims["scopes"] = scopes
    return _encode(claims)


def create_refresh_token(*, user_id: str, organization_id: str | None) -> tuple[str, str]:
    """Return ``(token, jti)``; the ``jti`` is persisted for rotation checks."""
    issued = _now()
    jti = uuid.uuid4().hex
    claims = {
        "sub": user_id,
        "org": organization_id,
        "type": REFRESH_TOKEN_TYPE,
        "iat": int(issued.timestamp()),
        "exp": int(
            (issued + timedelta(days=settings.refresh_token_expire_days)).timestamp()
        ),
        "jti": jti,
    }
    return _encode(claims), jti


def decode_token(token: str, *, expected_type: str = ACCESS_TOKEN_TYPE) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Your session has expired. Please sign in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("The supplied token is invalid.") from exc

    if payload.get("type") != expected_type:
        raise AuthenticationError(
            f"Expected a {expected_type} token but received {payload.get('type')!r}."
        )
    return payload


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------
def has_permission(role: Role | str, permission: str) -> bool:
    return permission in permissions_for(role)


def require_permission(role: Role | str, permission: str) -> None:
    if not has_permission(role, permission):
        raise PermissionDeniedError(
            f"Your role ({role}) cannot perform '{permission}'.",
            details={"required_permission": permission, "role": str(role)},
        )
