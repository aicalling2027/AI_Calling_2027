/**
 * The lead sheet contract: Name, Email, Phone, Identity.
 *
 * Parsing and validation live here rather than in the page because two callers
 * need the exact same rules - the upload preview in the browser and the Route
 * Handler that forwards rows to FastAPI. A row that the preview called valid
 * must not be rejected a millisecond later by the server.
 */

import type { LeadStatus } from "@/content/workspace";

export type LeadImportField = "name" | "email" | "phone" | "identity";

/** One lead as the operator typed or uploaded it. */
export type LeadDraft = {
  name: string;
  email: string;
  phone: string;
  identity: string;
};

export type ParsedLeadRow = {
  /** 1-based line in the file, so a complaint points at something findable. */
  line: number;
  lead: LeadDraft;
  problems: string[];
};

export type LeadParseResult = {
  rows: ParsedLeadRow[];
  /** Columns found in the file that no field claimed. */
  ignoredHeaders: string[];
  /** Required columns the file does not appear to contain. */
  missingFields: LeadImportField[];
};

/** The funnel labels a lead can be moved to from the dashboard. */
export const LEAD_STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Qualified",
  "Appointment",
  "Not interested",
] as const satisfies readonly LeadStatus[];

/** What the edit dialog may change. An absent key means "leave it alone". */
export type LeadPatchDraft = {
  name?: string;
  phone?: string;
  email?: string;
  identity?: string;
  status?: LeadStatus;
  agentId?: string | null;
};

export const LEAD_IMPORT_FIELDS: {
  key: LeadImportField;
  label: string;
  required: boolean;
  hint: string;
}[] = [
  { key: "name", label: "Name", required: true, hint: "Who the employee should greet" },
  { key: "email", label: "Email", required: false, hint: "Optional, used for confirmations" },
  { key: "phone", label: "Phone", required: true, hint: "10+ digits, country code welcome" },
  { key: "identity", label: "Identity", required: false, hint: "Your own reference for this customer" },
];

/** The header row a downloaded template contains. */
export const CSV_HEADER = "Name,Email,Phone,Identity";

/** Matches the backend's per-import ceiling, so nothing is dropped silently. */
export const MAX_IMPORT_ROWS = 5000;

export const CSV_ACCEPT = ".csv,text/csv";

/**
 * Column names people actually write in a sheet, normalised by
 * `normaliseHeader`. Order matters only for readability.
 */
const HEADER_ALIASES: Record<LeadImportField, string[]> = {
  name: ["name", "fullname", "contactname", "contact", "customer", "customername", "lead", "leadname"],
  email: ["email", "emailaddress", "mail", "emailid", "emailaddress1"],
  phone: [
    "phone",
    "phonenumber",
    "mobile",
    "mobilenumber",
    "whatsapp",
    "whatsappnumber",
    "number",
    "contactnumber",
    "tel",
    "telephone",
  ],
  identity: [
    "identity",
    "identitynumber",
    "id",
    "customerid",
    "customeridentity",
    "externalid",
    "policy",
    "policynumber",
    "applicationid",
    "accountnumber",
    "reference",
  ],
};

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** RFC 4180-ish reader: quotes, doubled quotes, CRLF, and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // Swallowed: the following \n ends the row, and a lone \r would too.
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function mapHeaders(headerCells: string[]): Partial<Record<LeadImportField, number>> {
  const mapping: Partial<Record<LeadImportField, number>> = {};
  headerCells.forEach((cell, index) => {
    const normalised = normaliseHeader(cell);
    if (!normalised) return;
    (Object.keys(HEADER_ALIASES) as LeadImportField[]).forEach((field) => {
      if (mapping[field] !== undefined) return;
      if (HEADER_ALIASES[field].includes(normalised)) {
        mapping[field] = index;
      }
    });
  });
  return mapping;
}

/** The no-surprises default: the columns in their documented order. */
function positionalMapping(): Partial<Record<LeadImportField, number>> {
  return { name: 0, email: 1, phone: 2, identity: 3 };
}

export function blankLeadDraft(): LeadDraft {
  return { name: "", email: "", phone: "", identity: "" };
}

/**
 * The digits that identify a number however it was typed.
 *
 * The server strips punctuation before storing, so `+91 98204 11822` and
 * `+919820411822` are the same lead and must compare equal here too.
 */
