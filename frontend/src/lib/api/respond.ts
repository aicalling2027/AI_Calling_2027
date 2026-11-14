import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/aotms";

/**
 * Turn a failed backend call into a response for the browser.
 *
 * A rejected service credential or an unreachable API is our problem, not the
 * visitor's session, so those surface as 502 instead of a misleading 401.
 */
export type FailureScope = {
  /** Log tag, e.g. `leads` reads as `[api/leads]`. */
  tag: string;
  code: string;
  message: string;
};

const EMPLOYEE_SCOPE: FailureScope = {
  tag: "employees",
  code: "employees_unavailable",
  message: "The employee service is unavailable. Try again in a moment.",
};

export const LEAD_SCOPE: FailureScope = {
  tag: "leads",
  code: "leads_unavailable",
  message: "The lead service is unavailable. Try again in a moment.",
};

export function failure(error: unknown, scope: FailureScope = EMPLOYEE_SCOPE): NextResponse {
  if (error instanceof ApiError) {
    const upstreamAuth = error.status === 401 || error.status === 403;
    const status = upstreamAuth || error.status >= 500 ? 502 : error.status;
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status },
    );
  }

  console.error(`[api/${scope.tag}]`, error);
  return NextResponse.json(
    { error: { code: scope.code, message: scope.message } },
    { status: 500 },
  );
}
