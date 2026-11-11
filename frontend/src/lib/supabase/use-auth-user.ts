"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User };

/**
 * Session state for client components. The first render is deterministic
 * (`loading` when configured, `signed-out` otherwise) so server and client
 * markup match; the real session arrives after hydration.
 */
export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? { status: "loading" } : { status: "signed-out" },
  );

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setState(
        data.user
          ? { status: "signed-in", user: data.user }
          : { status: "signed-out" },
      );
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(
        session?.user
          ? { status: "signed-in", user: session.user }
          : { status: "signed-out" },
      );
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
