/**
 * Industry, language and city landing content.
 *
 * These three families share one template each. Each entry carries only the
 * fields that genuinely differ; the template supplies the shared structure so
 * hundreds of URL variants can be generated from a small data file.
 *
 * PLACEHOLDER policy: no local customer counts, market shares or performance
 * figures appear anywhere in this file.
 */

import type { CardItem } from "@/components/sections/cards";
import type { FaqItem } from "@/components/sections/faq";
import type { IconName } from "@/components/layout/icon";

/* --------------------------------------------------------------- industries */

export type IndustryPage = {
  slug: string;
  name: string;
  /** Unique <h1>. */
  title: string;
  metaDescription: string;
  summary: string;
  icon: IconName;
  challenges: CardItem[];
  plays: { title: string; body: string }[];
  /** What the team should look at after the first week. */
  review: string[];
  faq: FaqItem[];
};

const sharedIndustryFaq = (name: string): FaqItem[] => [
  {
    question: `Do you already work with ${name.toLowerCase()} businesses?`,
    answer:
      "The scripts on this page describe the intended use case. Ask the AOTMS team for current references before you rely on sector experience as a selection criterion.",
  },
  {
    question: "Can the script match our own qualification questions?",
    answer:
      "Yes. The questions, permitted answers and escalation rules are configured per account, then reviewed with you before the first call.",
  },
  {
    question: "Which language would we start in?",
    answer:
      "Whichever language the majority of your enquiries arrive in. Adding languages later is a configuration change, not a new system.",
  },
];

