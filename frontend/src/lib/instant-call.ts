/**
 * How one reported outcome becomes the rest of the record.
 *
 * An instant lead is placed from two screens - the Instant Leads page and an
 * employee's own workspace - and both must land the same status, follow-up and
 * sentiment for the same words. Keeping that mapping here is what stops the
 * two forms drifting apart.
 */

import type { Lead, LeadStatus } from "@/content/workspace";

export const CALL_STEPS = [
  "Queued",
  "Dialling the number",
  "Connected",
  "Completing the call",
];

/** Used only while an employee has not declared its own outcome list. */
export const DEFAULT_OUTCOMES = [
  "Interested",
  "Callback requested",
  "Appointment scheduled",
  "Not interested",
  "No answer",
];

export type CallSentiment = "Positive" | "Neutral" | "Negative" | "Unknown";

export type CallPlan = {
  /** A call that was never picked up must not look like a completed one. */
  connected: boolean;
  status: LeadStatus;
  followUp: string;
  sentiment: CallSentiment;
  /** The last thing the employee says, kept for the transcript. */
  closing: string;
};

/**
 * Turns the one outcome an employee reports into the lead status, the
 * follow-up slot and the last line of the transcript. Ordered so
 * "not interested" is matched before "interested", and "unqualified" before
 * "qualified".
 */
export function planFor(outcome: string): CallPlan {
  const key = outcome.toLowerCase();

  if (key.includes("appointment") || key.includes("booked")) {
    return {
      connected: true,
      status: "Appointment",
      followUp: "Tomorrow, 11:00 am",
      sentiment: "Positive",
      closing: "I have booked that slot and sent the confirmation on WhatsApp.",
    };
  }
  if (key.includes("no answer") || key.includes("failed") || key.includes("unreachable")) {
    return {
      connected: false,
      status: "Contacted",
      followUp: "Today, 7:00 pm",
      sentiment: "Unknown",
      closing:
        "No answer after 30 seconds. The script was not played and a retry is booked for the evening slot.",
    };
  }
  if (
    key.includes("not interested") ||
    key.includes("unqualified") ||
    key.includes("not qualified") ||
    key.includes("do not call")
  ) {
    return {
      connected: true,
      status: "Not interested",
      followUp: "No follow-up",
      sentiment: "Negative",
      closing: "Understood. I have noted that and will not call again.",
    };
  }
  if (
    key.includes("callback") ||
    key.includes("call back") ||
    key.includes("follow-up") ||
    key.includes("follow up") ||
    key.includes("transfer") ||
    key.includes("human")
  ) {
    return {
      connected: true,
      status: "Contacted",
      followUp: "Today, 6:00 pm",
      sentiment: "Neutral",
      closing: "Theek hai, main aapko suggest kiye gaye samay par call karwa dunga.",
    };
  }
  return {
    connected: true,
    status: "Qualified",
    followUp: "Today, 4:00 pm",
    sentiment: "Positive",
    closing: "I have shared the details on WhatsApp and noted everything in the system.",
  };
}

/**
 * Whether a row belongs under "Recent instant leads".
 *
 * The screen writes "Instant leads" and reads back the backend's `instant`
 * enum. Comparing on the word rather than the exact label means a naming
 * change on either side cannot silently hide every row the user just created.
 */
export function isInstantLead(lead: Lead): boolean {
  return lead.source.trim().toLowerCase().includes("instant");
}
