import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Route handlers act on the signed-in user's behalf with a server-held backend
 * token, so they must check the session themselves - an anonymous request to
 * `/api/employees` must never reach FastAPI.
 *
 * Returns `null` when the caller may proceed, or the 401 response to return.
 * When Supabase is not configured there is no session to check and the app is
 * running in local development, which mirrors the guard in `src/proxy.ts`.
 */
export async function guardSession(): Promise<NextResponse | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Sign in to manage your AI employees.",
        },
      },
      { status: 401 },
    );
  }
  return null;
}