export const industries: IndustryPage[] = [
  {
    slug: "real-estate",
    name: "Real estate",
    title: "Answer every property enquiry before the buyer calls someone else.",
    metaDescription:
      "AI voice calling for real estate: answer enquiries at any hour, qualify budget and location, and pass site-visit-ready leads to your team.",
    summary:
      "Property enquiries arrive in bursts and outside office hours. An AI employee answers, qualifies on budget, location and timeline, and hands over the visitors who are ready to see something.",
    icon: "home",
    challenges: [
      {
        title: "The first responder wins the site visit",
        body: "Buyers contact several listings in one sitting. Whoever answers first usually books the visit.",
        icon: "clock",
      },
      {
        title: "Enquiries arrive while agents are on site",
        body: "Showing a property means not answering the phone. That is exactly when enquiries arrive.",
        icon: "map-pin",
      },
      {
        title: "Leads arrive without context",
        body: "A portal enquiry carries a name and a number. The qualification call is what turns it into a brief.",
        icon: "message",
      },
    ],
    plays: [
      {
        title: "Qualify on budget, area and timeline",
        body: "Ask the three questions that decide whether a visit is worth scheduling, and tag the answer set.",
      },
      {
        title: "Book the site visit",
        body: "Hand qualified enquiries to the agent with the preferred slot already captured.",
      },
      {
        title: "Follow up on stale enquiries",
        body: "Run a campaign over older portal leads to find out who is still looking.",
      },
    ],
    review: [
      "Enquiries contacted before the agent opens",
      "Visits booked per source",
      "Enquiries that ended without a timeline",
    ],
    faq: sharedIndustryFaq("Real estate"),
  },
  {
    slug: "education",
    name: "Education",
    title: "Call every admission enquiry while the parent is still deciding.",
    metaDescription:
      "AI voice calling for education: answer admission enquiries, qualify course and intake, and route serious applicants to counsellors.",
    summary:
      "Admission season produces more enquiries than a counselling team can call. An AI employee handles the first conversation, captures course and intake interest, and routes the ready applicants.",
    icon: "education",
    challenges: [
      {
        title: "Seasonal spikes",
        body: "Enquiry volume concentrates into a few weeks, so staffing for the peak is expensive and staffing for the average loses leads.",
        icon: "bar-chart",
      },
      {
        title: "Repetitive first questions",
        body: "Course, eligibility, fees, intake dates. The same four questions on almost every call.",
        icon: "message",
      },
      {
        title: "Parents call in the evening",
        body: "Decisions are discussed after work, when the counselling desk is closed.",
        icon: "clock",
      },
    ],
    plays: [
      {
        title: "Qualify course and eligibility",
        body: "Capture the programme of interest and the qualifying details before a counsellor spends time.",
      },
      {
        title: "Book a counselling slot",
        body: "Hand over only the enquiries that meet the eligibility rules, with the slot captured.",
      },
      {
        title: "Re-engage dormant enquiries",
        body: "Call last season's enquiries ahead of the new intake with a short, honest script.",
      },
    ],
    review: [
      "Enquiries reaching a counsellor with context",
      "Counselling slots booked per source",
      "Enquiries that failed eligibility",
    ],
    faq: sharedIndustryFaq("Education"),
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    title: "Handle appointment calls without keeping patients on hold.",
    metaDescription:
      "AI voice calling for healthcare: answer appointment and follow-up calls, capture the reason for the visit, and route urgent cases to staff.",
    summary:
      "Front-desk teams spend their day on the phone instead of on patients. An AI employee handles routing, appointment requests and reminders, and escalates anything clinical to a person.",
    icon: "health",
    challenges: [
      {
        title: "Reception is the bottleneck",
        body: "One desk absorbs appointment requests, reminders, directions and follow-ups at the same time.",
        icon: "phone-call",
      },
      {
        title: "Calls outside clinic hours",
        body: "Patients call when they are free, not when the clinic is open.",
        icon: "clock",
      },
      {
        title: "Repetition with no room for error",
        body: "Reminders and confirmations are repetitive, but details still have to be captured accurately.",
        icon: "shield",
      },
    ],
    plays: [
      {
        title: "Route by intent",
        body: "Separate appointment requests, reports and directions, so each reaches the right queue.",
      },
      {
        title: "Confirm and remind",
        body: "Run confirmation calls ahead of appointments and record the answer against the booking.",
      },
      {
        title: "Escalate anything clinical",
        body: "Route symptom descriptions and urgent language to staff immediately, with the transcript attached.",
      },
    ],
    review: [
      "Calls handled without a human on the line",
      "Appointments confirmed ahead of time",
      "Escalations, read in full",
    ],
    faq: [
      {
        question: "Does the AI give medical advice?",
        answer:
          "No. The intended scope is administrative: routing, appointment requests and reminders. Anything clinical escalates to staff.",
      },
      {
        question: "How is patient data protected?",
        answer:
          "Recording, consent and retention settings are applied before a call is placed. The specific compliance posture for AOTMS is still being documented; confirm it before handling health data.",
      },
      {
        question: "Can it call from our clinic number?",
        answer:
          "The intended setup routes an existing number to the AI employee. Confirm carrier requirements with the team.",
      },
    ],
  },
  {
    slug: "automobile",
    name: "Automobile",
    title: "Respond to showroom and service enquiries in the same hour.",
    metaDescription:
      "AI voice calling for automobile dealerships: answer enquiry calls, qualify model and timeline, and follow up on service bookings.",
    summary:
      "Dealership enquiries decay fast. An AI employee answers model enquiries, captures budget and exchange details, and follows up on service reminders that would otherwise be skipped.",
    icon: "car",
    challenges: [
      {
        title: "Enquiries spread across channels",
        body: "Portal leads, walk-ins and phone calls all land in different places with different follow-up.",
        icon: "layers",
      },
      {
        title: "Sales staff are on the floor",
        body: "The person best placed to answer is usually with a customer in the showroom.",
        icon: "users",
      },
      {
        title: "Service reminders get skipped",
        body: "Reminder calls are the first task dropped when the desk is busy.",
        icon: "clock",
      },
    ],
    plays: [
      {
        title: "Qualify model and timeline",
        body: "Capture the model of interest, the purchase timeline and whether there is an exchange.",
      },
      {
        title: "Book a test drive",
        body: "Hand over the enquiries that are ready to drive, with the preferred slot recorded.",
      },
      {
        title: "Run service reminders",
        body: "Call due vehicles, confirm the booking and log who asked to be contacted later.",
      },
    ],
    review: [
      "Enquiries reached before the showroom opens",
      "Test drives booked per source",
      "Reminder calls completed",
    ],
    faq: sharedIndustryFaq("Automobile"),
  },
  {
    slug: "financial-services",
    name: "Financial services",
    title: "Qualify financial enquiries before an advisor spends the hour.",
    metaDescription:
      "AI voice calling for financial services: qualify enquiries on product and intent, and route only ready prospects to a licensed advisor.",
    summary:
      "Advisor time is the scarce resource. An AI employee qualifies the enquiry on product interest and readiness, then routes only the conversations that need advice.",
    icon: "building",
    challenges: [
      {
        title: "Advisor time is expensive",
        body: "Every unqualified call an advisor takes is an hour not spent with a client.",
        icon: "wallet",
      },
      {
        title: "Consent has to be provable",
        body: "Outbound calling in this sector depends on consent and registry checks that must be applied consistently.",
        icon: "shield",
      },
      {
        title: "Enquiries sit in a queue",
        body: "A lead that waits three days is a lead that has already spoken to someone else.",
        icon: "clock",
      },
    ],
    plays: [
      {
        title: "Qualify without advising",
        body: "Capture product interest and readiness, and stop short of anything that constitutes advice.",
      },
      {
        title: "Route to the right advisor",
        body: "Send qualified enquiries to the advisor who covers that product, with the transcript attached.",
      },
      {
        title: "Record the consent trail",
        body: "Keep the consent, registry check and call record together so the trail is auditable.",
      },
    ],
    review: [
      "Advisor hours spent on qualified enquiries",
      "Enquiries contacted within the stated window",
      "Consent records complete for every outbound call",
    ],
    faq: sharedIndustryFaq("Financial services"),
  },
  {
    slug: "local-services",
    name: "Local services",
    title: "Book the job while you are still on site.",
    metaDescription:
      "AI voice calling for local service businesses: answer while the team is on a job, capture the request and book the visit.",
    summary:
      "A two-person team cannot answer the phone with their hands full. An AI employee takes the call, captures the job and books the visit instead of losing it to voicemail.",
    icon: "map-pin",
    challenges: [
      {
        title: "The phone rings at the worst time",
        body: "The busiest hours are the hours nobody can answer, and callers do not leave voicemail.",
        icon: "phone-incoming",
      },
      {
        title: "Every call is the same shape",
        body: "What is the job, where is it, when can we come. Capturing those three facts is most of the work.",
        icon: "message",
      },
      {
        title: "No record of missed calls",
        body: "A missed call is invisible revenue loss: nobody knows how much it cost.",
        icon: "bar-chart",
      },
    ],
    plays: [
      {
        title: "Capture the job",
        body: "Take the request, the location and the preferred time in one conversation.",
      },
      {
        title: "Book or call back",
        body: "Confirm the slot if the calendar allows it, or set a callback for the owner.",
      },
      {
        title: "Escalate emergencies",
        body: "Recognise urgent language and route it to a person immediately, with the transcript attached.",
      },
    ],
    review: [
      "Calls answered that would have gone to voicemail",
      "Jobs booked outside working hours",
      "Urgent calls escalated and closed",
    ],
    faq: sharedIndustryFaq("Local services"),
  },
];

