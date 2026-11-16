/**
 * Phone numbers: the FastAPI `/api/v1/phone-numbers` endpoints translated into
 * the `PhoneNumberRecord` the dashboard already renders.
 *
 * Server-side only (Route Handlers). Two vocabularies meet here and nowhere
 * else: the API speaks lowercase statuses and a `capabilities` list, the screen
 * speaks title-case statuses and a single `mode`, so one place owns both
 * directions and no page has to know which is which.
 */

import type { PhoneNumberRecord } from "@/content/workspace";
import { apiFetch } from "@/lib/api/aotms";

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
});

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
    const query = patch.agentId ? `?employee_id=${encodeURIComponent(patch.agentId)}` : "";
    row = await apiFetch<PhoneNumberRow>(`/phone-numbers/${id}/assign${query}`, {
      method: "POST",
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
