import { connection, NextResponse } from "next/server";

import { ApiError } from "@/lib/api/aotms";
import { apiBaseLabel, apiBaseUrl } from "@/lib/api/base-url";
import { listEmployees } from "@/lib/api/employees";

/**
 * Can this deployment reach the FastAPI backend?
 *
 * A missing or malformed `AOTMS_API_URL` used to surface only as the dashboard's
 * generic "service is unavailable" message, which is indistinguishable from a
 * backend bug. This probe reports the origin the server resolved and the exact
 * failure, using the backend's public `/health` route - no credentials, no
 * tenant data, nothing secret.
 *
 * `?deep=1` repeats the hop the dashboard actually uses - service-account login
 * then `GET /employees` - because `/health` proves the host answers but not that
 * the signed-in read works. It reports a count, never a record.
 */
export async function GET(request: Request) {
  // Live diagnostic: never answer from a build-time snapshot.
  await connection();

  const base = apiBaseUrl();
  const started = Date.now();
  const deep = new URL(request.url).searchParams.get("deep") === "1";

  try {
    const response = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const backend: unknown = await response.json().catch(() => null);
    return NextResponse.json({
      ok: response.ok,
      base: apiBaseLabel(),
      status: response.status,
      latencyMs: Date.now() - started,
      backend,
      ...(deep ? { employees: await probeEmployees() } : {}),
    });
  } catch (error) {
    const configured = (process.env.AOTMS_API_URL ?? "").trim();
    return NextResponse.json({
      ok: false,
      base: apiBaseLabel(),
      latencyMs: Date.now() - started,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      hint: configured
        ? "The resolved origin is unreachable from this deployment. Check the scheme and that the service is awake."
        : "AOTMS_API_URL is not set in this deployment's environment, so requests go to the local development default.",
      ...(deep ? { employees: await probeEmployees() } : {}),
    });
  }
}

/** The authenticated read behind every dashboard screen: login, then the list. */
async function probeEmployees() {
  const started = Date.now();
  try {
    const items = await listEmployees();
    return { ok: true, count: items.length, latencyMs: Date.now() - started };
  } catch (error) {
    const detail =
      error instanceof ApiError
        ? `${error.status} ${error.code}: ${error.message}`
        : error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
    return { ok: false, latencyMs: Date.now() - started, error: detail };
  }
}
