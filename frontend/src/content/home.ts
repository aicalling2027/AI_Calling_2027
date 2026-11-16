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

/** One entry of `GET /api/v1/voices` - the marketing site's voice catalogue. */
export type VoiceSample = {
  id: string;
  /**
   * What the catalogue prints in place of a name: `PM-01`, `SD-07`. The band
   * and the edition are both readable from it. Optional so a payload from an
   * older backend still renders - the name is the fallback.
   */
  code?: string;
  /** The speaker's own name. Search finds a voice by it; cards never show it. */
  name: string;
  /** `unspecified` where the provider does not label the speaker. */
  gender: "female" | "male" | "unspecified";
  personality: string;
  use_case: string;
  languages: { code: string; label: string }[];
  preview_language: string;
  /** The exact line the preview endpoint synthesises. */
  sample_text: string;
  featured: boolean;
  /**
   * The public name of the model the voice is synthesised with (`AOTMS-V 3B`).
   * Speaker ids are not portable between the two models, so the card names the
   * one it belongs to.
   */
  model: string;
};

/**
 * The languages a voice can be heard in - the speech API's synthesis set, not
 * its wider transcription set. Mirrors `SPEECH_LANGUAGES` in the backend.
 */
const SPEECH_LANGUAGES: VoiceSample["languages"] = [
  { code: "hi-IN", label: "Hindi" },
  { code: "en-IN", label: "English (India)" },
  { code: "mr-IN", label: "Marathi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "bn-IN", label: "Bengali" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "or-IN", label: "Odia" },
];

/**
 * The line every preview speaks, per language.
 *
 * Mirrors `PREVIEW_LINES` in `Backend/app/core/constants.py`: one short clause,
 * written in its own script because the speech API reads the text as written.
 * The catalogue payload only carries the default line, so `/voices` reads its
 * own copy to show what the sample will actually say in the chosen language.
 */
export const PREVIEW_LINES: Record<string, string> = {
  "en-IN": "Hi, this is how I speak.",
  "hi-IN": "नमस्ते, यह मेरी आवाज़ है।",
  "bn-IN": "নমস্কার, এটি আমার কণ্ঠ।",
  "ta-IN": "வணக்கம், இது என் குரல்.",
  "te-IN": "హాయ్, ఇది నా గొంతు.",
  "gu-IN": "નમસ્તે, આ મારો અવાજ છે.",
  "kn-IN": "ನಮಸ್ಕಾರ, ಇದು ನನ್ನ ಧ್ವನಿ.",
  "ml-IN": "ഹായ്, ഇത് എന്റെ ശബ്ദമാണ്.",
  "mr-IN": "नमस्कार, हा माझा आवाज आहे.",
  "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਇਹ ਮੇਰੀ ਆਵਾਜ਼ ਹੈ।",
  "or-IN": "ନମସ୍କାର, ଏହା ମୋର ସ୍ୱର।",
};

/** The language a sample leads with when the visitor names none. */
const PREVIEW_LANGUAGE = "en-IN";

/** The line the catalogue carries as `sample_text`, in the default language. */
const PREVIEW_LINE = PREVIEW_LINES[PREVIEW_LANGUAGE];

/** id, name, gender, personality, use case, featured. */
type VoiceSeed = readonly [
  id: string,
  name: string,
  gender: VoiceSample["gender"],
  personality: string,
  useCase: string,
  featured: boolean,
];

/**
 * The same catalogue the backend publishes, as a seed table.
 *
 * The shape is uniform by design: every speaker renders every language the
 * speech API synthesises, and every preview is the same one short line. Only
 * personality and use case differ between voices, and both stay empty where
 * the provider says nothing - inventing a role for a speaker would be a claim
 * the product cannot support.
 */
const VOICE_SEEDS: readonly VoiceSeed[] = [
  ["shubh", "Shubh", "male", "Confident & bold", "Sales", true],
  ["tanya", "Tanya", "female", "Friendly & modern", "Support", true],
  ["anand", "Anand", "male", "Warm & reassuring", "Reminders", true],
  ["aditya", "Aditya", "male", "Professional & clear", "", false],
  ["ritu", "Ritu", "female", "Calm & professional", "", false],
  ["ashutosh", "Ashutosh", "unspecified", "", "", false],
  ["priya", "Priya", "female", "Clear & precise", "Surveys", false],
  ["neha", "Neha", "female", "Warm & conversational", "", false],
  ["rahul", "Rahul", "male", "Professional & relaxed", "", false],
  ["pooja", "Pooja", "female", "Warm & friendly", "", false],
  ["rohan", "Rohan", "unspecified", "", "", false],
  ["simran", "Simran", "female", "Bright & clear", "", false],
  ["kavya", "Kavya", "female", "Calm & professional", "", false],
  ["amit", "Amit", "unspecified", "", "", false],
  ["dev", "Dev", "unspecified", "", "", false],
  ["ishita", "Ishita", "unspecified", "", "", false],
  ["shreya", "Shreya", "female", "Calm & narrative", "", false],
  ["ratan", "Ratan", "unspecified", "", "", false],
  ["varun", "Varun", "unspecified", "", "", false],
  ["manan", "Manan", "unspecified", "", "", false],
  ["sumit", "Sumit", "unspecified", "", "", false],
  ["roopa", "Roopa", "unspecified", "", "", false],
  ["kabir", "Kabir", "male", "Steady & trustworthy", "Renewals", false],
  ["aayan", "Aayan", "unspecified", "", "", false],
  ["advait", "Advait", "unspecified", "", "", false],
  ["tarun", "Tarun", "unspecified", "", "", false],
  ["sunny", "Sunny", "male", "Cheerful & upbeat", "Marketing", false],
  ["mani", "Mani", "male", "Calm & composed", "Collections", false],
  ["gokul", "Gokul", "male", "Mature & narrative", "", false],
  ["vijay", "Vijay", "male", "Mature & authoritative", "", false],
  ["shruti", "Shruti", "unspecified", "", "", false],
  ["suhani", "Suhani", "female", "Young & energetic", "", false],
  ["mohit", "Mohit", "unspecified", "", "", false],
  ["kavitha", "Kavitha", "unspecified", "", "", false],
  ["rehan", "Rehan", "unspecified", "", "", false],
  ["soham", "Soham", "unspecified", "", "", false],
  ["rupali", "Rupali", "unspecified", "", "", false],
];

/**
 * Stamp the bundled catalogue with the codes the backend assigns.
 *
 * The backend numbers the three featured voices `PM-01..03` and every other
 * voice `SD-01..` in catalogue order. `VOICE_SEEDS` is written in that same
 * order, so the same rule reproduces the live codes exactly - `/voices` reads
 * the same codes before `/api/voices` answers and while it is unreachable.
 */
function withCodes<T extends { featured: boolean }>(
  rows: T[],
): (T & { code: string })[] {
  const taken = { PM: 0, SD: 0 };
  return rows.map((row) => {
    const series = row.featured ? "PM" : "SD";
    taken[series] += 1;
    return { ...row, code: `${series}-${String(taken[series]).padStart(2, "0")}` };
  });
}

/**
 * The bundled catalogue, kept for `/voices` and the dashboard's voice picker.
 * The landing page does not list voices.
 *
 * Mirrors VOICE_PROFILES in Backend/app/core/constants.py so the catalogue
 * renders with real content before /api/voices answers - and stays intact if
 * the API is unreachable. The order below is the backend's, which is what makes
 * the derived codes (PM-01, SD-01...) agree with the live catalogue.
 */
export const voices = {
  catalog: withCodes(
    VOICE_SEEDS.map(([id, name, gender, personality, use_case, featured]) => ({
      id,
      name,
      gender,
      personality,
      use_case,
      languages: SPEECH_LANGUAGES,
      preview_language: PREVIEW_LANGUAGE,
      sample_text: PREVIEW_LINE,
      featured,
      // Every base speaker is synthesised by the stable model; the personas
      // only arrive with the live catalogue.
      model: "AOTMS-V 3B",
    })),
  ) satisfies VoiceSample[],
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
