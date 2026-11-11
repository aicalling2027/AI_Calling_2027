/**
 * Blog, glossary and comparison content.
 *
 * PLACEHOLDER policy: these articles explain calling concepts in AOTMS's own
 * words. They contain no customer names, no benchmark figures and no claims
 * about accuracy or cost savings, because none have been verified.
 */

import type { Block } from "@/components/sections/prose";

/* --------------------------------------------------------------------- blog */

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  /** ISO date. Replace with the real publish date when the post goes live. */
  publishedAt: string;
  readingMinutes: number;
  body: Block[];
};

export const articles: Article[] = [
  {
    slug: "what-an-ai-voice-employee-handles",
    title: "What an AI voice employee actually handles",
    excerpt:
      "An AI voice employee is not a chatbot with a microphone. Here is the work it can take over, and the work that stays with your team.",
    category: "Fundamentals",
    publishedAt: "2026-01-12",
    readingMinutes: 5,
    body: [
      {
        type: "paragraph",
        text: "Most descriptions of AI calling skip the only question that matters: which part of the job is being handed over? Without that answer, a demo tells you nothing about what your team will actually stop doing.",
      },
      {
        type: "heading",
        text: "The first conversation, not the whole relationship",
      },
      {
        type: "paragraph",
        text: "An AI voice employee is designed for the opening of a relationship: the first call, the qualification, the repetition. It answers, asks the questions you would ask, records what it heard and passes the result on.",
      },
      {
        type: "list",
        items: [
          "Answering an incoming call and capturing intent",
          "Asking a fixed set of qualifying questions",
          "Recording an outcome against the contact",
          "Retrying contacts that did not answer",
          "Passing a summary to a person",
        ],
      },
      {
        type: "heading",
        text: "What stays with a person",
      },
      {
        type: "paragraph",
        text: "Negotiation, pricing exceptions, complaints, anything requiring discretion or a relationship built over time. The handover exists precisely so those calls reach someone with context instead of starting cold.",
      },
      {
        type: "quote",
        text: "If a call needs judgement, it needs a person. The system should make that handover faster, not pretend it can be avoided.",
      },
      {
        type: "paragraph",
        text: "The practical test is simple: list the conversations your team has every day, then mark which ones have the same shape every time. Those are the candidates.",
      },
    ],
  },
  {
    slug: "response-time-decides-the-enquiry",
    title: "Why response time decides who wins the enquiry",
    excerpt:
      "Interest decays. The gap between a form submission and the first call is usually where opportunities are lost — not in the pitch.",
    category: "Revenue systems",
    publishedAt: "2026-02-02",
    readingMinutes: 4,
    body: [
      {
        type: "paragraph",
        text: "When someone submits an enquiry, they are usually comparing options in the same sitting. The business that responds first sets the frame for everything that follows, even if it is not the cheapest.",
      },
      {
        type: "heading",
        text: "The gap is structural, not personal",
      },
      {
        type: "paragraph",
        text: "A sales desk cannot be available at every hour an enquiry arrives. Overnight enquiries wait for the morning. Weekend enquiries wait for Monday. Peak-hour enquiries wait in a queue. None of that is a failure of effort — it is a failure of coverage.",
      },
      {
        type: "list",
        items: [
          "Enquiries arriving outside working hours",
          "Enquiries arriving while every agent is on a call",
          "Enquiries arriving during a campaign spike",
          "Enquiries that need a retry to connect",
        ],
      },
      {
        type: "heading",
        text: "What automation actually changes",
      },
      {
        type: "paragraph",
        text: "Automation does not make a team care more. It removes the queue. A lead can be called while the interest is intact, and a human takes over only when the conversation needs one.",
      },
      {
        type: "note",
        text: "Measure the thing you changed: time from enquiry to first contact, and how many enquiries receive any contact at all.",
      },
    ],
  },
  {
    slug: "choosing-the-first-conversation",
    title: "Choosing the first conversation to automate",
    excerpt:
      "Pick the wrong starting point and the pilot fails for reasons that have nothing to do with the technology. A short selection framework.",
    category: "Getting started",
    publishedAt: "2026-02-18",
    readingMinutes: 6,
    body: [
      {
        type: "paragraph",
        text: "Teams usually start with the most valuable conversation in the business. That is almost always a mistake. High-value calls involve exceptions, and exceptions are exactly what a pilot cannot yet handle well.",
      },
      {
        type: "heading",
        text: "Four tests for a first use case",
      },
      {
        type: "ordered",
        items: [
          "Volume: does it happen often enough to measure?",
          "Shape: is the sequence of questions broadly the same each time?",
          "Cost of failure: if the call goes badly, how bad is it?",
          "Owner: is there one person who can approve the script?",
        ],
      },
      {
        type: "heading",
        text: "The best candidate is usually boring",
      },
      {
        type: "paragraph",
        text: "Confirmation calls, first-contact qualification, appointment reminders, renewal notices. None of them are glamorous, and all of them are repetitive, measurable and low-consequence if something goes wrong.",
      },
      {
        type: "quote",
        text: "A pilot is not a proof of concept for the technology. It is a proof that one process can be measured and improved.",
      },
      {
        type: "heading",
        text: "What to review",
      },
      {
        type: "list",
        items: [
          "Transcripts, read end to end — not just the outcomes",
          "Calls that ended early, and why",
          "Questions the AI asked that a human would not have",
          "Outcomes your team disagreed with",
        ],
      },
    ],
  },
  {
    slug: "multilingual-calling-what-to-check",
    title: "Multilingual calling: what to check before you commit",
    excerpt:
      "A language listed on a data sheet is not the same as a language that works on a real call. Four things to verify before committing.",
    category: "Multilingual",
    publishedAt: "2026-03-04",
    readingMinutes: 5,
    body: [
      {
        type: "paragraph",
        text: "Language coverage is usually presented as a list. On a real call, the list is not the question. The question is how the system behaves when the caller does something unexpected in that language.",
      },
      {
        type: "heading",
        text: "Test with real accents and real interruptions",
      },
      {
        type: "paragraph",
        text: "A scripted demo in a neutral accent proves very little. Test with the regional accents, background noise and code-mixing your callers actually use.",
      },
      {
        type: "list",
        items: [
          "Mixed-language sentences inside one call",
          "Callers who switch mid-conversation",
          "Numbers, dates and addresses spoken quickly",
          "Brand and place names that are commonly mispronounced",
        ],
      },
      {
        type: "heading",
        text: "Check pronunciation separately from fluency",
      },
      {
        type: "paragraph",
        text: "Fluency is about flow; pronunciation is about whether a specific name is intelligible. A voice can sound natural and still mispronounce the one word your business depends on.",
      },
      {
        type: "heading",
        text: "Decide what happens when it fails",
      },
      {
        type: "paragraph",
        text: "Every system has a failure mode in a language it is less good at. Define the fallback before launch: transfer to a person, offer a callback, or end the call politely with a recorded summary.",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

/* ----------------------------------------------------------------- glossary */

export type GlossaryTerm = {
  slug: string;
  term: string;
  short: string;
  body: Block[];
};

export const glossaryTerms: GlossaryTerm[] = [
  {
    slug: "ai-voice-agent",
    term: "AI voice agent",
    short:
      "A system that holds a spoken conversation on a phone call without a human speaking.",
    body: [
      {
        type: "paragraph",
        text: "An AI voice agent listens to the caller, decides what to say next and speaks the response. It is configured with a purpose, a script and a set of rules that determine when to hand the call to a person.",
      },
      { type: "note", text: "Related: inbound calling, outbound campaign." },
    ],
  },
  {
    slug: "inbound-calling",
    term: "Inbound calling",
    short:
      "Calls that arrive at your number and are answered by you, rather than placed by you.",
    body: [
      {
        type: "paragraph",
        text: "Inbound volume is driven by your marketing and your reputation. The constraint is coverage: whether someone is available at the moment the call arrives.",
      },
      {
        type: "paragraph",
        text: "An AI employee answers inbound calls so that no caller reaches voicemail outside working hours or during a peak.",
      },
    ],
  },
  {
    slug: "outbound-campaign",
    term: "Outbound campaign",
    short:
      "A structured run through a contact list, with rules for when to call and when to retry.",
    body: [
      {
        type: "paragraph",
        text: "A campaign defines the list, the script, the calling window and the retry policy. Each contact carries an outcome as the campaign progresses.",
      },
      {
        type: "list",
        items: [
          "The list and its de-duplication",
          "The calling window in local time",
          "Retry limits for unanswered numbers",
          "The outcomes that need a human follow-up",
        ],
      },
    ],
  },
  {
    slug: "lead-qualification",
    term: "Lead qualification",
    short:
      "The process of deciding whether an enquiry matches what you sell, before a person invests time.",
    body: [
      {
        type: "paragraph",
        text: "Qualification is a fixed sequence of questions with defined answers. Done consistently, it produces a comparable outcome for every lead instead of a free-text note.",
      },
      {
        type: "paragraph",
        text: "It is one of the best candidates for automation because the questions rarely change and the answers determine the next step.",
      },
    ],
  },
  {
    slug: "call-disposition",
    term: "Call disposition",
    short:
      "The recorded outcome of a call — what happened, in a category your team can filter on.",
    body: [
      {
        type: "paragraph",
        text: "A disposition is not a summary. It is a short, finite set of states such as connected, not interested, callback requested or wrong number, applied consistently across calls.",
      },
      {
        type: "note",
        text: "Dispositions make reporting possible; summaries make follow-up possible. Both are needed.",
      },
    ],
  },
  {
    slug: "dnd-and-consent",
    term: "DND and consent",
    short:
      "Rules and registries that restrict who may be called, and for what purpose.",
    body: [
      {
        type: "paragraph",
        text: "Outbound calling is regulated. Numbers on a do-not-disturb registry, and contacts who have not consented to be contacted, must be excluded before a campaign runs.",
      },
      {
        type: "paragraph",
        text: "The requirement differs by jurisdiction and by the purpose of the call. Confirm the rules that apply to your business rather than assuming a single global standard.",
      },
    ],
  },
  {
    slug: "transcript",
    term: "Transcript",
    short: "A written record of what was said on a call, produced automatically.",
    body: [
      {
        type: "paragraph",
        text: "Transcripts are the raw material for quality review. They show what the caller actually said, which is usually more useful than the outcome alone.",
      },
      {
        type: "paragraph",
        text: "Retention is a policy decision: keep transcripts long enough to review and audit, and no longer than necessary.",
      },
    ],
  },
  {
    slug: "webhook",
    term: "Webhook",
    short:
      "A request your system sends to another system when an event happens, such as a finished call.",
    body: [
      {
        type: "paragraph",
        text: "Webhooks keep two systems in step without polling. When a call ends, the platform posts the outcome, transcript and summary to the URL you provide.",
      },
      {
        type: "note",
        text: "Related: API access, outcome write-back.",
      },
    ],
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return glossaryTerms.find((term) => term.slug === slug);
}

/* -------------------------------------------------------------- comparisons */

export type ComparisonRow = { label: string; aotms: string; other: string };

export type Comparison = {
  slug: string;
  /** What is being compared against. */
  against: string;
  title: string;
  excerpt: string;
  metaDescription: string;
  summary: string;
  rows: ComparisonRow[];
  body: Block[];
};

export const comparisons: Comparison[] = [
  {
    slug: "ai-voice-employee-vs-ivr",
    against: "IVR",
    title: "AI voice employee vs. IVR",
    excerpt:
      "An IVR routes a call. An AI voice employee holds a conversation. The difference decides whether callers reach the right place.",
    metaDescription:
      "How an AI voice employee differs from a traditional IVR menu, and when each is the right choice.",
    summary:
      "IVR is a menu: press 1 for sales. An AI voice employee listens to the reason for the call and responds. The trade-off is predictability versus flexibility.",
    rows: [
      {
        label: "How the caller starts",
        aotms: "Explains the reason for the call in their own words",
        other: "Chooses from a fixed keypad menu",
      },
      {
        label: "Languages",
        aotms: "Intended to handle multiple languages on the same number",
        other: "Usually one language per menu tree",
      },
      {
        label: "Handling the unexpected",
        aotms: "Can ask a clarifying question before routing",
        other: "Falls back to a default option or an operator queue",
      },
      {
        label: "What you get back",
        aotms: "Transcript, summary and a tagged outcome",
        other: "A routing record and a queue entry",
      },
      {
        label: "Best fit",
        aotms: "Variable reasons for calling, qualification needed",
        other: "Simple routing between a small number of known options",
      },
    ],
    body: [
      {
        type: "heading",
        text: "IVR is not obsolete",
      },
      {
        type: "paragraph",
        text: "If your callers genuinely have three options and always know which one they want, a menu is fast, predictable and cheap to run. IVR struggles when the reason for the call does not fit a menu.",
      },
      {
        type: "heading",
        text: "Where conversation wins",
      },
      {
        type: "paragraph",
        text: "When callers describe their problem in a sentence, a menu forces them to translate it into your internal categories. A conversational agent can capture the description and ask the follow-up question instead.",
      },
      {
        type: "note",
        text: "Comparison reflects intended behaviour. Confirm current capability with AOTMS before relying on any row.",
      },
    ],
  },
  {
    slug: "ai-calling-vs-manual-dialling",
    against: "Manual dialling",
    title: "AI calling vs. a manual dial desk",
    excerpt:
      "A dial desk is limited by headcount. Automated calling is limited by policy. The right choice depends on which limit hurts more.",
    metaDescription:
      "Compare automated AI calling with a manual outbound dial desk on throughput, consistency and control.",
    summary:
      "Manual dialling gives a person full judgement on every call. Automated calling gives consistent coverage and a record of every attempt, at the cost of flexibility on unusual calls.",
    rows: [
      {
        label: "Throughput",
        aotms: "Bounded by configured pacing, not by seats",
        other: "Bounded by the number of people dialling",
      },
      {
        label: "Consistency",
        aotms: "Same questions and rules on every call",
        other: "Varies by agent and by time of day",
      },
      {
        label: "Coverage",
        aotms: "Can run outside working hours",
        other: "Limited to shift patterns",
      },
      {
        label: "Judgement",
        aotms: "Hands unusual calls to a person",
        other: "Applies judgement on every call",
      },
      {
        label: "Record",
        aotms: "Transcript and disposition per call",
        other: "Notes depend on the agent",
      },
    ],
    body: [
      {
        type: "heading",
        text: "The honest trade-off",
      },
      {
        type: "paragraph",
        text: "Automation is better at the repeatable part of the list and worse at the surprising part. A team that only automates the repeatable portion usually keeps the judgement where it belongs.",
      },
      {
        type: "heading",
        text: "When manual is the right answer",
      },
      {
        type: "paragraph",
        text: "High-value negotiation, small lists of important contacts, and situations where every call is genuinely different. Automating those first is how pilots fail.",
      },
    ],
  },
  {
    slug: "ai-calling-vs-bpo",
    against: "Outsourced calling",
    title: "AI calling vs. an outsourced calling team",
    excerpt:
      "Both add capacity. One adds headcount and process; the other adds configuration and records. Compare on control and on ramp time.",
    metaDescription:
      "Compare an AI calling platform with an outsourced calling team on ramp time, control, record quality and cost structure.",
    summary:
      "A BPO brings people and management overhead. A platform brings configuration and records. The decision usually comes down to how quickly volume changes and how much of the script is fixed.",
    rows: [
      {
        label: "Ramp time",
        aotms: "Configure a script and start",
        other: "Recruit, train and supervise a team",
      },
      {
        label: "Change control",
        aotms: "You edit the script directly",
        other: "Changes pass through a supplier process",
      },
      {
        label: "Cost shape",
        aotms: "Follows call volume",
        other: "Follows seats and shifts",
      },
      {
        label: "Complex conversations",
        aotms: "Routed to your own team",
        other: "Handled by trained agents",
      },
      {
        label: "Record quality",
        aotms: "Transcript and disposition for every call",
        other: "Depends on the supplier's reporting",
      },
    ],
    body: [
      {
        type: "heading",
        text: "They solve different problems",
      },
      {
        type: "paragraph",
        text: "Outsourcing buys a managed team. A platform buys a system you configure. If the work needs people and supervision, outsourcing is the right shape. If the work is a fixed script at variable volume, a platform is usually simpler.",
      },
      {
        type: "note",
        text: "No cost comparison is published here because AOTMS pricing is not finalised.",
      },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return comparisons.find((comparison) => comparison.slug === slug);
}
