import Link from "next/link";

import { quickActions } from "@/content/dashboard-overview";

/** Shortcuts to the modules that actually start work (PRD Dashboard A). */
export function OverviewQuickActions() {
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[0.65rem] font-semibold tracking-[0.12em] text-ink-soft uppercase">
        Quick actions
      </span>
      {quickActions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line ring-inset transition-colors hover:bg-mist hover:text-ink"
        >
          <action.icon aria-hidden className="size-3.5 text-cobalt" />
          {action.label}
        </Link>
      ))}
    </nav>
  );
}
