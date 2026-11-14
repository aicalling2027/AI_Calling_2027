"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Field, Modal, SelectInput, TextInput } from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { buttonVariants } from "@/components/ui/button";
import type { Lead, LeadStatus } from "@/content/workspace";
import { LEAD_STATUS_OPTIONS, type LeadPatchDraft, validateLeadPatch } from "@/lib/lead-import";

type Mode = "closed" | "edit" | "delete";

type Draft = {
  name: string;
  phone: string;
  email: string;
  identity: string;
  status: LeadStatus;
  agentId: string;
};

function draftFrom(lead: Lead): Draft {
  return {
    // A lead whose contact was never enriched is stored as "Unknown caller";
    // starting the field empty lets the person name them instead of editing
    // around a placeholder they did not type.
    name: lead.name === "Unknown caller" ? "" : lead.name,
    phone: lead.phone,
    email: lead.email,
    identity: lead.identity ?? "",
    status: lead.status,
    agentId: lead.agentId ?? "",
  };
}

/**
 * Edit and delete for one row of Recent instant leads.
 *
 * Both actions go through the shared store, which saves to the database and
 * puts the row back if the server refuses the change.
 */
export function LeadRowActions({ lead }: { lead: Lead }) {
  const { agents, updateLead, removeLead } = useWorkspace();
  const [mode, setMode] = React.useState<Mode>("closed");
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(lead));
  const [problems, setProblems] = React.useState<string[]>([]);

  const startEdit = () => {
    setDraft(draftFrom(lead));
    setProblems([]);
    setMode("edit");
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    // Only the fields that actually changed are sent. A lead captured without a
    // name can then have its status corrected without being forced to invent
    // one first, and the request carries exactly what the person decided.
    const initial = draftFrom(lead);
    const patch: LeadPatchDraft = {};
    if (draft.name !== initial.name) patch.name = draft.name;
    if (draft.phone !== initial.phone) patch.phone = draft.phone;
    if (draft.email !== initial.email) patch.email = draft.email;
    if (draft.identity !== initial.identity) patch.identity = draft.identity;
    if (draft.status !== initial.status) patch.status = draft.status;
    if (draft.agentId !== initial.agentId) patch.agentId = draft.agentId || null;

    if (Object.keys(patch).length === 0) {
      setProblems(["Nothing has changed yet."]);
      return;
    }

    const found = validateLeadPatch(patch);
    setProblems(found);
    if (found.length > 0) return;

    updateLead(lead.id, patch);
    setMode("closed");
  };

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          aria-label={`Edit ${lead.name}`}
          onClick={startEdit}
          className="grid size-7 place-items-center rounded-md text-ink-soft transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Delete ${lead.name}`}
          onClick={() => setMode("delete")}
          className="grid size-7 place-items-center rounded-md text-ink-soft transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      <Modal
        open={mode === "edit"}
        onClose={() => setMode("closed")}
        title="Edit lead"
        description="Changes are saved to the workspace as soon as you save them."
        footer={
          <>
            <button
              type="button"
              onClick={() => setMode("closed")}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className={buttonVariants({ size: "sm" })}
            >
              Save changes
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor={`lead-name-${lead.id}`}>
            <TextInput
              id={`lead-name-${lead.id}`}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Phone" htmlFor={`lead-phone-${lead.id}`}>
            <TextInput
              id={`lead-phone-${lead.id}`}
              value={draft.phone}
              onChange={(event) => set("phone", event.target.value)}
              inputMode="tel"
              autoComplete="off"
            />
          </Field>
          <Field label="Email" hint="Optional" htmlFor={`lead-email-${lead.id}`}>
            <TextInput
              id={`lead-email-${lead.id}`}
              value={draft.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Identity"
            hint="Your reference for this customer"
            htmlFor={`lead-identity-${lead.id}`}
          >
            <TextInput
              id={`lead-identity-${lead.id}`}
              value={draft.identity}
              onChange={(event) => set("identity", event.target.value)}
              placeholder="POL-884213"
              autoComplete="off"
            />
          </Field>
          <Field label="Status" htmlFor={`lead-status-${lead.id}`}>
            <SelectInput
              id={`lead-status-${lead.id}`}
              value={draft.status}
              onChange={(event) => set("status", event.target.value as LeadStatus)}
            >
              {LEAD_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Employee" htmlFor={`lead-agent-${lead.id}`}>
            <SelectInput
              id={`lead-agent-${lead.id}`}
              value={draft.agentId}
              onChange={(event) => set("agentId", event.target.value)}
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {problems.length > 0 ? (
          <ul role="alert" className="mt-3 space-y-0.5 text-xs text-destructive">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        open={mode === "delete"}
        onClose={() => setMode("closed")}
        title="Delete this lead?"
        description={`${lead.name} will be removed from the queue. The number stays on file, so importing it again later will still be recognised.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMode("closed")}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Keep the lead
            </button>
            <button
              type="button"
              onClick={() => {
                removeLead(lead.id);
                setMode("closed");
              }}
              className={buttonVariants({ variant: "destructive", size: "sm" })}
            >
              Delete lead
            </button>
          </>
        }
      >
        <p className="text-xs text-ink-soft">
          Calls already logged against this lead keep their history.
        </p>
      </Modal>
    </>
  );
}
