"""Schema creation and reference-data seeding.

``create_all`` is intentionally used only for local development and tests.
Production deployments apply Alembic migrations instead.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import DEFAULT_PLANS, TRIAL_CREDITS, Role
from app.core.logging import get_logger
from app.core.security import hash_password
from app.database.base import utcnow
from app.database.models import (
    CreditAccount,
    Organization,
    OrganizationMember,
    SubscriptionPlan,
    TelephonyProvider,
    User,
)
from app.database.session import SessionLocal, engine

# Importing the models package registers every table on Base.metadata.
from app.database.base import Base  # noqa: E402  (import order matters)

logger = get_logger(__name__)

DEMO_ORG_SLUG = "demo-org"
# NOTE: ``.local`` is a reserved TLD and is rejected by email validation, so the
# demo account uses a routable-looking domain.
DEMO_ADMIN_EMAIL = "admin@ownai.in"
DEMO_ADMIN_PASSWORD = "Admin@12345"  # noqa: S105 - development seed only


def create_schema() -> None:
    """Create any missing tables (first boot on SQLite or PostgreSQL)."""
    Base.metadata.create_all(bind=engine)
    logger.info(
        "Database schema ensured (%d tables) on %s.",
        len(Base.metadata.tables),
        settings.database_target,
    )


def seed_plans(db: Session) -> None:
    """Insert the default subscription catalogue if absent."""
    existing = set(db.execute(select(SubscriptionPlan.code)).scalars().all())
    created = 0
    for index, plan in enumerate(DEFAULT_PLANS):
        code = str(plan["code"])
        if code in existing:
            continue
        db.add(
            SubscriptionPlan(
                code=code,
                name=str(plan["name"]),
                price_inr=int(plan["price_inr"]),  # type: ignore[arg-type]
                billing_interval=str(plan["billing_interval"]),
                included_credits=int(plan["included_credits"]),  # type: ignore[arg-type]
                max_employees=int(plan["max_employees"]),  # type: ignore[arg-type]
                max_phone_numbers=int(plan["max_phone_numbers"]),  # type: ignore[arg-type]
                features=list(plan["features"]),  # type: ignore[arg-type]
                sort_order=index,
            )
        )
        created += 1
    if created:
        logger.info("Seeded %d subscription plans.", created)


def seed_telephony_providers(db: Session) -> None:
    existing = set(db.execute(select(TelephonyProvider.code)).scalars().all())
    providers = [
        ("sarvam", "Sarvam AI SIP", True, True),
        ("mock", "Mock provider (development)", True, True),
    ]
    created = 0
    for code, name, inbound, outbound in providers:
        if code in existing:
            continue
        db.add(
            TelephonyProvider(
                code=code,
                name=name,
                supports_inbound=inbound,
                supports_outbound=outbound,
            )
        )
        created += 1
    if created:
        logger.info("Seeded %d telephony providers.", created)


def seed_demo_tenant(db: Session) -> None:
    """Create a ready-to-use organization and owner account for development."""
    if settings.is_production:
        return

    existing = db.execute(
        select(Organization).where(Organization.slug == DEMO_ORG_SLUG)
    ).scalar_one_or_none()
    if existing:
        return

    now = utcnow()
    org = Organization(
        name="Demo Organization",
        slug=DEMO_ORG_SLUG,
        industry="Education",
        timezone="Asia/Kolkata",
        currency="INR",
        trial_ends_at=now + timedelta(days=14),
    )
    db.add(org)
    db.flush()

    user = db.execute(select(User).where(User.email == DEMO_ADMIN_EMAIL)).scalar_one_or_none()
    if user is None:
        user = User(
            email=DEMO_ADMIN_EMAIL,
            hashed_password=hash_password(DEMO_ADMIN_PASSWORD),
            full_name="Demo Owner",
            is_superadmin=True,
            email_verified_at=now,
        )
        db.add(user)
        db.flush()

    db.add(
        OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=str(Role.OWNER),
            is_active=True,
            joined_at=now,
        )
    )
    db.add(
        CreditAccount(
            organization_id=org.id,
            balance=TRIAL_CREDITS,
            lifetime_credits=TRIAL_CREDITS,
        )
    )
    logger.info(
        "Seeded demo tenant '%s' with owner %s", DEMO_ORG_SLUG, DEMO_ADMIN_EMAIL
    )


def seed_all() -> None:
    """Seed every reference dataset exactly once."""
    db = SessionLocal()
    try:
        seed_plans(db)
        seed_telephony_providers(db)
        seed_demo_tenant(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_database() -> None:
    """Entry point used at application startup."""
    if settings.database_password_is_placeholder:
        raise RuntimeError(
            'DATABASE_URL still contains the Supabase "[YOUR-PASSWORD]" placeholder.\n'
            "   1. Open Backend/.env\n"
            "   2. Replace [YOUR-PASSWORD] with the password from "
            "Supabase -> Project Settings -> Database\n"
            "   3. Percent-encode special characters (for example @ -> %40)\n"
            "   4. Run `python app.py` again"
        )
    try:
        if settings.db_auto_create_tables or settings.is_sqlite:
            create_schema()
        seed_all()
    except OperationalError as exc:
        raise RuntimeError(_connection_hint(exc)) from exc


def _connection_hint(exc: Exception) -> str:
    """Turn a driver error into something a human can act on."""
    message = str(exc).splitlines()[0]
    lines = [
        f"Cannot reach the database at {settings.database_target}.",
        f"   Driver said: {message}",
    ]
    if "resolve host" in message or "getaddrinfo" in message:
        lines += [
            "   The hostname did not resolve. Supabase's direct host",
            "   (db.<project-ref>.supabase.co) is IPv6-only on newer projects,",
            "   so it is unreachable from IPv4-only networks.",
            "   Fix: Supabase dashboard -> Connect -> Connection pooling, copy the",
            "   Supavisor URL (port 6543) into DATABASE_URL in Backend/.env.",
        ]
    elif "password authentication" in message or "role" in message:
        lines.append("   Check the password in Backend/.env (percent-encode special characters).")
    lines.append("   Re-run `python app.py --check` to verify the connection.")
    return "\n".join(lines)
