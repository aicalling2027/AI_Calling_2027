import { apiBaseUrl } from "@/lib/api/base-url";

/**
 * Server-side client for the OWN AI FastAPI service.
 *
 * The browser never talks to FastAPI directly: dashboard data flows through the
 * Route Handlers in `src/app/api/*`, which attach a server-held bearer token
 * here. That keeps the API host and its credentials off the client and means
 * CORS never has to be widened for the dashboard origin.
 *
 * Environment:
 * - `AOTMS_API_URL`      base URL (default http://127.0.0.1:8000)
 * - `AOTMS_API_TOKEN`    a long-lived token, if one is provisioned
 * - `AOTMS_API_EMAIL` / `AOTMS_API_PASSWORD`
 *                        service account; defaults to the seeded demo tenant so
 *                        `npm run dev` works against a local backend
 */

const API_BASE = apiBaseUrl();
const API_PREFIX = "/api/v1";

const STATIC_TOKEN = (process.env.AOTMS_API_TOKEN ?? "").trim();
const SERVICE_EMAIL = process.env.AOTMS_API_EMAIL ?? "admin@ownai.in";
const SERVICE_PASSWORD = process.env.AOTMS_API_PASSWORD ?? "Admin@12345";

/** An error response from the backend, carrying its machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type CachedToken = { token: string; expiresAt: number };

let cachedToken: CachedToken | null = null;

/**
 * Set once a provisioned `AOTMS_API_TOKEN` has been refused by the backend.
 *
 * A static token can be rotated or revoked outside this app, and when it is the
 * whole dashboard goes blank while the health probe still reports a reachable
 * backend. Falling back to the service account turns that into a self-healing
 * hop instead of an outage nobody can name.
 */
let staticTokenRejected = false;

/** The backend's uniform error envelope: `{ error: { code, message } }`. */
type ErrorEnvelope = { error?: { code?: string; message?: string } };

function readError(payload: unknown, status: number): ApiError {
  const envelope = (payload ?? {}) as ErrorEnvelope;
  return new ApiError(
    status,
    envelope.error?.code ?? "api_error",
    envelope.error?.message ?? `The backend returned ${status}.`,
  );
}

async function accessToken(): Promise<string> {
  if (STATIC_TOKEN && !staticTokenRejected) return STATIC_TOKEN;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) return cachedToken.token;

  const response = await fetch(`${API_BASE}${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!response.ok || !body?.access_token) {
    throw readError(body, response.status);
  }

  const ttl = Number(body.expires_in ?? 1500);
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, ttl) * 1000,
  };
  return cachedToken.token;
}

type ApiRequest = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

/**
 * Call the backend as the workspace service account.
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
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      if (!timedOut || !isRead) throw error;
      console.warn(`[api] ${path} timed out once; retrying`);
      return send(token);
    }
  };

  const first = await accessToken();
  let response = await attempt(first);
  if (response.status === 401 || response.status === 403) {
    // The credential in hand was refused: drop whatever produced it and ask
    // for a fresh one, once.
    cachedToken = null;
    if (first === STATIC_TOKEN) staticTokenRejected = true;
    const next = await accessToken();
    if (next !== first) response = await attempt(next);
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
