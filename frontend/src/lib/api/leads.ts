/**
 * Server-side client for the lead endpoints.
 *
 * The browser never talks to FastAPI directly; Route Handlers in
 * `src/app/api/leads/*` call these functions with the workspace's own token.
 */

import { apiFetch } from "@/lib/api/aotms";
import type { LeadDraft } from "@/lib/lead-import";
import type { Lead, LeadStatus } from "@/content/workspace";

/** The backend's `LeadSource` member for a lead captured on this screen. */
const SOURCE = "instant";

/** `ContactOut` as much of it as the dashboard needs. */
export type LeadContact = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  company: string | null;
  city: string | null;
  is_dnc: boolean;
  custom_fields?: Record<string, unknown>;
};

/**
 * A lead as the backend returns it (`LeadDetail`).
 *
 * Deliberately loose: the API also carries score, call attempts and timestamps
 * that no screen reads yet, and a stricter type here would have to be widened
 * the first time one of them is needed.
 */
export type LeadRecord = {
  id: string;
  source: string;
  source_detail: string | null;
  status: string;
  employee_id: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  custom_fields: Record<string, unknown>;
  contact: LeadContact | null;
};

export type LeadImportError = {
  row?: number;
  phone?: string;
  error?: string;
};

/** The backend's `BulkImportResult`. */
export type LeadImportSummary = {
  created: number;
  skipped: number;
  errors: LeadImportError[];
  /** The numbers that became leads, so the caller can name them. */
  createdPhones: string[];
  /** Their ids, in the same order, so the caller can act on them later. */
  leadIds: string[];
};

/* ------------------------------------------------------------------ labels */

/** `LeadSource` -> the wording the dashboard uses for it. */
const SOURCE_LABELS: Record<string, string> = {
  instant: "Instant leads",
  bulk_campaign: "Bulk campaigns",
  inbound: "Inbound calls",
  google_sheets: "Google Sheets",
  meta_lead_ads: "Meta lead ads",
  manual_upload: "Manual upload",
  api: "API integration",
  other: "Manual upload",
};

/** The same table read backwards, for writes. */
const SOURCE_VALUES: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCE_LABELS).map(([value, label]) => [label, value]),
);

/** The backend's `LeadSource` value for a label the dashboard shows. */
export function leadSourceValue(label: string): string | undefined {
  return SOURCE_VALUES[label];
}

/** `LeadStatus` -> the funnel the dashboard shows. */
const STATUS_LABELS: Record<string, LeadStatus> = {
  new: "New",
  queued: "New",
  calling: "Contacted",
  contacted: "Contacted",
  qualified: "Qualified",
  not_interested: "Not interested",
  unreachable: "Contacted",
  converted: "Appointment",
  dnc: "Not interested",
};

const STATUS_VALUES: Record<LeadStatus, string> = {
  New: "new",
  Contacted: "contacted",
  Qualified: "qualified",
  Appointment: "converted",
  "Not interested": "not_interested",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Fixed parts rather than a locale format, so the server and browser agree. */
function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** The backend's `LeadStatus` value for a funnel label. */
export function leadStatusValue(status: LeadStatus): string {
  return STATUS_VALUES[status];
}

/** Turn a stored lead into the row the dashboard renders. */
export function toLeadView(record: LeadRecord): Lead {
  const identity = record.custom_fields?.identity;
  return {
    id: record.id,
    name: record.contact?.full_name ?? "Unknown caller",
    phone: record.contact?.phone ?? "",
    email: record.contact?.email ?? "",
    identity: typeof identity === "string" ? identity : "",
    source: SOURCE_LABELS[record.source] ?? "Manual upload",
    agentId: record.employee_id,
    status: STATUS_LABELS[record.status] ?? "New",
    // Neither of these has a column yet; the row is honest about that rather
    // than inventing a follow-up nobody scheduled.
    followUp: "—",
    lastContact: formatWhen(record.last_contacted_at),
    summary: record.notes?.trim() || "—",
  };
}

/** `custom_fields` is where the customer's own identifier is kept. */
function contactBody(lead: LeadDraft) {
  const identity = lead.identity.trim();
  return {
    full_name: lead.name.trim(),
    phone: lead.phone.trim(),
    email: lead.email.trim() || undefined,
    identity: identity || undefined,
  };
}

export async function createLead(input: {
  lead: LeadDraft;
  employeeId?: string | null;
  detail?: string;
  /** The dashboard's label for where the lead came from. */
  source?: string;
}): Promise<LeadRecord> {
  return apiFetch<LeadRecord>("/leads", {
    method: "POST",
    body: {
      contact: contactBody(input.lead),
      employee_id: input.employeeId || undefined,
      source: leadSourceValue(input.source ?? "") ?? SOURCE,
      source_detail: input.detail ?? "instant_leads_manual",
    },
  });
}

export async function importLeads(input: {
  leads: LeadDraft[];
  employeeId?: string | null;
  detail?: string;
}): Promise<LeadImportSummary> {
  const body = {
    leads: input.leads.map(contactBody),
    employee_id: input.employeeId || undefined,
    source: SOURCE,
    source_detail: input.detail ?? "instant_leads_upload",
  };

  const result = await apiFetch<{
    created?: number;
    skipped?: number;
    errors?: LeadImportError[];
    created_phones?: string[];
    lead_ids?: string[];
  }>("/leads/bulk", { method: "POST", body });

  return {
    created: Number(result?.created ?? 0),
    skipped: Number(result?.skipped ?? 0),
    errors: result?.errors ?? [],
    createdPhones: Array.isArray(result?.created_phones) ? result.created_phones : [],
    leadIds: Array.isArray(result?.lead_ids) ? result.lead_ids : [],
  };
}

/** Every lead in the workspace, newest first. */
export async function listLeads(): Promise<LeadRecord[]> {
  const page = await apiFetch<{ items?: LeadRecord[] }>("/leads?page=1&page_size=100");
  return page?.items ?? [];
}

/** The fields the dashboard lets a person correct on an existing lead. */
export type LeadPatch = {
  name?: string;
  phone?: string;
  email?: string;
  identity?: string;
  status?: LeadStatus;
  agentId?: string | null;
};

/**
 * Save one lead's changes.
 *
 * Only the keys the caller actually sent are forwarded, because the backend
 * treats an absent field as "leave it alone" and drops nulls entirely.
 */
export async function updateLeadRecord(id: string, patch: LeadPatch): Promise<LeadRecord> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.full_name = patch.name.trim();
  if (patch.phone !== undefined) body.phone = patch.phone.trim();
  // An empty string clears the value; null would be dropped as "unchanged".
  if (patch.email !== undefined) body.email = patch.email.trim();
  if (patch.identity !== undefined) body.identity = patch.identity.trim();
  if (patch.status !== undefined) body.status = leadStatusValue(patch.status);
  if (patch.agentId !== undefined) body.employee_id = patch.agentId;

  return apiFetch<LeadRecord>(`/leads/${id}`, { method: "PATCH", body });
}

/** Remove a lead. Its contact stays, because other leads may point at it. */
export async function deleteLeadRecord(id: string): Promise<void> {
  await apiFetch<{ message?: string }>(`/leads/${id}`, { method: "DELETE" });
}