export function getIndustry(slug: string): IndustryPage | undefined {
  return industries.find((industry) => industry.slug === slug);
}

/* ---------------------------------------------------------------- languages */

export type LanguagePage = {
  slug: string;
  /** English name. */
  name: string;
  /** Name in the language itself. */
  nativeName: string;
  /** BCP-47 style code. */
  code: string;
  summary: string;
};

export const languages: LanguagePage[] = [
  {
    slug: "hindi",
    name: "Hindi",
    nativeName: "हिन्दी",
    code: "hi-IN",
    summary:
      "Hindi is the default first language for most north Indian calling use cases, and the one to evaluate first if your enquiries arrive mostly in Hindi.",
  },
  {
    slug: "english",
    name: "English",
    nativeName: "English",
    code: "en-IN",
    summary:
      "Indian English is what most business calls mix with a regional language. Test code-mixed sentences, not only clean English.",
  },
  {
    slug: "tamil",
    name: "Tamil",
    nativeName: "தமிழ்",
    code: "ta-IN",
    summary:
      "Tamil calling works best when the script avoids heavy English loanwords that callers would not use themselves.",
  },
  {
    slug: "telugu",
    name: "Telugu",
    nativeName: "తెలుగు",
    code: "te-IN",
    summary:
      "Telugu enquiries often mix English product terms with Telugu sentences. The voice has to handle that mix without slowing down.",
  },
  {
    slug: "kannada",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    code: "kn-IN",
    summary:
      "Kannada is worth evaluating with local place names and building names, which are the most common source of mispronunciation.",
  },
  {
    slug: "malayalam",
    name: "Malayalam",
    nativeName: "മലയാളം",
    code: "ml-IN",
    summary:
      "Malayalam speakers frequently switch to English mid-sentence. Judge the agent on the switch, not on the monologue.",
  },
  {
    slug: "marathi",
    name: "Marathi",
    nativeName: "मराठी",
    code: "mr-IN",
    summary:
      "Marathi and Hindi overlap heavily in urban calling. Decide which one the first sentence should be in before launch.",
  },
  {
    slug: "bengali",
    name: "Bengali",
    nativeName: "বাংলা",
    code: "bn-IN",
    summary:
      "Bengali callers distinguish formal and informal address quickly. Pick the register that matches how your team already speaks.",
  },
  {
    slug: "gujarati",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    code: "gu-IN",
    summary:
      "Gujarati business calls often mix in Hindi numerals and English product names, which is the realistic test case.",
  },
];

