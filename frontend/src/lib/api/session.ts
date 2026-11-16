import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Refuse a dashboard request that has no signed-in user behind it.
 *
 * This is the gate, not the credential: an anonymous request to
 * `/api/employees` must never reach FastAPI. Who the caller turns out to be is
 * established next by `apiFetch`, which exchanges this same session for a
 * backend token - so the check here and the identity used there cannot drift
 * apart.
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
