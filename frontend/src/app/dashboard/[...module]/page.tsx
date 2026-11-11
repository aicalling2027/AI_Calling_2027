import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import {
  dashboardGroupForHref,
  dashboardModuleForPath,
} from "@/content/dashboard";

// Awaits `params`, so the route cannot stream an instant shell.
export const instant = false;

type Params = { params: Promise<{ module: string[] }> };

/** Everything under /dashboard except the index, resolved from the module list. */
function resolve(segments: string[]) {
  const entry = dashboardModuleForPath(`/dashboard/${segments.join("/")}`);
  if (!entry) {
    notFound();
  }

  return { entry, group: dashboardGroupForHref(entry.href) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const segments = (await params).module;
  const { entry } = resolve(segments);

  return { title: entry.label };
}

export default async function DashboardModulePage({ params }: Params) {
  const segments = (await params).module;
  const { entry, group } = resolve(segments);

  return (
    <ModulePlaceholder
      description={entry.description}
      group={group}
      icon={entry.icon}
      title={entry.label}
    />
  );
}
