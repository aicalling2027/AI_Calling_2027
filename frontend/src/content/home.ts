/**
 * Homepage copy and structure.
 *
 * IMPORTANT: every string below is PLACEHOLDER copy written to preserve the
 * reference site's section order and content hierarchy. No pricing, statistics,
 * testimonials or customer names are invented. Replace the text with approved
 * AOTMS messaging — components read from this file, so no UI changes are needed.
 *
 * The voice catalogue is not here: see `content/voices.ts`. The landing page
 * lists no voices.
 */

export const hero = {
  // TODO(AOTMS): final hero headline.
  title: "AI Automatic voice calling, built for your business",
  /** The small label above the headline: what the product is, in one line. */
  eyebrow: "AI voice agents for inbound and outbound",
  // TODO(AOTMS): final hero subheading.
  subtitle:
    "AOTMS Global runs multilingual AI voice agents for inbound and outbound calls, so your team spends its time on the conversations that need a human.",
  /** One extra line between the subheading and the buttons: the three products. */
  trust: [
    "Multilingual voice agents",
    "Inbound and outbound calls",
    "Human handover when needed",
  ],
};

export const howItWorks = {
  eyebrow: "How it works",
  title: "Three steps from a list to a conversation.",
  /** One line under the heading; the phone beside it shows a call in progress. */
  body: "You bring the list and the brief. The dialling, the language and the follow-up run on their own.",
  /** The illustrative call drawn on the phone beside the steps. Not a real record. */
  demo: {
    status: "Auto-dialling",
    agent: "AI voice agent",
    meta: "English · Lead from WhatsApp",
    timer: "00:42",
    transcriptLabel: "Live transcript",
    reply: "Hello, this is the AOTMS assistant. Is now a good time?",
    transcript: "“I am interested — please call me after 6.”",
  },
  steps: [
    {
      title: "Add your leads",
      body: "Upload a list or connect a lead source. Duplicates and invalid numbers are filtered before anything is dialled.",
    },
    {
      title: "Choose an AI employee",
      body: "Pick the language, voice and instructions for the conversation. Each employee keeps its own script and knowledge.",
    },
    {
      title: "Review every outcome",
      body: "Each call returns a transcript, a summary and a recorded outcome, so follow-up starts from context instead of guesswork.",
    },
  ],
};

export const useCases = {
  eyebrow: "Where it fits",
  title: "New leads, old lists, incoming calls. One system.",
  tabs: [
    {
      id: "new-leads",
      label: "New leads",
      heading: "Reach a new lead while the interest is still warm.",
      body: "Leads that arrive from a form or an advertisement can be called by an AI employee without waiting for a free human.",
    },
    {
      id: "old-lists",
      label: "Old lists",
      heading: "Revisit a list that went quiet.",
      body: "Work through contacts you already own, qualify who is still interested, and hand only those to your team.",
    },
    {
      id: "inbound",
      label: "Incoming calls",
      heading: "Answer calls outside working hours.",
      body: "An AI employee can take the call, capture what the caller needs, and pass a summary to the team.",
    },
  ],
  // TODO(AOTMS): confirm which industries are actually supported.
  industries: [
    "Real estate",
    "Education",
    "Healthcare",
    "Automobile",
    "Financial services",
    "Local services",
  ],
};

export const featureGrid = {
  eyebrow: "Built in",
  title: "The operational pieces, included.",
  features: [
    {
      title: "Number provisioning",
      body: "Connect the phone numbers you call from and route each one to the right employee.",
    },
    {
      title: "Automatic retries",
      body: "Set how many times an unanswered call is retried, and when, without touching a spreadsheet.",
    },
    {
      title: "Trust and compliance",
      body: "Calling rules, consent checks and retention settings are applied before a call is placed.",
    },
    {
      title: "Follow-through",
      body: "Outcomes feed follow-ups, notifications and your team handover automatically.",
    },
  ],
};

export const integrations = {
  eyebrow: "Integrations",
  title: "Connects to the tools your team already runs on.",
  body: "Leads arrive from WhatsApp, Meta or your own product, and every call outcome flows back into the sheet, the CRM or the calendar your team already works in. Nothing has to be copied by hand.",
  note: "n8n, AiSensy and any REST endpoint or webhook you own are supported too.",
  cta: { label: "More integrations", href: "/contact" },
};

export const apiSection = {
  eyebrow: "Developers",
  title: "Build on the AOTMS API.",
  body: "Trigger calls, receive outcomes and sync conversations into your own systems. API documentation will be published alongside the first release.",
  bullets: [
    "Create a call from your own application",
    "Receive outcomes and transcripts on a webhook",
    "Keep your CRM as the place your team works",
  ],
};

export const pricingSection = {
  eyebrow: "Pricing",
  // TODO(AOTMS): replace with the approved commercial model.
  title: "Pricing is being finalised.",
  body: "AOTMS plans are not published yet. Talk to the team for a quote based on your call volume and languages.",
  note: "No prices are shown here because none have been approved.",
};

export const finalCta = {
  title: "Put an AI employee on your next call.",
  body: "Start with one use case, measure the outcome, then expand.",
};
