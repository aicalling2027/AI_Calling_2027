# OWN AI — Backend

Multilingual AI calling platform: AI voice agents that call leads, qualify them,
follow up on WhatsApp and report back to your CRM — all behind one REST API.

This service is a **modular monolith**: one process, one deployable, with clean
internal boundaries (`api → modules → database/integrations`). It boots with a
single command and needs **no external services** — the database is the only
dependency, and even that falls back to a local SQLite file.

```
python app.py
```

That is the whole setup. Open <http://127.0.0.1:8000/docs>.

| | |
|---|---|
| API surface | 111 documented endpoints across 18 tags |
| Database | 51 tables, seeded with plans, providers and a demo tenant |
| Tests | 47 black-box contract tests (`python -m pytest`) |
| Runtime | Python 3.11+ (verified on 3.13), FastAPI, SQLAlchemy 2, Pydantic 2 |

---

## 1. Quick start

### One-time: point the app at your database

`Backend/.env` ships with the Supabase connection string and a placeholder
password. Replace the placeholder once:

```ini
DATABASE_URL=postgresql://postgres:YOUR-REAL-PASSWORD@db.awuxrmgphnawphohzdwy.supabase.co:5432/postgres
```

* Get the password from **Supabase → Project Settings → Database**.
* Percent-encode special characters: `@` → `%40`, `#` → `%23`, `:` → `%3A`.
* Paste the URL exactly as the dashboard gives it — the app switches to the
  psycopg (v3) driver and appends `sslmode=require` for you.
* Prefer a local database instead? Set `DATABASE_URL=sqlite:///./aotms.db`.

### Then run

```bash
cd Backend
python -m pip install -r requirements.txt
python app.py
```

If the password is still the placeholder, the process stops immediately with
step-by-step instructions instead of a driver traceback.

First start creates any missing tables, seeds reference data and prints the
demo credentials:

```
  O W N   A I   -   Multilingual AI Calling Platform
==============================================================
  OWN AI 1.0.0  |  env=development
  API      http://127.0.0.1:8000/api/v1
  Docs     http://127.0.0.1:8000/docs
  Health   http://127.0.0.1:8000/health
```

**Demo login**

```
email:    admin@ownai.in
password: Admin@12345
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ownai.in","password":"Admin@12345"}'
```

### Launcher options

| Command | Effect |
|---|---|
| `python app.py` | Development server on `127.0.0.1:8000`, auto-reload |
| `python app.py --port 9000` | Bind another port |
| `python app.py --no-reload` | Single process, no file watcher |
| `python app.py --workers 4` | Multi-process (implies `--no-reload`) |
| `python app.py --check` | Print config, database and integration diagnostics, then exit |

`python app.py --check` is the fastest way to prove an environment is healthy
before deploying.

---

## 2. What is implemented

| Domain | Capabilities |
|---|---|
| **Auth** | JWT access + refresh, password policy, API-key auth, Supabase JWT passthrough |
| **Organization** | Tenant profile, team members, invitations, roles (owner/admin/manager/agent/viewer) |
| **AI Employees** | Agent profiles, voice/language/script config, provider-ready `agent-config`, versioning, publish lifecycle |
| **Phone numbers** | Provider catalogue, number provisioning, inbound/outbound capabilities, per-agent binding |
| **Leads** | Contacts with dedupe-by-phone, funnel statuses, activity timeline, bulk import, Google Sheets / Meta Lead Ads intake |
| **Campaigns** | Audience building, calling windows, concurrency and retry rules, start/pause/resume/cancel, live progress |
| **Calls** | Outbound dialling, inbound registration, provider webhooks, per-call event stream, outcome capture, recording links |
| **Conversations** | Transcripts, sentiment, key points, action items, AI summaries |
| **Knowledge base** | Text/URL/PDF ingestion, chunking, search, grounded Q&A with source citations |
| **Analytics** | Dashboard KPIs, call trends, outcome mix, source attribution, busiest hours, per-agent performance |
| **Billing** | Plans, subscription, credit ledger, top-ups, invoices, Razorpay webhook |
| **Integrations** | Sarvam, telephony/SIP, WhatsApp, Google Sheets, Meta, Calendly, Zoom, Razorpay, n8n — each reports `configured` or `simulated` |
| **Automation** | Workflow definitions, manual execution, n8n delegation |
| **Notifications** | WhatsApp/email dispatch log, retry queue, delivery stats |
| **Developers** | API keys with scopes, usage metering, audit log |
| **Ops** | `/health`, `/ready`, `/capabilities`, request ids, structured logs, rate limiting, security headers |

