/**
 * Workspace data model and seed records for every dashboard module.
 *
 * The shapes mirror what the FastAPI service returns under /api/v1 (employees,
 * leads, campaigns, calls, conversations, billing), so swapping the store for
 * real requests later is a data-source change rather than a UI rewrite. All
 * values are demo data.
 */

export type AgentStatus = "Active" | "Paused" | "Draft";
export type ModelId = "sarvam-24b" | "sarvam-2b" | "sarvam-105b";
export type VoiceId = string;

/**
 * Whether an employee can answer a call, in the customer's vocabulary.
 *
 * Deliberately holds no provider identifier - no deployment id, no agent id, no
 * workspace - mirroring the API contract. A customer buys a phone line that
 * works, not a vendor object.
 */
export type CallingStatus = {
  enabled: boolean;
  state:
    | "not_configured"
    | "configuration_pending"
    | "syncing"
    | "ready_to_deploy"
    | "live"
    | "paused"
    | "sync_failed"
    | string;
  simulated: boolean;
  connected: boolean;
  lastCheckedAt: string | null;
  actionRequired: string | null;
};

export type KnowledgeSource = {
  id: string;
  name: string;
  kind: "PDF" | "DOCX" | "TXT" | "URL" | "FAQ";
  status: "Ready" | "Processing" | "Failed";
  addedAt: string;
};

export type Agent = {
  id: string;
  name: string;
  purpose: string;
  initials: string;
  tone: string;
  status: AgentStatus;
  languages: string[];
  defaultLanguage: string;
  voice: string;
  voiceId: VoiceId;
  model: string;
  modelId: ModelId;
  calls: number;
  successRate: number;
  lastActive: string;
  greeting: string;
  prompt: string;
  knowledge: KnowledgeSource[];
  actions: string[];
  outcomes: string[];
  createdAt: string;
  /** Which save of this employee's configuration the UI is looking at. */
  configurationVersion?: number;
  calling?: CallingStatus | null;
};

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Appointment"
  | "Not interested";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  agentId: string | null;
  status: LeadStatus;
  followUp: string;
  lastContact: string;
  summary: string;
};

export type CampaignStatus = "Running" | "Paused" | "Completed" | "Draft";

export type Campaign = {
  id: string;
  name: string;
  agentId: string;
  status: CampaignStatus;
  contacts: number;
  completed: number;
  answered: number;
  failed: number;
  leads: number;
  schedule: string;
  createdAt: string;
};

export type PhoneNumberRecord = {
  id: string;
  number: string;
  provider: string;
  status: "Active" | "Pending" | "Released";
  mode: "Inbound" | "Outbound" | "Both";
  agentId: string | null;
  welcome: string;
};

export type TranscriptTurn = { who: "Agent" | "Customer"; text: string };

export type Conversation = {
  id: string;
  contact: string;
  phone: string;
  agentId: string;
  direction: "Inbound" | "Outbound";
  outcome: string;
  sentiment: "Positive" | "Neutral" | "Negative" | "Unknown";
  duration: string;
  credits: number;
  startedAt: string;
  summary: string;
  transcript: TranscriptTurn[];
};

export type Invoice = {
  id: string;
  date: string;
  amount: number;
  status: "Paid" | "Due";
};

export type ApiKeyRecord = {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsed: string;
};

export type WebhookRecord = {
  id: string;
  url: string;
  events: string[];
  status: "Active" | "Disabled";
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Manager" | "Member";
  status: "Active" | "Invited";
};

export type WorkspaceSettings = {
  orgName: string;
  timezone: string;
  currency: string;
  callWindowStart: string;
  callWindowEnd: string;
  dnd: boolean;
  recordCalls: boolean;
  emailAlerts: boolean;
  whatsappAlerts: boolean;
  dailyDigest: boolean;
};

export const LANGUAGES = [
  "Hindi",
  "English",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Bengali",
  "Punjabi",
  "Odia",
  "Assamese",
  "Urdu",
  "Nepali",
  "Konkani",
  "Sanskrit",
  "Maithili",
  "Sindhi",
];

/** Native script, badge glyph and accent used by the language dropdowns. */
export type LanguageMeta = { native: string; badge: string; accent: string };

export const LANGUAGE_META: Record<string, LanguageMeta> = {
  Hindi: { native: "हिन्दी", badge: "हि", accent: "#b45309" },
  English: { native: "English", badge: "En", accent: "#185adb" },
  Marathi: { native: "मराठी", badge: "म", accent: "#0f766e" },
  Tamil: { native: "தமிழ்", badge: "த", accent: "#b91c1c" },
  Telugu: { native: "తెలుగు", badge: "తె", accent: "#a21caf" },
  Kannada: { native: "ಕನ್ನಡ", badge: "ಕ", accent: "#7c3aed" },
  Malayalam: { native: "മലയാളം", badge: "മ", accent: "#0e7490" },
  Gujarati: { native: "ગુજરાતી", badge: "ગુ", accent: "#c2410c" },
  Bengali: { native: "বাংলা", badge: "বং", accent: "#4d7c0f" },
  Punjabi: { native: "ਪੰਜਾਬੀ", badge: "ਪੰ", accent: "#be185d" },
  Odia: { native: "ଓଡ଼ିଆ", badge: "ଓ", accent: "#1d4ed8" },
  Assamese: { native: "অসমীয়া", badge: "অ", accent: "#047857" },
  Urdu: { native: "اردو", badge: "ار", accent: "#4338ca" },
  Nepali: { native: "नेपाली", badge: "ने", accent: "#7e22ce" },
  Konkani: { native: "कोंकणी", badge: "कों", accent: "#9a3412" },
  Sanskrit: { native: "संस्कृतम्", badge: "सं", accent: "#57534e" },
  Maithili: { native: "मैथिली", badge: "मै", accent: "#155e75" },
  Sindhi: { native: "سنڌي", badge: "سن", accent: "#9d174d" },
};

