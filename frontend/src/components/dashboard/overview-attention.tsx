import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { attentionItems } from "@/content/dashboard-overview";
import { cn } from "@/lib/utils";

/** "Needs your attention" (PRD Dashboard C). */
export function OverviewAttention({ className }: { className?: string }) {
  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>
          Alerts that block calls, credits or follow-ups.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {attentionItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex items-start gap-3 rounded-xl border border-line bg-mist-soft px-3 py-2.5 transition-colors hover:border-cobalt-line hover:bg-surface"
          >
            <span
              className={cn(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                item.iconClass,
              )}
            >
              <item.icon aria-hidden className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                {item.detail}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="mt-1 size-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
