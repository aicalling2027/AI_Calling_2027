import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { OverviewAgents } from "@/components/dashboard/overview-agents";
import { OverviewAttention } from "@/components/dashboard/overview-attention";
import {
  BusiestHoursCard,
  CallsOverTimeCard,
  OutcomesCard,
  SourcesCard,
} from "@/components/dashboard/overview-charts";
import { OverviewHeader } from "@/components/dashboard/overview-header";
import { OverviewInsights } from "@/components/dashboard/overview-insights";
import { OverviewKpis } from "@/components/dashboard/overview-kpis";
import { OverviewQuickActions } from "@/components/dashboard/overview-quick-actions";
import { OverviewRecentCalls } from "@/components/dashboard/overview-recent-calls";
import { OverviewSummary } from "@/components/dashboard/overview-summary";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { userDisplayName } from "@/lib/user";

// Reads the session cookie for the greeting, so no instant shell for this route.
export const instant = false;

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Calling activity, AI employees and results at a glance.",
};

export default async function DashboardPage() {
  // Layouts and pages render in parallel, so this page claims the request too:
  // the greeting needs the session, and the auth client reads the wall clock.
  await connection();

  if (!isSupabaseConfigured) {
    redirect("/login?next=/dashboard");
  }

  // The layout already gates this route; the page re-reads the user only for
  // the greeting name, because layouts cannot pass props to pages.
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <OverviewHeader name={userDisplayName(user)} />
      <OverviewQuickActions />
      <OverviewKpis />
      <OverviewSummary />

      <div className="grid gap-4 xl:grid-cols-3">
        <CallsOverTimeCard className="xl:col-span-2" />
        <BusiestHoursCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OutcomesCard />
        <SourcesCard />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <OverviewAgents className="xl:col-span-2" />
        <OverviewAttention />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <OverviewRecentCalls className="xl:col-span-2" />
        <OverviewInsights />
      </div>
    </div>
  );
}
