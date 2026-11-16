import { connection, NextResponse } from "next/server";

import {
  type PhoneNumberPatch,
  releasePhoneNumber,
  updatePhoneNumber,
} from "@/lib/api/phone-numbers";
import { failure, NUMBERS_SCOPE } from "@/lib/api/respond";
import { guardSession } from "@/lib/api/session";

type RouteContext = { params: Promise<{ id: string }> };

/** Rename a line, or switch it between inbound, outbound and both. */
export async function PATCH(request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;

  let patch: PhoneNumberPatch;
  try {
    patch = (await request.json()) as PhoneNumberPatch;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "The request body was not valid JSON." } },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ number: await updatePhoneNumber(id, patch ?? {}) });
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}

/**
 * Release a line.
 *
 * The number goes back to the pool and can be bought again; the row is removed
 * with it, so this is the one action on the screen that cannot be undone. Call
 * records keep their own copy of the number they dialled.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  await connection();

  const denied = await guardSession();
  if (denied) return denied;

  const { id } = await params;
  try {
    await releasePhoneNumber(id);
    return NextResponse.json({ message: "Phone number released." });
  } catch (error) {
    return failure(error, NUMBERS_SCOPE);
  }
}
