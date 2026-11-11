"use client";

import * as React from "react";
import { Download } from "lucide-react";
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
  FilterPills,
  PageHeader,
  StatTile,
  pct,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { buttonVariants } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import {
  type CallVolumeRange,
  busiestHours,
  callVolumeRanges,
  conversationOutcomes,
} from "@/content/dashboard-overview";

const axisTick = { fill: "var(--ink-soft)", fontSize: 11 };

const volumeConfig: ChartConfig = {
  total: { label: "Total calls", color: "#185adb" },
  answered: { label: "Answered", color: "#0d2a6b" },
  missed: { label: "Missed", color: "#ff8a3d" },
};

const hoursConfig: ChartConfig = { calls: { label: "Calls", color: "#4f86e8" } };

type Range = CallVolumeRange;

export default function PerformancePage() {
  const { agents, leads, conversations } = useWorkspace();
  const [range, setRange] = React.useState<Range>("weekly");
  const { hint, points } = callVolumeRanges[range];

  const totalCalls = agents.reduce((sum, agent) => sum + agent.calls, 0);
  const qualified = leads.filter(
    (lead) => lead.status === "Qualified" || lead.status === "Appointment",
  ).length;
  const appointments = leads.filter((lead) => lead.status === "Appointment").length;
  const positive = conversations.filter((call) => call.sentiment === "Positive").length;
  const outcomeTotal = conversationOutcomes.reduce((sum, slice) => sum + slice.value, 0);

  const exportReport = () => {
    const header = ["Employee", "Calls", "Success rate", "Qualified leads", "Appointments"];
    const rows = agents.map((agent) => [
      agent.name,
      String(agent.calls),
      `${agent.successRate}%`,
      String(
        leads.filter(
          (lead) =>
            lead.agentId === agent.id &&
            (lead.status === "Qualified" || lead.status === "Appointment"),
        ).length,
      ),
      String(leads.filter((lead) => lead.agentId === agent.id && lead.status === "Appointment").length),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aotms-performance.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Performance"
        title="Performance"
        description="Where the calls come from, when they happen, how they end and which employee converts best."
        actions={
          <>
            <FilterPills
              label="Report range"
              value={range}
              onChange={setRange}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <button type="button" onClick={exportReport} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Download aria-hidden />
              Export
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Calls placed" value={totalCalls.toLocaleString("en-IN")} hint={hint} />
        <StatTile label="Answer rate" value="82%" hint="Connected vs dialled" />
        <StatTile label="Qualified leads" value={String(qualified)} hint="Status based" />
        <StatTile label="Positive sentiment" value={pct(positive, conversations.length)} hint="From call summaries" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-4 xl:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Calls over time</h2>
              <p className="text-xs text-ink-soft">
                Total, answered and missed across {callVolumeRanges[range].label.toLowerCase()} buckets.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-ink-soft">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-cobalt" />Total</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-cobalt-night" />Answered</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-tangerine" />Missed</span>
            </div>
          </div>
          <ChartContainer config={volumeConfig} className="mt-3 h-64">
            <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
              <defs>
                <linearGradient id="performance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} width={40} tick={axisTick} />
              <ChartTooltip />
              <Area dataKey="total" name="Total calls" type="monotone" stroke="var(--color-total)" strokeWidth={2} fill="url(#performance-fill)" />
              <Area dataKey="answered" name="Answered" type="monotone" stroke="var(--color-answered)" strokeWidth={2} strokeDasharray="4 4" fill="none" />
              <Area dataKey="missed" name="Missed" type="monotone" stroke="var(--color-missed)" strokeWidth={2} fill="none" />
            </AreaChart>
          </ChartContainer>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">How calls ended</h2>
          <p className="text-xs text-ink-soft">Last 30 days · {outcomeTotal.toLocaleString("en-IN")} calls</p>
          <div className="relative mt-2 h-48">
            <ChartContainer config={{}} className="h-full">
              <PieChart>
                <Pie data={conversationOutcomes} dataKey="value" nameKey="label" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">
                  {conversationOutcomes.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-lg font-semibold text-ink">{outcomeTotal.toLocaleString("en-IN")}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-soft">calls</p>
              </div>
            </div>
          </div>
          <ul className="mt-2 space-y-1 text-[11px]">
            {conversationOutcomes.slice(0, 4).map((slice) => (
              <li key={slice.label} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="flex-1 text-ink-soft">{slice.label}</span>
                <span className="font-medium text-ink">{pct(slice.value, outcomeTotal)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-4 xl:col-span-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Busiest hours</h2>
              <p className="text-xs text-ink-soft">Calls answered per hour, IST. Staff the transfer desk before 11am.</p>
            </div>
            <span className="text-[11px] text-ink-soft">Peak 11am · 142 calls</span>
          </div>
          <ChartContainer config={hoursConfig} className="mt-3 h-52">
            <BarChart data={busiestHours} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
              <YAxis hide />
              <ChartTooltip />
              <Bar dataKey="calls" name="Calls" fill="var(--color-calls)" radius={[6, 6, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ChartContainer>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Efficiency</h2>
          <dl className="mt-3 space-y-2.5 text-xs">
            {[
              { label: "Average talk time", value: "3:12" },
              { label: "Cost per connected call", value: "₹18.40" },
              { label: "Credits per qualified lead", value: "26" },
              { label: "Speed to lead", value: "12 s" },
              { label: "Appointments booked", value: String(appointments) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">{row.label}</dt>
                <dd className="font-semibold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-lg bg-mist-soft p-2.5 text-[11px] leading-relaxed text-ink-soft">
            Cost per call is credits used divided by connected calls. It excludes the monthly
            platform fee.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">By employee</h2>
          <p className="text-xs text-ink-soft">Success rate is the share of calls that ended in a positive outcome.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                <th scope="col" className="px-4 py-2.5 font-semibold">Employee</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Calls</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Success</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Qualified</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Appointments</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {agents.map((agent) => {
                const agentLeads = leads.filter((lead) => lead.agentId === agent.id);
                return (
                  <tr key={agent.id} className="hover:bg-mist-soft/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{agent.name}</p>
                      <p className="text-[11px] text-ink-soft">{agent.purpose}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{agent.calls.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{agent.successRate}%</td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {agentLeads.filter((lead) => lead.status === "Qualified").length}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {agentLeads.filter((lead) => lead.status === "Appointment").length}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex h-1.5 w-24 overflow-hidden rounded-full bg-mist">
                        <span className="h-full rounded-full bg-cobalt" style={{ width: `${agent.successRate}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
