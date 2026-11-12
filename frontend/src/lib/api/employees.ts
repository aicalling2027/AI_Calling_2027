/**
 * Employee records: the FastAPI `/api/v1/employees` endpoints translated into
 * the `Agent` shape the dashboard already renders.
 *
 * Everything here runs on the server (Route Handlers only). The mapping is
 * two-way on purpose: the API speaks language codes, model ids and a lowercase
 * lifecycle status, while the UI speaks display names, so a single place owns
 * both directions and no page has to know about either vocabulary.
 */

import {
  type Agent,
  type AgentStatus,
  type ModelId,
  type ProviderAgent,
  initialsOf,
  languageCode,
  languageFromCode,
  modelById,
  toneForIndex,
  voiceById,
} from "@/content/workspace";
import { apiFetch } from "@/lib/api/aotms";

type ProviderAgentRecord = {
  provider: string;
  deployment_id: string | null;
  app_id: string | null;
  app_version: number;
  status: string;
  simulated: boolean;
  synced_at: string | null;
  error: string | null;
};

/** The subset of `EmployeeOut` the dashboard reads. */
export type EmployeeRecord = {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  business_category: string | null;
  system_prompt: string;
  first_message: string | null;
  voice: string;
  model: string;
  default_language: string;
  status: string;
  total_calls: number;
  success_rate: number;
  last_active_at: string | null;
  created_at: string;
  languages: { language_code: string; is_default: boolean }[];
  provider_agent: ProviderAgentRecord | null;
};

type EmployeePage = { items: EmployeeRecord[]; meta?: { total: number } };

export type DedupeResult = { scanned: number; duplicates: number; archivedIds: string[] };

/** Fields the create form collects beyond the plain `NewAgentInput`. */
export type NewEmployeeInput = {
  name: string;
  purpose: string;
  category?: string;
  templateKey?: string;
  languages: string[];
  defaultLanguage: string;
  voiceId: string;
  modelId: ModelId;
  greeting: string;
  prompt: string;
};

// ---------------------------------------------------------------------------
// Backend -> UI
// ---------------------------------------------------------------------------
const STATUS_TO_UI: Record<string, AgentStatus> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  archived: "Draft",
};

const STATUS_TO_API: Record<AgentStatus, string> = {
  Active: "active",
  Paused: "paused",
  Draft: "draft",
};

/** Sarvam-M is the default conversation model; only 2B is a distinct id. */
const modelIdOf = (code: string): ModelId =>
  code === "sarvam-2b" ? "sarvam-2b" : "sarvam-24b";

const modelCodeOf = (id: ModelId): string => (id === "sarvam-2b" ? "sarvam-2b" : "sarvam-m");

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Never";

  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function providerAgent(record: ProviderAgentRecord | null): ProviderAgent | null {
  if (!record) return null;
  return {
    provider: record.provider,
    deploymentId: record.deployment_id,
    appId: record.app_id,
    appVersion: record.app_version,
    status: record.status,
    simulated: record.simulated,
    syncedAt: record.synced_at,
    error: record.error,
  };
}

/** Stable per employee: a renamed card must not change colour. */
function toneFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return toneForIndex(hash);
}

export function toAgent(record: EmployeeRecord): Agent {
  const languages = Array.from(
    new Set(record.languages.map((entry) => languageFromCode(entry.language_code))),
  );
  if (languages.length === 0) languages.push(languageFromCode(record.default_language));

  const modelId = modelIdOf(record.model);
  return {
    id: record.id,
    name: record.name,
    purpose: record.purpose ?? record.description ?? "AI employee",
    initials: initialsOf(record.name),
    tone: toneFor(record.id),
    status: STATUS_TO_UI[record.status] ?? "Draft",
    languages,
    defaultLanguage: languageFromCode(record.default_language),
    voice: voiceById(record.voice).name,
    voiceId: record.voice,
    model: modelById(modelId).name,
    modelId,
    calls: record.total_calls,
    successRate: Math.round(record.success_rate ?? 0),
    lastActive: relativeTime(record.last_active_at),
    greeting: record.first_message ?? "",
    prompt: record.system_prompt ?? "",
    // Knowledge and actions live in their own modules; the employee screen
    // starts from the record itself rather than inventing rows.
    knowledge: [],
    actions: [],
    outcomes: [],
    createdAt: formatDate(record.created_at),
    providerAgent: providerAgent(record.provider_agent),
  };
}

