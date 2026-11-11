"""Google Sheets adapter - imports leads from a spreadsheet.

Two access modes are supported, in priority order:

1. **Access token** - ``GOOGLE_SHEETS_CREDENTIALS_JSON`` holds either an OAuth
   access token or a JSON object with an ``access_token`` field (produced by
   ``gcloud auth print-access-token`` or a server-side refresh job). Uses the
   Sheets v4 ``values`` API.
2. **Public / link-shared sheet** - falls back to Google's CSV export endpoint,
   which needs no credentials at all. Perfect for demos and internal sheets.

A service-account key file cannot be exchanged for a token here because that
requires RSA signing; run a tiny token-refresh job (or n8n) and store the
access token instead.
"""

from __future__ import annotations

import csv
import io
import json
import re
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.phone import normalise_phone
from app.utils.text import collapse_whitespace

logger = get_logger(__name__)

PROVIDER = "google_sheets"

_SHEET_URL = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")

NAME_KEYS = ("name", "full name", "fullname", "customer", "customer name", "contact")
PHONE_KEYS = ("phone", "mobile", "phone number", "mobile number", "contact number", "number")
EMAIL_KEYS = ("email", "email id", "e-mail")
CITY_KEYS = ("city", "location", "town")
COMPANY_KEYS = ("company", "organisation", "organization", "business")


def configured() -> bool:
    return settings.enabled(
        settings.google_sheets_credentials_json
    ) or settings.enabled(settings.google_sheets_spreadsheet_id)


def _access_token() -> str | None:
    raw = (settings.google_sheets_credentials_json or "").strip()
    if not raw:
        return None
    if raw.startswith("{"):
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return None
        token = payload.get("access_token") or payload.get("token")
        return str(token) if token else None
    return raw if raw.count(".") < 2 else None  # a JWT cannot be used directly


def extract_spreadsheet_id(value: str | None = None) -> str | None:
    """Accept a raw id or a full Google Sheets URL."""
    candidate = (value or settings.google_sheets_spreadsheet_id or "").strip()
    if not candidate:
        return None
    match = _SHEET_URL.search(candidate)
    return match.group(1) if match else candidate


def fetch_rows(
    spreadsheet_id: str | None = None,
    *,
    range_a1: str = "A1:Z1000",
    sheet_name: str | None = None,
) -> list[dict[str, str]]:
    """Return the sheet as a list of ``{header: value}`` dictionaries."""
    sheet_id = extract_spreadsheet_id(spreadsheet_id)
    if not sheet_id:
        logger.info("google_sheets_not_configured")
        return []

    token = _access_token()
    if token:
        return _fetch_via_api(sheet_id, range_a1=range_a1, token=token)
    return _fetch_via_csv(sheet_id, sheet_name=sheet_name)


def _fetch_via_api(sheet_id: str, *, range_a1: str, token: str) -> list[dict[str, str]]:
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{range_a1}"
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True) as client:
            response = client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params={"majorDimension": "ROWS"},
            )
        if not response.is_success:
            logger.warning(
                "google_sheets_api_error", status=response.status_code, body=response.text[:300]
            )
            return []
        rows = response.json().get("values") or []
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("google_sheets_api_failed", error=str(exc))
        return []
    return _rows_to_dicts(rows)


def _fetch_via_csv(sheet_id: str, *, sheet_name: str | None) -> list[dict[str, str]]:
    params: dict[str, str] = {"tqx": "out:csv", "format": "csv"}
    if sheet_name:
        params["sheet"] = sheet_name
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq"
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True) as client:
            response = client.get(url, params=params)
        if not response.is_success:
            logger.warning("google_sheets_csv_error", status=response.status_code)
            return []
        reader = csv.reader(io.StringIO(response.text))
        rows = [row for row in reader if any(cell.strip() for cell in row)]
    except (httpx.HTTPError, csv.Error) as exc:
        logger.warning("google_sheets_csv_failed", error=str(exc))
        return []
    return _rows_to_dicts(rows)


def _rows_to_dicts(rows: list[list[str]]) -> list[dict[str, str]]:
    """Map the first row's headers onto every following row."""
    if not rows or len(rows) < 2:
        return []
    headers = [collapse_whitespace(str(cell)).lower() for cell in rows[0]]
    records: list[dict[str, str]] = []
    for row in rows[1:]:
        record: dict[str, str] = {}
        for index, header in enumerate(headers):
            if not header:
                continue
            value = row[index] if index < len(row) else ""
            record[header] = collapse_whitespace(str(value))
        if any(record.values()):
            records.append(record)
    return records


def _pick(record: dict[str, str], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = record.get(key)
        if value:
            return value
    # Loose match: any header containing the key
    for header, value in record.items():
        if value and any(key in header for key in keys):
            return value
    return None


def to_leads(records: list[dict[str, str]], *, default_country: str = "+91") -> list[dict[str, Any]]:
    """Normalise arbitrary sheet rows into lead dictionaries.

    Rows without a usable phone number are dropped - they cannot be called.
    """
    leads: list[dict[str, Any]] = []
    skipped = 0

    for record in records:
        phone_raw = _pick(record, PHONE_KEYS)
        if not phone_raw:
            skipped += 1
            continue
        try:
            phone = normalise_phone(phone_raw, default_country=default_country)
        except Exception:  # noqa: BLE001 - a bad row must not abort the import
            skipped += 1
            continue

        name = _pick(record, NAME_KEYS) or f"Lead {phone[-4:]}"
        custom = {
            header: value
            for header, value in record.items()
            if value and header not in {*NAME_KEYS, *PHONE_KEYS, *EMAIL_KEYS, *CITY_KEYS, *COMPANY_KEYS}
        }
        leads.append(
            {
                "full_name": name[:160],
                "phone": phone,
                "email": _pick(record, EMAIL_KEYS),
                "city": (_pick(record, CITY_KEYS) or "")[:80] or None,
                "company": (_pick(record, COMPANY_KEYS) or "")[:160] or None,
                "custom_fields": custom,
            }
        )

    if skipped:
        logger.info("google_sheets_rows_skipped", skipped=skipped, imported=len(leads))
    return leads


def status() -> dict[str, Any]:
    return {
        "configured": configured(),
        "spreadsheet_id": extract_spreadsheet_id(),
        "auth_mode": "access_token" if _access_token() else "public_csv",
    }
