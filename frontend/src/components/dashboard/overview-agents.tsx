import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dashboardAgents } from "@/content/dashboard-overview";
import { cn } from "@/lib/utils";

const STATUS_VARIANT = {
  Active: "success",
  Paused: "warning",
  Draft: "secondary",
} as const;

const ROW_ACTION =
  "inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-medium text-ink-soft ring-1 ring-line ring-inset transition-colors hover:bg-mist hover:text-ink";

/** "Your AI employees" (PRD Dashboard B). */
export function OverviewAgents({ className }: { className?: string }) {
  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>Your AI employees</CardTitle>
        <CardDescription>
          Three agents are configured on this workspace.
        </CardDescription>
        <CardAction>
          <Link
            href="/dashboard/employees"
            className="text-xs font-semibold text-cobalt hover:text-cobalt-deep"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-line">
        {dashboardAgents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className={cn("size-10", agent.tone)}>
                <AvatarFallback>{agent.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {agent.name}
                  <span className="text-xs font-normal text-ink-soft">
                    {agent.purpose}
                  </span>
                  <Badge variant={STATUS_VARIANT[agent.status]}>
                    {agent.status}
                  </Badge>
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {agent.languages} · {agent.voice} · {agent.model}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-1.5 sm:w-44">
              <div className="flex items-center justify-between text-[0.7rem] text-ink-soft">
                <span className="tabular-nums">
                  {agent.calls.toLocaleString("en-IN")} calls
                </span>
                <span className="font-medium text-ink">
                  {agent.successRate}% success
                </span>
              </div>
              <Progress
                value={agent.successRate}
                aria-label={`${agent.name} success rate`}
              />
              <p className="text-[0.7rem] text-ink-soft">
                Last active {agent.lastActive}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:ml-4">
              <Link href="/dashboard/talk" className={ROW_ACTION}>
                Test
              </Link>
              <Link href="/dashboard/employees" className={ROW_ACTION}>
                Edit
              </Link>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
