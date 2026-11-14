import { connection, NextResponse } from "next/server";

import { createLead, listLeads, toLeadView } from "@/lib/api/leads";
import { failure, LEAD_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";
import type { LeadStatus } from "@/content/workspace";
import { LEAD_STATUS_OPTIONS, readLeadDraft, validateLeadDraft } from "@/lib/lead-import";

/** Every lead in the workspace, already in the shape the dashboard renders. */
export async function GET() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    const records = await listLeads();
    return NextResponse.json({ items: records.map(toLeadView) });
  } catch (error) {
    return failure(error, LEAD_SCOPE);
  }
}

/**
 * Save one lead typed by hand on the Instant Leads screen.
 *
 * The same validator the upload preview uses runs here, so a row cannot be
 * called valid in the browser and rejected a moment later by the server.
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

  const payload = (body ?? {}) as {
    employeeId?: unknown;
    source?: unknown;
    notes?: unknown;
    status?: unknown;
  };
  const lead = readLeadDraft(body);
  const problems = validateLeadDraft(lead);

  if (problems.length > 0) {
    return NextResponse.json(
      { error: { code: "invalid_lead", message: problems.join(" ") } },
      { status: 400 },
    );
  }

  const employeeId = typeof payload.employeeId === "string" ? payload.employeeId : null;
  // The dashboard's own wording for where the lead came from; the client maps
  // it to the backend's enum and falls back to "instant" for anything else.
  const source = typeof payload.source === "string" ? payload.source : undefined;
  // The call outcome, when the lead is captured after a call rather than
  // before one.
  const notes = typeof payload.notes === "string" ? payload.notes : undefined;
  // A lead captured after its first call arrives already in the funnel; only
  // the labels the dashboard actually offers are accepted.
  const status =
    typeof payload.status === "string" &&
    (LEAD_STATUS_OPTIONS as readonly string[]).includes(payload.status)
      ? (payload.status as LeadStatus)
      : undefined;

  try {
    const stored = await createLead({
      lead,
      employeeId,
      source,
      notes,
      status,
      detail: "instant_leads_manual",
    });
    return NextResponse.json({ lead: toLeadView(stored) }, { status: 201 });
  } catch (error) {
    return failure(error, LEAD_SCOPE);
  }
}
