# Provider capability matrix

What OWN AI can ask a voice provider to do, and what it refuses to pretend it
can. The machine-readable source of truth is
`Backend/app/integrations/voice_provider.py` — this page explains it.

## Why a matrix exists

The Option B contract has fifteen operations. The provider holding our current
integration exposes five of them over REST. The other ten exist only inside the
vendor's own console or behind an interactive MCP session, and an interactive
session is not a credential a backend can hold.

So the contract declares a level for every operation, and an operation that is
not `supported` raises `ProviderCapabilityMissing` (**501**) *before* a network
call is made. The alternative — returning a plausible-looking success — would be
discovered by the customer at the only moment it matters: when the phone does
not ring.

Levels:

| Level | Meaning | Behaviour |
| --- | --- | --- |
| `supported` | Exercised against the real API from this backend | Delegates to the adapter |
| `unverified` | Documented or MCP-exposed, never confirmed here | Refuses with 501 |
| `unsupported` | The provider has no such operation | Refuses with 501 |

`unverified` and `unsupported` behave identically to a caller. The distinction
exists so an operator reading the matrix knows which gaps to chase, and which
are permanent.

## Current matrix

Provider code: `sarvam-voice-agents`

### Supported (5)

| Operation | Provider surface | Notes |
| --- | --- | --- |
| `create_deployment` | `POST …/workspaces/{ws}/deployments` | Binds a committed agent version to a connection + number. Makes the number answer immediately. |
| `get_deployment` | `GET …/deployments` (list, filtered) | No single-deployment GET exists, so this scans the verified list rather than inventing a path. Reports 404 for an unknown id. |
| `pause_deployment` | `PUT …/deployments/{id}/status` | Keeps call history, transcripts and the number binding. |
| `resume_deployment` | `PUT …/deployments/{id}/status` | |
| `delete_deployment` | `DELETE …/deployments/{id}` | The only irreversible call. A 404 is reported as "already gone" so a retry after a half-finished delete succeeds. |

### Unverified (10)

| Operation | Why it is not available |
| --- | --- |
| `create_agent` | An agent is authored in the vendor console. No create-agent REST endpoint is documented. |
| `get_agent` | Same — the agent is addressable only through a deployment. |
| `list_agents` | There is no list-agents call at all. This is why "import the existing agents" cannot be a direct list. |
| `update_agent` | Console-only. |
| `configure_agent` | Console-only. This is also why prompts must be pushed as a deployment-level configuration, not by editing an agent. |
| `commit_agent_version` | Console-only. Version state is therefore *read back*, never asserted. |
| `create_knowledge_base` | MCP `knowledge_base` tools only; no REST surface. |
| `upload_knowledge_base_document` | MCP only. |
| `attach_knowledge_base` | MCP only. |
| `test_agent` | No agent-scoped test call. The in-product "Test message" is prompt-based chat, a different path. |

## Consequences for the product

1. **Employee creation cannot create a provider agent.** The agent must already
   exist. Creation therefore stops at OWN AI and enabling calls is a separate,
   explicit step.
2. **Prompts live in OWN AI, and the provider only executes them.** Because
   `configure_agent` is unavailable, a configuration change cannot be pushed
   into an agent draft. It has to reach the call path another way — see Phase C.
3. **Knowledge base sync cannot be built yet.** The OWN AI knowledge stack
   (`training_sources`, `training_documents`) is fully functional locally, but
   pushing it to the provider is blocked on a service credential for those MCP
   tools.
4. **Reverse import must go through deployments.** A deployment is the only
   provider object we can enumerate, so that is the only viable import path.

## What would move an operation to `supported`

1. A documented REST endpoint, **or** an MCP tool reachable with a
   non-interactive service credential.
2. One real call from this backend, recorded in the adapter with its request and
   response shape.
3. A test that exercises the happy path and one provider-rejection path.

Changing the level without writing the method raises `AssertionError` on the
first call. That is deliberate: moving a button must never be easier than
implementing the endpoint behind it.

## Related

- [`SARVAM_VOICE_AGENTS_MCP.md`](./SARVAM_VOICE_AGENTS_MCP.md) — how the MCP
  server is registered, why its OAuth token cannot serve the backend, and the
  workspace-binding limitation.
