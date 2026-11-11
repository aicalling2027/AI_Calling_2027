import { Lightbulb } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { managerInsights } from "@/content/dashboard-overview";
import { cn } from "@/lib/utils";

/**
 * "Manager insights" (PRD Dashboard K). These are rule-based observations for
 * now; the AI-generated version arrives with the analytics API.
 */
export function OverviewInsights({ className }: { className?: string }) {
  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>Manager insights</CardTitle>
        <CardDescription>
          What changed this month and where to look next.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {managerInsights.map((insight) => (
          <div
            key={insight.id}
            className="flex items-start gap-3 rounded-xl bg-cream/60 px-3 py-2.5"
          >
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-tangerine-tint text-tangerine-ink">
              <Lightbulb aria-hidden className="size-3.5" />
            </span>
            <p className="text-xs leading-relaxed text-ink-soft">
              {insight.text}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