Anything without credentials runs in **simulated** mode: the call is recorded,
the response shape is identical, and a `provider_simulated` log line marks it.
Nothing has to be stubbed out by hand to demo the product.

---

## 3. Project layout

```
Backend/
├── app.py                  # launcher: python app.py
├── app/
│   ├── main.py             # app factory, middleware, error envelope, OpenAPI
│   ├── api/
│   │   ├── deps.py         # DB session, current principal, RBAC dependencies
│   │   └── v1/             # one router per domain (18 tags)
│   ├── core/               # settings, logging, exceptions, security, constants
│   ├── database/
│   │   ├── base.py         # declarative base, UUID + timestamp mixins
│   │   ├── session.py      # engine, session factory, health check
│   │   ├── models/         # 51 tables
│   │   └── init_db.py      # create + seed
│   ├── middleware/         # request context, rate limit, security headers
│   ├── modules/            # business logic, one module per domain
│   ├── schemas/            # Pydantic request/response contracts
│   ├── integrations/       # provider adapters (graceful degradation)
│   ├── utils/              # phone, time, text helpers
│   └── workers/            # Celery app + scheduled tasks
├── alembic/                # migrations
├── tests/                  # contract tests
├── Dockerfile / docker-compose.yml
├── requirements.txt        # runtime
└── requirements-dev.txt    # pytest, coverage, ruff
```

**Layering rule:** routers never touch models directly. `api → modules → models`,
with `integrations` isolated so a provider outage cannot corrupt data.

---

## 4. Configuration

Every setting has a working default, so `.env` is optional locally. Copy
`.env.example` to `.env` to override anything:

```bash
cp .env.example .env
```

Production must set at minimum:

```ini
APP_ENV=production
APP_DEBUG=false
LOG_JSON=true
JWT_SECRET=<64+ random characters>
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/ownai
DB_AUTO_CREATE_TABLES=false
TELEPHONY_WEBHOOK_SECRET=<random>
CORS_ORIGINS=https://app.yourdomain.com
```

The service refuses to look healthy with insecure defaults in production —
`python app.py` prints a warning block for every one it finds.

Provider credentials (`SARVAM_API_KEY`, `WHATSAPP_*`, `RAZORPAY_*`,
`GOOGLE_SHEETS_*`, `META_*`, `CALENDLY_*`, `ZOOM_*`, `N8N_*`) are all optional.
Missing them only downgrades that integration to simulated mode.

---

## 5. Database

Supabase PostgreSQL is the configured default; SQLite is the zero-setup fallback.

### Supabase

1. Copy the password from **Supabase → Project Settings → Database** and
   percent-encode special characters (`@` → `%40`, `#` → `%23`).
2. Put the connection string in `Backend/.env`:

   ```ini
   DATABASE_URL=postgresql://postgres:PASSWORD@db.awuxrmgphnawphohzdwy.supabase.co:5432/postgres
   ```

3. Start the app: `python app.py`. Missing tables are created on first boot
   (51 tables), then plans, providers and the demo tenant are seeded.

What happens to the URL automatically:

| Input | Behaviour |
|---|---|
| `postgres://…` or `postgresql://…` | Rewritten to `postgresql+psycopg://` — psycopg 3 ships in `requirements.txt` |
| no `sslmode` | `?sslmode=require` appended, because Supabase rejects plaintext |
| host contains `.pooler.` or port `6543` | psycopg prepared statements disabled for pgbouncer / Supavisor |
| any PostgreSQL | `pool_pre_ping`, `pool_recycle=1800`, `connect_timeout=10`, `application_name=ownai-backend` |

**IPv6 note.** New Supabase projects publish only an IPv6 record for
`db.<ref>.supabase.co`. On an IPv4-only network, switch to the **Supavisor
pooler** string from *Connect → Connection pooling* (port `6543`); the app
detects it and configures the session accordingly.

