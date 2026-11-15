import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api/base-url";

/**
 * One voice preview, proxied to the FastAPI service.
 *
 * The API caches each sample for hours and reads the sentence from its own
 * catalogue, so this route stays a thin pass-through: no caller text, no
 * exposed API key, no widened CORS.
 */
const API_BASE = apiBaseUrl();

/**
 * Speaker ids are either a legacy slug (`shubh`) or a dashed UUID
 * (`01a0cf16-7021-76f7-a0cc-9d065cdb30a8`); anything else is not worth
 * forwarding.
 */
const VOICE_ID = /^[a-z0-9][a-z0-9-]{1,40}$/i;

/** A BCP-47 code, which is all the backend accepts alongside a voice. */
const LANGUAGE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

export async function GET(request: Request, context: { params: Promise<{ voice: string }> }) {
  const { voice } = await context.params;
  if (!VOICE_ID.test(voice)) {
    return NextResponse.json({ message: "Unknown voice." }, { status: 404 });
  }

  // The sample can be spoken in any language the voice is offered in, so the
  // caller may name one. It is a query parameter, not caller text: the sentence
  // is still read from the backend's own catalogue.
  const requested = new URL(request.url).searchParams.get("language");
  const language = requested && LANGUAGE.test(requested) ? requested : null;
  const query = language ? `?language=${encodeURIComponent(language)}` : "";

  try {
    const response = await fetch(`${API_BASE}/api/v1/voices/${voice}/preview${query}`, {
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
