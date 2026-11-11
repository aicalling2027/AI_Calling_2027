"""Provider catalogue and configuration health.

One place to answer "what can this deployment actually do right now?" - used by
``GET /integrations`` and the health endpoint. Each entry lists the settings it
needs, so the UI can show a precise "missing configuration" hint instead of a
generic failure.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Final

from app.core.config import settings
from app.integrations import calendly, google_sheets, meta_leads, n8n
from app.integrations import razorpay, sarvam, telephony, whatsapp, zoom


def _is_set(attribute: str) -> bool:
    value = getattr(settings, attribute, None)
    return bool(value and str(value).strip())


@dataclass(frozen=True, slots=True)
class ProviderSpec:
    code: str
    name: str
    category: str
    required: tuple[str, ...]
    optional: tuple[str, ...] = ()
    description: str = ""
    docs_url: str = ""

    def missing(self) -> list[str]:
        return [name for name in self.required if not _is_set(name)]

    @property
    def configured(self) -> bool:
        return not self.missing()


PROVIDERS: Final[tuple[ProviderSpec, ...]] = (
    ProviderSpec(
        code="sarvam",
        name="Sarvam AI",
        category="voice",
        required=("sarvam_api_key",),
        optional=("sarvam_base_url", "sarvam_default_speaker"),
        description="Indic LLM, Bulbul voices and Saarika transcription.",
        docs_url="https://docs.sarvam.ai",
    ),
    ProviderSpec(
        code="telephony",
        name="SIP Telephony",
        category="voice",
        required=("telephony_sip_domain",),
        optional=("telephony_sip_username", "telephony_sip_password"),
        description="Outbound dialling through an HTTP SIP bridge. Demo mode when unset.",
        docs_url="https://docs.sarvam.ai/telephony",
    ),
    ProviderSpec(
        code="whatsapp",
        name="WhatsApp Cloud API",
        category="messaging",
        required=("whatsapp_phone_number_id", "whatsapp_access_token"),
        optional=("whatsapp_verify_token",),
        description="Follow-up messages, catalogs and appointment confirmations.",
        docs_url="https://developers.facebook.com/docs/whatsapp/cloud-api",
    ),
    ProviderSpec(
        code="meta_lead_ads",
        name="Meta Lead Ads",
        category="lead_source",
        required=("meta_page_access_token",),
        optional=("meta_app_secret", "meta_verify_token"),
        description="Instant lead import from Facebook and Instagram forms.",
        docs_url="https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
    ),
    ProviderSpec(
        code="google_sheets",
        name="Google Sheets",
        category="lead_source",
        required=("google_sheets_spreadsheet_id",),
        optional=("google_sheets_credentials_json",),
        description="Import leads from a spreadsheet, sheet sync for bulk campaigns.",
        docs_url="https://developers.google.com/sheets/api",
    ),
    ProviderSpec(
        code="n8n",
        name="n8n Automation",
        category="automation",
        required=("n8n_base_url",),
        optional=("n8n_api_key", "n8n_lead_webhook_url", "n8n_followup_webhook_url"),
        description="Workflow orchestration for CRM sync and follow-up automation.",
        docs_url="https://docs.n8n.io",
    ),
    ProviderSpec(
        code="calendly",
        name="Calendly",
        category="scheduling",
        required=("calendly_api_token",),
        optional=("calendly_event_type_uri",),
        description="Appointment booking links created on demand.",
        docs_url="https://developer.calendly.com",
    ),
    ProviderSpec(
        code="zoom",
        name="Zoom",
        category="scheduling",
        required=("zoom_account_id", "zoom_client_id", "zoom_client_secret"),
        description="Meeting links for virtual consultations.",
        docs_url="https://developers.zoom.us",
    ),
    ProviderSpec(
        code="razorpay",
        name="Razorpay",
        category="billing",
        required=("razorpay_key_id", "razorpay_key_secret"),
        optional=("razorpay_webhook_secret",),
        description="Subscription billing and credit top-ups.",
        docs_url="https://razorpay.com/docs/api",
    ),
    ProviderSpec(
        code="redis",
        name="Redis",
        category="infrastructure",
        required=("redis_url",),
        description="Rate limiting, cache and Celery broker.",
        docs_url="https://redis.io/docs",
    ),
    ProviderSpec(
        code="supabase",
        name="Supabase",
        category="infrastructure",
        required=("supabase_url", "supabase_service_role_key"),
        optional=("supabase_storage_bucket",),
        description="File storage for call recordings. The database is DATABASE_URL.",
        docs_url="https://supabase.com/docs",
    ),
    ProviderSpec(
        code="sentry",
        name="Sentry",
        category="observability",
        required=("sentry_dsn",),
        description="Error tracking and performance traces.",
        docs_url="https://docs.sentry.io",
    ),
)

_BY_CODE: Final[dict[str, ProviderSpec]] = {spec.code: spec for spec in PROVIDERS}

#: Extra runtime probes that answer "is the adapter actually able to talk?".
_PROBES: Final[dict[str, Callable[[], bool]]] = {
    "sarvam": sarvam.configured,
    "telephony": telephony.configured,
    "whatsapp": whatsapp.configured,
    "meta_lead_ads": meta_leads.configured,
    "google_sheets": google_sheets.configured,
    "n8n": n8n.configured,
    "calendly": calendly.configured,
    "zoom": zoom.configured,
    "razorpay": razorpay.configured,
}


def get_spec(code: str) -> ProviderSpec | None:
    return _BY_CODE.get(code)


def describe(code: str) -> dict[str, Any]:
    """Return the status payload expected by ``IntegrationStatusOut``."""
    spec = _BY_CODE.get(code)
    if spec is None:
        return {
            "provider": code,
            "name": code,
            "category": "other",
            "description": "",
            "docs_url": "",
            "configured": False,
            "healthy": False,
            "detail": "Unknown provider",
            "missing_settings": [],
        }

    missing = spec.missing()
    probe = _PROBES.get(code)
    healthy = bool(probe()) if probe else spec.configured

    if spec.configured and healthy:
        detail = "Ready"
    elif spec.configured and not healthy:
        detail = "Configured but the adapter reports it cannot connect"
    else:
        detail = "Simulation mode - add " + ", ".join(missing)

    return {
        "provider": spec.code,
        "name": spec.name,
        "category": spec.category,
        "description": spec.description,
        "docs_url": spec.docs_url,
        "configured": spec.configured,
        "healthy": healthy,
        "detail": detail,
        "missing_settings": missing,
    }


def all_statuses() -> list[dict[str, Any]]:
    return [describe(spec.code) for spec in PROVIDERS]


def summary() -> dict[str, Any]:
    statuses = all_statuses()
    ready = [item["provider"] for item in statuses if item["healthy"]]
    pending = [item["provider"] for item in statuses if not item["configured"]]
    return {
        "total": len(statuses),
        "ready": ready,
        "simulated": pending,
        "detail": statuses,
    }
