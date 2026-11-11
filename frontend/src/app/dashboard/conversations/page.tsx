"use client";

import Link from "next/link";
import * as React from "react";
import { Download, MessageSquare, Phone } from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  EmptyState,
  FilterPills,
  Modal,
  PageHeader,
  SearchField,
  StatTile,
  pct,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { initialsOf } from "@/content/workspace";
import { cn } from "@/lib/utils";

type DirectionFilter = "All" | "Inbound" | "Outbound";

const SENTIMENT_DOT: Record<string, string> = {
  Positive: "bg-[#1c7a4c]",
  Neutral: "bg-cobalt",
  Negative: "bg-destructive",
  Unknown: "bg-ink-soft/40",
};

const seconds = (duration: string) => {
  const [minutes, rest] = duration.split(":");
  return Number(minutes) * 60 + Number(rest);
};

const clock = (total: number) =>
  `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}`;

export default function ConversationsPage() {
  const { conversations, agents, creditsUsed } = useWorkspace();
  const [query, setQuery] = React.useState("");
  const [direction, setDirection] = React.useState<DirectionFilter>("All");
  const [agentId, setAgentId] = React.useState("All");
  const [outcome, setOutcome] = React.useState("All");
  const [selected, setSelected] = React.useState<string | null>(null);

  const outcomes = Array.from(new Set(conversations.map((call) => call.outcome)));

  const filtered = conversations.filter((call) => {
    const matchesQuery =
      !query ||
      `${call.contact} ${call.phone} ${call.summary}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesDirection = direction === "All" || call.direction === direction;
    const matchesAgent = agentId === "All" || call.agentId === agentId;
    const matchesOutcome = outcome === "All" || call.outcome === outcome;
    return matchesQuery && matchesDirection && matchesAgent && matchesOutcome;
  });

  const positive = conversations.filter((call) => call.sentiment === "Positive").length;
  const averageSeconds = conversations.length
    ? conversations.reduce((sum, call) => sum + seconds(call.duration), 0) /
      conversations.length
    : 0;
  const call = conversations.find((item) => item.id === selected) ?? null;

  const download = () => {
    if (!call) return;
    const lines = [
      `AOTMS conversation ${call.id.toUpperCase()}`,
      `${call.contact} · ${call.phone} · ${call.direction}`,
      `Employee: ${agents.find((agent) => agent.id === call.agentId)?.name ?? "Unassigned"}`,
      `Outcome: ${call.outcome} · Sentiment: ${call.sentiment} · ${call.duration} · ${call.credits} credits`,
      `Started: ${call.startedAt}`,
      "",
      `Summary: ${call.summary}`,
      "",
      "Transcript",
      "----------",
      ...call.transcript.map((turn) => `${turn.who}: ${turn.text}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${call.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Conversations"
        title="All conversations"
        description="Searchable transcripts for every call, with the outcome, the sentiment and the credits it used."
        actions={<Badge variant="secondary">{creditsUsed.toLocaleString("en-IN")} credits used</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Conversations" value={String(conversations.length)} hint="All time" />
        <StatTile label="Average duration" value={clock(averageSeconds)} hint="Connected calls" />
        <StatTile label="Positive sentiment" value={pct(positive, conversations.length)} hint="Based on call summary" />
        <StatTile label="Employees involved" value={String(new Set(conversations.map((item) => item.agentId)).size)} hint="With at least one call" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={query} onChange={setQuery} placeholder="Search contact or summary" />
          <FilterPills
            label="Filter by direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "All", label: "All", count: conversations.length },
              {
                value: "Inbound",
                label: "Inbound",
                count: conversations.filter((item) => item.direction === "Inbound").length,
              },
              {
                value: "Outbound",
                label: "Outbound",
                count: conversations.filter((item) => item.direction === "Outbound").length,
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryDropdown
            label="Filter by employee"
            size="sm"
            className="w-44"
            value={agentId}
            onChange={setAgentId}
            dividerAfter={0}
            options={[
              { value: "All", label: "All employees" },
              ...agents.map((agent) => ({
                value: agent.id,
                label: agent.name,
                badge: initialsOf(agent.name),
                accent: "#185adb",
              })),
            ]}
          />
          <CategoryDropdown
            label="Filter by outcome"
            size="sm"
            className="w-44"
            value={outcome}
            onChange={setOutcome}
            dividerAfter={0}
            options={[
              { value: "All", label: "All outcomes" },
              ...outcomes.map((item) => ({ value: item, label: item })),
            ]}
          />
          <span className="ml-auto text-[11px] text-ink-soft">{filtered.length} conversations</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-5" />}
          title="No conversations match"
          description="Clear the filters, or place a call from Instant leads to create the first one."
          action={
            <Link href="/dashboard/instant-leads" className={buttonVariants({ size: "lg" })}>
              <Phone aria-hidden />
              Start a call
            </Link>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Direction</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Outcome</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Sentiment</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Talk time</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Credits</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Started</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-mist-soft/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{item.contact}</p>
                      <p className="text-[11px] text-ink-soft">{item.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {agents.find((agent) => agent.id === item.agentId)?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={item.direction === "Inbound" ? "secondary" : "outline"}>
                        {item.direction}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{item.outcome}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-ink-soft">
                        <span className={cn("size-2 rounded-full", SENTIMENT_DOT[item.sentiment])} aria-hidden />
                        {item.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{item.duration}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{item.credits}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{item.startedAt}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(item.id)}
                        className="inline-flex h-7 items-center rounded-md bg-cobalt-tint px-2 text-[11px] font-medium text-cobalt-deep transition-colors hover:bg-cobalt-tint/70"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={Boolean(call)}
        onClose={() => setSelected(null)}
        title={call ? `${call.contact} · ${call.direction}` : "Conversation"}
        description={call ? `${call.phone} · ${call.startedAt}` : undefined}
        footer={
          <>
            <button type="button" onClick={download} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden />
              Download transcript
            </button>
            <Link href="/dashboard/leads" className={buttonVariants()}>
              Open leads
            </Link>
          </>
        }
      >
        {call ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Outcome", value: call.outcome },
                { label: "Talk time", value: call.duration },
                { label: "Credits", value: String(call.credits) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-mist-soft px-2 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                Summary
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink">{call.summary}</p>
            </div>

            <div className="rounded-lg bg-mist-soft/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  Transcript
                </p>
                <Badge variant="outline">
                  {agents.find((agent) => agent.id === call.agentId)?.name ?? "AI"}
                </Badge>
              </div>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {call.transcript.map((turn, index) => (
                  <div
                    key={`${turn.who}-${index}`}
                    className={cn(
                      "flex flex-col gap-0.5",
                      turn.who === "Customer" ? "items-end" : "items-start",
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide text-ink-soft">{turn.who}</span>
                    <p
                      className={cn(
                        "max-w-[88%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                        turn.who === "Customer" ? "bg-cobalt-tint text-cobalt-night" : "bg-surface text-ink ring-1 ring-line",
                      )}
                    >
                      {turn.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
