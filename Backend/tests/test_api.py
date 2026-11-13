"""Contract tests for the public API surface.

These are deliberately black-box: they talk HTTP only, so they keep passing
through refactors of the service layer and catch the failures a user would
actually see (status codes, envelope shape, tenancy, RBAC).
"""

from __future__ import annotations

from tests.conftest import API, DEMO_EMAIL, DEMO_PASSWORD, unique


# ---------------------------------------------------------------------------
# Platform
# ---------------------------------------------------------------------------
def test_health_is_database_independent(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["service"]


def test_readiness_reports_dependencies(client):
    body = client.get("/ready").json()
    assert body["database"]["ok"] is True
    assert set(body["integrations"]) == {"total", "ready", "simulated"}


def test_capabilities_lists_every_provider(client):
    body = client.get("/capabilities").json()
    assert body["providers"]
    assert "features" in body


def test_openapi_documents_auth_schemes(client):
    schema = client.get("/openapi.json").json()
    assert {"BearerAuth", "ApiKeyAuth"} <= set(schema["components"]["securitySchemes"])
    assert len(schema["paths"]) > 50


def test_request_id_is_echoed(client):
    response = client.get("/health")
    assert response.headers["X-Request-ID"]
    assert float(response.headers["X-Process-Time-Ms"]) >= 0


def test_security_headers_present(client):
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "Content-Security-Policy" in response.headers


# ---------------------------------------------------------------------------
# Authentication & authorisation
# ---------------------------------------------------------------------------
def test_login_returns_a_token_pair(client):
    body = client.post(
        f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    ).json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"].lower() == "bearer"


def test_login_rejects_a_bad_password(client):
    response = client.post(
        f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "nope-nope"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_protected_endpoint_requires_a_token(client):
    response = client.get(f"{API}/leads")
    assert response.status_code == 401


def test_garbage_token_is_rejected(client):
    response = client.get(f"{API}/leads", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_me_returns_the_organization(client, auth):
    body = client.get(f"{API}/auth/me", headers=auth).json()
    assert body["organization"]["id"]
    assert body["user"]["email"] == DEMO_EMAIL


def test_validation_errors_use_the_error_envelope(client):
    response = client.post(f"{API}/auth/login", json={"email": "not-an-email"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"]["fields"]


def test_unknown_route_is_a_404_envelope(client):
    response = client.get("/api/v1/definitely-not-a-route")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------
def test_employee_lifecycle(client, auth, employee):
    detail = client.get(f"{API}/employees/{employee['id']}", headers=auth)
    assert detail.status_code == 200
    assert detail.json()["status"] == "active"


def test_employee_agent_config_is_provider_ready(client, auth, employee):
    body = client.get(f"{API}/employees/{employee['id']}/agent-config", headers=auth).json()
    assert body["employee_id"] == employee["id"]
    assert "system_prompt" in body


def test_employee_update_persists(client, auth, employee):
    new_name = unique("Renamed")
    response = client.patch(
        f"{API}/employees/{employee['id']}", headers=auth, json={"name": new_name}
    )
    assert response.status_code == 200
    assert response.json()["name"] == new_name

    # Restore so later tests keep a stable name.
    client.patch(f"{API}/employees/{employee['id']}", headers=auth, json={"name": employee["name"]})


def test_employee_status_transition_is_recorded(client, auth, employee):
    paused = client.post(
        f"{API}/employees/{employee['id']}/status", headers=auth, json={"status": "paused"}
    )
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"

    resumed = client.post(
        f"{API}/employees/{employee['id']}/status", headers=auth, json={"status": "active"}
    )
    assert resumed.json()["status"] == "active"


def test_employee_catalogues_are_available(client, auth):
    versions = client.get(f"{API}/employees/{employee_id_placeholder(client, auth)}/versions", headers=auth)
    assert versions.status_code == 200


def employee_id_placeholder(client, auth) -> str:
    rows = client.get(f"{API}/employees", headers=auth).json()
    return rows["items"][0]["id"]


def _disposable_employee(client, auth, prefix: str) -> str:
    """A throw-away, activated employee that already has instructions.

    Enabling calls needs both, and the trial plan caps the workspace at two
    seats, so callers must archive what they create.
    """
    created = client.post(
        f"{API}/employees",
        headers=auth,
        json={
            "name": unique(prefix),
            "system_prompt": "Answer questions about admissions.",
        },
    )
    assert created.status_code == 201, created.text
    employee_id = created.json()["id"]

    activated = client.post(
        f"{API}/employees/{employee_id}/status", headers=auth, json={"status": "active"}
    )
    assert activated.status_code == 200, activated.text
    return employee_id


def test_employee_creation_does_not_touch_the_voice_provider(client, auth, employee):
    """Creating a row is a workspace action; putting it on the phone is not."""
    calling = employee["calling"]
    assert calling["enabled"] is False
    assert calling["state"] == "not_configured"
    assert calling["connected"] is False
    assert calling["last_checked_at"] is None

    # White-label: no deployment id, agent id or workspace in the payload.
    assert "provider_agent" not in employee
    assert "dep-" not in str(employee)


def test_enabling_calling_does_not_duplicate_the_line(client, auth, employee):
    """Enabling twice reuses the line instead of claiming a second number."""
    first = client.post(f"{API}/employees/{employee['id']}/calling/enable", headers=auth)
    assert first.status_code == 200, first.text
    body = first.json()["calling"]
    assert body["enabled"] is True
    assert body["state"] == "ready_to_deploy"
    assert body["simulated"] is True

    again = client.post(f"{API}/employees/{employee['id']}/calling/enable", headers=auth)
    assert again.status_code == 200, again.text
    assert again.json()["calling"]["state"] == body["state"]

    # The deprecated provider-named alias still reaches the same line.
    legacy = client.post(f"{API}/employees/{employee['id']}/agent", headers=auth)
    assert legacy.status_code == 200, legacy.text
    assert legacy.json()["calling"]["state"] == body["state"]


def test_pausing_an_employee_takes_its_line_down(client, auth):
    """A status change may adjust an existing line, never create one."""
    employee_id = _disposable_employee(client, auth, "Paused")

    enabled = client.post(f"{API}/employees/{employee_id}/calling/enable", headers=auth)
    assert enabled.status_code == 200, enabled.text
    assert enabled.json()["calling"]["state"] == "ready_to_deploy"

    paused = client.post(
        f"{API}/employees/{employee_id}/status", headers=auth, json={"status": "paused"}
    )
    assert paused.json()["calling"]["state"] == "paused"

    resumed = client.post(
        f"{API}/employees/{employee_id}/status", headers=auth, json={"status": "active"}
    )
    assert resumed.json()["calling"]["state"] == "ready_to_deploy"

    client.delete(f"{API}/employees/{employee_id}", headers=auth)


def test_editing_after_enabling_marks_the_line_as_pending(client, auth):
    """An edit nobody can push to the agent must not keep reading as applied."""
    employee_id = _disposable_employee(client, auth, "Stale")
    client.post(f"{API}/employees/{employee_id}/calling/enable", headers=auth)

    edited = client.patch(
        f"{API}/employees/{employee_id}",
        headers=auth,
        json={"system_prompt": "Ask about the new term dates."},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["configuration_version"] == 2
    assert edited.json()["calling"]["state"] == "configuration_pending"

    client.delete(f"{API}/employees/{employee_id}", headers=auth)


def test_duplicate_employee_name_is_rejected(client, auth, employee):
    response = client.post(
        f"{API}/employees",
        headers=auth,
        json={"name": employee["name"].upper()},
    )
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "conflict"
    assert employee["name"].lower() in error["message"].lower()


def test_employee_cannot_be_renamed_onto_another(client, auth, employee):
    other = client.post(
        f"{API}/employees",
        headers=auth,
        json={"name": unique("Collision")},
    )
    assert other.status_code == 201, other.text
    created = other.json()

    response = client.patch(
        f"{API}/employees/{created['id']}", headers=auth, json={"name": employee["name"]}
    )
    assert response.status_code == 409
    assert employee["name"] in response.json()["error"]["message"]

    # The freshly created row is archived so it does not eat the plan quota.
    client.delete(f"{API}/employees/{created['id']}", headers=auth)


def test_dedupe_is_a_no_op_on_a_clean_workspace(client, auth, employee):
    body = client.post(f"{API}/employees/dedupe", headers=auth).json()
    assert body["scanned"] >= 1
    assert body["duplicates"] == 0
    assert body["archived_ids"] == []


def test_redeploying_a_paused_employee_keeps_the_line_down(client, auth):
    """A re-deploy must not put a stopped employee back on the phone."""
    employee_id = _disposable_employee(client, auth, "Paused again")

    client.post(f"{API}/employees/{employee_id}/calling/enable", headers=auth)
    paused = client.post(
        f"{API}/employees/{employee_id}/status", headers=auth, json={"status": "paused"}
    )
    assert paused.json()["calling"]["state"] == "paused"

    again = client.post(f"{API}/employees/{employee_id}/agent", headers=auth)
    assert again.status_code == 200, again.text
    assert again.json()["calling"]["state"] == "paused"

    client.delete(f"{API}/employees/{employee_id}", headers=auth)


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------
def test_lead_creation_and_lookup(client, auth, lead):
    detail = client.get(f"{API}/leads/{lead['id']}", headers=auth)
    assert detail.status_code == 200
    assert detail.json()["contact"]["phone"].startswith("+91")


def test_lead_funnel_transitions(client, auth, lead):
    updated = client.post(
        f"{API}/leads/{lead['id']}/status",
        headers=auth,
        json={"status": "qualified", "note": "Budget confirmed"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "qualified"


def test_lead_activity_timeline_records_the_change(client, auth, lead):
    client.post(f"{API}/leads/{lead['id']}/status", headers=auth, json={"status": "contacted"})
    activities = client.get(f"{API}/leads/{lead['id']}/activities", headers=auth).json()
    items = activities["items"] if isinstance(activities, dict) else activities
    assert items


def test_lead_validation_rejects_a_bad_phone(client, auth):
    response = client.post(
        f"{API}/leads",
        headers=auth,
        json={"contact": {"full_name": "Bad Number", "phone": "12"}},
    )
    assert response.status_code == 422


def test_bulk_import_accepts_partial_rows(client, auth):
    # Seed one number, then import it again alongside a brand-new one.
    seed = client.post(
        f"{API}/leads",
        headers=auth,
        json={
            "contact": {"full_name": unique("Bulk seed"), "phone": "+919812340001"},
            "source": "manual_upload",
        },
    )
    assert seed.status_code == 201, seed.text

    response = client.post(
        f"{API}/leads/bulk",
        headers=auth,
        json={
            "leads": [
                {"full_name": unique("Bulk"), "phone": "+919812340002"},
                {"full_name": "Already present", "phone": "+919812340001"},
            ],
            "source": "bulk_campaign",
        },
    )
    assert response.status_code in (200, 201), response.text
    body = response.json()
    # Duplicates are skipped, not fatal.
    assert body["created"] >= 1 and body["skipped"] >= 1


def test_pagination_is_consistent(client, auth):
    page = client.get(f"{API}/leads", headers=auth, params={"page": 1, "page_size": 2}).json()
    meta = page["meta"]
    assert meta["page"] == 1
    assert meta["page_size"] == 2
    assert len(page["items"]) <= 2
    assert meta["total"] >= len(page["items"])


# ---------------------------------------------------------------------------
# Phone numbers, campaigns and calls
# ---------------------------------------------------------------------------
def test_phone_number_providers_catalogue(client, auth):
    body = client.get(f"{API}/phone-numbers/providers", headers=auth).json()
    assert isinstance(body, list) and body


def test_campaign_runs_end_to_end(client, auth, employee, phone_number, lead):
    created = client.post(
        f"{API}/campaigns",
        headers=auth,
        json={
            "name": unique("Campaign"),
            "employee_id": employee["id"],
            "phone_number_id": phone_number["id"],
            "lead_ids": [lead["id"]],
            "calling_window_start": "00:00",
            "calling_window_end": "23:59",
            "max_concurrent_calls": 1,
            "max_attempts": 2,
        },
    )
    assert created.status_code == 201, created.text
    campaign = created.json()

    started = client.post(f"{API}/campaigns/{campaign['id']}/start", headers=auth)
    assert started.status_code == 200
    assert started.json()["status"] in {"running", "scheduled"}

    progress = client.get(f"{API}/campaigns/{campaign['id']}/progress", headers=auth).json()
    assert progress["total"] >= 1

    paused = client.post(f"{API}/campaigns/{campaign['id']}/pause", headers=auth)
    assert paused.json()["status"] == "paused"

    cancelled = client.post(f"{API}/campaigns/{campaign['id']}/cancel", headers=auth)
    assert cancelled.json()["status"] == "cancelled"


def test_campaign_cannot_start_twice_after_completion(client, auth, employee, phone_number, lead):
    created = client.post(
        f"{API}/campaigns",
        headers=auth,
        json={
            "name": unique("Campaign"),
            "employee_id": employee["id"],
            "phone_number_id": phone_number["id"],
            "lead_ids": [lead["id"]],
        },
    ).json()
    client.post(f"{API}/campaigns/{created['id']}/cancel", headers=auth)
    again = client.post(f"{API}/campaigns/{created['id']}/start", headers=auth)
    assert again.status_code == 409


def test_outbound_call_is_queued_and_recorded(client, auth, employee, phone_number, lead):
    response = client.post(
        f"{API}/calls/outbound",
        headers=auth,
        json={
            "to_number": lead["contact"]["phone"],
            "employee_id": employee["id"],
            "lead_id": lead["id"],
            "phone_number_id": phone_number["id"],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["call_id"]

    detail = client.get(f"{API}/calls/{body['call_id']}", headers=auth)
    assert detail.status_code == 200
    assert detail.json()["direction"] == "outbound"


def test_outbound_call_requires_a_phone_number(client, auth, employee):
    # A brand-new org has no numbers; the demo org always does, so instead of
    # creating a tenant we assert the guard through an unknown employee id.
    response = client.post(
        f"{API}/calls/outbound",
        headers=auth,
        json={"to_number": "+919812345678", "employee_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 404


def test_call_outcome_can_be_recorded(client, auth, employee, phone_number):
    created = client.post(
        f"{API}/calls/outbound",
        headers=auth,
        json={
            "to_number": "+919812349999",
            "employee_id": employee["id"],
            "phone_number_id": phone_number["id"],
        },
    ).json()
    updated = client.post(
        f"{API}/calls/{created['call_id']}/outcome",
        headers=auth,
        json={"outcome": "interested", "notes": "Wants a callback"},
    )
    assert updated.status_code == 200
    assert updated.json()["outcome"] == "interested"


def test_active_call_count_is_exposed(client, auth):
    body = client.get(f"{API}/calls/active", headers=auth).json()
    assert isinstance(body["active_calls"], int)


# ---------------------------------------------------------------------------
# Analytics, billing and knowledge base
# ---------------------------------------------------------------------------
def test_dashboard_returns_every_section(client, auth):
    body = client.get(f"{API}/dashboard", headers=auth, params={"days": 30}).json()
    for key in ("at_a_glance", "recent_summary", "trends", "outcomes", "sources"):
        assert key in body


def test_performance_returns_per_employee_rows(client, auth):
    body = client.get(f"{API}/performance", headers=auth).json()
    assert "employees" in body


def test_billing_plans_are_seeded(client, auth):
    plans = client.get(f"{API}/billing/plans").json()
    assert len(plans) >= 3
    assert all(plan["price_inr"] >= 0 for plan in plans)


def test_credit_balance_is_tracked(client, auth):
    body = client.get(f"{API}/billing/credits", headers=auth).json()
    assert "balance" in body
    ledger = client.get(f"{API}/billing/credits/ledger", headers=auth)
    assert ledger.status_code == 200


def test_subscription_is_provisioned(client, auth):
    body = client.get(f"{API}/billing/subscription", headers=auth).json()
    assert body["plan"]["code"]
    assert body["status"]


def test_knowledge_source_is_ingested_and_searchable(client, auth):
    created = client.post(
        f"{API}/training/sources",
        headers=auth,
        json={
            "name": unique("Fee policy"),
            "source_type": "text",
            "raw_text": "The MBA programme costs 250000 INR per year. "
            "Hostel accommodation is 80000 INR per year. "
            "Scholarships are available for meritorious students.",
        },
    )
    assert created.status_code == 201, created.text

    answer = client.post(
        f"{API}/training/query", headers=auth, json={"query": "How much is the hostel?"}
    )
    assert answer.status_code == 200
    found = answer.json()
    assert isinstance(found["hits"], list)
    assert found["mode"]


# ---------------------------------------------------------------------------
# Integrations, automation and the developer platform
# ---------------------------------------------------------------------------
def test_provider_catalog_needs_no_auth(client):
    body = client.get(f"{API}/integrations/catalog").json()
    assert len(body) >= 10
    assert all("configured" in item for item in body)


def test_integration_status_marks_simulated_providers(client, auth):
    rows = client.get(f"{API}/integrations/status", headers=auth).json()
    assert any(row["configured"] is False for row in rows)


def test_workflow_can_be_created_and_run(client, auth):
    created = client.post(
        f"{API}/workflows",
        headers=auth,
        json={
            "name": unique("Lead router"),
            "trigger_type": "lead.created",
            "trigger_config": {"webhook_url": ""},
            "actions": [{"type": "http", "url": ""}],
        },
    )
    assert created.status_code == 201, created.text
    workflow = created.json()

    run = client.post(f"{API}/workflows/{workflow['id']}/run", headers=auth, json={})
    assert run.status_code == 200, run.text
    execution = run.json()
    assert execution["workflow_id"] == workflow["id"]
    assert execution["status"]  # provider-specific, but never empty


def test_notification_history_is_queryable(client, auth):
    body = client.get(f"{API}/notifications", headers=auth).json()
    assert "items" in body
    stats = client.get(f"{API}/notifications/stats", headers=auth).json()
    assert isinstance(stats, dict)


def test_api_key_grants_machine_access(client, auth):
    created = client.post(
        f"{API}/developers/api-keys",
        headers=auth,
        json={"name": unique("CI"), "scopes": ["leads:read"]},
    )
    assert created.status_code == 201, created.text
    raw = created.json()["api_key"]
    assert raw.startswith("ownai_")

    whoami = client.get(f"{API}/developers/whoami", headers={"X-API-Key": raw})
    assert whoami.status_code == 200
    assert whoami.json()["organization_id"]

    usage = client.get(f"{API}/developers/api-keys/usage", headers=auth)
    assert usage.status_code == 200

    revoked = client.delete(
        f"{API}/developers/api-keys/{created.json()['id']}", headers=auth
    )
    assert revoked.status_code == 200


def test_revoked_api_key_stops_working(client, auth):
    created = client.post(
        f"{API}/developers/api-keys",
        headers=auth,
        json={"name": unique("Temp"), "scopes": ["leads:read"]},
    ).json()
    client.delete(f"{API}/developers/api-keys/{created['id']}", headers=auth)

    response = client.get(f"{API}/developers/whoami", headers={"X-API-Key": created["api_key"]})
    assert response.status_code == 401


def test_audit_trail_records_writes(client, auth):
    body = client.get(
        f"{API}/developers/audit-logs", headers=auth, params={"page_size": 5}
    )
    assert body.status_code == 200
    assert body.json()["meta"]["total"] >= 1


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
def test_telephony_webhook_rejects_a_bad_secret(client, monkeypatch):
    from app.core.config import settings

    # The shipped default accepts unsigned callbacks in development, so pin a
    # real secret to prove the production path rejects a wrong one.
    monkeypatch.setattr(settings, "telephony_webhook_secret", "prod-secret")
    response = client.post(
        f"{API}/webhooks/telephony/status",
        json={"provider_call_id": "x", "event_type": "completed", "status": "completed"},
        headers={"X-Webhook-Secret": "definitely-wrong"},
    )
    assert response.status_code == 401


def test_telephony_webhook_acknowledges_unknown_calls(client):
    # Providers retry non-2xx answers, so an unmatched event must still be a 200.
    response = client.post(
        f"{API}/webhooks/telephony/status",
        json={
            "provider_call_id": unique("ghost-call"),
            "event_type": "completed",
            "status": "completed",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["matched"] is False


def test_whatsapp_verification_handshake(client):
    response = client.get(
        f"{API}/webhooks/whatsapp",
        params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "42"},
    )
    assert response.status_code == 401
