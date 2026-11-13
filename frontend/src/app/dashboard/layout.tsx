import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { userAvatarUrl, userDisplayName, userInitials } from "@/lib/user";

// Reads the session cookie before the first paint, so there is no instant shell.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · AOTMS" },
  description: "Manage AI employees, calling campaigns and results.",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The session read below goes through the Supabase auth client, which reads
  // the wall clock to decide whether a token has expired. Prerendering treats
  // that as an unstable value and aborts the whole route, so the layout claims
  // the request first - this tree is per-user and can never be prerendered.
  await connection();

  if (!isSupabaseConfigured) {
    redirect("/login?next=/dashboard");
  }

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <DashboardShell
      profile={{
        name: userDisplayName(user),
        email: user.email ?? "",
        initials: userInitials(user),
        avatarUrl: userAvatarUrl(user),
      }}
    >
      {children}
    </DashboardShell>
  );
}
