"""Shared pytest fixtures.

Environment variables are set *before* the application is imported because the
engine, settings and Celery app are all created at import time. Tests therefore
always run against a throw-away SQLite file, never against ``aotms.db``.
"""

from __future__ import annotations

import os
import sys
import tempfile
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_TMP_DB = Path(tempfile.gettempdir()) / f"ownai_test_{uuid.uuid4().hex[:8]}.db"

os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB.as_posix()}"
os.environ["APP_ENV"] = "development"
os.environ["APP_DEBUG"] = "true"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
os.environ["DB_AUTO_CREATE_TABLES"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

API = settings.api_v1_prefix

DEMO_EMAIL = "admin@ownai.in"
DEMO_PASSWORD = "Admin@12345"


def unique(prefix: str) -> str:
    """Names must be unique per tenant, so every test gets its own suffix."""
    return f"{prefix} {uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def tokens(client: TestClient) -> dict[str, str]:
    response = client.post(
        f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(scope="session")
def auth(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture(scope="session")
def employee(client: TestClient, auth: dict[str, str]) -> dict:
    """A fresh, activated AI employee.

    Session-scoped on purpose: the trial plan caps how many employees a tenant
    may own, so the whole suite shares one agent instead of exhausting the quota
    (which is itself covered by a dedicated test).
    """
    response = client.post(
        f"{API}/employees",
        headers=auth,
        json={
            "name": unique("Agent"),
            "business_category": "Education",
            "default_language": "en-IN",
            "voice": "shubh",
            "first_message": "Hello, how can I help?",
            "system_prompt": "You are a helpful admissions counsellor.",
        },
    )
    assert response.status_code == 201, response.text
    created = response.json()

    activated = client.post(
        f"{API}/employees/{created['id']}/status",
        headers=auth,
        json={"status": "active"},
    )
    assert activated.status_code == 200, activated.text
    return activated.json()


@pytest.fixture(scope="session")
def phone_number(client: TestClient, auth: dict[str, str], employee: dict) -> dict:
    """An active outbound number bound to the fixture employee."""
    response = client.post(
        f"{API}/phone-numbers",
        headers=auth,
        json={
            "number": f"+9198{uuid.uuid4().int % 10**8:08d}",
            "label": "Test line",
            "provider": "mock",
            "capabilities": ["outbound", "inbound"],
            "employee_id": employee["id"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def lead(client: TestClient, auth: dict[str, str]) -> dict:
    response = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {
                "full_name": unique("Lead"),
                "phone": f"+9199{uuid.uuid4().int % 10**8:08d}",
            },
            "source": "manual_upload",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
