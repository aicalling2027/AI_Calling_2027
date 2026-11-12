/**
 * Homepage copy and structure.
 *
 * IMPORTANT: every string below is PLACEHOLDER copy written to preserve the
 * reference site's section order and content hierarchy. No pricing, statistics,
 * testimonials or customer names are invented. Replace the text with approved
 * AOTMS messaging — components read from this file, so no UI changes are needed.
 */

export const hero = {
  // TODO(AOTMS): final hero headline.
  title: "AI voice calling, built for your business.",
  /** The word drawn in coral with a hand-drawn underline. Must appear in `title`. */
  highlight: "business",
  // TODO(AOTMS): final hero subheading.
  subtitle:
    "AOTMS Global runs multilingual AI voice agents for inbound and outbound calls, so your team spends its time on the conversations that need a human.",
  /** One extra line between the subheading and the buttons: the three products. */
  note: "Inbound answering, outbound campaigns and instant lead callbacks — one system, on the numbers you already own.",
  /** Short, checkable statements under the hero buttons. No invented claims. */
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

/** One entry of `GET /api/v1/voices` - the marketing site's voice catalogue. */
export type VoiceSample = {
  id: string;
  name: string;
  gender: "female" | "male";
  personality: string;
  use_case: string;
  languages: { code: string; label: string }[];
  preview_language: string;
  /** The exact line the preview endpoint synthesises. */
  sample_text: string;
  featured: boolean;
};

export const voices = {
  eyebrow: "Hear our voices",
  title: "Voices your customers can follow.",
  body: "Real Bulbul speakers, generated for your language and your script - not stock recordings. Play any voice below and keep the one your customers trust.",
  sourceLive: "Live catalogue",
  sourceBundled: "Curated catalogue",
  footnote:
    "Samples are synthesised on demand by Sarvam Bulbul, each in the voice's own language. Every voice also speaks the rest of our Indic set.",
  // Mirrors VOICE_PROFILES in Backend/app/core/constants.py so the band renders
  // with real content before /api/voices answers - and stays intact if the API
  // is unreachable.
  catalog: [
    {
      id: "shubh",
      name: "Shubh",
      gender: "male",
      personality: "Confident & bold",
      use_case: "Sales",
      sample_text:
        "Hello, Shubh from AOTMS. I'm calling about the plan you asked about - can I take two minutes of your time?",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "ta-IN", label: "Tamil" },
      ],
      preview_language: "en-IN",
      featured: true,
    },
    {
      id: "tanya",
      name: "Tanya",
      gender: "female",
      personality: "Friendly & modern",
      use_case: "Support",
      sample_text:
        "नमस्ते! मैं AOTMS से तान्या बोल रही हूँ। आपकी शिकायत दर्ज हो गई है और हम आज ही समाधान भेज देंगे।",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "bn-IN", label: "Bengali" },
      ],
      preview_language: "hi-IN",
      featured: true,
    },
    {
      id: "anand",
      name: "Anand",
      gender: "male",
      personality: "Warm & reassuring",
      use_case: "Reminders",
      sample_text:
        "नमस्ते! आनंद बोल रहा हूँ AOTMS से। आपका अपॉइंटमेंट कल सुबह दस बजे तय है।",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "te-IN", label: "Telugu" },
      ],
      preview_language: "hi-IN",
      featured: true,
    },
    {
      id: "sunny",
      name: "Sunny",
      gender: "male",
      personality: "Cheerful & upbeat",
      use_case: "Marketing",
      sample_text:
        "Hi! Sunny from AOTMS with a quick update on this month's offer - it takes under a minute.",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "ml-IN", label: "Malayalam" },
      ],
      preview_language: "en-IN",
      featured: false,
    },
    {
      id: "mani",
      name: "Mani",
      gender: "male",
      personality: "Calm & composed",
      use_case: "Collections",
      sample_text:
        "Hello, Mani calling from AOTMS about the invoice due this week. May I confirm the payment date?",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "kn-IN", label: "Kannada" },
      ],
      preview_language: "en-IN",
      featured: false,
    },
    {
      id: "kabir",
      name: "Kabir",
      gender: "male",
      personality: "Steady & trustworthy",
      use_case: "Renewals",
      sample_text:
        "Good evening, Kabir from AOTMS. Your plan renews on Friday and I wanted to check whether anything needs changing.",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "gu-IN", label: "Gujarati" },
      ],
      preview_language: "en-IN",
      featured: false,
    },
    {
      id: "priya",
      name: "Priya",
      gender: "female",
      personality: "Clear & precise",
      use_case: "Surveys",
      sample_text:
        "Hello, this is Priya from AOTMS with a two-question feedback call. Shall I continue?",
      languages: [
        { code: "en-IN", label: "English (India)" },
        { code: "hi-IN", label: "Hindi" },
        { code: "mr-IN", label: "Marathi" },
      ],
      preview_language: "en-IN",
      featured: false,
    },
  ] satisfies VoiceSample[],
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
