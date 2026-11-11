import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { recentCalls, type RecentCall } from "@/content/dashboard-overview";
import { cn } from "@/lib/utils";

const SENTIMENT_DOT: Record<RecentCall["sentiment"], string> = {
  Positive: "bg-[#1c7a4c]",
  Neutral: "bg-cobalt",
  Negative: "bg-destructive",
  Unknown: "bg-ink-soft/40",
};

/** "Recent calls" (PRD Dashboard L). */
export function OverviewRecentCalls({ className }: { className?: string }) {
  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>Recent calls</CardTitle>
        <CardDescription>
          The last six conversations across every agent.
        </CardDescription>
        <CardAction>
          <Link
            href="/dashboard/conversations"
            className="text-xs font-semibold text-cobalt hover:text-cobalt-deep"
          >
            All conversations
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[0.62rem] tracking-[0.12em] text-ink-soft uppercase">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Contact
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Employee
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Channel
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Outcome
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Sentiment
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  Talk time
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentCalls.map((call) => (
                <tr key={call.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{call.contact}</p>
                    <p className="text-xs text-ink-soft tabular-nums">
                      {call.phone}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{call.employee}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="secondary">{call.channel}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={call.outcomeTone}>{call.outcome}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          SENTIMENT_DOT[call.sentiment],
                        )}
                      />
                      {call.sentiment}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-ink-soft tabular-nums">
                    {call.talkTime}
                  </td>
                  <td className="py-3 text-right text-xs whitespace-nowrap text-ink-soft">
                    {call.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
