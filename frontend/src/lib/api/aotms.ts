import { apiBaseLabel, apiBaseUrl } from "@/lib/api/base-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side client for the OWN AI FastAPI service.
 *
 * The browser never talks to FastAPI directly: dashboard data flows through the
 * Route Handlers in `src/app/api/*`, which attach a bearer token here. That
 * keeps the API host and its credentials off the client and means CORS never
 * has to be widened for the dashboard origin.
 *
 * Whose data a request may read is decided by the credential, in this order:
 *
 * 1. the signed-in Supabase session. Its token is exchanged at
 *    `POST /auth/supabase/exchange` for a backend token, so each person acts as
 *    themselves and only ever sees their own organization.
 * 2. `AOTMS_API_TOKEN`, when one is provisioned deliberately for server-to-server
 *    callers such as scripts and health checks.
 * 3. the seeded demo tenant - development only. It used to be the default
 *    everywhere, which quietly put every signed-in visitor in one workspace.
 *
 * Environment:
 * - `AOTMS_API_URL`      base URL (default http://127.0.0.1:8000)
 * - `AOTMS_API_TOKEN`    a long-lived token, if one is provisioned
 * - `AOTMS_API_EMAIL` / `AOTMS_API_PASSWORD`
 *                        the development service account; ignored in production
 */

const API_BASE = apiBaseUrl();
const API_PREFIX = "/api/v1";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const STATIC_TOKEN = (process.env.AOTMS_API_TOKEN ?? "").trim();
const SERVICE_EMAIL = process.env.AOTMS_API_EMAIL ?? "admin@ownai.in";
const SERVICE_PASSWORD = process.env.AOTMS_API_PASSWORD ?? "Admin@12345";

/** An error response from the backend, carrying its machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Whatever the backend attached, e.g. the campaigns blocking a release. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type CachedToken = { token: string; expiresAt: number };

/**
 * Backend tokens, keyed by the Supabase token that produced them.
 *
 * A map rather than a single slot: two people signed in at once must never be
 * handed each other's token, and that is exactly what one shared variable did.
 */
const sessionTokens = new Map<string, CachedToken>();

/** The development service account's token, while that fallback is in use. */
let serviceToken: CachedToken | null = null;

/**
 * Set once a provisioned `AOTMS_API_TOKEN` has been refused by the backend.
 *
 * A static token can be rotated or revoked outside this app, and when it is the
 * whole dashboard goes blank while the health probe still reports a reachable
 * backend. Falling back to the service account turns that into a self-healing
 * hop instead of an outage nobody can name.
 */
let staticTokenRejected = false;

/** The backend's uniform error envelope: `{ error: { code, message, details } }`. */
type ErrorEnvelope = {
  error?: { code?: string; message?: string; details?: unknown };
};

function readError(payload: unknown, status: number): ApiError {
  const envelope = (payload ?? {}) as ErrorEnvelope;
  return new ApiError(
    status,
    envelope.error?.code ?? "api_error",
    envelope.error?.message ?? `The backend returned ${status}.`,
    envelope.error?.details,
  );
}

type Credential = {
  token: string;
  /** `session`: the signed-in person. `static`/`service`: one shared identity. */
  via: "session" | "static" | "service";
};

/**
 * The backend token that represents the signed-in person.
 *
 * Nothing here decides who the caller is: the cookie already holds a Supabase
 * token and the backend is what verifies it. `getSession()` reads that cookie
 * (refreshing it when needed) and the exchange turns it into this API's own
 * token, which is what every later request presents.
 *
 * Returns `null` when there is no session to exchange, leaving the choice to
 * the caller.
 */
async function sessionCredential(): Promise<Credential | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  if (!supabase) return null;

  let supabaseToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    supabaseToken = data.session?.access_token;
  } catch (error) {
    // Outside a request scope there are no cookies to read. That is a
    // server-to-server caller, not a person, and the caller falls back.
    console.warn("[api] the Supabase session could not be read", error);
    return null;
  }
  if (!supabaseToken) return null;

  const cached = sessionTokens.get(supabaseToken);
  if (cached && cached.expiresAt > Date.now() + 15_000) {
    return { token: cached.token, via: "session" };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${API_PREFIX}/auth/supabase/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: supabaseToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw unreachable("/auth/supabase/exchange", error);
  }

  const body = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;

  if (!response.ok || !body?.access_token) {
    const failure = readError(body, response.status);
    // A backend that cannot verify Supabase tokens is a local setup problem.
    // Development is the only place where the demo workspace is still an
    // acceptable answer; everywhere else it would be someone else's data.
    if (failure.status === 503 && !IS_PRODUCTION) {
      console.warn(
        "[api] single sign-on is not configured on the backend; using the demo workspace.",
      );
      return null;
    }
    throw failure;
  }

  const ttl = Number(body.expires_in ?? 1500);
  const entry: CachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, ttl) * 1000,
  };
  sessionTokens.set(supabaseToken, entry);

  // Sessions that ended elsewhere leave entries behind; this is the cheap sweep.
  for (const [key, value] of sessionTokens) {
    if (value.expiresAt <= Date.now()) sessionTokens.delete(key);
  }
  return { token: entry.token, via: "session" };
}

