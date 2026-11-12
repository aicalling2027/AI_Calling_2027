import { connection, NextResponse } from "next/server";

import { type Agent } from "@/content/workspace";
import {
  deployEmployeeAgent,
  getEmployee,
  setEmployeeStatus,
  updateEmployee,
} from "@/lib/api/employees";
import { failure } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

type RouteContext = { params: Promise<{ id: string }> };

/** One employee, read straight from the database. */
export async function GET(_request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;
  try {
    return NextResponse.json({ agent: await getEmployee(id) });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Save an edit. A status change goes to its own endpoint because the backend
 * mirrors activation onto the Sarvam deployment; everything else is a patch.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;

  let patch: Partial<Agent>;
  try {
    patch = (await request.json()) as Partial<Agent>;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
      { status: 400 },
    );
  }

  const { status, ...rest } = patch ?? {};
  try {
    let agent = await getEmployee(id);

    if (status && status !== agent.status) {
      agent = await setEmployeeStatus(id, status);
    }
    if (Object.keys(rest).length > 0) {
      agent = await updateEmployee(id, rest);
    }
    return NextResponse.json({ agent });
  } catch (error) {
    return failure(error);
  }
}

/** Deploy (or re-deploy) the Sarvam agent behind this employee. */
export async function POST(_request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;
  try {
    return NextResponse.json({ agent: await deployEmployeeAgent(id) });
  } catch (error) {
    return failure(error);
  }
}
