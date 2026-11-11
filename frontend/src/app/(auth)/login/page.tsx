import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Auth } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Reads the session cookie and `searchParams` before the first paint, so the
// page cannot stream an instant shell.
export const instant = false;

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your AOTMS account to manage AI calling campaigns, numbers and recordings.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

type AuthView =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "check-email"
  | "reset-password";

const linkErrors: Record<string, string> = {
  link: "That link has expired or was already used. Request a fresh one and try again.",
  access_denied: "Sign-in was cancelled before it finished.",
  missing_code: "That link is incomplete. Request a fresh one and try again.",
};

// Where a successful sign-in lands when the caller did not ask for a specific
// page. The dashboard is the product home once a session exists, so a fresh
// Google or email sign-in ends there instead of on the home page.
const DEFAULT_AFTER_SIGN_IN = "/dashboard";

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  return value;
}

function safeView(value: string | undefined): AuthView {
  return value === "reset-password" ? "reset-password" : "sign-in";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; view?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const view = safeView(params.view);
  const initialError = params.error
    ? (linkErrors[params.error] ?? "Sign in failed. Try again.")
    : null;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.auth.getClaims();
      // A recovery link signs the user in, so that view must stay reachable.
      if (data && view !== "reset-password") {
        redirect(next);
      }
    }
  }

  return <Auth initialView={view} initialError={initialError} next={next} />;
}
