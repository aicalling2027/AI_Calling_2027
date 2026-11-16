/**
 * Phone numbers: the FastAPI `/api/v1/phone-numbers` endpoints translated into
 * the `PhoneNumberRecord` the dashboard already renders.
 *
 * Server-side only (Route Handlers). Two vocabularies meet here and nowhere
 * else: the API speaks lowercase statuses and a `capabilities` list, the screen
 * speaks title-case statuses and a single `mode`, so one place owns both
 * directions and no page has to know which is which.
 */

import type { NumberRoute, PhoneNumberRecord } from "@/content/workspace";
import { apiFetch } from "@/lib/api/aotms";

/**
 * What the provider answered about inbound routing for one number.
 *
 * `confirmed` is the field that matters: it is true only when a provider call
 * came back. An employee chosen here is `pending` and unconfirmed until then.
 */
export type NumberRouting = {
  state: "unconfigured" | "pending" | "active" | "paused" | "failed";
  confirmed: boolean;
  detail: string | null;
  checked_at: string | null;
};

/** The subset of `PhoneNumberOut` the dashboard reads. */
export type PhoneNumberRow = {
  id: string;
  number: string;
  label: string | null;
  country_code: string;
  provider: string;
  status: string;
  employee_id: string | null;
  capabilities: string[];
  monthly_cost_inr: number;
  created_at: string;
  routing?: NumberRouting | null;
};

type PhoneNumberPage = { items: PhoneNumberRow[]; meta?: { total: number } };

/** One number on the shelf the purchase form searches. */
export type AvailableNumber = {
  number: string;
  formatted: string;
  country_code: string;
  country: string;
  dial_code: string;
  region: string;
  provider: string;
  capabilities: string[];
  monthly_cost_inr: number;
  setup_cost_inr: number;
};

export type MarketRegion = {
  region: string;
  monthly_cost_inr: number;
  setup_cost_inr: number;
};

/** A country the purchase form offers, with the cities inside it. */
export type TelephonyMarket = {
  country_code: string;
  country: string;
  dial_code: string;
  capabilities: string[];
  regions: MarketRegion[];
};

export type AvailableNumberQuery = {
  countryCode?: string;
  region?: string;
  capability?: string;
  /** Digits typed so far; matched anywhere in the number. */
  query?: string;
  limit?: number;
};

export type CarrierCountryCount = { country: string; numbers: number };

/**
 * How much of the plan's number allowance this workspace holds.
 *
 * `current` counts pending, active and switched-off lines because they are all
 * still held; released ones are not. Absent when no plan is on file.
 */
export type NumberQuota = {
  plan: string;
  limit: number;
  current: number;
  remaining: number;
};

/**
 * What this workspace has recorded, read back from the platform.
 *
 * There is no carrier half to compare against: Sarvam publishes no API for
 * rented numbers, so these counts describe the rows stored here that the
 * workspace attached from the console. `status` is fixed at `manual` for the
 * same reason - nothing is being synced, so nothing may claim to be.
 */
export type InventorySummary = {
  status: "manual";
  inventory_source: "manual";
  /** The voice connection dials through, when one is configured. */
  connection_id: string | null;
  checked_at: string;
  local_total: number;
  local_active: number;
  local_pending: number;
  local_released: number;
  assigned: number;
  unassigned: number;
  by_country: CarrierCountryCount[];
  /** Null when this workspace has no plan yet, as for a first sign-in. */
  quota?: NumberQuota | null;
};

export type PurchaseInput = {
  number: string;
  label?: string;
  employeeId?: string | null;
  capabilities: string[];
};

export type PurchaseResult = {
  record: PhoneNumberRecord;
  setupCostInr: number;
  /** True while the shelf stands in for the carrier's own inventory API. */
  simulated: boolean;
};

/** A number rented in the Sarvam console, about to be recorded here. */
export type AttachInput = {
  number: string;
  label?: string;
  countryCode?: string;
  employeeId?: string | null;
  capabilities?: string[];
};

export type AttachResult = {
  record: PhoneNumberRecord;
  /** False when this workspace had already recorded the number. */
  created: boolean;
};

// ---------------------------------------------------------------------------
// Backend -> UI
// ---------------------------------------------------------------------------
const STATUS_TO_UI: Record<string, PhoneNumberRecord["status"]> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
  released: "Released",
};

/**
 * What the workspace calls its carrier.
 *
 * `provider` is a vendor code in the database, and a number bought before the
 * platform was consolidated under one brand still carries the old one, so both
 * print as the SIP trunk a call actually leaves through.
 */
const PROVIDER_LABELS: Record<string, string> = {
  aotms_sip: "AOTMS SIP",
  sarvam: "AOTMS SIP",
  mock: "Test line",
  exotel: "Exotel",
  plivo: "Plivo",
  twilio: "Twilio",
};

export const providerLabel = (code: string): string => PROVIDER_LABELS[code] ?? code;

const modeOf = (capabilities: string[]): PhoneNumberRecord["mode"] => {
  const inbound = capabilities.includes("inbound");
  const outbound = capabilities.includes("outbound");
  if (inbound && outbound) return "Both";
  return inbound ? "Inbound" : "Outbound";
};

/** The capabilities a mode asks the backend to enable. */
export const capabilitiesOf = (mode: PhoneNumberRecord["mode"]): string[] =>
  mode === "Both" ? ["inbound", "outbound"] : [mode.toLowerCase()];

