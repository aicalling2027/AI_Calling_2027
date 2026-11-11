"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  busiestHours,
  callVolumeRanges,
  callVolumeSeries,
  conversationOutcomes,
  conversationSources,
  type CallVolumeRange,
  type DonutSlice,
} from "@/content/dashboard-overview";
import { cn } from "@/lib/utils";

const volumeConfig: ChartConfig = {
  total: callVolumeSeries.total,
  answered: callVolumeSeries.answered,
  missed: callVolumeSeries.missed,
};

const hoursConfig: ChartConfig = {
  calls: { label: "Calls", color: "#185adb" },
};

const RANGES: CallVolumeRange[] = ["daily", "weekly", "monthly"];

const axisTick = { fontSize: 11, fill: "var(--ink-soft)" };

/** Trends + "Calls over time" (PRD Dashboard F and G). */
export function CallsOverTimeCard({ className }: { className?: string }) {
  const [range, setRange] = React.useState<CallVolumeRange>("weekly");
  const { hint, points } = callVolumeRanges[range];

  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>Calls over time</CardTitle>
        <CardDescription>{hint} — total, answered and missed</CardDescription>
        <CardAction>
          <div
            role="group"
            aria-label="Call volume range"
            className="inline-flex rounded-lg bg-mist p-0.5"
          >
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                aria-pressed={range === option}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === option
                    ? "bg-surface text-ink shadow-sm ring-1 ring-line"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {callVolumeRanges[option].label}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={volumeConfig} className="h-64">
          <AreaChart
            data={points}
            margin={{ left: 4, right: 8, top: 8 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id="calls-total-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.16}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={axisTick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tick={axisTick}
            />
            <ChartTooltip />
            <Area
              dataKey="total"
              name="Total calls"
              type="monotone"
              stroke="var(--color-total)"
              strokeWidth={2}
              fill="url(#calls-total-fill)"
            />
            <Area
              dataKey="answered"
              name="Answered"
              type="monotone"
              stroke="var(--color-answered)"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
            />
            <Area
              dataKey="missed"
              name="Missed"
              type="monotone"
              stroke="var(--color-missed)"
              strokeWidth={2}
              fill="none"
            />
          </AreaChart>
        </ChartContainer>

        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          {Object.entries(volumeConfig).map(([key, item]) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** "Busiest hours" (PRD Dashboard H). */
export function BusiestHoursCard({ className }: { className?: string }) {
  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>Busiest hours</CardTitle>
        <CardDescription>The 11am to 3pm window carries the load</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={hoursConfig} className="h-52">
          <BarChart
            data={busiestHours}
            margin={{ left: 0, right: 4, top: 8 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
            />
            <YAxis hide />
            <ChartTooltip cursor={{ fill: "rgba(13, 42, 107, 0.04)" }} />
            <Bar
              dataKey="calls"
              name="Calls"
              fill="var(--color-calls)"
              radius={[6, 6, 0, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ChartContainer>
        <p className="mt-3 text-xs text-ink-soft">
          Hour of day across every agent, last 30 days.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Shared donut for the two breakdown cards. The centre keeps the total so the
 * percentage legend on the right has something to add up to.
 */
function DonutCard({
  title,
  description,
  slices,
  className,
}: {
  title: string;
  description: string;
  slices: DonutSlice[];
  className?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card className={cn("bg-surface", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative size-44 shrink-0">
          <ChartContainer
            config={{ calls: { label: "Calls", color: "#185adb" } }}
            className="size-full"
          >
            <PieChart>
              <ChartTooltip />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-semibold tabular-nums text-ink">
              {total.toLocaleString("en-IN")}
            </span>
            <span className="text-[0.6rem] font-semibold tracking-[0.12em] text-ink-soft uppercase">
              calls
            </span>
          </div>
        </div>

        <ul className="flex w-full flex-col gap-2 text-xs">
          {slices.map((slice) => (
            <li key={slice.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate text-ink-soft">{slice.label}</span>
              <span className="ml-auto shrink-0 font-medium tabular-nums text-ink">
                {Math.round((slice.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** "How conversations ended" (PRD Dashboard I). */
export function OutcomesCard({ className }: { className?: string }) {
  return (
    <DonutCard
      title="How conversations ended"
      description="Final outcome recorded per call"
      slices={conversationOutcomes}
      className={className}
    />
  );
}

/** "Where conversations came from" (PRD Dashboard J). */
export function SourcesCard({ className }: { className?: string }) {
  return (
    <DonutCard
      title="Where conversations came from"
      description="Lead source behind each call"
      slices={conversationSources}
      className={className}
    />
  );
}
