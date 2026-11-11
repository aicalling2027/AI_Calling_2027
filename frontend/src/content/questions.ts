/**
 * Question library — the content behind /questions and /questions/[slug].
 *
 * PLACEHOLDER policy: answers describe intended behaviour and are explicit
 * where a fact is not yet confirmed. No prices, volumes or timelines are
 * invented; anything unknown is labelled as pending.
 */

import type { Block } from "@/components/sections/prose";

export type QuestionEntry = {
  slug: string;
  question: string;
  /** One-line answer used on the index page. */
  short: string;
  topic: Topic;
  answer: Block[];
};

export const topics = [
  "Getting started",
  "Capability",
  "Pricing",
  "Compliance",
  "Integration",
] as const;

export type Topic = (typeof topics)[number];

export const questions: QuestionEntry[] = [
  {
    slug: "what-is-an-ai-voice-employee",
    question: "What is an AI voice employee?",
    short:
      "A configured system that holds a spoken phone conversation and hands the outcome to a person.",
    topic: "Getting started",
    answer: [
      {
        type: "paragraph",
        text: "An AI voice employee is not a chatbot with a microphone. It is a configuration of three things: a purpose, a script and a set of rules for handing over.",
      },
      {
        type: "list",
        items: [
          "Purpose — why the call exists (answer, qualify, remind, follow up)",
          "Script — the questions and the answers it is allowed to give",
          "Handover — the conditions under which a person takes over",
        ],
      },
      {
        type: "paragraph",
        text: "Everything else — the voice, the language, the retry behaviour — is a setting on top of those three.",
      },
    ],
  },
  {
    slug: "how-fast-can-we-start",
    question: "How quickly can we get started?",
    short:
      "Setup time depends on the script and the number; no timeline is published yet.",
    topic: "Getting started",
    answer: [
      {
        type: "paragraph",
        text: "The blocking dependency is usually the script, not the technology. Someone on your side has to decide what the AI employee is allowed to say.",
      },
      {
        type: "ordered",
        items: [
          "Define one use case and the questions it must ask",
          "Review the script with the AOTMS team",
          "Connect a number and place a test call",
          "Run the first week and read the transcripts",
        ],
      },
      {
        type: "note",
        text: "A confirmed setup timeline has not been published. Ask for one when you request access.",
      },
    ],
  },
  {
    slug: "how-much-does-it-cost",
    question: "How much does it cost?",
    short:
      "Pricing is quoted per account on volume, languages and channels — no public price list yet.",
    topic: "Pricing",
    answer: [
      {
        type: "paragraph",
        text: "AOTMS does not publish a price list. Accounts are quoted individually because call volume, language coverage and number requirements change the cost materially.",
      },
      {
        type: "paragraph",
        text: "Ask for a written quote with its unit basis stated — usually per conversation or per successful outcome. Never accept a headline price without the basis attached.",
      },
      {
        type: "note",
        text: "See the pricing page for what the quote depends on.",
      },
    ],
  },
  {
    slug: "which-languages-are-supported",
    question: "Which languages are supported?",
    short:
      "A catalogue is planned across Indian languages; the final list is not published yet.",
    topic: "Capability",
    answer: [
      {
        type: "paragraph",
        text: "The intended catalogue covers major Indian languages including Hindi, English, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali and Gujarati.",
      },
      {
        type: "paragraph",
        text: "That list is a plan, not a published commitment. Quality differs by language and provider, so evaluate the specific language you intend to use rather than assuming parity.",
      },
      {
        type: "list",
        items: [
          "Test with the accents your callers actually have",
          "Test code-mixed sentences, not only clean scripted lines",
          "Ask what happens when the caller switches language mid-call",
        ],
      },
    ],
  },
  {
    slug: "can-it-use-our-existing-number",
    question: "Can it use our existing business number?",
    short:
      "The intended setup routes an existing number to the AI employee; carrier requirements are confirmed per account.",
    topic: "Capability",
    answer: [
      {
        type: "paragraph",
        text: "Routing an existing number is the intended pattern, so callers do not see a new number appear in their call history.",
      },
      {
        type: "paragraph",
        text: "The exact carrier and telephony requirements depend on your provider and are confirmed during scoping. Some setups require a forwarding rule rather than a new number.",
      },
    ],
  },
  {
    slug: "what-happens-when-the-ai-cannot-answer",
    question: "What happens when the AI cannot answer?",
    short:
      "Escalation is configured per script: transfer to a person, offer a callback, or end with a recorded summary.",
    topic: "Capability",
    answer: [
      {
        type: "paragraph",
        text: "Every script defines its own fallback. There is no single global behaviour, because a collections call and an appointment booking fail differently.",
      },
      {
        type: "list",
        items: [
          "Transfer to a person with the transcript so far",
          "Offer a callback and record the preferred window",
          "End politely and flag the call for human follow-up",
        ],
      },
      {
        type: "paragraph",
        text: "Whichever you choose, the caller should never be left in a loop or told something that is not true.",
      },
    ],
  },
  {
    slug: "are-calls-recorded",
    question: "Are calls recorded?",
    short:
      "Recording, consent and retention are configured before a call is placed; default periods are not published.",
    topic: "Compliance",
    answer: [
      {
        type: "paragraph",
        text: "Calls produce a transcript, and recording is a setting rather than a fixed behaviour. Both are controlled by the policy applied to the account.",
      },
      {
        type: "paragraph",
        text: "Retention is a business decision as much as a legal one: long enough to review and audit, no longer than necessary. A default retention period for AOTMS accounts has not been published.",
      },
    ],
  },
  {
    slug: "how-do-you-handle-consent-and-dnd",
    question: "How are consent and the DND registry handled?",
    short:
      "Registry checks and consent records are applied before outbound calls; the exact workflow is confirmed per account.",
    topic: "Compliance",
    answer: [
      {
        type: "paragraph",
        text: "Outbound calling is regulated. Numbers on a do-not-disturb registry and contacts without consent must be excluded before a campaign runs, not filtered afterwards.",
      },
      {
        type: "paragraph",
        text: "The requirement varies by jurisdiction and by the purpose of the call. Confirm the rules that apply to your business, and keep the consent record with the call record so the trail is auditable.",
      },
      {
        type: "note",
        text: "The specific compliance workflow for AOTMS accounts is still being documented. Do not rely on this page as legal advice.",
      },
    ],
  },
  {
    slug: "does-it-integrate-with-our-crm",
    question: "Does it integrate with our CRM?",
    short:
      "Outcome write-back is part of the intended design; the confirmed integration list is not published.",
    topic: "Integration",
    answer: [
      {
        type: "paragraph",
        text: "The design principle is one record per contact. When a call ends, the outcome, transcript and summary should be written back to the system your team already works in.",
      },
      {
        type: "paragraph",
        text: "The mechanism is a webhook or an API call. The list of systems with a pre-built connector is not published yet — ask before assuming your CRM is covered on day one.",
      },
    ],
  },
  {
    slug: "can-a-human-take-over-mid-call",
    question: "Can a person take over in the middle of a call?",
    short:
      "Yes — transferring with context is the intended handover model, rather than starting the conversation again.",
    topic: "Capability",
    answer: [
      {
        type: "paragraph",
        text: "Handover exists so a caller never has to repeat themselves. The person taking over should receive the transcript so far and the reason the call was escalated.",
      },
      {
        type: "paragraph",
        text: "The trigger can be a rule in the script, an explicit request from the caller, or an outcome that requires judgement.",
      },
    ],
  },
  {
    slug: "what-does-a-pilot-include",
    question: "What does a pilot include?",
    short:
      "One use case, one reviewed script, real transcripts, and a review session on what the calls revealed.",
    topic: "Getting started",
    answer: [
      {
        type: "ordered",
        items: [
          "One conversation type, chosen for volume and repetition",
          "A script reviewed with you before the first call",
          "Transcripts and summaries for every call placed",
          "A review session focused on what the calls actually said",
        ],
      },
      {
        type: "paragraph",
        text: "A pilot is not a demonstration. Its purpose is to produce evidence that one process can be measured and improved.",
      },
      {
        type: "note",
        text: "Commercial terms for a pilot are still being finalised. Ask for them in writing.",
      },
    ],
  },
  {
    slug: "how-is-call-quality-reviewed",
    question: "How is call quality reviewed?",
    short:
      "By reading transcripts, not by trusting outcomes alone — disagreements are where the script improves.",
    topic: "Capability",
    answer: [
      {
        type: "paragraph",
        text: "Outcomes tell you what happened; transcripts tell you why. A weekly read of a sample of calls is the cheapest quality control available.",
      },
      {
        type: "list",
        items: [
          "Calls that ended early, and the last thing the caller said",
          "Questions the AI asked that a person would not have",
          "Outcomes your team disagreed with",
          "Pronunciations that cost a clarification turn",
        ],
      },
    ],
  },
];

export function getQuestion(slug: string): QuestionEntry | undefined {
  return questions.find((question) => question.slug === slug);
}