/** Backend language codes (BCP-47). The UI shows the display name, the API
 * only accepts the code, so both directions go through these two helpers. */
export const LANGUAGE_CODES: Record<string, string> = {
  Hindi: "hi-IN",
  English: "en-IN",
  Marathi: "mr-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
  Gujarati: "gu-IN",
  Bengali: "bn-IN",
  Punjabi: "pa-IN",
  Odia: "or-IN",
  Assamese: "as-IN",
  Urdu: "ur-IN",
  Nepali: "ne-IN",
  Konkani: "kok-IN",
  Sanskrit: "sa-IN",
  Maithili: "mai-IN",
  Sindhi: "sd-IN",
};

export const languageCode = (name: string) => LANGUAGE_CODES[name] ?? "en-IN";

export const languageFromCode = (code: string) =>
  Object.keys(LANGUAGE_CODES).find((name) => LANGUAGE_CODES[name] === code) ?? code;

export const BUSINESS_CATEGORIES = [
  "Insurance & Finance",
  "Travel & Tourism",
  "Hospital & Clinic",
  "Coaching & Tuitions",
  "Real Estate",
  "Local Services",
  "Jewellery & Fashion",
];

export const MODELS: {
  id: ModelId;
  name: string;
  provider: string;
  note: string;
  speed: string;
}[] = [
  {
    id: "sarvam-24b",
    name: "Sarvam-M 24B",
    provider: "Sarvam AI",
    note: "Best reasoning for sales and renewals calls.",
    speed: "Balanced",
  },
  {
    id: "sarvam-2b",
    name: "Sarvam-M 2B",
    provider: "Sarvam AI",
    note: "Cheapest per minute, good for short qualification calls.",
    speed: "Fastest",
  },
  {
    id: "sarvam-105b",
    name: "Sarvam-M 105B",
    provider: "Sarvam AI",
    note: "Deepest understanding for complex multi-step conversations.",
    speed: "Most capable",
  },
];

/** `Unspecified` is used where the catalogue does not label the voice. */
export type VoiceGender = "Female" | "Male" | "Unspecified";

/** One entry of the voice picker. */
export type Voice = {
  id: VoiceId;
  /** Speaker name a sample is synthesised from; empty when none is known. */
  slug: string;
  name: string;
  gender: VoiceGender;
  language: string;
  tone: string;
};

/**
 * The voices the catalogue publishes a name for, in catalogue order.
 *
 * Three rules shape this list:
 *
 * - `id` is the identifier the catalogue issues and the only value stored on an
 *   employee. It is never rendered: the card shows `name`, so the customer sees
 *   a colleague, not a provider object.
 * - `slug` is a stable handle for templates, which are written by name, and it
 *   is the speaker name the live preview is synthesised from.
 * - `gender` says "Unspecified" when the catalogue does not label the voice.
 *   The nine original presets keep their labels so existing employees read the
 *   same as before.
 *
 * Audio samples live in `public/voices`; see `voiceSampleSources` for the
 * filenames that are accepted, and `voicePreviewUrl` for the live fallback.
 */
const NAMED_VOICES: Voice[] = [
  { id: "01a0cf16-7021-76f7-a0cc-9d065cdb30a8", slug: "shubh", name: "Shubh", gender: "Male", language: "English, Hindi, Tamil", tone: "Confident" },
  { id: "01a0cf16-5726-7055-8622-322e53f6bc77", slug: "tanya", name: "Tanya", gender: "Female", language: "English, Hindi, Bengali", tone: "Friendly" },
  { id: "01a0cf16-73d4-78aa-a416-c593287484db", slug: "anand", name: "Anand", gender: "Male", language: "English, Hindi, Telugu", tone: "Warm" },
  { id: "01a0cf16-6001-7fac-b2c3-96de29fc6cd6", slug: "sunny", name: "Sunny", gender: "Male", language: "English, Hindi, Malayalam", tone: "Cheerful" },
  { id: "01a0cf16-729b-720b-bf53-1e18c3d5a5da", slug: "mani", name: "Mani", gender: "Male", language: "English, Hindi, Kannada", tone: "Calm" },
  { id: "01a0cf16-655d-78cb-8b68-a000a3e4878e", slug: "kabir", name: "Kabir", gender: "Male", language: "English, Hindi, Gujarati", tone: "Steady" },
  { id: "01a0cf16-6ecd-7a97-b86b-f91eeadd5bd7", slug: "priya", name: "Priya", gender: "Female", language: "English, Hindi, Marathi", tone: "Precise" },
  { id: "01a0cf16-6b54-7b44-8dff-e67586a9762a", slug: "kavya", name: "Kavya", gender: "Female", language: "Hindi, Marathi", tone: "Calm" },
  { id: "01a0cf16-5a52-747d-8900-0a77b9f5402c", slug: "ritu", name: "Ritu", gender: "Female", language: "Hindi, English", tone: "Warm" },
  // The catalogue issues ids, but a sample is synthesised from a speaker name,
  // so these five are named after the speaker that can actually be heard.
  { id: "01a0cf16-68c6-7341-8408-bceec24a6a06", slug: "aditya", name: "Aditya", gender: "Male", language: "All supported languages", tone: "Clear" },
  { id: "01a0cf16-5c61-787d-a83f-ae54ce8c0f96", slug: "simran", name: "Simran", gender: "Female", language: "All supported languages", tone: "Bright" },
  { id: "01a0cf16-7179-7472-b7df-b7b432d5faa5", slug: "rahul", name: "Rahul", gender: "Male", language: "All supported languages", tone: "Assured" },
  { id: "01a0cf16-6c54-746b-815a-2e1cf51a473a", slug: "neha", name: "Neha", gender: "Female", language: "All supported languages", tone: "Gentle" },
  { id: "01a0cf16-6a07-7cee-b592-494b2d213be1", slug: "shreya", name: "Shreya", gender: "Female", language: "All supported languages", tone: "Lively" },
];

