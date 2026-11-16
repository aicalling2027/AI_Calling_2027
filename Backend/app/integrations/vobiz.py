"""Vobiz telephony inventory adapter (dormant).

Not part of the product any more. A workspace records the numbers it rents
through ``POST /phone-numbers/attach``, because Sarvam publishes no API for
rented numbers and this account is not the one a Sarvam console renter holds.
The adapter and its tests are kept until the attach workflow has been verified
in production, then they can be retired together with the ``VOBIZ_*`` settings.
For operator diagnostics only; nothing imports it except its own tests.

Sarvam Voice Agents carry every call over a telephony provider, and the numbers
belong to *that* provider - a Voice Agents connection imports the numbers an
account already owns rather than creating them. So the count of provisioned
numbers can only come from the carrier's own API:

* the Sarvam model key is a speech key and is refused by the app-authoring
  surface (``401 invalid_api_key_format`` on ``/deployments``);
* the Voice Agents connection routes answer ``Not authenticated`` without an
  interactive session, which is a credential this backend cannot hold.

Vobiz API v1, authenticated with ``X-Auth-ID`` + ``X-Auth-Token``:

* ``GET /api/v1/Account/{auth_id}/numbers`` - the numbers an account owns,
  paginated with ``page`` / ``per_page`` (``limit`` / ``offset`` are ignored by
  that endpoint).

Read-only on purpose. Nothing here buys, imports or releases a number, and
nothing calls it on a request path: it only reported what the carrier held so
the two records could be compared.
"""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.integrations import ProviderResponse, request_json

PROVIDER = "vobiz"

#: The inventory endpoint caps a page at 100; the loop stops when a short page
#: arrives, so the ceiling only bounds a runaway account.
PAGE_SIZE = 100
MAX_PAGES = 20

#: Provider capability flags, in the order they are reported.
CAPABILITY_KEYS = ("voice", "sms", "mms", "fax")

_SETTINGS_FIELDS = ("vobiz_auth_id", "vobiz_auth_token")


def auth_id() -> str:
    return str(settings.vobiz_auth_id or "").strip()


def _auth_token() -> str:
    return str(settings.vobiz_auth_token or "").strip()


def configured() -> bool:
    """True when the carrier account can be addressed at all."""
    return bool(auth_id()) and bool(_auth_token())


def missing_settings() -> list[str]:
    """Env var names still empty, in the order they should be filled in."""
    return [
        field.upper()
        for field in _SETTINGS_FIELDS
        if not str(getattr(settings, field, "") or "").strip()
    ]


def connection_label() -> str | None:
    """The account id, masked - enough to tell two deployments apart in a log.

    An Auth ID is half a credential pair, so it is never echoed whole.
    """
    value = auth_id()
    if not value:
        return None
    if len(value) <= 6:
        return value[:2] + "***"
    return f"{value[:3]}***{value[-4:]}"


def _headers() -> dict[str, str]:
    return {
        "X-Auth-ID": auth_id(),
        "X-Auth-Token": _auth_token(),
        "Content-Type": "application/json",
    }


def _numbers_url() -> str:
    root = str(settings.vobiz_base_url or "https://api.vobiz.ai").rstrip("/")
    return f"{root}/api/v1/Account/{auth_id()}/numbers"


def _opt(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _as_int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def normalise(item: dict[str, Any]) -> dict[str, Any]:
    """One provider record, in the vocabulary the report speaks.

    The vendor shape is translated here and nowhere else: ``e164`` becomes
    ``number``, the boolean capability object becomes a list, ``is_trial_number``
    becomes ``is_trial``, and the fields the report does not read are dropped
    rather than carried around.
    """
    flags = item.get("capabilities") or {}
    capabilities = [
        key
        for key in CAPABILITY_KEYS
        if isinstance(flags, dict) and bool(flags.get(key))
    ]
    return {
        "number": str(item.get("e164") or "").strip(),
        "provider_number_id": _opt(item.get("id")),
        "country": str(item.get("country") or "").strip().upper(),
        "region": _opt(item.get("region")),
        "status": str(item.get("status") or "unknown").strip().lower(),
        "capabilities": capabilities,
        "voice_enabled": bool(item.get("voice_enabled")),
        "monthly_fee": _as_int(item.get("monthly_fee")),
        "currency": str(item.get("currency") or "INR").strip().upper(),
        # A shared trial line reads as an owned number everywhere else in the
        # payload, so the flag has to travel or the report overstates what the
        # account actually has.
        "is_trial": bool(item.get("is_trial_number")),
        "application_id": _opt(item.get("application_id")),
        "account_id": _opt(item.get("account_id")),
        "source": _opt(item.get("source")),
        "purchased_at": _opt(item.get("purchased_at")),
    }


def list_numbers(
    *, per_page: int = PAGE_SIZE, max_pages: int = MAX_PAGES
) -> ProviderResponse:
    """Every number the carrier account owns, across all pages.

    ``truncated`` in the payload says whether the page ceiling stopped the read
    early: a report that compared a partial list against the database would
    invent "missing at the carrier" rows, so the caller must know.
    """
    missing = missing_settings()
    if missing:
        return ProviderResponse(
            ok=False,
            error=(
                "The telephony account is not addressed yet - set "
                f"{', '.join(missing)} in the backend environment."
            ),
            status_code=503,
        )

    page_size = max(1, min(int(per_page), PAGE_SIZE))
    items: list[dict[str, Any]] = []
    total = 0
    page = 1
    truncated = False

    while page <= max(1, int(max_pages)):
        result = request_json(
            "GET",
            _numbers_url(),
            provider=PROVIDER,
            headers=_headers(),
            params={"page": page, "per_page": page_size},
            timeout=float(settings.sarvam_timeout_seconds),
            retries=1,
        )
        if not result.ok:
            return result

        batch = [
            normalise(entry)
            for entry in (result.data.get("items") or [])
            if isinstance(entry, dict)
        ]
        total = _as_int(result.data.get("total")) or len(items) + len(batch)
        items.extend(batch)
        if len(batch) < page_size or len(items) >= total:
            break
        page += 1
    else:
        # The loop ran out of pages rather than out of records.
        truncated = len(items) < total

    return ProviderResponse(
        ok=True,
        data={"items": items, "total": len(items), "truncated": truncated},
        status_code=200,
    )
