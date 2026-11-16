import { connection, NextResponse } from "next/server";

import { listMarkets } from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * Where a number can be bought: the countries, their cities and the price of
 * each. The purchase form reads this instead of carrying its own copy, so a
 * market added on the server shows up in the picker without a code change.
 */
export async function GET() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    return NextResponse.json(
      { markets: await listMarkets() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
