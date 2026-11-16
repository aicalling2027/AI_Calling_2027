import { connection, NextResponse } from "next/server";

import { attachPhoneNumber } from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

/**
 * Record a number that was rented in the Sarvam console.
 *
 * Nothing is bought here: the line is already rented and billed by the console,
 * and this only records it against the workspace so calls can be routed to an
 * employee. The backend refuses a number another workspace holds (409) and
 * answers with the existing row when it is already attached, so a retry or a
 * double-click cannot create a second copy.
 */
export async function POST(request: Request) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  let payload: {
    number?: string;
    label?: string;
    countryCode?: string;
    employeeId?: string | null;
    capabilities?: string[];
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
      { status: 400 },
    );
  }

  const number = payload?.number?.trim();
  if (!number) {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Enter the number you rented." } },
      { status: 400 },
    );
  }

  try {
    const attached = await attachPhoneNumber({
      number,
      label: payload.label,
      countryCode: payload.countryCode,
      employeeId: payload.employeeId ?? null,
      capabilities: payload.capabilities,
    });
    return NextResponse.json({ attach: attached });
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
