import { connection, NextResponse } from "next/server";

import { apiBaseLabel, apiBaseUrl } from "@/lib/api/base-url";

/**
 * Public voice catalogue for the landing page.
 *
 * The browser only ever talks to this origin: the FastAPI service URL stays
 * server-side, and CORS never has to be widened for the marketing domain.
 * Point `AOTMS_API_URL` at the deployed API in production.
 */
const API_BASE = apiBaseUrl();

type VoicePayload = { items: unknown[]; source: "live" };

export async function GET() {
  // Live data: never bake a build-time snapshot of the catalogue into the app.
  await connection();

  try {
    const response = await fetch(`${API_BASE}/api/v1/voices`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`voices ${response.status}`);

    const items: unknown = await response.json();
    if (!Array.isArray(items) || items.length === 0) throw new Error("empty catalogue");

    return NextResponse.json<VoicePayload>({ items, source: "live" });
  } catch (error) {
    // The section keeps the catalogue bundled in `content/home`, so an API
    // outage degrades to static content instead of an error state. The reason
    // still has to reach the deployment logs: a silent fallback once hid a
    // missing AOTMS_API_URL for weeks.
    console.error(`[api/voices] ${apiBaseLabel()} unreachable (${String(error)})`);
    return NextResponse.json({ items: null, source: "fallback" });
  }
}
