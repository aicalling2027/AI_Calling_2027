import { connection, NextResponse } from "next/server";

import { importEmployees } from "@/lib/api/employees";
import { failure } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * Pull the agents that already exist in the Sarvam workspace in as employees.
 *
 * Nothing is deployed or deleted here: each remote deployment is linked to an
 * employee, so running this again only refreshes what changed on Sarvam.
 */
export async function POST() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    return NextResponse.json(await importEmployees());
  } catch (error) {
    return failure(error);
  }
}