/**
 * Catalogue ids that arrive without a name or a speaker.
 *
 * The speech API only knows speaker names, so nothing can be synthesised from
 * an id alone: these voices are selectable and storable, but they have no
 * sample. They are labelled by position (`Voice 15` ...) because inventing a
 * name for a voice nobody has heard would be a claim the product cannot
 * support.
 */
const UNNAMED_VOICE_IDS: VoiceId[] = [
  "01a0cf16-c8fa-7c70-a30e-0896e4695e86",
  "01a0cf16-8d27-75e7-a4f8-f71f57f86443",
  "01a0cf16-944c-78eb-9f80-81eb02c4bcb9",
  "01a0cf16-90ae-7470-941d-2c1f17b37528",
  "01a0e8fc-b042-7326-a139-e97058ab7c50",
  "01a0cf16-e8b3-7f97-909b-27be790e7330",
  "01a0cf16-98e5-7477-b1c4-73db8ad8ba82",
  "01a0cf16-8c17-7394-a54d-d11431e8a13a",
  "01a0e8fc-a461-75e4-b7d4-43e84745eee6",
  "01a0cf16-97b2-72b5-bdc4-4785b7a334ed",
  "01a0e8fc-9b0d-7595-b5b6-4ba0d403c566",
  "01a0cf16-b5cd-7a8b-a0f5-f3889c932e82",
  "01a0e8fc-8c7f-7a29-ad18-34060dd8bac2",
  "01a0e8fc-aee0-7e7b-9dd9-11c12bbe2bcd",
  "01a0e8fc-865c-715e-993e-3478d3a1fc1c",
  "01a0cf1a-7d5a-7bca-a22b-f36f7c6c1bbe",
  "01a0e8fc-87f8-73ff-bbc9-2b8b802b2b13",
  "01a0cf16-8e7d-72c5-9a8b-e3c431253630",
  "01a0cf16-955f-71e1-b1b6-68bf2fcf2172",
  "01a0cf16-96aa-7c19-89c0-2978daac5737",
  "01a0cf16-b371-767c-b137-81a1cd4d9eed",
  "01a0e8fc-b332-7ea8-9f1d-4f5495aff777",
  "01a0cf16-ecd8-7d99-8aab-265fd11bc871",
  "01a0e8fc-b0f1-72a6-ad04-96656a0d28d2",
  "01a0cf16-eba8-7528-a44c-eb42d4b2b5d9",
  "01a0cf16-e9ab-77e9-9953-2238f05c7110",
  "01a0cf16-b252-7218-996b-1d4902aae830",
  "01a0cf16-eddc-7cb3-823b-88731b6cbe29",
  "01a0cf17-0b6e-79f0-b8ab-7392cabc497b",
  "01a0e8fc-b2bb-781b-a7fa-f5b43f946f03",
  "01a0cf16-eabc-779c-a266-b37c1967acb3",
  "01a0e8fc-b168-741f-87a9-3ba15a7628ec",
  "01a0cf16-b474-782d-9743-13bdfc4c9a25",
  "01a0cf16-897b-76f8-8de9-34f27e861df6",
  "01a0cf16-8ac9-7d36-866f-b19d0c05a72d",
  "01a0cf17-17b8-7952-ab5c-ed9ea97a6925",
  "01a0cf17-1650-73b7-ac23-aad040439447",
  "01a0cf16-ef1b-7525-91f7-03bca0da8bf4",
  "01a0cf16-9a05-79b1-8110-4b923c936015",
  "01a0cf16-aff2-7919-b06c-9c03433f2ffd",
  "01a0cf17-07ec-7e82-976c-1115f36dda1b",
  "01a0cf16-ad8b-762d-8e12-73ddbae38db8",
  "01a0cf16-aee5-7a59-981c-e4e7b8b148a0",
  "01a0cf17-154d-7cc0-b5c3-b11b350d519b",
  "01a0cf16-da10-74b6-a33b-9640d0f046fd",
  "01a0cf16-d697-7eb3-b04f-79641a0aaef2",
  "01a0cf16-d30b-796e-b775-e33f383b004b",
  "01a0cf16-d447-7a70-a2a0-4dc350038a24",
  "01a0e8fc-aa0e-78f5-96a4-b4640a6446f9",
  "01a0e8fc-ab43-77e8-ab9d-2cec9ec5dfac",
  "01a0cf16-d8d6-70e3-8282-7494b008cb37",
  "01a0cf16-db1d-7fa1-b803-6c76b70c2917",
  "01a0cf16-dc66-7811-a129-ac6855ef5ca9",
  "01a0cf17-0200-70eb-86af-68c0147d2351",
  "01a0e8fc-accd-7171-b0e6-e952a20fc408",
  "01a0e8fc-abc0-7c93-aa6a-174eb836a648",
  "01a0e8fc-86d1-72b5-89d8-37018dd049b4",
  "01a0cf16-de84-785d-b91b-7b47965d373d",
  "01a0cf16-df9b-76dc-a9e1-e3981efacba0",
  "01a0cf16-dd5f-77fa-8a45-4a6c01663eb1",
  "01a0cf16-d541-7554-a9ad-1e8964aeb427",
  "01a0cf16-d7da-7f22-b00b-b454c7a709ba",
  "01a0e8fc-b801-7a88-a9c6-7c4dc2755a01",
  "01a0cf16-e562-7c39-a3fb-24ec65422292",
  "01a0e8fc-b777-79fe-be74-548740a07d96",
  "01a0cf16-f693-7823-b244-369096928e66",
  "01a0cf16-f569-72ca-b0a6-e1e973c00ae7",
  "01a0cf16-f486-7d5c-b1cc-7f6a3eef52e3",
  "01a0e8fc-b87f-7efc-a4a0-908a32674ffb",
  "01a0cf16-ca3d-739c-aaa2-2a9d61f94abf",
  "01a0cf16-cc50-70f1-a3c2-fc8b0afff87e",
  "01a0e8fc-a176-70dc-8444-4043e6271041",
  "01a0cf16-c7f5-7248-8cf6-4eb9a5bb264d",
  "01a0cf16-cb52-7d7d-b708-4ae241366ee1",
  "01a0cf16-cd9f-7de5-b8e3-7d438ebb57cd",
  "01a0e8fc-a296-7e2c-a431-b055396bb790",
  "01a0cf16-cfd4-71b3-9254-b921720f3ed0",
  "01a0e8fc-a31d-7e65-a508-8b62a5d45639",
  "01a0cf16-c6b0-74a8-93b8-0f8fbd35a74d",
  "01a0cf16-cea3-70e6-931b-9dc276d6675f",
  "01a0cf16-d0cd-7e3a-a054-2bb4a1310538",
  "01a0e8fc-a5ba-71fe-abcc-5543b864c9fb",
  "01a0cf16-a1c6-7d20-8675-7b4941347f1e",
  "01a0cf16-a0c0-76f9-8d2e-79635434a78a",
  "01a0cf16-d212-7f69-b4e0-60b1b45d8c29",
  "01a0e8fc-ba8b-79c2-83f9-f64f06fa03f1",
  "01a0e8fc-9a2a-76d9-b143-e250fa1d6be1",
  "01a0cf16-beba-74d5-b4e1-fa97f11587f6",
  "01a0e8fc-9d8f-7ba3-9397-3c0443e9f918",
  "01a0cf16-b718-7896-89b7-f64266beb2c8",
  "01a0cf16-b828-78d4-819d-0ec6fc85b3f0",
  "01a0cf16-b98a-7203-8697-5e09e2b95a62",
  "01a0cf16-bba3-7c6d-a76d-b866f9063987",
  "01a0cf16-bc9f-724e-a450-37b605a509f8",
  "01a0cf16-bdbf-7e26-bdc5-0235e462d043",
  "01a0cf16-ba80-7ea3-9e61-8e5a0381560b",
  "01a0e8fc-afcd-77b6-acfe-4c0341856ee6",
  "01a0cf16-c013-7907-8311-4977d02f37f5",
  "01a0cf16-c153-7c18-bee4-b599f3a8f423",
  "01a0cf16-c253-72de-a0e3-d99c8127a4bd",
  "01a0cf16-c38c-7c6c-8e6a-f0bd7af56a16",
  "01a0cf16-c494-7231-b33d-fc186090959f",
  "01a0cf17-12bd-7de3-9df0-f607db604d52",
  "01a0e8fc-9b80-7cb2-aaec-6a9b030b4d36",
  "01a0cf1a-7e84-7b02-af0f-cc692f99bcc3",
  "01a0cf16-e0d7-7870-a832-83bdd785052c",
  "01a0cf16-e219-74ee-8e6c-a1e3d5df8d11",
  "01a0e8fc-9f41-7d10-9f15-1720a4b077d0",
  "01a0e8fc-a540-7db8-b919-feda80526484",
  "01a0cf16-a32a-730c-9800-0451f3f6598e",
  "01a0cf16-e455-7887-b274-77f1c903825f",
  "01a0cf16-fec7-72d5-8803-5ea3ea7b5e8a",
];

