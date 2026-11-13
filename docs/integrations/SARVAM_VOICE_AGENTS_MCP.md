# Sarvam Voice Agents MCP (remote server)

Status: registered for **human-driven, read-only use** in Qoder. The backend's REST
path (`app-authoring`) is **not** authenticated and cannot be fed by this MCP
session. See [Current backend integration limitations](#10-current-backend-integration-limitations).

Registered configuration, as verified in this revision:

| File | Servers | `sarvam-voice-agents` | Credentials in entry |
|---|---:|---:|---|
| `~/.qoder/mcp.json` (what Qoder loads) | 15 | 1 | none |
| `MCP/mcp.json` (project template, git-ignored) | 14 | 1 | none |

No server was removed from the Qoder-level config. The project template holds one
fewer entry because its legacy `sarvam` stdio server (`uvx sarvam-mcp`) is not part
of it; that server still exists at Qoder level and is unrelated to this endpoint.

## 1. Official endpoint

| Item | Value |
|---|---|
| Name | `sarvam-voice-agents` |
| URL | `https://mcp.sarvam.ai/voice-agents` |
| Transport | Streamable HTTP (remote, hosted — nothing to install) |
| Authentication | OAuth 2.1 / Sarvam SSO (browser sign-in) |
| Credentials in config | **none** — no API key, no token, no headers |

## 2. What the server exposes (verified by probe)

Unauthenticated calls are rejected with an OAuth challenge, not a JSON-RPC error:

```
GET  https://mcp.sarvam.ai/voice-agents            -> 401
POST https://mcp.sarvam.ai/voice-agents (initialize) -> 401
  WWW-Authenticate: Bearer error="invalid_token",
    error_description="Authentication required",
    resource_metadata="https://mcp.sarvam.ai/.well-known/oauth-protected-resource/voice-agents"

GET /.well-known/oauth-protected-resource/voice-agents
  {"resource":"https://mcp.sarvam.ai/voice-agents",
   "authorization_servers":["https://mcp.sarvam.ai/voice-agents"],
   "bearer_methods_supported":["header"]}

GET /.well-known/oauth-authorization-server/voice-agents
  issuer                     https://mcp.sarvam.ai/voice-agents
  authorization_endpoint     .../voice-agents/authorize
  token_endpoint             .../voice-agents/token
  registration_endpoint      .../voice-agents/register    (dynamic client registration)
  code_challenge_methods     S256 (PKCE)
  grant_types                authorization_code, refresh_token
  scopes_supported           (none advertised)
```

Practically: any OAuth-capable MCP client can register itself and complete a
browser sign-in. There are no scopes to request; what you can reach is decided by
the workspace your login resolves to and by the plan.

## 3. Authentication flow

1. Client POSTs to `/register` (dynamic client registration) and receives a
   `client_id`.
2. Client opens `/authorize` with PKCE (`code_challenge`, `S256`) in the browser.
3. You approve the connection in **Sarvam SSO**.
4. Client exchanges the code at `/token` and keeps the bearer token; it is sent as
   `Authorization: Bearer …` on every tool call.

There is no API key anywhere in this flow, and no client secret is stored in the
repository.

## 4. Qoder setup

### Option A — global config file (already applied)

`~/.qoder/mcp.json` carries this entry next to the servers that were already there:

```json
"sarvam-voice-agents": {
  "type": "http",
  "url": "https://mcp.sarvam.ai/voice-agents"
}
```

The project copy `MCP/mcp.json` (git-ignored) carries the same entry and is the file
teams clone. It has no `sarvam` stdio entry — only this remote server — so each file
has exactly one Voice Agents entry and no two server names share a URL.

Never point the legacy stdio `sarvam` server (`uvx sarvam-mcp`) at this URL: it
authenticates with `SARVAM_API_KEY` for the model APIs, while this endpoint accepts
only an OAuth 2.1 bearer from Sarvam SSO.

### Option B — through the IDE

Settings → **MCP** → add a server, transport **HTTP**, URL
`https://mcp.sarvam.ai/voice-agents`. This is the supported route if the file edit
is not picked up.

Do **not** hand-edit the client's internal cache
(`%APPDATA%\Qoder\SharedClientCache\extension\local\mcp.json`). It carries a
`userConfigMD5` integrity field and is regenerated from user settings; an edit
there is either overwritten or leaves the two copies disagreeing.

### After either option

1. Reload the window (or restart the MCP servers) so the new entry is loaded.
2. The server shows **needs authentication** on first use.
3. Trigger sign-in — in Qoder, use the server's **Authenticate** action; the
   browser opens **Sarvam SSO**; approve the connection for the workspace your
   login resolves to.
4. Verify with a read, e.g. ask for the agent list. The call is labelled with the
   server name `sarvam-voice-agents`.

If the client cannot start the OAuth flow, the same server works from any
OAuth-capable client, e.g.:

```
claude mcp add --transport http sarvam-voice-agents https://mcp.sarvam.ai/voice-agents
```

## 5. Workspace selection limitations

- A connection is bound to **one organisation and one workspace**, the ones your
  login resolves to. No tool accepts `org_id` or `workspace_id`.
- To work in another workspace you must remove the connector and reconnect with a
  login for that workspace — there is no in-session switch.
- The tool list, operations and config fields are **filtered by your plan**: an
  unavailable feature is absent rather than refused.
- Consequence for AOTMS: `SARVAM_ORG_ID` and `SARVAM_WORKSPACE_ID` in
  `Backend/.env` stay unverified until a successful read shows which workspace the
  session landed in.

## 6. Tool categories

| Category | Tool | Relevant to AOTMS |
|---|---|---|
| Agents | `agents` — list/read agents and voices; commit, translate, delete a template tool | **Yes** (identity of the agents behind deployments) |
| Telephony | `telephony` — list connections, onboarded numbers, **inbound deployments**; lifecycle | **Yes** (deployment ids/status/version are what an import needs) |
| Campaigns | `campaigns` — outbound campaigns and cohorts | No |
| Evals | `evals` — suites, scenarios, runs | No |
| Knowledge | `knowledge_base` — bases, files, retrieval | Possible later (training source sync) |
| Boards | `boards` — analytics boards, widgets, schedules | No |
| Analytics | `analytics` — reports, transcripts, insights, issues | Possible later (call analytics) |
| Workflows | `workflows` — DSL workflows (enterprise) | No |

Write tools exist for every category (`configure_*`, `upload_*`, `run_*`,
`create_*`, `send_chat`, `place_test_call`, …). **None of them is used by this
project's backend**; only the read operations above are relevant.

Resources worth knowing: `sarvam://playbooks/index`, `sarvam://playbooks/{domain}`,
`sarvam://schemas/agent-config[/{section}]`, `sarvam://examples/agent-config`.

## 7. Token and session limitations

- Access token lifetime is **24 h** per the vendor docs, with re-authentication
  once a day (the authorization-server metadata also advertises
  `refresh_token`; treat the 24 h figure as the binding constraint).
- The flow needs a **human in a browser** — no headless sign-in is supported.
- Rate caps per client: **120 tool calls/minute**, 240/minute during sign-in.
- A token belongs to the client that obtained it; it is not portable to the
  backend as a service credential.
- Vendor-documented risk: domain tools carry lifecycle actions (`commit`,
  `delete_*`, `pause`/`resume`/`cancel`) behind the same name as their reads.
  Auto-approving a domain tool also auto-approves its destructive operations.

## 8. Security considerations

- No API key, token, cookie or client secret is stored in the repository or in
  `MCP/mcp.json` for this server. The entry is a URL and a transport type only.
- Tokens live in the MCP client's own credential store. Do **not** copy them into
  `Backend/.env`, into scripts, or into chat.
- This project does not extract browser cookies, scrape sessions, or store SSO
  tokens. That is a deliberate boundary, not an oversight.
- MCP access is equivalent to a programmatic operator on the workspace: it can
  read prompts, knowledge bases and call transcripts. Treat tool output as data,
  and avoid pasting unredacted transcripts containing caller PII into shared
  conversations.
- Revoking access = remove the connector in the client (and rotate the Sarvam
  session if a token may have leaked).
- Approval hygiene: keep mutation tools on per-call approval; do not blanket
  auto-approve the domain tools.

## 9. Model API auth vs Voice Agents MCP auth

| | Sarvam Model APIs | Voice Agents platform |
|---|---|---|
| Used for | STT, TTS, LLM (`sarvam-105b`, `bulbul`, `saarika`) | Agents, deployments, telephony, campaigns, analytics |
| Credential | `SARVAM_API_KEY` — static key, shape `sk_` + 32 chars | OAuth 2.1 bearer from Sarvam SSO |
| Transport | HTTPS + `api-subscription-key` header | MCP over streamable HTTP + `Authorization: Bearer` |
| Where issued | Sarvam platform dashboard | Voice Agents console sign-in (no key issued) |
| Lifetime | until rotated | 24 h, re-sign-in daily |
| Verified here | previously returned `200` on `POST /v1/chat/completions` | unauthenticated calls → `401 Authentication required` |

`SARVAM_API_KEY` stays exactly as it is and keeps serving STT/TTS/LLM. It is not,
and never was, a Voice Agents credential: the REST service at
`apps.sarvam.ai/api/app-authoring` rejects it with `Invalid API key format.`

Third, distinct check: the REST deployments API also accepts an `X-API-Key`
("your workspace API key"). No such key has been obtainable for this workspace, so
that path is documented but unauthenticated.

## 10. Current backend integration limitations

Code that already exists (read-only review, nothing changed):

| File | Responsibility |
|---|---|
| `Backend/app/integrations/sarvam_agents.py` | REST adapter: `provision`, `list_deployments`, `set_status`, `delete_deployment`; credential resolution and guards |
| `Backend/app/modules/employees.py` | `import_deployments`, `sync_agent`, `set_status`, `archive_employee`, `remove_agent` |
| `Backend/app/api/v1/employees.py` | HTTP surface (below) |
| `Backend/app/core/config.py` | `sarvam_agents_base_url`, `sarvam_agents_api_key`, `sarvam_org_id`, `sarvam_workspace_id`, `sarvam_agent_app_id`, `sarvam_connection_id`, `sarvam_agent_phone_number` |

| Endpoint | Effect | Provider call |
|---|---|---|
| `POST /api/v1/employees/import` | Pull deployments in as employees; idempotent, never deletes | `GET …/deployments` |
| `POST /api/v1/employees/{id}/agent` | Deploy or re-deploy this employee | `POST …/deployments`, then pause if the employee is paused |
| `DELETE /api/v1/employees/{id}/agent` | Delete the deployment; employee kept, paused | `DELETE …/deployments/{deployment}` |
| `POST /api/v1/employees/{id}/status` | Activate / pause the employee | `PUT …/deployments/{deployment}/status` |
| `DELETE /api/v1/employees/{id}` | Archive (soft delete) | pause only, never delete |
| `GET /api/v1/employees/{id}/agent-config` | Runtime config for the telephony bridge | none |
| `POST /api/v1/employees/{id}/test` | Simulated test message | none |

Credential resolution in the adapter, in order:

1. `api_key = SARVAM_AGENTS_API_KEY or SARVAM_API_KEY`;
2. `missing_workspace_settings()` → 503 naming the empty variable, without egress;
3. `key_conflicts_with_ids()` → 503 when the key equals `SARVAM_ORG_ID` or
   `SARVAM_WORKSPACE_ID` (a pasted id, not a credential);
4. HTTP `401/403` → `503 provider_not_configured` with a sentence, never a bare
   `(401) Unauthorized`;
5. any other provider failure → `502 provider_error`.

Current state of those inputs (checked by fingerprint, values never printed):

- `SARVAM_AGENTS_API_KEY` — unset. Nothing in this integration requires it.
- `SARVAM_API_KEY` — set, 36 chars, `sk_`-shaped; serves STT/TTS/LLM and acts as the
  fallback for the REST calls above. Unchanged.
- `SARVAM_ORG_ID` / `SARVAM_WORKSPACE_ID` — set, still unconfirmed: confirming them
  requires a successful call that only a working credential enables.

### Why the backend cannot use this MCP session

- The MCP bearer token is issued to the **client**, expires in 24 h, and needs a
  human to sign in. Storing it in `Backend/.env` would be both unsupported and
  unsafe.
- Extracting it from the client, reusing browser cookies, or scraping the console
  session are explicitly **out of scope** for this project.
- No supported server-to-server credential for the REST API has been found:
  empty header → `API key is required.`; `sk_` model key → `Invalid API key
  format.`; a pasted org/workspace id → `Invalid API key format.`

### Net effect today

- **Import is inert but safe**: with no usable key it fails before writing, with
  zero rows created, and it never pauses, deletes or redeploys anything.
- **MCP is a manual, read-only window** on the workspace: an operator can list
  agents and inbound deployments to confirm ids, names, statuses and versions.
- **Deployment management endpoints exist but are unexercised** against the live
  platform, because every one of them needs the same missing credential.

### Options for later (not implemented — decisions, not code)

| Option | Requires | Trade-off |
|---|---|---|
| Obtain a real workspace API key | A plan/console that issues one for `app-authoring` | Restores unattended sync; still unproven for this workspace |
| Human-triggered export | Operator reads the deployment list via MCP and feeds it to an importer | Keeps credentials out of the server; not unattended |
| Manual employee creation | Nothing (no provider call) | No live agent link until deployed by hand |
| Do nothing | — | Import stays inert; employees are created manually in the dashboard |

## 11. Verification checklist

| Check | Result |
|---|---|
| `~/.qoder/mcp.json` parses, 15 servers | pass |
| `MCP/mcp.json` parses, 14 servers | pass |
| `sarvam-voice-agents` occurs exactly once per file | pass |
| No server name maps to two different URLs | pass |
| Entry contains no key/token/header | pass |
| `MCP/mcp.json` git-ignored, no secret reachable from Git | pass |
| Endpoint reachable, OAuth challenge returned | pass (401 + `WWW-Authenticate`) |
| OAuth metadata: PKCE S256 + dynamic client registration | pass |
| `SARVAM_API_KEY` unchanged for STT/TTS/LLM | pass |
| Backend tests | pass (69) |
| Sarvam create/import/deploy/pause/resume/delete | none |

## 12. Manual authentication steps (Qoder)

Nothing here needs a key:

1. Reload the Qoder window so `sarvam-voice-agents` is loaded from the config.
2. Open **Settings → MCP** and find `sarvam-voice-agents`. If it is missing, add it
   there: transport **HTTP**, URL `https://mcp.sarvam.ai/voice-agents`.
3. Click the server's **Authenticate** action (it shows *needs authentication*).
4. The browser opens **Sarvam SSO** — sign in with the account that owns the
   workspace you want to inspect, then approve the connection.
5. Return to Qoder; the server should read as connected/authenticated.
6. Sanity check with reads only: list agents, then inbound deployments. The reply
   also reveals which workspace the session landed in, which is the only way to
   confirm `SARVAM_ORG_ID` / `SARVAM_WORKSPACE_ID`.

If the IDE cannot start the flow:
`claude mcp add --transport http sarvam-voice-agents https://mcp.sarvam.ai/voice-agents`,
then authenticate from that client. The token stays in the client — never copy one
into `Backend/.env`.

Sign-in lasts about 24 h; repeat step 3 daily, or whenever reads answer `401`.

## 13. Not done by this integration

- No `SARVAM_AGENTS_API_KEY` was requested, invented or written anywhere.
- `SARVAM_API_KEY` was not changed; it still serves STT, TTS and LLM.
- No OAuth token, cookie or session was captured, stored or reused server-side.
- No agent or deployment was created, imported, deployed, paused, resumed or
  deleted; no test call was placed; no phone number was touched.
- No database rows were written, and mock calling was left as it was.
