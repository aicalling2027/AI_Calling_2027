import { connection, NextResponse } from "next/server";

import { importLeads, type LeadImportError } from "@/lib/api/leads";
import { failure, LEAD_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";
import {
  MAX_IMPORT_ROWS,
  readLeadDraft,
  validateLeadDraft,
} from "@/lib/lead-import";

/**
 * Import a reviewed lead sheet.
 *
 * Rows are re-checked here rather than trusted from the browser. Anything that
 * fails is reported with its position in the sheet instead of being dropped
 * quietly, and the rest of the file still imports.
 */
export async function POST(request: Request) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
      { status: 400 },
    );
  }

  const payload = (body ?? {}) as { leads?: unknown; employeeId?: unknown };
  const incoming = Array.isArray(payload.leads) ? payload.leads : [];

  if (incoming.length === 0) {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Add at least one lead to import." } },
      { status: 400 },
    );
  }

  if (incoming.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      {
        error: {
          code: "too_many_rows",
          message: `One import can hold ${MAX_IMPORT_ROWS} leads. Split the file and upload the rest.`,
        },
      },
      { status: 400 },
    );
  }

  const accepted: ReturnType<typeof readLeadDraft>[] = [];
  const rejected: LeadImportError[] = [];

  incoming.forEach((row, index) => {
    const lead = readLeadDraft(row);
    const problems = validateLeadDraft(lead);
    if (problems.length > 0) {
      rejected.push({ row: index + 1, phone: lead.phone, error: problems.join(" ") });
      return;
    }
    accepted.push(lead);
  });

  const employeeId =
    typeof payload.employeeId === "string" ? payload.employeeId : null;

  try {
    const summary = await importLeads({
      leads: accepted,
      employeeId,
      detail: "instant_leads_upload",
    });

    return NextResponse.json({
      created: summary.created,
      skipped: summary.skipped + rejected.length,
      errors: [...rejected, ...summary.errors],
      createdPhones: summary.createdPhones,
      leadIds: summary.leadIds,
    });
  } catch (error) {
    return failure(error, LEAD_SCOPE);
  }
}
