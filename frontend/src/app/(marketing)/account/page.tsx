import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { formatDate } from "@/lib/date";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { userDisplayName, userInitials } from "@/lib/user";

// Reads the session cookie, so the page renders per request.
export const instant = false;

export const metadata: Metadata = {
  title: "Your account",
  description: "Your AOTMS account details.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect("/login?next=/account");
  }

  const provider = String(user.app_metadata?.provider ?? "email");
  const rows = [
    { label: "Email", value: user.email ?? "—" },
    { label: "Sign-in method", value: provider },
    {
      label: "Member since",
      value: user.created_at ? formatDate(user.created_at.slice(0, 10)) : "—",
    },
    { label: "User ID", value: user.id },
  ];

  return (
    <Section>
      <Container>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-blue"
        >
          <ArrowLeft className="size-4" />
          Back to site
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-full bg-blue text-base font-semibold uppercase tracking-wide text-white">
                {userInitials(user)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-ink">
                  {userDisplayName(user)}
                </h1>
                <p className="truncate text-sm text-ink-soft">{user.email}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <SignOutButton className="h-10 px-4 text-sm" />
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center rounded-full border border-blue-line bg-surface px-4 text-sm font-medium text-blue transition-colors hover:bg-blue-tint hover:text-blue-deep"
              >
                View pricing
              </Link>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Account details
            </h2>
            <dl className="mt-4 divide-y divide-line">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-4"
                >
                  <dt className="text-sm text-ink-soft">{row.label}</dt>
                  <dd className="truncate text-sm font-medium text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              This page is rendered on the server from your session cookie, so
              it redirects to sign-in whenever the session is missing or
              expired.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
