/**
 * Product page content.
 *
 * Structure mirrors the reference site's product pages (hero → problem →
 * capabilities → how it works → measurement → FAQ → CTA). Every claim below is
 * a PLACEHOLDER: replace with AOTMS-approved capability statements. No volume
 * figures, latency numbers, accuracy percentages or customer results are
 * invented — add them only once they are confirmed.
 */

import type { CardItem, StepItem } from "@/components/sections/cards";
import type { FaqItem } from "@/components/sections/faq";

export type ProductPage = {
  slug: string;
  name: string;
  eyebrow: string;
  /** Unique <h1>. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  heroBullets: string[];
  problems: CardItem[];
  capabilities: CardItem[];
  steps: StepItem[];
  faq: FaqItem[];
  /** Related pages shown at the bottom of the product page. */
  related: { label: string; href: string; body: string }[];
};

export const productPages: ProductPage[] = [
  {
    slug: "inbound",
    name: "Inbound",
    eyebrow: "Product · Inbound",
    title: "Answer the calls your team cannot pick up.",
    metaTitle: "Inbound AI calling",
    metaDescription:
      "An AI employee answers incoming calls, captures what the caller needs and passes a summary to your team.",
    summary:
      "Inbound puts an AI employee on your published number. It answers, asks the questions your team would ask, and hands over a summary so nobody starts from zero.",
    heroBullets: [
      "Answers after hours and during peak volume",
      "Captures intent, contact details and next step",
      "Sends a written summary to the team",
    ],
    problems: [
      {
        title: "Missed calls become missed revenue",
        body: "A caller who reaches voicemail usually calls the next number on the list. Every unanswered ring is a conversation you paid to earn and then dropped.",
        icon: "phone-incoming",
      },
      {
        title: "Peak hours, fixed headcount",
        body: "Enquiry volume rarely arrives evenly. Staffing for the busiest hour is expensive, and staffing for the average leaves calls waiting.",
        icon: "clock",
      },
      {
        title: "Repetitive qualification work",
        body: "The first few questions are the same on almost every call. That is time your team could spend on the calls that actually need judgement.",
        icon: "message",
      },
    ],
    capabilities: [
      {
        title: "Number routing",
        body: "Point an existing business number or a new one at the AI employee, and choose which numbers it answers.",
        icon: "phone-call",
      },
      {
        title: "Structured questioning",
        body: "Define the questions the caller must be asked, in order, with the allowed answers for each.",
        icon: "workflow",
      },
      {
        title: "Context handover",
        body: "Each call ends with a transcript and summary so a human can continue the conversation without repeating it.",
        icon: "layers",
      },
      {
        title: "Language choice",
        body: "Answer in the languages your callers actually use — the published catalogue is still being confirmed.",
        icon: "languages",
      },
      {
        title: "Escalation rules",
        body: "Decide which calls must reach a person, and what the AI employee should say while it transfers.",
        icon: "users",
      },
      {
        title: "Call records",
        body: "Recordings, transcripts and outcomes are kept against the contact so the history is auditable.",
        icon: "shield",
      },
    ],
    steps: [
      {
        title: "Connect a number",
        body: "Route a business number to the AI employee. Existing numbers can stay in use.",
      },
      {
        title: "Describe the conversation",
        body: "Write the questions, the answers it may give and the conditions for escalating to a person.",
      },
      {
        title: "Read every summary",
        body: "Each call lands as a summary with a transcript, an outcome and a suggested next step.",
      },
    ],
    faq: [
      {
        question: "Can it use our existing phone number?",
        answer:
          "The intended setup is to route an existing business number to the AI employee. The exact carrier and routing requirements for AOTMS are still being confirmed.",
      },
      {
        question: "Which languages can it answer in?",
        answer:
          "The published language list is not finalised yet. Confirm the supported set with the AOTMS team before publishing a commitment.",
      },
      {
        question: "What happens when the AI cannot answer?",
        answer:
          "Escalation is defined per conversation. You decide which calls must reach a person and what the caller hears during the transfer.",
      },
      {
        question: "Are calls recorded?",
        answer:
          "Recording, consent and retention settings are applied before a call is placed. The default retention period for AOTMS accounts is not yet published.",
      },
    ],
    related: [
      {
        label: "Campaigns",
        href: "/product/campaigns",
        body: "Work through a contact list with the same AI employee.",
      },
      {
        label: "Instant Leads",
        href: "/product/instant-leads",
        body: "Call a single new lead the moment it arrives.",
      },
      {
        label: "Voices",
        href: "/voices",
        body: "Hear the voices available for inbound conversations.",
      },
    ],
  },
  {
    slug: "campaigns",
    name: "Campaigns",
    eyebrow: "Product · Campaigns",
    title: "Work through a contact list without a dial queue.",
    metaTitle: "Outbound calling campaigns",
    metaDescription:
      "Run an outbound campaign with an AI employee: import a list, set the calling rules and review every outcome.",
    summary:
      "Campaigns turns a list into conversations. Upload the contacts, set the calling window and retry policy, then review what came back from each call.",
    heroBullets: [
      "Import and clean a contact list before dialling",
      "Control calling windows and retries per campaign",
      "Every outcome tagged and written back",
    ],
    problems: [
      {
        title: "Lists go stale in a spreadsheet",
        body: "A list that was warm last quarter is cold by the time someone opens it. Without a repeatable process, nobody works it at all.",
        icon: "layers",
      },
      {
        title: "Manual dialling caps throughput",
        body: "A person can only hold one conversation at a time, so throughput is fixed by headcount rather than by demand.",
        icon: "clock",
      },
      {
        title: "Outcomes live in different places",
        body: "Call notes, follow-ups and dispositions end up split between a sheet, a notebook and someone's memory.",
        icon: "bar-chart",
      },
    ],
    capabilities: [
      {
        title: "List import and clean-up",
        body: "Bring contacts in from a file or your own system; invalid and duplicate numbers are filtered before dialling.",
        icon: "layers",
      },
      {
        title: "Calling windows",
        body: "Define the days and hours a campaign is allowed to call. Outside the window, no calls are placed.",
        icon: "clock",
      },
      {
        title: "Retry policy",
        body: "Choose how many times an unanswered number is retried, and the gap between attempts.",
        icon: "workflow",
      },
      {
        title: "Script per campaign",
        body: "Each campaign carries its own objective, questions and permitted answers, so scripts never bleed across use cases.",
        icon: "megaphone",
      },
      {
        title: "Pacing and pause",
        body: "Start, pause and resume a campaign; progress is tracked per contact rather than per batch.",
        icon: "zap",
      },
      {
        title: "Outcome tags",
        body: "Every call resolves to a tagged outcome so qualified contacts can be handed to the team the same day.",
        icon: "bar-chart",
      },
    ],
    steps: [
      {
        title: "Import the list",
        body: "Upload contacts or connect a source. Duplicates and invalid numbers are removed before anything is dialled.",
      },
      {
        title: "Set the rules",
        body: "Choose the script, calling window, retry limit and which outcomes need a human follow-up.",
      },
      {
        title: "Review the outcomes",
        body: "Filter by outcome, read transcripts and export the contacts worth a second conversation.",
      },
    ],
    faq: [
      {
        question: "How many contacts can one campaign hold?",
        answer:
          "Volume limits depend on the AOTMS plan and are not published yet. Ask the team for the current limit before planning a campaign size.",
      },
      {
        question: "How is consent handled?",
        answer:
          "Calling rules and consent checks are intended to run before a call is placed. The specific compliance workflow for AOTMS accounts is still being confirmed.",
      },
      {
        question: "What happens when a call reaches voicemail?",
        answer:
          "Voicemail and answering machines are treated as their own outcome and counted separately from a completed conversation.",
      },
      {
        question: "Can a campaign be stopped mid-run?",
        answer:
          "Yes. A campaign can be paused, and contacts already processed keep their outcome and are not re-dialled unless you reset them.",
      },
    ],
    related: [
      {
        label: "Instant Leads",
        href: "/product/instant-leads",
        body: "Call new leads the moment they arrive instead of in a batch.",
      },
      {
        label: "Inbound",
        href: "/product/inbound",
        body: "Answer the calls a campaign generates.",
      },
      {
        label: "Revenue systems",
        href: "/revenue-systems",
        body: "See where calling sits in the wider revenue process.",
      },
    ],
  },
  {
    slug: "instant-leads",
    name: "Instant Leads",
    eyebrow: "Product · Instant Leads",
    title: "Call a new lead while the interest is still fresh.",
    metaTitle: "Instant lead calling",
    metaDescription:
      "Trigger an AI call the moment a lead arrives from a form, advertisement or your own system.",
    summary:
      "Instant Leads reacts to a single event. When a lead arrives, an AI employee calls it, qualifies it and routes what it learned without a queue in between.",
    heroBullets: [
      "Triggered by a form, advertisement or API call",
      "Qualifies before the enquiry goes cold",
      "Writes the outcome back to the source",
    ],
    problems: [
      {
        title: "Fast follow-up wins the enquiry",
        body: "A lead that waits for a free agent is a lead someone else has already spoken to. Response time is the whole advantage.",
        icon: "zap",
      },
      {
        title: "Nights and weekends are dead time",
        body: "Enquiries arrive when marketing runs, not when the sales desk opens. By Monday the interest has moved on.",
        icon: "clock",
      },
      {
        title: "Only a name and a number",
        body: "A form submission carries almost no context. Someone has to call to find out what the person actually wants.",
        icon: "message",
      },
    ],
    capabilities: [
      {
        title: "Event triggers",
        body: "Start a call from a form submission, an advertisement lead or a request to your own system.",
        icon: "plug",
      },
      {
        title: "Single-lead focus",
        body: "One trigger produces one call with the context from the source attached to it.",
        icon: "phone-call",
      },
      {
        title: "Qualification script",
        body: "Ask the questions that determine fit, then tag the lead by the answers it gave.",
        icon: "workflow",
      },
      {
        title: "Routing",
        body: "Send qualified leads to the right person or queue, and keep unqualified ones out of the sales inbox.",
        icon: "users",
      },
      {
        title: "Write-back",
        body: "Outcome, transcript and summary are pushed to the source system so the record stays complete.",
        icon: "layers",
      },
      {
        title: "Retry while warm",
        body: "If the lead does not answer, retries can run inside the window where the enquiry still matters.",
        icon: "zap",
      },
    ],
    steps: [
      {
        title: "Connect the source",
        body: "Point a form, advertisement or your own application at the AOTMS endpoint.",
      },
      {
        title: "Define the first response",
        body: "Write the qualification questions and the rules that mark a lead as ready for a human.",
      },
      {
        title: "Route the qualified lead",
        body: "Qualified leads are handed over with the summary already attached; the rest are recorded and closed.",
      },
    ],
    faq: [
      {
        question: "How quickly is the call placed?",
        answer:
          "The intent is to call as soon as the trigger is received. A confirmed latency figure has not been published, so avoid quoting one.",
      },
      {
        question: "Which lead sources are supported?",
        answer:
          "Form, advertisement and API triggers are the documented pattern. Confirm the specific integrations available at launch with the AOTMS team.",
      },
      {
        question: "What if the same lead is triggered twice?",
        answer:
          "Repeated triggers for the same contact should be de-duplicated so a person is not called twice for one enquiry.",
      },
      {
        question: "Does it replace a salesperson?",
        answer:
          "No. Instant Leads covers the first conversation and qualification; anything requiring judgement is routed to a person.",
      },
    ],
    related: [
      {
        label: "Campaigns",
        href: "/product/campaigns",
        body: "Run the same qualification across an existing list.",
      },
      {
        label: "Inbound",
        href: "/product/inbound",
        body: "Handle the calls those leads make back.",
      },
      {
        label: "Solutions",
        href: "/solutions",
        body: "See how the products combine by team and industry.",
      },
    ],
  },
];

export function getProductPage(slug: string): ProductPage | undefined {
  return productPages.find((page) => page.slug === slug);
}
