import { connection, NextResponse } from "next/server";

import { listAvailableNumbers } from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * The shelf behind the purchase form: numbers no workspace holds yet, filtered
 * by the country, city, capability and digits the form is asking about.
 */
export async function GET(request: Request) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(
      {
        numbers: await listAvailableNumbers({
          countryCode: params.get("country_code") ?? undefined,
          region: params.get("region") ?? undefined,
          capability: params.get("capability") ?? undefined,
          query: params.get("q") ?? undefined,
          limit: Number(params.get("limit") ?? 24) || 24,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
