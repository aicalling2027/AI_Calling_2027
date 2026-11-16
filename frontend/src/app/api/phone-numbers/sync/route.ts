import { connection, NextResponse } from "next/server";

import { getInventorySummary } from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * The inventory counts for this workspace, read server-side.
 *
 * The path is kept because the panel has always read it, but there is no
 * carrier behind it: Sarvam has no API for rented numbers, so the answer says
 * `manual` and describes only the rows stored here. `no-store` matters - a
 * cached count would keep saying "3 numbers" after one was attached.
 */
export async function GET() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    return NextResponse.json(
      { inventory: await getInventorySummary() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
