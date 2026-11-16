import { connection, NextResponse } from "next/server";

import { listPhoneNumbers } from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * The browser's only route to the phone number inventory. FastAPI stays
 * server-side and every call carries the signed-in workspace's own token.
 */
export async function GET() {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  try {
    // A cached copy would show the previous list until the CDN revalidates,
    // which reads as "the number I just bought vanished".
    return NextResponse.json(
      { items: await listPhoneNumbers() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