/** Everything the voice picker shows: named voices first, then the rest. */
export const VOICES: Voice[] = [
  ...NAMED_VOICES,
  ...UNNAMED_VOICE_IDS.map((id, index) => ({
    id,
    slug: "",
    name: `Voice ${NAMED_VOICES.length + index + 1}`,
    gender: "Unspecified" as VoiceGender,
    language: "",
    tone: "",
  })),
];

/** The id behind a stable slug, for templates written against a voice name. */
export const voiceIdBySlug = (slug: string) =>
  VOICES.find((voice) => voice.slug === slug)?.id ?? VOICES[0].id;

/**
 * Filenames a sample may live at, tried in order.
 *
 * The id is preferred. The 1-based position is accepted as well, so files can
 * be dropped into `public/voices` as `01.mp3`, `02.mp3`, ... without renaming.
 */
export function voiceSampleSources(
  voice: { id: string },
  position: number,
): string[] {
  return [
    `/voices/${voice.id}.mp3`,
    `/voices/${String(position).padStart(2, "0")}.mp3`,
    `/voices/${voice.id}.wav`,
  ];
}

/**
 * Live sample for a voice, used when no file has been uploaded yet.
 *
 * The speech API knows speakers by name, not by the id an employee stores, so
 * the slug is what goes on the wire.
 */