const toRecord = (row: PhoneNumberRow): PhoneNumberRecord => ({
  id: row.id,
  number: row.number,
  provider: providerLabel(row.provider),
  status: STATUS_TO_UI[row.status] ?? "Pending",
  mode: modeOf(row.capabilities ?? []),
  agentId: row.employee_id ?? null,
  // The greeting lives with the employee, not the line; this stays a local
  // scratch value on the routing screen and is never read back from here.
  welcome: "",
  label: row.label ?? null,
  monthlyCostInr: row.monthly_cost_inr,
  routing: toRoute(row.routing),
});

const ROUTING_TO_UI: Record<string, NumberRoute["state"]> = {
  unconfigured: "Unconfigured",
  pending: "Pending",
  active: "Active",
  paused: "Paused",
  failed: "Failed",
};

/**
 * The provider's routing answer, in the screen's vocabulary.
 *
 * A row with no routing at all stays `null` rather than defaulting to pending:
 * "nothing is known yet" and "a route is being set up" are different claims.
 */
const toRoute = (routing: NumberRouting | null | undefined): NumberRoute | null => {
  if (!routing) return null;
  return {
    state: ROUTING_TO_UI[routing.state] ?? "Pending",
    confirmed: routing.confirmed === true,
    detail: routing.detail ?? null,
  };
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export async function listPhoneNumbers(): Promise<PhoneNumberRecord[]> {
  const page = await apiFetch<PhoneNumberPage>("/phone-numbers?page=1&page_size=100");
  return (page?.items ?? []).map(toRecord);
}

export async function listMarkets(): Promise<TelephonyMarket[]> {
  return apiFetch<TelephonyMarket[]>("/phone-numbers/catalogue");
}

export async function listAvailableNumbers(
  filters: AvailableNumberQuery = {},
): Promise<AvailableNumber[]> {
  const params = new URLSearchParams();
  if (filters.countryCode) params.set("country_code", filters.countryCode);
  if (filters.region) params.set("region", filters.region);
  if (filters.capability) params.set("capability", filters.capability);
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  params.set("limit", String(filters.limit ?? 24));

  return apiFetch<AvailableNumber[]>(`/phone-numbers/available?${params.toString()}`);
}

/**
 * What this workspace has attached, counted.
 *
 * Read-only on the backend too, so calling it is safe on every visit: it never
 * imports a number or changes what the workspace owns.
 */
export async function getInventorySummary(): Promise<InventorySummary> {
  return apiFetch<InventorySummary>("/phone-numbers/sync");
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export async function purchasePhoneNumber(input: PurchaseInput): Promise<PurchaseResult> {
  const bought = await apiFetch<{
    number: PhoneNumberRow;
    setup_cost_inr: number;
    simulated: boolean;
  }>("/phone-numbers/purchase", {
    method: "POST",
    body: {
      number: input.number,
      label: input.label?.trim() || null,
      employee_id: input.employeeId || null,
      capabilities: input.capabilities,
    },
  });

  return {
    record: toRecord(bought.number),
    setupCostInr: bought.setup_cost_inr,
    simulated: bought.simulated,
  };
}

export type PhoneNumberPatch = {
  label?: string | null;
  mode?: PhoneNumberRecord["mode"];
  /** `null` releases the line from its employee. */
  agentId?: string | null;
};

export async function updatePhoneNumber(
  id: string,
  patch: PhoneNumberPatch,
): Promise<PhoneNumberRecord> {
  // The backend keeps these on different endpoints: the greeting-free fields
  // are a patch, while binding an employee records assignment history.
  let row: PhoneNumberRow | null = null;

  if (patch.agentId !== undefined) {
    // The choice travels in the body; the backend records the assignment so its
    // history stays intact, and answers with whatever the provider confirmed.
    row = await apiFetch<PhoneNumberRow>(`/phone-numbers/${id}/assign`, {
      method: "POST",
      body: { employee_id: patch.agentId },
    });
  }

  const body: Record<string, unknown> = {};
  if (patch.label !== undefined) body.label = patch.label;
  if (patch.mode !== undefined) body.capabilities = capabilitiesOf(patch.mode);

  if (Object.keys(body).length > 0) {
    row = await apiFetch<PhoneNumberRow>(`/phone-numbers/${id}`, {
      method: "PATCH",
      body,
    });
  }

  if (!row) {
    // Nothing to send is still an answer: re-read so the caller gets the row
    // it asked about instead of having to guess.
    row = await apiFetch<PhoneNumberRow>(`/phone-numbers/${id}`);
  }
  return toRecord(row);
}

export async function releasePhoneNumber(id: string): Promise<void> {
  await apiFetch<{ message: string }>(`/phone-numbers/${id}`, { method: "DELETE" });
}

/**
 * Record a number that was rented in the Sarvam console.
 *
 * Attaching is idempotent on the backend: the same number twice answers with the
 * row that already holds it, and `created` tells the two answers apart. Nothing
 * is bought here - the line is already rented and billed in the console.
 */
export async function attachPhoneNumber(input: AttachInput): Promise<AttachResult> {
  const attached = await apiFetch<{
    number: PhoneNumberRow;
    created: boolean;
    source: "console";
  }>("/phone-numbers/attach", {
    method: "POST",
    body: {
      number: input.number,
      label: input.label?.trim() || null,
      country_code: input.countryCode || "IN",
      employee_id: input.employeeId || null,
      capabilities: input.capabilities ?? ["inbound", "outbound"],
    },
  });

  return { record: toRecord(attached.number), created: attached.created };
}