### Schema ownership

`DB_AUTO_CREATE_TABLES=true` (the default) lets the first boot build the schema.
Once it exists, hand ownership to Alembic so later changes are versioned:

```bash
python -m alembic stamp head        # record the current schema as the baseline
```

Then set `DB_AUTO_CREATE_TABLES=false` and use migrations from that point on:

```bash
python -m alembic upgrade head                    # apply pending migrations
python -m alembic revision --autogenerate -m "…"  # create after model changes
python -m alembic downgrade -1                    # roll back one step
```

`alembic/env.py` reads `DATABASE_URL` from the same settings object, so
migrations always target exactly the database the API is using.

### SQLite (offline development)

```ini
DATABASE_URL=sqlite:///./aotms.db
```

Nothing else changes — the schema is created, seeded and migrated the same way.

---

## 6. Background jobs

Celery is wired up but **eager by default** (`CELERY_TASK_ALWAYS_EAGER=true`),
so `python app.py` needs no broker — tasks run inline.

| Task | Schedule | Purpose |
|---|---|---|
| `workers.campaign_scheduler` | every 60 s | Start scheduled campaigns, refill running ones |
| `workers.release_stale_calls` | every 5 min | Finalise calls stuck past 30 minutes |
| `workers.retry_notifications` | every 5 min | Re-send failed WhatsApp/email |
| `workers.nightly_maintenance` | 02:00 | Purge expired tokens, roll up counters |

Run a real worker when you outgrow eager mode:

```bash
celery -A app.workers.celery_app worker --loglevel=info -P solo
celery -A app.workers.celery_app beat   --loglevel=info
```

---

## 7. Tests

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

The suite is black-box: it drives HTTP only, against a throw-away SQLite file,
so it never touches `aotms.db`. Coverage spans auth, RBAC, tenancy, the lead and
campaign funnel, billing arithmetic, API keys and webhooks.

```bash
python -m pytest --cov=app --cov-report=term-missing
python -m ruff check app tests
```

---

## 8. Docker

```bash
docker compose up --build          # api + postgres + redis + worker + beat
docker compose logs -f api
```

The image runs as a non-root user, exposes a `HEALTHCHECK` on `/health`, and
starts with `python app.py --no-reload` — the same entry point as local
development.

---

## 9. API conventions

* Base path `/api/v1`; interactive docs at `/docs`, schema at `/openapi.json`.
* Auth: `Authorization: Bearer <jwt>` for users, `X-API-Key: ownai_…` for machines.
* Errors are always the same envelope:

  ```json
  {"error": {"code": "validation_error", "message": "The submitted data is invalid.",
             "details": {"fields": [{"field": "phone", "message": "Invalid number"}]},
             "request_id": "9aeb8698204b4f6a"}}
  ```

* Lists are paginated: `{"items": [...], "meta": {"page", "page_size", "total",
  "pages", "has_next", "has_previous"}}`.
* Every response carries `X-Request-ID` and `X-Process-Time-Ms`; the same request
  id appears in the logs, so a customer report maps straight to a log line.
* Tenancy is enforced in the query layer — a token can never read another
  organization's rows, and cross-tenant ids return `404`, not `403`.

---

## 10. Health and readiness

| Endpoint | Meaning |
|---|---|
| `GET /health` | Process is alive (no dependencies touched) |
| `GET /ready` | Database reachable + integration summary |
| `GET /capabilities` | Provider matrix: which integrations are live vs simulated |
| `GET /api/v1/health` | Versioned alias for probes behind an ingress |

---

## 11. Production checklist

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `LOG_JSON=true`
- [ ] Fresh `JWT_SECRET` and `TELEPHONY_WEBHOOK_SECRET`
- [ ] PostgreSQL reachable, `DB_AUTO_CREATE_TABLES=false`, `alembic upgrade head` run
- [ ] Redis reachable, `CELERY_TASK_ALWAYS_EAGER=false`, worker + beat running
- [ ] `CORS_ORIGINS` restricted to real front-end origins
- [ ] `python app.py --check` reports every required provider as `ready`
- [ ] Reverse proxy terminates TLS; `/health` wired to the load balancer
