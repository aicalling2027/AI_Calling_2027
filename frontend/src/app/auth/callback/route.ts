import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Only allow same-origin relative paths, so `next` can never leave the site.
 * Falls back to the account view, which is what a completed sign-in should show.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }
  return value;
}

/**
 * Landing point for Supabase email links (sign-up confirmation, magic links,
 * password recovery). Exchanges the one-time code for a session cookie.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const failure = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
  }

  const target = new URL("/login", origin);
  target.searchParams.set("error", failure ?? "link");
  if (next !== "/") {
    target.searchParams.set("next", next);
  }

  return NextResponse.redirect(target);
}
