import Link from "next/link";
import { Plus, Zap } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/**
 * Page heading. The greeting comes from the session, so the same layout serves
 * every workspace member without a client-side read of the user object.
 */
export function OverviewHeader({ name }: { name: string }) {
  const firstName = name.split(" ")[0] || name;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
          Overview
        </p>
        <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          A 30-day view of what your AI employees handled. Figures are sample
          data until the calling APIs land.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/instant-leads"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "px-3.5",
          })}
        >
          <Zap aria-hidden />
          Start instant lead
        </Link>
        <Link
          href="/dashboard/employees/new"
          className={buttonVariants({ size: "lg", className: "px-3.5" })}
        >
          <Plus aria-hidden />
          New employee
        </Link>
      </div>
    </header>
  );
}
