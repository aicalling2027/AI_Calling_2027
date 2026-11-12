import { NextResponse } from "next/server";

/**
 * One voice preview, proxied to the FastAPI service.
 *
 * The API caches each sample for hours and reads the sentence from its own
 * catalogue, so this route stays a thin pass-through: no caller text, no
 * exposed API key, no widened CORS.
 */
const API_BASE = (process.env.AOTMS_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

/** Speakers are lowercase slugs; anything else is not worth forwarding. */
const VOICE_ID = /^[a-z][a-z0-9-]{1,30}$/;

export async function GET(_request: Request, context: { params: Promise<{ voice: string }> }) {
  const { voice } = await context.params;
  if (!VOICE_ID.test(voice)) {
    return NextResponse.json({ message: "Unknown voice." }, { status: 404 });
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/voices/${voice}/preview`, {
      cache: "no-store",
      // Bulbul usually answers in a couple of seconds; the first call for a
      // voice also pays for the API's own cache fill.
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`preview ${response.status}`);

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ message: "That sample could not be generated." }, { status: 503 });
  }
}
