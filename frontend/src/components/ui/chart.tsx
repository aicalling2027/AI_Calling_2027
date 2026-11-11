"use client";

import type * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

/**
 * Wraps Recharts in a responsive container and publishes each series colour as
 * `--color-<key>`, so marks can say `stroke="var(--color-total)"` and the chart
 * reads its palette from one config object rather than hex literals in JSX.
 */
function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactElement;
}) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      `--color-${key}`,
      value.color,
    ]),
  ) as React.CSSProperties;

  return (
    <div className={cn("w-full text-xs", className)} style={style}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Recharts' stock tooltip is a semi-transparent black box; this keeps the card
 * surface, hairline edge and shadow so the tooltip looks part of the dashboard.
 */
function ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      cursor={{ fill: "rgba(13, 42, 107, 0.04)", stroke: "var(--hairline)" }}
      contentStyle={{
        borderRadius: 12,
        border: "1px solid var(--hairline)",
        backgroundColor: "var(--surface)",
        boxShadow: "var(--elevation-card)",
        padding: "8px 10px",
        fontSize: 12,
        lineHeight: 1.5,
      }}
      labelStyle={{ color: "var(--ink)", fontWeight: 600, marginBottom: 2 }}
      itemStyle={{ color: "var(--ink-soft)", paddingBlock: 1 }}
      {...props}
    />
  );
}

export { ChartContainer, ChartTooltip };
