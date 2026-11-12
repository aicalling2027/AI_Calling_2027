import { connection, NextResponse } from "next/server";

import { dedupeEmployees } from "@/lib/api/employees";
import { failure } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * Maintenance: archive employees that repeat a name, keeping the oldest.
 *
 * Nothing is deleted - a repeat is archived and its Sarvam deployment is
 * paused, so the workspace has one agent per name and no call history is lost.
 */
export async function POST() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    return NextResponse.json(await dedupeEmployees());
  } catch (error) {
    return failure(error);
  }
}