// ---------------------------------------------------------------------------
// UI -> backend
// ---------------------------------------------------------------------------
function languageSet(
  names: string[],
  defaultLanguage: string,
): { language_code: string; is_default: boolean }[] {
  const list = names.length ? names : [defaultLanguage];
  const codes = Array.from(new Set(list.map(languageCode)));
  // Exactly one row is the default, and it is the one the form marked.
  const defaultCode = languageCode(
    list.includes(defaultLanguage) ? defaultLanguage : list[0],
  );
  return codes.map((code, index) => ({
    language_code: code,
    is_default: code === defaultCode && codes.indexOf(defaultCode) === index,
  }));
}

export function toCreateBody(input: NewEmployeeInput) {
  return {
    name: input.name.trim(),
    purpose: input.purpose || undefined,
    business_category: input.category || undefined,
    template_key: input.templateKey || undefined,
    system_prompt: input.prompt,
    first_message: input.greeting.trim() || undefined,
    voice: input.voiceId,
    model: modelCodeOf(input.modelId),
    default_language: languageCode(input.defaultLanguage),
    languages: languageSet(input.languages, input.defaultLanguage),
  };
}

/**
 * Only fields the backend stores are sent. Actions and outcomes are still
 * local to the browser - they have no column yet - so they are dropped here
 * rather than silently rejected by the API's `extra="forbid"` schemas.
 */
export function toPatchBody(patch: Partial<Agent>) {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.purpose !== undefined) body.purpose = patch.purpose;
  if (patch.prompt !== undefined) body.system_prompt = patch.prompt;
  if (patch.greeting !== undefined) body.first_message = patch.greeting;
  if (patch.voiceId !== undefined) body.voice = patch.voiceId;
  if (patch.modelId !== undefined) body.model = modelCodeOf(patch.modelId);
  if (patch.defaultLanguage !== undefined) {
    body.default_language = languageCode(patch.defaultLanguage);
  }
  if (patch.languages !== undefined && patch.languages.length) {
    body.languages = languageSet(
      patch.languages,
      patch.defaultLanguage ?? patch.languages[0],
    );
  }
  return body;
}

export const statusForApi = (status: AgentStatus) => STATUS_TO_API[status];

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export async function listEmployees(): Promise<Agent[]> {
  const page = await apiFetch<EmployeePage>("/employees?page=1&page_size=100");
  return page.items.map(toAgent);
}

export async function getEmployee(id: string): Promise<Agent> {
  return toAgent(await apiFetch<EmployeeRecord>(`/employees/${id}`));
}

export async function createEmployee(input: NewEmployeeInput): Promise<Agent> {
  const record = await apiFetch<EmployeeRecord>("/employees", {
    method: "POST",
    body: toCreateBody(input),
  });
  return toAgent(record);
}

export async function updateEmployee(id: string, patch: Partial<Agent>): Promise<Agent> {
  const record = await apiFetch<EmployeeRecord>(`/employees/${id}`, {
    method: "PATCH",
    body: toPatchBody(patch),
  });
  return toAgent(record);
}

export async function setEmployeeStatus(id: string, status: AgentStatus): Promise<Agent> {
  const record = await apiFetch<EmployeeRecord>(`/employees/${id}/status`, {
    method: "POST",
    body: { status: statusForApi(status) },
  });
  return toAgent(record);
}

/** Re-run the Sarvam deployment for an employee (same agent, same number). */
export async function deployEmployeeAgent(id: string): Promise<Agent> {
  const record = await apiFetch<EmployeeRecord>(`/employees/${id}/agent`, {
    method: "POST",
  });
  return toAgent(record);
}

export async function dedupeEmployees(): Promise<DedupeResult> {
  const result = await apiFetch<{
    scanned: number;
    duplicates: number;
    archived_ids: string[];
  }>("/employees/dedupe", { method: "POST" });
  return {
    scanned: result.scanned,
    duplicates: result.duplicates,
    archivedIds: result.archived_ids,
  };
}
