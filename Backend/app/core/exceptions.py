"""Typed application errors and the JSON error envelope.

Every error surfaced by the API has the same shape::

    {"error": {"code": "not_found", "message": "...", "details": {...},
               "request_id": "..."}}

This keeps client error handling uniform across all endpoints.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base class for all expected (non-bug) application failures."""

    status_code: int = 400
    code: str = "bad_request"
    message: str = "Request could not be processed."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details or {}
        super().__init__(self.message)

    def to_payload(self, request_id: str | None = None) -> dict[str, Any]:
        error: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            error["details"] = self.details
        if request_id:
            error["request_id"] = request_id
        return {"error": error}


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"
    message = "The submitted data is invalid."


class AuthenticationError(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Authentication is required."


class PermissionDeniedError(AppError):
    status_code = 403
    code = "forbidden"
    message = "You do not have permission to perform this action."


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "The requested resource was not found."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "The resource already exists or conflicts with an existing one."


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many requests. Please retry later."


class ProviderError(AppError):
    """An upstream provider (Sarvam, WhatsApp, Razorpay, ...) failed."""

    status_code = 502
    code = "provider_error"
    message = "The upstream provider rejected the request."


class ProviderNotConfiguredError(ProviderError):
    status_code = 503
    code = "provider_not_configured"
    message = "This integration is not configured on the server."


class ProviderCapabilityMissing(ProviderError):
    """The provider does not offer this operation, so nothing was attempted.

    Deliberately not a 500: the request was understood and the answer is final.
    501 tells a caller "this build cannot do that yet" without hinting at which
    vendor is behind it - the capability name is the only detail that leaves.
    """

    status_code = 501
    code = "provider_capability_unavailable"
    message = "This capability is not available yet."


class InsufficientCreditsError(AppError):
    status_code = 402
    code = "insufficient_credits"
    message = "The organization does not have enough credits for this action."
