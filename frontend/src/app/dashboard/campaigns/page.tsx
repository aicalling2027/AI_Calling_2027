"use client";

import Link from "next/link";
import * as React from "react";
import {
  Megaphone,
  Pause,
  Play,
  Plus,
  Square,
  Upload,
} from "lucide-react";

import {
  EmptyState,
  Field,
  FilterPills,
  Modal,
  PageHeader,
  SearchField,
  SelectInput,
  StatTile,
  StatusBadge,
  TextInput,
  pct,
} from "@/components/dashboard/ui/kit";
import { CAMPAIGN_TONE, useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CampaignStatus } from "@/content/workspace";

type Filter = "All" | CampaignStatus;

export default function CampaignsPage() {
  const { campaigns, agents, addCampaign, setCampaignStatus } = useWorkspace();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("All");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [agentId, setAgentId] = React.useState(agents[0]?.id ?? "");
  const [contacts, setContacts] = React.useState(500);
  const [schedule, setSchedule] = React.useState("10am – 6pm, Mon–Sat");
  const [fileLabel, setFileLabel] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const filtered = campaigns.filter((campaign) => {
    const matchesFilter = filter === "All" || campaign.status === filter;
    const matchesQuery =
      !query ||
      `${campaign.name} ${agents.find((agent) => agent.id === campaign.agentId)?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const totalContacts = campaigns.reduce((sum, campaign) => sum + campaign.contacts, 0);
  const totalCompleted = campaigns.reduce((sum, campaign) => sum + campaign.completed, 0);
  const totalLeads = campaigns.reduce((sum, campaign) => sum + campaign.leads, 0);
  const running = campaigns.filter((campaign) => campaign.status === "Running").length;

  const readCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result ?? "")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
      setContacts(Math.max(1, lines.length - 1));
      setFileLabel(file.name);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const create = () => {
    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (contacts < 1) {
      setError("Add at least one contact.");
      return;
    }
    addCampaign({ name: name.trim(), agentId, contacts, schedule });
    setName("");
    setContacts(500);
    setFileLabel(null);
    setError(null);
    setOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Campaigns"
        title="Bulk campaigns"
        description="Upload a contact list, choose an employee and let it work through the list inside your calling window."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonVariants({ size: "lg" })}
          >
            <Plus aria-hidden />
            New campaign
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Running" value={String(running)} hint={`${campaigns.length} campaigns total`} />
        <StatTile label="Contacts reached" value={totalCompleted.toLocaleString("en-IN")} hint={`of ${totalContacts.toLocaleString("en-IN")}`} />
        <StatTile label="Completion" value={pct(totalCompleted, totalContacts)} hint="Across campaigns" />
        <StatTile label="Leads captured" value={String(totalLeads)} hint="From campaigns" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField value={query} onChange={setQuery} placeholder="Search campaigns or employees" />
        <FilterPills
          label="Filter by campaign status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "All", label: "All", count: campaigns.length },
            { value: "Running", label: "Running", count: running },
            {
              value: "Paused",
              label: "Paused",
              count: campaigns.filter((campaign) => campaign.status === "Paused").length,
            },
            {
              value: "Completed",
              label: "Completed",
              count: campaigns.filter((campaign) => campaign.status === "Completed").length,
            },
            {
              value: "Draft",
              label: "Draft",
              count: campaigns.filter((campaign) => campaign.status === "Draft").length,
            },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="No campaigns here"
          description="Create a campaign from a CSV, or clear the filters to see the others."
          action={
            <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              New campaign
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((campaign) => {
            const agent = agents.find((item) => item.id === campaign.agentId);
            const percent = campaign.contacts
              ? Math.round((campaign.completed / campaign.contacts) * 100)
              : 0;
            return (
              <article key={campaign.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{campaign.name}</h2>
                    <p className="truncate text-xs text-ink-soft">
                      {agent?.name ?? "Unassigned"} · {campaign.schedule} · started {campaign.createdAt}
                    </p>
                  </div>
                  <StatusBadge variant={CAMPAIGN_TONE[campaign.status]}>
                    {campaign.status}
                  </StatusBadge>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span>
                      {campaign.completed.toLocaleString("en-IN")} of{" "}
                      {campaign.contacts.toLocaleString("en-IN")} contacts
                    </span>
                    <span className="font-medium text-ink">{percent}%</span>
                  </div>
                  <div className="mt-1">
                    <Progress value={percent} aria-label={`${campaign.name} completion`} />
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Answered", value: campaign.answered, tone: "text-[#1c7a4c]" },
                    { label: "Failed", value: campaign.failed, tone: "text-destructive" },
                    { label: "Leads", value: campaign.leads, tone: "text-cobalt-deep" },
                    {
                      label: "Left",
                      value: Math.max(0, campaign.contacts - campaign.completed),
                      tone: "text-ink",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-mist-soft px-1.5 py-2">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-soft">
                        {stat.label}
                      </dt>
                      <dd className={`mt-0.5 text-sm font-semibold ${stat.tone}`}>
                        {stat.value.toLocaleString("en-IN")}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
                  {campaign.status === "Running" ? (
                    <button
                      type="button"
                      onClick={() => setCampaignStatus(campaign.id, "Paused")}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-tangerine-tint px-2 text-[11px] font-medium text-tangerine-ink transition-colors hover:bg-tangerine-tint/70"
                    >
                      <Pause className="size-3" />
                      Pause
                    </button>
                  ) : campaign.status === "Paused" ? (
                    <button
                      type="button"
                      onClick={() => setCampaignStatus(campaign.id, "Running")}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-cobalt-tint px-2 text-[11px] font-medium text-cobalt-deep transition-colors hover:bg-cobalt-tint/70"
                    >
                      <Play className="size-3" />
                      Resume
                    </button>
                  ) : null}
                  {campaign.status === "Running" || campaign.status === "Paused" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Stop ${campaign.name}? Queued contacts stay in the list.`)) {
                          setCampaignStatus(campaign.id, "Completed");
                        }
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-mist px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-mist/70"
                    >
                      <Square className="size-3" />
                      Stop
                    </button>
                  ) : null}
                  <Link
                    href={`/dashboard/leads?campaign=${campaign.id}`}
                    className="ml-auto text-[11px] font-medium text-cobalt hover:underline"
                  >
                    View leads
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="rounded-xl border border-line bg-cream/60 p-4">
        <h2 className="text-xs font-semibold text-ink">How campaigns run</h2>
        <ol className="mt-2 grid gap-2 text-[11px] leading-relaxed text-ink-soft sm:grid-cols-2 xl:grid-cols-4">
          <li><span className="font-semibold text-ink">1 · Upload.</span> CSV with name and phone; duplicates and DND numbers are removed.</li>
          <li><span className="font-semibold text-ink">2 · Dial.</span> One call at a time per number, inside the calling window.</li>
          <li><span className="font-semibold text-ink">3 · Classify.</span> Each call ends with one outcome and a summary.</li>
          <li><span className="font-semibold text-ink">4 · Retry.</span> No-answer and busy numbers retry twice, then stop.</li>
        </ol>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New campaign"
        description="Contacts are dialled in order, one at a time, inside your calling window."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </button>
            <button type="button" onClick={create} className={buttonVariants()}>
              Create campaign
            </button>
          </>
        }
      >
        <Field label="Campaign name" htmlFor="campaign-name">
          <TextInput
            id="campaign-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Diwali offer · Pune"
          />
        </Field>
        <Field label="Employee" htmlFor="campaign-agent">
          <SelectInput
            id="campaign-agent"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.purpose}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          label="Contacts"
          hint="Upload a CSV (name, phone) or type the count."
          htmlFor="campaign-contacts"
        >
          <div className="flex gap-2">
            <TextInput
              id="campaign-contacts"
              type="number"
              min={1}
              value={contacts}
              onChange={(event) => setContacts(Number(event.target.value))}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={readCsv}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
            >
              <Upload className="size-3.5" />
              CSV
            </button>
          </div>
        </Field>
        {fileLabel ? (
          <p className="rounded-lg bg-mist px-2.5 py-1.5 text-[11px] text-ink-soft">
            Loaded {fileLabel} · {contacts} contacts detected
          </p>
        ) : null}
        <Field label="Calling window" htmlFor="campaign-schedule">
          <TextInput
            id="campaign-schedule"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-ink-soft">
          Campaigns respect the do-not-call list and the calling window in Settings. You can
          pause at any time.
        </p>
        <Badge variant="outline">5 credits per connected call</Badge>
      </Modal>
    </div>
  );
}
