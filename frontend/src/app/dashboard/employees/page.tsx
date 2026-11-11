"use client";

import Link from "next/link";
import * as React from "react";
import {
  ArrowUpRight,
  Copy,
  Pause,
  Play,
  Plus,
  Trash2,
  Users,
  Zap,
} from "lucide-react";

import {
  EmptyState,
  FilterPills,
  PageHeader,
  SearchField,
  StatTile,
  StatusBadge,
} from "@/components/dashboard/ui/kit";
import { LanguageDropdown } from "@/components/dashboard/ui/language-dropdown";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type Agent, LANGUAGES, MODELS } from "@/content/workspace";
import { cn } from "@/lib/utils";

type StatusFilter = "All" | Agent["status"];

const STATUS_VARIANT: Record<Agent["status"], "success" | "warning" | "secondary"> = {
  Active: "success",
  Paused: "warning",
  Draft: "secondary",
};

export default function EmployeesPage() {
  const { agents, updateAgent, deleteAgent, addAgent } = useWorkspace();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("All");
  const [language, setLanguage] = React.useState("All");

  const filtered = agents.filter((agent) => {
    const matchesQuery =
      !query ||
      `${agent.name} ${agent.purpose} ${agent.languages.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesStatus = status === "All" || agent.status === status;
    const matchesLanguage =
      language === "All" || agent.languages.includes(language);
    return matchesQuery && matchesStatus && matchesLanguage;
  });

  const totalCalls = agents.reduce((sum, agent) => sum + agent.calls, 0);
  const active = agents.filter((agent) => agent.status === "Active").length;
  const average =
    agents.length === 0
      ? 0
      : Math.round(
          agents.reduce((sum, agent) => sum + agent.successRate, 0) / agents.length,
        );

  const duplicate = (agent: Agent) => {
    addAgent({
      name: `${agent.name} copy`,
      purpose: agent.purpose,
      languages: agent.languages,
      defaultLanguage: agent.defaultLanguage,
      voice: agent.voice,
      voiceId: agent.voiceId,
      model: agent.model,
      modelId: agent.modelId,
      greeting: agent.greeting,
      prompt: agent.prompt,
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Employees"
        title="My employees"
        description="Every AI employee you have built, with its voice, languages and live performance."
        actions={
          <>
            <Link
              href="/dashboard/talk"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Zap aria-hidden />
              Talk to an employee
            </Link>
            <Link href="/dashboard/employees/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              New employee
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Employees" value={String(agents.length)} hint={`${active} active`} />
        <StatTile label="Calls handled" value={totalCalls.toLocaleString("en-IN")} hint="All time" />
        <StatTile label="Average success" value={`${average}%`} hint="Across employees" />
        <StatTile label="Models in use" value={String(new Set(agents.map((a) => a.modelId)).size)} hint="Sarvam M series" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 lg:flex-row lg:items-center">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name, role or language"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "All", label: "All", count: agents.length },
              { value: "Active", label: "Active", count: active },
              {
                value: "Paused",
                label: "Paused",
                count: agents.filter((a) => a.status === "Paused").length,
              },
              {
                value: "Draft",
                label: "Draft",
                count: agents.filter((a) => a.status === "Draft").length,
              },
            ]}
          />
          <LanguageDropdown
            label="Filter by language"
            size="sm"
            className="w-44"
            value={language}
            onChange={setLanguage}
            options={["All", ...LANGUAGES]}
            placeholder="All languages"
            dividerAfter={0}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No employees match these filters"
          description="Clear the search, choose another language, or build a new employee from a template."
          action={
            <Link href="/dashboard/employees/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Build an employee
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((agent) => (
            <article
              key={agent.id}
              className="flex flex-col rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-[0_16px_40px_-32px_rgba(13,42,107,0.6)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold",
                    agent.tone,
                  )}
                  aria-hidden
                >
                  {agent.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-ink">
                      {agent.name}
                    </h2>
                    <StatusBadge variant={STATUS_VARIANT[agent.status]}>
                      {agent.status}
                    </StatusBadge>
                  </div>
                  <p className="truncate text-xs text-ink-soft">{agent.purpose}</p>
                </div>
                <Link
                  href={`/dashboard/employees/${agent.id}`}
                  className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-mist hover:text-ink"
                  aria-label={`Open ${agent.name}'s workspace`}
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-mist-soft p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-ink-soft">Calls</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {agent.calls.toLocaleString("en-IN")}
                  </dd>
                </div>
                <div className="rounded-lg bg-mist-soft p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-ink-soft">
                    Success
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {agent.successRate}%
                  </dd>
                </div>
              </dl>

              <div className="mt-3">
                <Progress
                  value={agent.successRate}
                  aria-label={`${agent.name} success rate`}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.languages.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
                <Badge variant="outline">{agent.voice}</Badge>
                <Badge variant="outline">
                  {MODELS.find((model) => model.id === agent.modelId)?.name ?? agent.model}
                </Badge>
              </div>

              <p className="mt-3 text-[11px] text-ink-soft">
                Last active {agent.lastActive}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
                <Link
                  href={`/dashboard/talk?agent=${agent.id}`}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-cobalt-tint px-2 text-[11px] font-medium text-cobalt-deep transition-colors hover:bg-cobalt-tint/70"
                >
                  <Zap className="size-3" />
                  Test
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    updateAgent(agent.id, {
                      status: agent.status === "Active" ? "Paused" : "Active",
                    })
                  }
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-mist px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-mist/70"
                >
                  {agent.status === "Active" ? (
                    <Pause className="size-3" />
                  ) : (
                    <Play className="size-3" />
                  )}
                  {agent.status === "Active" ? "Pause" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(agent)}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-mist px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-mist/70"
                >
                  <Copy className="size-3" />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete ${agent.name}? Its training is removed too.`)) {
                      deleteAgent(agent.id);
                    }
                  }}
                  className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
