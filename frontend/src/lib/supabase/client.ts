"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

let browserClient: SupabaseClient | undefined;

/**
 * One browser client per tab. The session is stored in cookies, so the server
 * (proxy, route handlers, server components) sees the same session.
 * Returns `null` when the project credentials are missing.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  browserClient ??= createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