/** Drop the cached backend token that a refused request was made with. */
function forgetToken(token: string): void {
  for (const [key, value] of sessionTokens) {
    if (value.token === token) sessionTokens.delete(key);
  }
}

/**
 * The development service account's token.
 *
 * This is what let every visitor share one workspace, so production never
 * reaches it - see `credential()`.
 */
async function devServiceToken(): Promise<string> {
  if (serviceToken && serviceToken.expiresAt > Date.now() + 15_000) {
    return serviceToken.token;
  }

  const login = () =>
    fetch(`${API_BASE}${API_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

  let response: Response;
  try {
    response = await login();
  } catch (error) {
    // A refused socket is worth one more try; a timeout is not - the screen is
    // already waiting and the backend is not answering.
    if (isTimeout(error)) throw unreachable("/auth/login", error);
    console.warn("[api] the login connection failed; retrying once");
    try {
      response = await login();
    } catch (retry) {
      throw unreachable("/auth/login", retry);
    }
  }

  const body = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!response.ok || !body?.access_token) {
    throw readError(body, response.status);
  }

  const ttl = Number(body.expires_in ?? 1500);
  serviceToken = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, ttl) * 1000,
  };
  return serviceToken.token;
}

/** The credential to present, in the order the module docstring describes. */
async function credential(): Promise<Credential> {
  const session = await sessionCredential();
  if (session) return session;

  if (STATIC_TOKEN && !staticTokenRejected) {
    if (isHeaderSafe(STATIC_TOKEN)) return { token: STATIC_TOKEN, via: "static" };
    // A token pasted with a stray newline or a smart quote makes `fetch` throw
    // before a request is ever made, which used to read as "service unavailable".
    staticTokenRejected = true;
    console.warn("[api] AOTMS_API_TOKEN is not a valid header value; ignoring it.");
  }

  if (!IS_PRODUCTION) {
    return { token: await devServiceToken(), via: "service" };
  }

  // Production has no shared fallback: an unauthenticated request is refused
  // rather than answered with the demo tenant's records.
  throw new ApiError(401, "unauthorized", "Sign in to continue.");
}

type ApiRequest = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

/** `fetch` rejects synchronously on control or non-ASCII characters. */
const isHeaderSafe = (token: string) => /^[\x21-\x7e]+$/.test(token);

const isTimeout = (error: unknown) =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

/**
 * A request that produced no response at all, named.
 *
 * `fetch` throws for a refused socket, a DNS failure, a timeout or an invalid
 * header, and that throw used to reach the browser as "the service is
 * unavailable" - true but useless, because it hid which hop failed and why.
 * undici keeps the real cause on `error.cause`, so it is reported here.
 */
function unreachable(path: string, error: unknown): ApiError {
  const cause = (error as { cause?: unknown } | null)?.cause;
  const code = (cause as { code?: string } | null)?.code;
  const detail =
    cause instanceof Error
      ? `${cause.name}${code ? ` ${code}` : ""}: ${cause.message}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  console.error(`[api] ${apiBaseLabel()} ${path} threw (${detail})`);
  return new ApiError(
    502,
    "backend_unreachable",
    `The backend at ${apiBaseLabel()} could not be reached (${detail}).`,
  );
}

/**
 * Call the backend as the caller this request belongs to.
 *
 * A rejected credential is dropped and retried once, so a rotated token or an
 * expired cache does not surface as a spurious error to the dashboard. A read
 * that times out is retried too: a sleeping backend loses the first attempt and
 * answering sooner than it wakes only produces an error the visitor cannot act
 * on.
 */
export async function apiFetch<T>(path: string, init: ApiRequest = {}): Promise<T> {
  const send = async (token: string) =>
    fetch(`${API_BASE}${API_PREFIX}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

  const isRead = !init.method || init.method === "GET";
  const attempt = async (token: string): Promise<Response> => {
    try {
      return await send(token);
    } catch (error) {
      // A read that produced no response is usually a sleeping backend (Render
      // spins down); one retry turns that into a slow screen rather than an
      // error the visitor cannot act on.
      if (!isRead) throw unreachable(path, error);
      console.warn(`[api] ${path} produced no response; retrying once`);
      try {
        return await send(token);
      } catch (retry) {
        throw unreachable(path, retry);
      }
    }
  };

  const first = await credential();
  let response: Response;
  try {
    response = await attempt(first.token);
  } catch (error) {
    // A provisioned token that cannot even be delivered must not take the
    // dashboard down with it.
    if (first.via !== "static" || staticTokenRejected) throw error;
    staticTokenRejected = true;
    response = await attempt((await credential()).token);
  }

  if (response.status === 401 || response.status === 403) {
    // The credential in hand was refused: drop whatever produced it and ask
    // for a fresh one, once.
    if (first.via === "session") forgetToken(first.token);
    if (first.via === "static") staticTokenRejected = true;
    if (first.via === "service") serviceToken = null;
    const next = await credential();
    if (next.token !== first.token) response = await attempt(next.token);
  }

  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;
  if (!response.ok) throw readError(payload, response.status);
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
