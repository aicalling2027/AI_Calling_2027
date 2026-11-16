import { connection, NextResponse } from "next/server";

import { purchasePhoneNumber } from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

const invalidBody = () =>
  NextResponse.json(
    { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
    { status: 400 },
  );

/**
 * Buy a number from the shelf.
 *
 * The price, the country and the provider all come from the catalogue on the
 * server: the browser sends which number it chose and who answers it, nothing
 * that decides what it costs. A refusal (plan include used up, number already
 * taken) arrives with the backend's own message, which the form prints as-is.
 */
export async function POST(request: Request) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  let payload: {
    number?: string;
    label?: string;
    employeeId?: string | null;
    capabilities?: string[];
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return invalidBody();
  }

  const number = payload?.number?.trim();
  if (!number) {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Choose a number to buy." } },
      { status: 400 },
    );
  }

  try {
    const bought = await purchasePhoneNumber({
      number,
      label: payload.label,
      employeeId: payload.employeeId ?? null,
      capabilities: payload.capabilities ?? ["inbound", "outbound"],
    });
    return NextResponse.json({ purchase: bought }, { status: 201 });
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