export function getLanguage(slug: string): LanguagePage | undefined {
  return languages.find((language) => language.slug === slug);
}

/* ------------------------------------------------------------------- cities */

export type CityPage = {
  slug: string;
  name: string;
  state: string;
  /** One line on what drives calling volume in that market. */
  summary: string;
  sectors: string[];
  languageSlugs: string[];
};

export const cities: CityPage[] = [
  {
    slug: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    summary:
      "High enquiry volume across property, financial services and local services, with callers who rarely leave voicemail.",
    sectors: ["Real estate", "Financial services", "Local services"],
    languageSlugs: ["marathi", "hindi", "english"],
  },
  {
    slug: "delhi",
    name: "Delhi NCR",
    state: "Delhi",
    summary:
      "Large education and property enquiry volumes, with a high share of calls arriving outside business hours.",
    sectors: ["Education", "Real estate", "Automobile"],
    languageSlugs: ["hindi", "english"],
  },
  {
    slug: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    summary:
      "Technology-driven sales teams with fast lead cycles, mixing Kannada, English and Hindi in the same list.",
    sectors: ["Real estate", "Education", "Local services"],
    languageSlugs: ["kannada", "english", "hindi"],
  },
  {
    slug: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    summary:
      "Property and education enquiries where a Telugu first sentence materially changes the response rate.",
    sectors: ["Real estate", "Education", "Healthcare"],
    languageSlugs: ["telugu", "english", "hindi"],
  },
  {
    slug: "pune",
    name: "Pune",
    state: "Maharashtra",
    summary:
      "A mix of education, automobile and services enquiries, with a strong Marathi-speaking base outside the city centre.",
    sectors: ["Education", "Automobile", "Local services"],
    languageSlugs: ["marathi", "hindi", "english"],
  },
  {
    slug: "chennai",
    name: "Chennai",
    state: "Tamil Nadu",
    summary:
      "Tamil-first calling across healthcare, education and property, where English-only scripts underperform.",
    sectors: ["Healthcare", "Education", "Real estate"],
    languageSlugs: ["tamil", "english"],
  },
  {
    slug: "kolkata",
    name: "Kolkata",
    state: "West Bengal",
    summary:
      "Bengali-first enquiries across education and services, with callers who expect a local accent.",
    sectors: ["Education", "Local services", "Healthcare"],
    languageSlugs: ["bengali", "hindi", "english"],
  },
  {
    slug: "ahmedabad",
    name: "Ahmedabad",
    state: "Gujarat",
    summary:
      "Gujarati-speaking business enquiries across automobile and financial services, often mixed with Hindi numerals.",
    sectors: ["Automobile", "Financial services", "Real estate"],
    languageSlugs: ["gujarati", "hindi", "english"],
  },
];

export function getCity(slug: string): CityPage | undefined {
  return cities.find((city) => city.slug === slug);
}

/* -------------------------------------------------- shared landing questions */

export const landingFaq: FaqItem[] = [
  {
    question: "Is this a different product per page?",
    answer:
      "No. Every landing page describes the same platform. The difference is the script, the language and the routing rules applied to it.",
  },
  {
    question: "Can the script be changed after launch?",
    answer:
      "Yes. Questions, permitted answers and escalation rules are configuration, and can be revised as the calls reveal what works.",
  },
  {
    question: "How is this priced?",
    answer:
      "Per account, based on volume, languages and channels. No prices are published because the commercial model is still being finalised.",
  },
];
