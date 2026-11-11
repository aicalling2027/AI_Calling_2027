"use client";

import * as React from "react";
import { Download, Phone, Plus, Users } from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  EmptyState,
  Field,
  FilterPills,
  Modal,
  PageHeader,
  SearchField,
  StatTile,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { LEAD_TONE, useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  initialsOf,
  LEAD_SOURCES,
  type LeadStatus,
} from "@/content/workspace";

type StatusFilter = "All" | LeadStatus;

const STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Appointment",
  "Not interested",
];

export default function LeadsPage() {
  const { leads, agents, updateLead, addLead } = useWorkspace();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("All");
  const [agentId, setAgentId] = React.useState("All");
  const [source, setSource] = React.useState("All");
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    name: "",
    phone: "",
    email: "",
    agentId: agents[0]?.id ?? "",
    source: LEAD_SOURCES[0],
    followUp: "",
    summary: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  const filtered = leads.filter((lead) => {
    const matchesQuery =
      !query ||
      `${lead.name} ${lead.phone} ${lead.email} ${lead.summary}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesStatus = status === "All" || lead.status === status;
    const matchesAgent = agentId === "All" || lead.agentId === agentId;
    const matchesSource = source === "All" || lead.source === source;
    return matchesQuery && matchesStatus && matchesAgent && matchesSource;
  });

  const qualified = leads.filter(
    (lead) => lead.status === "Qualified" || lead.status === "Appointment",
  ).length;
  const appointments = leads.filter((lead) => lead.status === "Appointment").length;
  const followUps = leads.filter((lead) => lead.followUp !== "—").length;

  const exportCsv = () => {
    const header = [
      "Name",
      "Phone",
      "Email",
      "Employee",
      "Source",
      "Status",
      "Follow-up",
      "Last contact",
      "Summary",
    ];
    const rows = filtered.map((lead) => [
      lead.name,
      lead.phone,
      lead.email,
      agents.find((agent) => agent.id === lead.agentId)?.name ?? "",
      lead.source,
      lead.status,
      lead.followUp,
      lead.lastContact,
      lead.summary,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aotms-leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const createLead = () => {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (draft.phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    addLead({
      name: draft.name.trim(),
      phone: draft.phone,
      email: draft.email.trim(),
      source: draft.source,
      agentId: draft.agentId || null,
      status: "New",
      followUp: draft.followUp.trim() || "—",
      lastContact: "Never",
      summary: draft.summary.trim() || "Added manually from Leads & results.",
    });
    setDraft({
      name: "",
      phone: "",
      email: "",
      agentId: agents[0]?.id ?? "",
      source: LEAD_SOURCES[0],
      followUp: "",
      summary: "",
    });
    setError(null);
    setOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Leads & results"
        title="Leads & results"
        description="Every contact the employees touched, with the outcome, the follow-up date and the summary of the call."
        actions={
          <>
            <button type="button" onClick={exportCsv} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Download aria-hidden />
              Export CSV
            </button>
            <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Add lead
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total leads" value={String(leads.length)} hint={`${filtered.length} in view`} />
        <StatTile label="Qualified or booked" value={String(qualified)} hint="Status based" />
        <StatTile label="Appointments" value={String(appointments)} hint="Scheduled by employees" />
        <StatTile label="Open follow-ups" value={String(followUps)} hint="With a callback date" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={query} onChange={setQuery} placeholder="Search name, phone or summary" />
          <FilterPills
            label="Filter by lead status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "All", label: "All", count: leads.length },
              ...STATUSES.map((item) => ({
                value: item,
                label: item,
                count: leads.filter((lead) => lead.status === item).length,
              })),
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
            label="Filter by source"
            size="sm"
            className="w-44"
            value={source}
            onChange={setSource}
            dividerAfter={0}
            options={[
              { value: "All", label: "All sources" },
              ...LEAD_SOURCES.map((item) => ({ value: item, label: item })),
            ]}
          />
          <span className="ml-auto text-[11px] text-ink-soft">
            {filtered.length} of {leads.length} leads
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No leads match these filters"
          description="Reset the filters or add a lead manually to get started."
          action={
            <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Add lead
            </button>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Source</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Follow-up</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Summary</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-mist-soft/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{lead.name}</p>
                      <p className="text-[11px] text-ink-soft">{lead.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {agents.find((agent) => agent.id === lead.agentId)?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline">{lead.source}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <label className="sr-only" htmlFor={`status-${lead.id}`}>
                        Lead status for {lead.name}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={LEAD_TONE[lead.status]}>{lead.status}</Badge>
                        <select
                          id={`status-${lead.id}`}
                          value={lead.status}
                          onChange={(event) =>
                            updateLead(lead.id, {
                              status: event.target.value as LeadStatus,
                            })
                          }
                          className="h-7 rounded-md border border-line bg-surface px-1 text-[11px] text-ink-soft outline-none focus-visible:border-cobalt"
                        >
                          {STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{lead.followUp}</td>
                    <td className="max-w-[260px] truncate px-4 py-2.5 text-ink-soft">
                      {lead.summary}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`/dashboard/talk${lead.agentId ? `?agent=${lead.agentId}` : ""}`}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-mist px-2 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
                      >
                        <Phone className="size-3" />
                        Call
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a lead"
        description="Manually added leads can be called from the instant-leads module."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </button>
            <button type="button" onClick={createLead} className={buttonVariants()}>
              Save lead
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="lead-name">
            <TextInput
              id="lead-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Rohit Sharma"
            />
          </Field>
          <Field label="Phone" htmlFor="lead-phone">
            <TextInput
              id="lead-phone"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              placeholder="+91 98204 11822"
            />
          </Field>
          <Field label="Email" htmlFor="lead-email">
            <TextInput
              id="lead-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              placeholder="optional"
            />
          </Field>
          <Field label="Employee" htmlFor="lead-agent">
            <CategoryDropdown
              id="lead-agent"
              label="Employee"
              value={draft.agentId}
              onChange={(next) => setDraft({ ...draft, agentId: next })}
              options={[
                { value: "", label: "Unassigned" },
                ...agents.map((agent) => ({
                  value: agent.id,
                  label: agent.name,
                  badge: initialsOf(agent.name),
                  accent: "#185adb",
                })),
              ]}
            />
          </Field>
          <Field label="Source" htmlFor="lead-source">
            <CategoryDropdown
              id="lead-source"
              label="Source"
              value={draft.source}
              onChange={(next) => setDraft({ ...draft, source: next })}
              options={LEAD_SOURCES.map((item) => ({ value: item, label: item }))}
            />
          </Field>
          <Field label="Follow-up" htmlFor="lead-followup">
            <TextInput
              id="lead-followup"
              value={draft.followUp}
              onChange={(event) => setDraft({ ...draft, followUp: event.target.value })}
              placeholder="Tomorrow, 11:00 am"
            />
          </Field>
        </div>
        <Field label="Summary" htmlFor="lead-summary">
          <TextInput
            id="lead-summary"
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            placeholder="What the lead wants"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
