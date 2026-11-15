import { apiBaseLabel, apiBaseUrl } from "@/lib/api/base-url";

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
  if (STATIC_TOKEN && !staticTokenRejected) {
    if (isHeaderSafe(STATIC_TOKEN)) return STATIC_TOKEN;
    // A token pasted with a stray newline or a smart quote makes `fetch` throw
    // before a request is ever made, which used to read as "service unavailable".
    staticTokenRejected = true;
    console.warn(
      "[api] AOTMS_API_TOKEN is not a valid header value; using the service account instead.",
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) return cachedToken.token;

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

  const first = await accessToken();
  let response: Response;
  try {
    response = await attempt(first);
  } catch (error) {
    // A provisioned token that cannot even be delivered must not take the
    // dashboard down with it.
    if (first !== STATIC_TOKEN || staticTokenRejected) throw error;
    staticTokenRejected = true;
    response = await attempt(await accessToken());
  }

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