export const voicePreviewUrl = (voice: { slug: string }) =>
  `/api/voices/${voice.slug}/preview`;

export const TEMPLATES: {
  id: string;
  name: string;
  category: string;
  role: string;
  languages: string[];
  voiceId: VoiceId;
  prompt: string;
}[] = [
  {
    id: "insurance",
    name: "Policy renewal caller",
    category: "Insurance & Finance",
    role: "Renewal specialist",
    languages: ["Hindi", "English"],
    voiceId: voiceIdBySlug("kabir"),
    prompt:
      "You are a renewal specialist for a health insurer. Confirm the customer's policy number, explain the renewal amount, handle price objections, and offer a callback slot if they are not ready to pay today. Never quote a discount you were not given.",
  },
  {
    id: "travel",
    name: "Trip enquiry desk",
    category: "Travel & Tourism",
    role: "Travel consultant",
    languages: ["English", "Hindi"],
    voiceId: voiceIdBySlug("tanya"),
    prompt:
      "You are a travel consultant. Understand destination, travel dates, number of travellers and budget, then suggest two packages. Offer to email the itinerary and book a follow-up call.",
  },
  {
    id: "clinic",
    name: "Clinic receptionist",
    category: "Hospital & Clinic",
    role: "Front-desk receptionist",
    languages: ["Hindi", "Marathi", "English"],
    voiceId: voiceIdBySlug("priya"),
    prompt:
      "You are the front desk for a multi-specialty clinic. Capture the patient name, complaint and preferred doctor, then book the earliest slot. Escalate emergencies to a human immediately.",
  },
  {
    id: "coaching",
    name: "Admissions counsellor",
    category: "Coaching & Tuitions",
    role: "Admissions counsellor",
    languages: ["English", "Hindi"],
    voiceId: voiceIdBySlug("shubh"),
    prompt:
      "You are an admissions counsellor. Ask about the student's grade and subjects, explain the batch schedule and fee, and invite them to a free demo class.",
  },
  {
    id: "realestate",
    name: "Site visit scheduler",
    category: "Real Estate",
    role: "Sales associate",
    languages: ["Hindi", "English"],
    voiceId: voiceIdBySlug("shubh"),
    prompt:
      "You are a real estate sales associate. Qualify budget and locality, describe two matching projects, and book a site visit with the project name and time confirmed.",
  },
  {
    id: "local",
    name: "Service booking line",
    category: "Local Services",
    role: "Booking agent",
    languages: ["Hindi", "Marathi"],
    voiceId: voiceIdBySlug("anand"),
    prompt:
      "You are a booking agent for a home services company. Capture the service needed, address and preferred slot, confirm the visit charge and send the booking confirmation.",
  },
  {
    id: "jewellery",
    name: "Showroom concierge",
    category: "Jewellery & Fashion",
    role: "Showroom concierge",
    languages: ["English", "Hindi"],
    voiceId: voiceIdBySlug("kavya"),
    prompt:
      "You are a jewellery showroom concierge. Understand the occasion and budget, describe two collections, and invite the customer to a private viewing at the nearest showroom.",
  },
];

export const OUTCOME_OPTIONS = [
  "Interested",
  "Not interested",
  "Qualified lead",
  "Unqualified lead",
  "Appointment scheduled",
  "Callback requested",
  "Follow-up required",
  "No answer",
  "Failed",
  "Human transfer",
];

export const AGENT_ACTIONS = [
  "Capture lead information",
  "Schedule appointment",
  "Create follow-up",
  "Send notification",
  "Transfer to human",
  "Trigger webhook",
  "Update CRM",
  "Send WhatsApp message",
];

export const LEAD_SOURCES = [
  "Instant leads",
  "Bulk campaigns",
  "Inbound calls",
  "Google Sheets",
  "Meta lead ads",
  "Manual upload",
  "API integration",
];

const TONES = [
  "bg-cobalt-tint text-cobalt-deep",
  "bg-mist text-ink-soft",
  "bg-tangerine-tint text-tangerine-ink",
];

export const modelById = (id: ModelId) =>
  MODELS.find((model) => model.id === id) ?? MODELS[0];

/**
 * Resolve a stored voice to its catalogue entry.
 *
 * Employees saved before the catalogue moved to ids hold a slug, so both are
 * accepted; without that an existing employee would silently display the first
 * voice in the list.
 */
export const voiceById = (id: VoiceId) =>
  VOICES.find((voice) => voice.id === id) ??
  VOICES.find((voice) => voice.slug === id) ??
  VOICES[0];