export function phoneKey(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

/** Coerce an untrusted request body into a draft, so the routes never guess. */
export function readLeadDraft(value: unknown): LeadDraft {
  const record = (value ?? {}) as Record<string, unknown>;
  const text = (key: keyof LeadDraft) =>
    typeof record[key] === "string" ? (record[key] as string).trim() : "";
  return {
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    identity: text("identity"),
  };
}

function cell(cells: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (cells[index] ?? "").trim();
}

export function validateLeadDraft(draft: LeadDraft): string[] {
  const problems: string[] = [];

  if (draft.name.trim().length < 2) {
    problems.push("Name is missing.");
  }
  if (draft.name.trim().length > 160) {
    problems.push("Name is longer than 160 characters.");
  }

  const digits = draft.phone.replace(/\D/g, "");
  if (digits.length < 10) {
    problems.push("Phone needs at least 10 digits.");
  }

  if (draft.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) {
      problems.push("Email does not look like an address.");
    } else if (draft.email.trim().length > 255) {
      problems.push("Email is longer than 255 characters.");
    }
  }

  if (draft.identity.trim().length > 64) {
    problems.push("Identity is longer than 64 characters.");
  }

  return problems;
}

/** Coerce an edit body into a patch, keeping only the values we understand. */
export function readLeadPatch(value: unknown): LeadPatchDraft {
  const record = (value ?? {}) as Record<string, unknown>;
  const patch: LeadPatchDraft = {};

  for (const key of ["name", "email", "phone", "identity"] as const) {
    const field = record[key];
    if (typeof field === "string") patch[key] = field.trim();
  }

  const status = record.status;
  if (
    typeof status === "string" &&
    (LEAD_STATUS_OPTIONS as readonly string[]).includes(status)
  ) {
    patch.status = status as LeadStatus;
  }

  if (typeof record.agentId === "string") patch.agentId = record.agentId;
  else if (record.agentId === null) patch.agentId = null;

  return patch;
}

/** The same rules as a new row, applied only to the fields that were sent. */
export function validateLeadPatch(patch: LeadPatchDraft): string[] {
  const problems: string[] = [];

  if (patch.name !== undefined && (patch.name.length < 2 || patch.name.length > 160)) {
    problems.push("Name needs between 2 and 160 characters.");
  }

  if (patch.phone !== undefined && patch.phone.replace(/\D/g, "").length < 10) {
    problems.push("Phone needs at least 10 digits.");
  }

  if (patch.email !== undefined) {
    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(patch.email)) {
      problems.push("Email does not look like an address.");
    } else if (patch.email.length > 255) {
      problems.push("Email is longer than 255 characters.");
    }
  }

  if (patch.identity !== undefined && patch.identity.length > 64) {
    problems.push("Identity is longer than 64 characters.");
  }

  return problems;
}

/**
 * Read a whole sheet into reviewable rows.
 *
 * A file whose first row is not a header is read positionally as
 * Name/Email/Phone/Identity, which is the order the template ships in.
 */
export function parseLeadCsv(text: string): LeadParseResult {
  const table = parseCsv(text);

  if (table.length === 0) {
    return { rows: [], ignoredHeaders: [], missingFields: ["name", "phone"] };
  }

  const headerMapping = mapHeaders(table[0]);
  const hasHeader = headerMapping.name !== undefined || headerMapping.phone !== undefined;
  const mapping = hasHeader ? headerMapping : positionalMapping();
  const body = hasHeader ? table.slice(1) : table;

  const claimed = new Set(Object.values(mapping));
  const ignoredHeaders = hasHeader
    ? table[0].filter((_, index) => !claimed.has(index) && table[0][index].trim() !== "")
    : [];

  const missingFields = (["name", "phone"] as LeadImportField[]).filter(
    (field) => mapping[field] === undefined,
  );

  const rows: ParsedLeadRow[] = body.slice(0, MAX_IMPORT_ROWS).map((cells, index) => {
    const lead: LeadDraft = {
      name: cell(cells, mapping.name),
      email: cell(cells, mapping.email),
      phone: cell(cells, mapping.phone),
      identity: cell(cells, mapping.identity),
    };
    return {
      line: (hasHeader ? index + 2 : index + 1),
      lead,
      problems: validateLeadDraft(lead),
    };
  });

  return { rows, ignoredHeaders, missingFields };
}

/** Rows that passed review - the only thing worth sending to the server. */
export function validLeads(rows: ParsedLeadRow[]): LeadDraft[] {
  return rows.filter((row) => row.problems.length === 0).map((row) => row.lead);
}
