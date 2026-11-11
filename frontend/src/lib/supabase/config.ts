/**
 * Public Supabase credentials shared by the browser and server clients.
 * These values identify the project; they never grant admin access.
 */
export const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

/**
 * Supabase renamed the browser-safe "anon" key to "publishable key", so the
 * dashboard now hands out a `sb_publishable_...` value. Accept either variable
 * name; the current one wins if both are present.
 */
export const supabasePublishableKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

/**
 * False until the environment carries both values. The UI reads this so the site
 * still renders (with an explanatory notice) when auth is unconfigured.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);