export const templateById = (id: string) =>
  TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];

/** "Meera · Inbound support" style label for selects. */
export const agentLabel = (agent: { name: string; purpose: string }) =>
  `${agent.name} · ${agent.purpose}`;

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function toneForIndex(index: number) {
  return TONES[index % TONES.length];
}

export const seedAgents: Agent[] = [
  {
    id: "aarav",
    name: "Aarav",
    purpose: "Renewals",
    initials: "AR",
    tone: TONES[0],
    status: "Active",
    languages: ["Hindi", "English"],
    defaultLanguage: "Hindi",
    voice: "Shubh",
    voiceId: voiceIdBySlug("shubh"),
    model: "Sarvam-M 24B",
    modelId: "sarvam-24b",
    calls: 1284,
    successRate: 74,
    lastActive: "3 min ago",
    greeting:
      "Namaste, main Aarav bol raha hoon aapki health policy renewal ke baare mein. Do minute hain abhi?",
    prompt:
      "You are a renewal specialist calling existing health-insurance customers. Confirm identity, state the renewal amount, handle price objections with the value framing below, and offer a callback slot if the customer is not ready.",
    knowledge: [
      {
        id: "k1",
        name: "Renewal rate sheet.pdf",
        kind: "PDF",
        status: "Ready",
        addedAt: "2 Nov",
      },
      {
        id: "k2",
        name: "Policy FAQ.docx",
        kind: "DOCX",
        status: "Processing",
        addedAt: "12 Nov",
      },
    ],
    actions: ["Capture lead information", "Create follow-up", "Send WhatsApp message"],
    outcomes: ["Interested", "Callback requested", "Not interested", "No answer"],
    createdAt: "12 Oct 2026",
  },
  {
    id: "meera",
    name: "Meera",
    purpose: "Inbound support",
    initials: "MR",
    tone: TONES[1],
    status: "Active",
    languages: ["Hindi", "Marathi", "English"],
    defaultLanguage: "Hindi",
    voice: "Kavya",
    voiceId: voiceIdBySlug("kavya"),
    model: "Sarvam-M 24B",
    modelId: "sarvam-24b",
    calls: 2410,
    successRate: 81,
    lastActive: "just now",
    greeting:
      "Thank you for calling AOTMS support. This is Meera. How can I help you today?",
    prompt:
      "You are the inbound support agent. Identify the customer, summarise their issue, resolve anything covered by the support playbook, and transfer billing disputes to a human.",
    knowledge: [
      {
        id: "k3",
        name: "Support playbook.pdf",
        kind: "PDF",
        status: "Ready",
        addedAt: "28 Oct",
      },
    ],
    actions: ["Schedule appointment", "Transfer to human", "Send notification"],
    outcomes: ["Qualified lead", "Appointment scheduled", "Human transfer", "Failed"],
    createdAt: "2 Sep 2026",
  },
  {
    id: "kabir",
    name: "Kabir",
    purpose: "Lead qualification",
    initials: "KB",
    tone: TONES[2],
    status: "Paused",
    languages: ["English", "Tamil"],
    defaultLanguage: "English",
    voice: "Arjun",
    voiceId: "arjun",
    model: "Sarvam-M 2B",
    modelId: "sarvam-2b",
    calls: 318,
    successRate: 62,
    lastActive: "2 days ago",
    greeting:
      "Hi, this is Kabir from AOTMS. I have two quick questions about the enquiry you submitted.",
    prompt:
      "You qualify inbound leads for a SaaS product. Confirm company size, current tooling and timeline, score the lead from 1 to 5, and book a demo for scores of 4 and above.",
    knowledge: [],
    actions: ["Capture lead information", "Update CRM", "Trigger webhook"],
    outcomes: ["Qualified lead", "Unqualified lead", "Follow-up required"],
    createdAt: "20 Oct 2026",
  },
];

export const seedLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Rohit Sharma",
    phone: "+91 98204 11822",
    email: "rohit.sharma@example.com",
    source: "Inbound calls",
    agentId: "meera",
    status: "Qualified",
    followUp: "Today, 4:30 pm",
    lastContact: "2 min ago",
    summary: "Booked a policy review call for Thursday; asked about family floater.",
  },
  {
    id: "lead-2",
    name: "Anita Deshmukh",
    phone: "+91 99870 45510",
    email: "anita.d@example.com",
    source: "Bulk campaigns",
    agentId: "aarav",
    status: "Appointment",
    followUp: "Tomorrow, 11:00 am",
    lastContact: "11 min ago",
    summary: "Renewal due on 28 Nov. Wants the 10-lakh cover with no room-rent cap.",
  },
  {
    id: "lead-3",
    name: "Faizan Qureshi",
    phone: "+91 90042 77361",
    email: "faizan.q@example.com",
    source: "Manual upload",
    agentId: "kabir",
    status: "New",
    followUp: "Today, 6:00 pm",
    lastContact: "24 min ago",
    summary: "Did not answer the first attempt; retry scheduled in the evening slot.",
  },
  {
    id: "lead-4",
    name: "Lakshmi Iyer",
    phone: "+91 98840 22109",
    email: "lakshmi.iyer@example.com",
    source: "Inbound calls",
    agentId: "meera",
    status: "Qualified",
    followUp: "Today, 5:15 pm",
    lastContact: "38 min ago",
    summary: "Asked about maternity cover; sending the comparison sheet on WhatsApp.",
  },
  {
    id: "lead-5",
    name: "Vikram Singh",
    phone: "+91 98110 60742",
    email: "vikram.singh@example.com",
    source: "Bulk campaigns",
    agentId: "aarav",
    status: "Not interested",
    followUp: "—",
    lastContact: "1 hr ago",
    summary: "Already renewed through another broker. Do not call again this cycle.",
  },
  {
    id: "lead-6",
    name: "Sneha Kulkarni",
    phone: "+91 90280 31947",
    email: "sneha.k@example.com",
    source: "Instant leads",
    agentId: "meera",
    status: "Contacted",
    followUp: "Thursday, 10:00 am",
    lastContact: "1 hr ago",
    summary: "Needs a quote for a family of four; compares two insurers this week.",
  },
];

