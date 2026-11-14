import { connection, NextResponse } from "next/server";

import { deleteLeadRecord, toLeadView, updateLeadRecord } from "@/lib/api/leads";
import { failure, LEAD_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";
import { readLeadPatch, validateLeadPatch } from "@/lib/lead-import";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Save the edits made in one lead's row.
 *
 * The body is re-read and re-checked here rather than trusted from the browser,
 * using the same rules the edit dialog applied a moment earlier.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
      { status: 400 },
    );
  }

  const patch = readLeadPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "There was nothing to change." } },
      { status: 400 },
    );
  }

  const problems = validateLeadPatch(patch);
  if (problems.length > 0) {
    return NextResponse.json(
      { error: { code: "invalid_lead", message: problems.join(" ") } },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ lead: toLeadView(await updateLeadRecord(id, patch)) });
  } catch (error) {
    return failure(error, LEAD_SCOPE);
  }
}

/** Remove a lead from the queue. Its contact is left alone. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;

  try {
    await deleteLeadRecord(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, LEAD_SCOPE);
  }
}
