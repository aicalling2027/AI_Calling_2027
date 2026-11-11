import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session before a request renders, so server
 * components never read an expired access token. Requests without a session
 * cookie return immediately, which keeps anonymous traffic on the static path.
 *
 * `/dashboard` is guarded here as well as in its layout: this response is a
 * real redirect, so an anonymous visitor never sees the dashboard chrome paint
 * before the layout's redirect takes effect mid-stream.
 */
export async function proxy(request: NextRequest) {
  const needsSession = request.nextUrl.pathname.startsWith("/dashboard");

  function redirectToLogin() {
    const url = request.nextUrl.clone();
    const next = `${url.pathname}${url.search}`;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  if (!isSupabaseConfigured) {
    return needsSession ? redirectToLogin() : NextResponse.next();
  }

  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

  if (!hasSessionCookie) {
    return needsSession ? redirectToLogin() : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Cookies must be written to both the forwarded request (so this
        // render sees them) and the response (so the browser stores them).
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verifies (and, if needed, refreshes) the session while the response can
  // still be modified. Without this call the refreshed cookies are lost.
  const { data: claims } = await supabase.auth.getClaims();

  if (needsSession && !claims) {
    return redirectToLogin();
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files in /public.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|css|js|map|woff|woff2)$).*)",
  ],
};