export const seedCampaigns: Campaign[] = [
  {
    id: "camp-1",
    name: "HDFC renewals",
    agentId: "aarav",
    status: "Completed",
    contacts: 420,
    completed: 412,
    answered: 386,
    failed: 12,
    leads: 41,
    schedule: "10am – 6pm, Mon–Fri",
    createdAt: "2 Nov",
  },
  {
    id: "camp-2",
    name: "Diwali offer · Pune",
    agentId: "aarav",
    status: "Running",
    contacts: 1200,
    completed: 640,
    answered: 561,
    failed: 32,
    leads: 63,
    schedule: "11am – 7pm, daily",
    createdAt: "9 Nov",
  },
  {
    id: "camp-3",
    name: "Insurance follow-up",
    agentId: "kabir",
    status: "Paused",
    contacts: 300,
    completed: 0,
    answered: 0,
    failed: 0,
    leads: 0,
    schedule: "2pm – 6pm, Mon–Sat",
    createdAt: "11 Nov",
  },
  {
    id: "camp-4",
    name: "Clinic appointments",
    agentId: "meera",
    status: "Completed",
    contacts: 180,
    completed: 180,
    answered: 171,
    failed: 4,
    leads: 22,
    schedule: "9am – 1pm, Mon–Sat",
    createdAt: "28 Oct",
  },
];

export const seedNumbers: PhoneNumberRecord[] = [
  {
    id: "num-1",
    number: "+91 80199 52233",
    provider: "Sarvam SIP",
    status: "Active",
    mode: "Both",
    agentId: "aarav",
    welcome: "Thank you for calling AOTMS. Connecting you to Aarav.",
  },
  {
    id: "num-2",
    number: "+91 80442 71800",
    provider: "Sarvam SIP",
    status: "Active",
    mode: "Inbound",
    agentId: "meera",
    welcome: "AOTMS support, this is Meera. How can I help?",
  },
  {
    id: "num-3",
    number: "+91 90000 12345",
    provider: "Exotel",
    status: "Pending",
    mode: "Outbound",
    agentId: null,
    welcome: "",
  },
  {
    id: "num-4",
    number: "+91 79000 44112",
    provider: "Sarvam SIP",
    status: "Active",
    mode: "Inbound",
    agentId: "meera",
    welcome: "AOTMS clinic desk, how may I assist you?",
  },
];

