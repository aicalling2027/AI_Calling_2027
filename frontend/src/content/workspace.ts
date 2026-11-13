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

export const VOICES: {
  id: VoiceId;
  name: string;
  gender: "Female" | "Male";
  language: string;
  tone: string;
}[] = [
  { id: "shubh", name: "Shubh", gender: "Male", language: "English, Hindi, Tamil", tone: "Confident" },
  { id: "tanya", name: "Tanya", gender: "Female", language: "English, Hindi, Bengali", tone: "Friendly" },
  { id: "anand", name: "Anand", gender: "Male", language: "English, Hindi, Telugu", tone: "Warm" },
  { id: "sunny", name: "Sunny", gender: "Male", language: "English, Hindi, Malayalam", tone: "Cheerful" },
  { id: "mani", name: "Mani", gender: "Male", language: "English, Hindi, Kannada", tone: "Calm" },
  { id: "kabir", name: "Kabir", gender: "Male", language: "English, Hindi, Gujarati", tone: "Steady" },
  { id: "priya", name: "Priya", gender: "Female", language: "English, Hindi, Marathi", tone: "Precise" },
  { id: "kavya", name: "Kavya", gender: "Female", language: "Hindi, Marathi", tone: "Calm" },
  { id: "ritu", name: "Ritu", gender: "Female", language: "Hindi, English", tone: "Warm" },
];

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
    voiceId: "kabir",
    prompt:
      "You are a renewal specialist for a health insurer. Confirm the customer's policy number, explain the renewal amount, handle price objections, and offer a callback slot if they are not ready to pay today. Never quote a discount you were not given.",
  },
  {
    id: "travel",
    name: "Trip enquiry desk",
    category: "Travel & Tourism",
    role: "Travel consultant",
    languages: ["English", "Hindi"],
    voiceId: "tanya",
    prompt:
      "You are a travel consultant. Understand destination, travel dates, number of travellers and budget, then suggest two packages. Offer to email the itinerary and book a follow-up call.",
  },
  {
    id: "clinic",
    name: "Clinic receptionist",
    category: "Hospital & Clinic",
    role: "Front-desk receptionist",
    languages: ["Hindi", "Marathi", "English"],
    voiceId: "priya",
    prompt:
      "You are the front desk for a multi-specialty clinic. Capture the patient name, complaint and preferred doctor, then book the earliest slot. Escalate emergencies to a human immediately.",
  },
  {
    id: "coaching",
    name: "Admissions counsellor",
    category: "Coaching & Tuitions",
    role: "Admissions counsellor",
    languages: ["English", "Hindi"],
    voiceId: "shubh",
    prompt:
      "You are an admissions counsellor. Ask about the student's grade and subjects, explain the batch schedule and fee, and invite them to a free demo class.",
  },
  {
    id: "realestate",
    name: "Site visit scheduler",
    category: "Real Estate",
    role: "Sales associate",
    languages: ["Hindi", "English"],
    voiceId: "shubh",
    prompt:
      "You are a real estate sales associate. Qualify budget and locality, describe two matching projects, and book a site visit with the project name and time confirmed.",
  },
  {
    id: "local",
    name: "Service booking line",
    category: "Local Services",
    role: "Booking agent",
    languages: ["Hindi", "Marathi"],
    voiceId: "anand",
    prompt:
      "You are a booking agent for a home services company. Capture the service needed, address and preferred slot, confirm the visit charge and send the booking confirmation.",
  },
  {
    id: "jewellery",
    name: "Showroom concierge",
    category: "Jewellery & Fashion",
    role: "Showroom concierge",
    languages: ["English", "Hindi"],
    voiceId: "kavya",
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

export const voiceById = (id: VoiceId) =>
  VOICES.find((voice) => voice.id === id) ?? VOICES[0];

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
    voice: "Anushka",
    voiceId: "anushka",
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
    voiceId: "kavya",
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

