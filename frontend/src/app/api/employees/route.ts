import { connection, NextResponse } from "next/server";

import { createEmployee, listEmployees, type NewEmployeeInput } from "@/lib/api/employees";
import { failure } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * The browser's only route to the employee database. FastAPI stays server-side
 * and every call carries the signed-in workspace's own backend token.
 */
export async function GET() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    return NextResponse.json({ items: await listEmployees() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  let payload: NewEmployeeInput;
  try {
    payload = (await request.json()) as NewEmployeeInput;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
      { status: 400 },
    );
  }

  if (!payload?.name?.trim()) {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Give your employee a name." } },
      { status: 400 },
    );
  }

  try {
    // The backend creates the employee and its Sarvam deployment in one call,
    // so the returned agent already carries `providerAgent`.
    return NextResponse.json({ agent: await createEmployee(payload) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