export const seedConversations: Conversation[] = [
  {
    id: "conv-1",
    contact: "Rohit Sharma",
    phone: "+91 98204 11822",
    agentId: "meera",
    direction: "Inbound",
    outcome: "Appointment scheduled",
    sentiment: "Positive",
    duration: "4:12",
    credits: 12,
    startedAt: "12 Nov, 11:42 am",
    summary:
      "Customer called to check family floater details. Meera explained the 10-lakh plan and booked a policy review on Thursday at 4:30 pm.",
    transcript: [
      { who: "Agent", text: "Thank you for calling AOTMS support. This is Meera. How can I help you today?" },
      { who: "Customer", text: "Hi, I wanted to check what the family floater covers for two adults and a child." },
      { who: "Agent", text: "The 10-lakh floater covers all three under one sum insured, with no room-rent cap. Shall I book a policy review with a specialist?" },
      { who: "Customer", text: "Yes please, Thursday evening works." },
    ],
  },
  {
    id: "conv-2",
    contact: "Anita Deshmukh",
    phone: "+91 99870 45510",
    agentId: "aarav",
    direction: "Outbound",
    outcome: "Interested",
    sentiment: "Positive",
    duration: "2:38",
    credits: 8,
    startedAt: "12 Nov, 11:33 am",
    summary:
      "Renewal reminder. Anita wants the 10-lakh cover but asked for the room-rent cap to be removed. Callback agreed for tomorrow at 11 am.",
    transcript: [
      { who: "Agent", text: "Namaste, main Aarav bol raha hoon aapki health policy renewal ke liye. Do minute hain?" },
      { who: "Customer", text: "Haan boliye, renewal kitne ka hai?" },
      { who: "Agent", text: "Aath hazaar do sau saath rupaye. Aap chahein toh room-rent cap hata kar bhi le sakte hain." },
      { who: "Customer", text: "Theek hai, kal subah call karna." },
    ],
  },
  {
    id: "conv-3",
    contact: "Faizan Qureshi",
    phone: "+91 90042 77361",
    agentId: "kabir",
    direction: "Outbound",
    outcome: "No answer",
    sentiment: "Unknown",
    duration: "0:00",
    credits: 2,
    startedAt: "12 Nov, 11:20 am",
    summary: "First attempt rang out after 30 seconds. Retry queued for the evening slot.",
    transcript: [{ who: "Agent", text: "No answer — the call was not connected." }],
  },
  {
    id: "conv-4",
    contact: "Lakshmi Iyer",
    phone: "+91 98840 22109",
    agentId: "meera",
    direction: "Inbound",
    outcome: "Qualified lead",
    sentiment: "Positive",
    duration: "6:04",
    credits: 18,
    startedAt: "12 Nov, 11:06 am",
    summary:
      "Asked about maternity cover and the waiting period. Meera qualified the lead and promised a comparison sheet on WhatsApp.",
    transcript: [
      { who: "Agent", text: "AOTMS support, this is Meera. How can I help?" },
      { who: "Customer", text: "I am planning a pregnancy next year. What is the waiting period for maternity?" },
      { who: "Agent", text: "Most plans cover maternity after two policy years. I can send a comparison of three plans that waive the first-year check-up." },
      { who: "Customer", text: "Please do, and call me tomorrow evening." },
    ],
  },
  {
    id: "conv-5",
    contact: "Vikram Singh",
    phone: "+91 98110 60742",
    agentId: "aarav",
    direction: "Outbound",
    outcome: "Not interested",
    sentiment: "Negative",
    duration: "1:21",
    credits: 4,
    startedAt: "12 Nov, 10:48 am",
    summary:
      "Already renewed through another broker. Requested no further calls this cycle; flagged as do-not-call until February.",
    transcript: [
      { who: "Agent", text: "Namaste, aapki policy renewal ke baare mein baat karni thi." },
      { who: "Customer", text: "Maine already renew karwa liya kisi aur broker se. Ab call mat karna." },
      { who: "Agent", text: "Samajh gaya, main aapka number February tak do-not-call par daal deta hoon." },
    ],
  },
  {
    id: "conv-6",
    contact: "Sneha Kulkarni",
    phone: "+91 90280 31947",
    agentId: "meera",
    direction: "Inbound",
    outcome: "Successful",
    sentiment: "Neutral",
    duration: "3:47",
    credits: 11,
    startedAt: "12 Nov, 10:31 am",
    summary:
      "Shared the premium for a family of four, explained the two add-ons and agreed a Thursday call to finalise.",
    transcript: [
      { who: "Agent", text: "AOTMS support, this is Meera. How can I help?" },
      { who: "Customer", text: "I need a quote for two adults and two children." },
      { who: "Agent", text: "For a 10-lakh floater that is thirteen thousand four hundred a year, including the hospital-cash add-on." },
      { who: "Customer", text: "Okay, I will compare and call back Thursday." },
    ],
  },
];

export const seedInvoices: Invoice[] = [
  { id: "INV-2026-011", date: "1 Nov 2026", amount: 8260, status: "Paid" },
  { id: "INV-2026-010", date: "1 Oct 2026", amount: 8260, status: "Paid" },
  { id: "INV-2026-009", date: "1 Sep 2026", amount: 6490, status: "Paid" },
  { id: "INV-2026-012", date: "1 Dec 2026", amount: 8260, status: "Due" },
];

export const seedApiKeys: ApiKeyRecord[] = [
  { id: "key-1", label: "Production server", prefix: "sk_live_9f2a", createdAt: "2 Nov", lastUsed: "4 min ago" },
  { id: "key-2", label: "n8n workflow", prefix: "sk_live_31cd", createdAt: "18 Oct", lastUsed: "1 hr ago" },
];

export const seedWebhooks: WebhookRecord[] = [
  {
    id: "wh-1",
    url: "https://hooks.aotms.si/n8n/calls",
    events: ["call.completed", "call.failed"],
    status: "Active",
  },
  {
    id: "wh-2",
    url: "https://crm.example.com/hook",
    events: ["lead.created"],
    status: "Disabled",
  },
];

export const seedTeam: TeamMember[] = [
  { id: "tm-1", name: "Ameen Ahamed", email: "ameen@aotms.com", role: "Owner", status: "Active" },
  { id: "tm-2", name: "Priya Nair", email: "priya@aotms.com", role: "Admin", status: "Active" },
  { id: "tm-3", name: "Rahul Verma", email: "rahul@aotms.com", role: "Manager", status: "Active" },
  { id: "tm-4", name: "Divya Menon", email: "divya@aotms.com", role: "Member", status: "Invited" },
];

export const seedSettings: WorkspaceSettings = {
  orgName: "Academy of Tech Masters",
  timezone: "Asia/Kolkata",
  currency: "INR",
  callWindowStart: "09:00",
  callWindowEnd: "19:00",
  dnd: true,
  recordCalls: true,
  emailAlerts: true,
  whatsappAlerts: true,
  dailyDigest: false,
};

/** Plan figures for the billing screen. */
export const billing = {
  plan: "Growth",
  price: 8260,
  renewal: "1 Dec 2026",
  creditsIncluded: 12000,
  creditsUsed: 7412,
  seats: 4,
  seatsIncluded: 5,
};

export const usageByModule = [
  { label: "Bulk campaigns", calls: 1892, credits: 4120 },
  { label: "Instant leads", calls: 640, credits: 1480 },
  { label: "Inbound calls", calls: 1814, credits: 1362 },
  { label: "Employee tests", calls: 466, credits: 450 },
];

