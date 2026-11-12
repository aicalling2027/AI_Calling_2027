import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/aotms";

/**
 * Turn a failed backend call into a response for the browser.
 *
 * A rejected service credential or an unreachable API is our problem, not the
 * visitor's session, so those surface as 502 instead of a misleading 401.
 */
export function failure(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const upstreamAuth = error.status === 401 || error.status === 403;
    const status = upstreamAuth || error.status >= 500 ? 502 : error.status;
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status },
    );
  }

  console.error("[api/employees]", error);
  return NextResponse.json(
    {
      error: {
        code: "employees_unavailable",
        message: "The employee service is unavailable. Try again in a moment.",
      },
    },
    { status: 500 },
  );
}
