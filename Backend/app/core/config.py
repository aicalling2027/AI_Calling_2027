"""Application configuration.

All settings come from environment variables or a ``.env`` file located at the
``Backend/`` root. Every field carries a safe development default so the
service starts with ``python app.py`` and no configuration at all.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# app/core/config.py -> app/core -> app -> Backend/
BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_PATH = BASE_DIR / "aotms.db"

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Typed, validated application settings."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # ``CORS_ORIGINS`` is written as ``a,b`` in .env. Without this,
        # pydantic-settings would JSON-decode it before our validator runs and
        # every value would be rejected.
        enable_decoding=False,
    )

    # -- Application -------------------------------------------------------
    app_name: str = "OWN AI"
    app_version: str = "1.0.0"
    app_env: Environment = "development"
    app_debug: bool = True
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    app_reload: bool = True
    api_v1_prefix: str = "/api/v1"
    #: Public base URL used to build provider callbacks. Empty -> derive from the request.
    public_base_url: str = ""
    log_level: str = "INFO"
    log_json: bool = False
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # -- Database ----------------------------------------------------------
    database_url: str = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
    db_echo: bool = False
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_auto_create_tables: bool = True

    # -- Authentication ----------------------------------------------------
    jwt_secret: str = "dev-insecure-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14
    password_min_length: int = 8
    supabase_jwt_secret: str = ""

    # -- Rate limiting -----------------------------------------------------
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 300
    rate_limit_window_seconds: int = 60

    # -- Redis / Celery ----------------------------------------------------
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    celery_task_always_eager: bool = True

    # -- Sarvam AI ---------------------------------------------------------
    sarvam_api_key: str = ""
    sarvam_base_url: str = "https://api.sarvam.ai"
    sarvam_stt_model: str = "saarika:v2"
    sarvam_tts_model: str = "bulbul:v3"
    sarvam_chat_model: str = "sarvam-m"
    sarvam_default_speaker: str = "shubh"
    sarvam_timeout_seconds: int = 30

    # -- Sarvam Voice Agents (Samvaad deployments) --------------------------
    #: Agents are authored in the Sarvam workspace; the API deploys them. These
    #: identifiers tell the service which agent to deploy and where.
    sarvam_agents_base_url: str = "https://apps.sarvam.ai/api/app-authoring"
    #: Workspace key from the voice agent dashboard (Settings -> API Key). It is
    #: not the same credential as ``sarvam_api_key``, which pays for chat and TTS.
    sarvam_agents_api_key: str = ""
    sarvam_org_id: str = ""
    sarvam_workspace_id: str = ""
    sarvam_agent_app_id: str = ""
    sarvam_agent_app_version: int = 1
    sarvam_connection_id: str = ""
    sarvam_agent_phone_number: str = ""

    # -- Telephony ---------------------------------------------------------
    telephony_provider: str = "sarvam"
    telephony_webhook_secret: str = "change-me"
    telephony_sip_domain: str = ""
    telephony_sip_username: str = ""
    telephony_sip_password: str = ""
    telephony_outbound_enabled: bool = False

    # -- Supabase ----------------------------------------------------------
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "call-recordings"

    # -- WhatsApp ----------------------------------------------------------
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_verify_token: str = "change-me-verify-token"
    whatsapp_api_version: str = "v21.0"

    # -- Google Sheets -----------------------------------------------------
    google_sheets_credentials_json: str = ""
    google_sheets_spreadsheet_id: str = ""

    # -- Meta Lead Ads -----------------------------------------------------
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_verify_token: str = "change-me-meta-verify"
    meta_page_access_token: str = ""

    # -- Calendly / Zoom / Razorpay ---------------------------------------
    calendly_api_token: str = ""
    calendly_event_type_uri: str = ""
    zoom_account_id: str = ""
    zoom_client_id: str = ""
    zoom_client_secret: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # -- n8n ---------------------------------------------------------------
    n8n_base_url: str = ""
    n8n_api_key: str = ""
    n8n_lead_webhook_url: str = ""
    n8n_followup_webhook_url: str = ""

    # -- Observability -----------------------------------------------------
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.0

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept ``a,b``, a JSON list, or an already-parsed list."""
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                try:
                    return json.loads(stripped)
                except ValueError as exc:  # pragma: no cover - bad operator input
                    raise ValueError(
                        "CORS_ORIGINS must be a JSON list or a comma-separated string"
                    ) from exc
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return value

    @field_validator("app_env", mode="before")
    @classmethod
    def _normalise_env(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalise_database_url(cls, value: object) -> object:
        """Make a copy-pasted provider URL safe for SQLAlchemy.

        The Supabase dashboard hands out ``postgresql://…``; SQLAlchemy would
        then look for psycopg2, so the driver is pinned to psycopg 3. Supabase
        also requires TLS, therefore ``sslmode=require`` is appended when the
        URL does not already say otherwise.
        """
        if not isinstance(value, str):
            return value
        url = value.strip().strip('"').strip("'")
        if not url:
            return url
        for scheme in ("postgres://", "postgresql://"):
            if url.startswith(scheme):
                url = "postgresql+psycopg://" + url[len(scheme) :]
                break
        if url.startswith("postgresql+psycopg://") and "sslmode=" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
        return url

    # -- Derived helpers ---------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def is_pooled_postgres(self) -> bool:
        """True for Supabase Supavisor / pgbouncer in transaction mode.

        That pooler multiplexes many clients onto few server connections, which
        breaks psycopg's server-side prepared statements.
        """
        return self.is_postgres and (":6543" in self.database_url or ".pooler." in self.database_url)

    @property
    def database_target(self) -> str:
        """Host-level identifier for logs - never exposes the password."""
        from sqlalchemy.engine import make_url

        try:
            url = make_url(self.database_url)
        except Exception:  # pragma: no cover - malformed URL
            return "unknown"
        if url.get_backend_name() == "sqlite":
            return f"sqlite:{url.database}"
        return f"{url.get_backend_name()}://{url.host}:{url.port}/{url.database}"

    @property
    def database_password_is_placeholder(self) -> bool:
        """True while the Supabase ``[YOUR-PASSWORD]`` placeholder is unfilled."""
        lowered = self.database_url.lower()
        return any(
            token in lowered
            for token in ("[your-password]", "your-password", "<password>", "your_password")
        )

    @property
    def docs_url(self) -> str | None:
        return None if self.is_production else "/docs"

    @property
    def redoc_url(self) -> str | None:
        return None if self.is_production else "/redoc"

    def enabled(self, *values: str) -> bool:
        """True when every supplied credential/config value is non-empty."""
        return all(bool(value and str(value).strip()) for value in values)

    def masked(self) -> dict[str, str]:
        """Safe-to-log view of the credential-bearing settings."""
        keys = (
            "sarvam_api_key",
            "supabase_service_role_key",
            "whatsapp_access_token",
            "meta_page_access_token",
            "calendly_api_token",
            "razorpay_key_secret",
            "n8n_api_key",
        )
        out: dict[str, str] = {"database_url": self.database_target}
        for key in keys:
            raw = str(getattr(self, key, "") or "")
            out[key] = "set" if raw.strip() else "unset"
        return out


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
