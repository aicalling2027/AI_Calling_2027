"""Phone number normalisation.

Indian numbers arrive in a dozen shapes (``+91 98765 43210``, ``09876543210``,
``9876543210``). Everything stored in the database goes through
:func:`normalise_phone` so that de-duplication and provider calls are reliable.
"""

from __future__ import annotations

import re

from app.core.exceptions import ValidationError

DEFAULT_COUNTRY_CODE = "+91"

_DIGITS = re.compile(r"\D")


def digits_only(value: str) -> str:
    return _DIGITS.sub("", value or "")


def normalise_phone(value: str, *, default_country: str = DEFAULT_COUNTRY_CODE) -> str:
    """Return an E.164-ish number: ``+`` followed by 8-15 digits.

    >>> normalise_phone("098765 43210")
    '+919876543210'
    """
    raw = (value or "").strip()
    if not raw:
        raise ValidationError("A phone number is required.")

    has_plus = raw.startswith("+")
    digits = digits_only(raw)

    if not digits:
        raise ValidationError("The phone number contains no digits.", details={"value": value})

    if has_plus:
        number = f"+{digits}"
    elif digits.startswith("00"):
        # International prefix written as 00 instead of +
        number = f"+{digits[2:]}"
    elif digits.startswith("0"):
        # National trunk prefix - drop the leading zero before adding the country code
        number = f"{default_country}{digits[1:]}"
    elif len(digits) == 10:
        number = f"{default_country}{digits}"
    else:
        number = f"+{digits}"

    length = len(number) - 1
    if not 8 <= length <= 15:
        raise ValidationError(
            "The phone number length looks invalid.",
            details={"value": value, "normalised": number},
        )
    return number


def mask_phone(value: str | None) -> str:
    """Return a display-safe version keeping only the last four digits."""
    digits = digits_only(value or "")
    if len(digits) < 4:
        return "***"
    return f"***{digits[-4:]}"


def same_number(left: str | None, right: str | None) -> bool:
    """Compare two numbers ignoring formatting and the country prefix."""
    a, b = digits_only(left or ""), digits_only(right or "")
    if not a or not b:
        return False
    if a == b:
        return True
    # Compare the trailing 10 digits so +91 98765 43210 == 9876543210
    return a[-10:] == b[-10:]
