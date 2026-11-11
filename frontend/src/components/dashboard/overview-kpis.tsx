import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dashboardKpis } from "@/content/dashboard-overview";
import { cn } from "@/lib/utils";

/**
 * "At a glance" — the four numbers a manager checks first. The delta sits in a
 * tinted chip; the card surface stays white so the row reads as data, not as
 * four coloured blocks.
 */
export function OverviewKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {dashboardKpis.map((kpi) => (
        <Card key={kpi.id} className="gap-3 bg-surface">
          <CardHeader>
            <CardDescription className="text-[0.68rem] font-semibold tracking-[0.12em] uppercase">
              {kpi.label}
            </CardDescription>
            <CardAction>
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-lg",
                  kpi.iconClass,
                )}
              >
                <kpi.icon aria-hidden className="size-4" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-ink">
              {kpi.value}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={kpi.trend === "up" ? "success" : "danger"}>
                {kpi.delta}
              </Badge>
              <span className="text-xs text-ink-soft">{kpi.hint}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
