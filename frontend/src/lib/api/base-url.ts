/**
 * Resolve the FastAPI origin from `AOTMS_API_URL`.
 *
 * Read at request time so a corrected Vercel environment variable applies to the
 * next deployment rather than being frozen into the bundle. A value pasted
 * without a scheme (`ai-calling-2027.onrender.com`) makes `fetch` throw
 * `TypeError: Failed to parse URL`, which previously reached the visitor as a
 * generic "service is unavailable" message, so a missing scheme is repaired
 * here and an unusable value is logged with the value that caused it.
 */
const LOCAL_API_BASE = "http://127.0.0.1:8000";

export function apiBaseUrl(): string {
  const raw = (process.env.AOTMS_API_URL ?? "").trim();
  if (!raw) return LOCAL_API_BASE;

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`unsupported protocol ${parsed.protocol}`);
    }
    return candidate.replace(/\/+$/, "");
  } catch (error) {
    console.error(
      `[api] AOTMS_API_URL=${JSON.stringify(raw)} is not a usable URL (${String(error)}). ` +
        `Falling back to ${LOCAL_API_BASE}, which only resolves when the backend runs on this host.`,
    );
    return LOCAL_API_BASE;
  }
}

/** Host-only label for logs and diagnostics, never a path or a credential. */
export function apiBaseLabel(): string {
  try {
    return new URL(apiBaseUrl()).host;
  } catch {
    return apiBaseUrl();
  }
}
