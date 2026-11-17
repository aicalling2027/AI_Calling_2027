"""Verification of Supabase-issued access tokens.

The browser signs in with Supabase; this backend issues its own session tokens
and never accepts a Supabase token as an API credential. This module is the one
place such a token is read, and it is only reached from
``POST /auth/supabase/exchange``.

Two signing schemes exist in the wild, so both are handled:

* asymmetric (RS256/ES256) - the project publishes a JWKS under
  ``{SUPABASE_URL}/auth/v1/.well-known/jwks.json``. This is the current default
  and the preferred path.
* symmetric (HS256) - the legacy project JWT secret in ``SUPABASE_JWT_SECRET``.

Signature, ``exp``, ``aud`` and (when the base URL is known) ``iss`` are all
verified. ``nbf`` and ``iat`` are honoured by PyJWT; a small leeway absorbs the
clock difference between the auth service and this host.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient

from app.core.config import settings
from app.core.exceptions import AuthenticationError, ProviderNotConfiguredError
from app.core.logging import get_logger

logger = get_logger(__name__)

#: Tolerated clock difference, in seconds, between the auth service and here.
_LEEWAY_SECONDS = 30

_jwks_lock = threading.Lock()
_jwks_client: PyJWKClient | None = None


@dataclass(frozen=True, slots=True)
class SupabaseIdentity:
    """What a verified token proves: who signed in, and their email.

    ``name`` is presentational only - it seeds ``users.full_name`` when an
    account is first created. It is never used to decide access.
    """

    subject: str
    email: str | None
    email_verified: bool
    name: str | None = None


def issuer() -> str:
    """The ``iss`` a token from this project carries, or "" when unknown."""
    base = str(settings.supabase_url or "").strip().rstrip("/")
    return f"{base}/auth/v1" if base else ""


def configured() -> bool:
    """True when a token from this project could be verified at all."""
    return bool(issuer() or settings.supabase_jwt_secret.strip())


def _jwks() -> PyJWKClient | None:
    """The cached key-set client, built on first use for the configured project."""
    global _jwks_client
    url = issuer()
    if not url:
        return None

    with _jwks_lock:
        if _jwks_client is None:
            _jwks_client = PyJWKClient(
                f"{url}/.well-known/jwks.json",
                cache_keys=True,
                lifespan=max(60, int(settings.supabase_jwks_cache_seconds)),
            )
        return _jwks_client


def verify_access_token(token: str) -> SupabaseIdentity:
    """Verify a Supabase access token and return the identity it proves.

    Raises ``AuthenticationError`` for anything the caller can fix by signing in
    again, and ``ProviderNotConfiguredError`` when this deployment holds no way
    to verify such a token - a server problem, not a credential problem.
    """
    raw = (token or "").strip()
    if not raw:
        raise AuthenticationError("Sign in again; the session token is missing.")

    try:
        header = jwt.get_unverified_header(raw)
    except jwt.PyJWTError as exc:
        raise AuthenticationError("The session token is not a valid token.") from exc

    algorithm = str(header.get("alg") or "")
    if not algorithm or algorithm.lower() == "none":
        raise AuthenticationError("The session token is unsigned.")

    if algorithm.upper().startswith("HS"):
        key: object = settings.supabase_jwt_secret.strip()
        if not key:
            raise ProviderNotConfiguredError(
                "Single sign-on is not configured on this server: set SUPABASE_URL "
                "or SUPABASE_JWT_SECRET so sign-in tokens can be verified."
            )
    else:
        client = _jwks()
        if client is None:
            raise ProviderNotConfiguredError(
                "Single sign-on is not configured on this server: set SUPABASE_URL "
                "so the published signing keys can be read."
            )
        try:
            key = client.get_signing_key_from_jwt(raw).key
        except jwt.exceptions.MissingCryptographyError as exc:
            # PyJWT turns the published ES256/RS256 keys into usable keys through
            # the ``cryptography`` package. When a deployment installs PyJWT alone
            # the fetch succeeds and the key cannot be built, so this is a missing
            # dependency on this host, not a bad token - say so instead of raising
            # a bare PyJWT error that surfaces as a 500.
            logger.error("supabase_jwks_missing_cryptography")
            raise ProviderNotConfiguredError(
                "Single sign-on cannot be verified on this server: the cryptography "
                "package is not installed, so the published signing keys cannot be read."
            ) from exc
        except jwt.PyJWKClientError as exc:
            # An unknown key id means the project rotated its keys or the token
            # came from another project; both are worth one fresh sign-in.
            logger.warning("supabase_jwks_lookup_failed", error=str(exc))
            raise AuthenticationError(
                "This sign-in token is not recognised. Sign in again."
            ) from exc

    audience = str(settings.supabase_jwt_audience or "").strip() or None
    expected_issuer = issuer() or None

    try:
        claims = jwt.decode(
            raw,
            key,  # type: ignore[arg-type]
            algorithms=[algorithm],
            audience=audience,
            issuer=expected_issuer,
            leeway=_LEEWAY_SECONDS,
            options={
                "require": ["exp", "sub"],
                # A project without SUPABASE_URL cannot check ``iss``; verifying
                # it against nothing would reject every valid token instead.
                "verify_iss": expected_issuer is not None,
                "verify_aud": audience is not None,
            },
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Your sign-in session has expired. Sign in again.") from exc
    except jwt.InvalidTokenError as exc:
        logger.warning("supabase_token_rejected", error=type(exc).__name__)
        raise AuthenticationError("The sign-in token was rejected.") from exc

    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise AuthenticationError("The sign-in token does not identify a user.")

    verified = claims.get("email_verified")
    if isinstance(verified, str):
        verified = verified.lower() == "true"

    email = claims.get("email")
    metadata = claims.get("user_metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    name = metadata.get("full_name") or metadata.get("name") or claims.get("name")

    return SupabaseIdentity(
        subject=subject,
        email=str(email).strip().lower() if email else None,
        email_verified=bool(verified),
        name=(str(name).strip()[:160] or None) if name else None,
    )
