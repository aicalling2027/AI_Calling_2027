/**
 * Pricing, Voices, Solutions and Revenue Systems copy.
 *
 * PLACEHOLDER policy: AOTMS has not approved prices, plan tiers, customer
 * logos or performance figures, so none appear here. Where a fact is missing
 * the page says so explicitly instead of inventing one.
 */

import type { CardItem, StepItem } from "@/components/sections/cards";
import type { FaqItem } from "@/components/sections/faq";
import type { IconName } from "@/components/layout/icon";

type LinkItem = { title: string; body: string; icon: IconName; href: string };

/* ------------------------------------------------------------------ pricing */

export const pricingPage = {
  eyebrow: "Pricing",
  title: "Pricing that follows your call volume.",
  // TODO(AOTMS): replace once the commercial model is approved.
  summary:
    "AOTMS plans are quoted per account rather than published as fixed tiers. Tell us your call volume and languages and the team will map it to a plan.",
  note: "No prices are listed on this page because no commercial model has been approved for publication yet.",
  factors: [
    {
      title: "Call volume",
      body: "What you pay follows how many conversations you actually run, not how many seats you buy.",
      icon: "bar-chart",
    },
    {
      title: "Languages and voices",
      body: "The language set and voice catalogue attached to your account are part of the quote.",
      icon: "languages",
    },
    {
      title: "Numbers and channels",
      body: "Inbound numbers, outbound calling and API triggers are scoped per account.",
      icon: "phone-call",
    },
  ] satisfies CardItem[],
  included: [
    "Inbound, Campaigns and Instant Leads on the same account",
    "Per-campaign scripts, calling windows and retry rules",
    "Transcripts, summaries and tagged outcomes",
    "Number provisioning and routing",
    "Usage reporting for your finance team",
    "Access to the console for everyone who needs it",
  ],
  quoteSteps: [
    {
      title: "Tell us the use case",
      body: "Which conversations you want covered first: inbound, a list, or new leads.",
    },
    {
      title: "Share expected volume",
      body: "An approximate monthly call count and the languages you need are enough to start.",
    },
    {
      title: "Receive a written quote",
      body: "The team returns a scope, a unit basis and the terms in writing before anything is switched on.",
    },
  ] satisfies StepItem[],
  faq: [
    {
      question: "Why are there no prices on this page?",
      answer:
        "The AOTMS commercial model is still being finalised. Publishing a number that later changes would mislead you, so the page asks you to request a quote instead.",
    },
    {
      question: "Is there a minimum commitment?",
      answer:
        "Commitment length has not been confirmed. Ask for it in writing with your quote.",
    },
    {
      question: "How is a call counted?",
      answer:
        "The definition of a billable call is part of the commercial model and is not published yet. Confirm it before you sign.",
    },
    {
      question: "Can we start small?",
      answer:
        "A single use case is the intended starting point: one product, one script, one measurable outcome.",
    },
    {
      question: "What happens when we outgrow a plan?",
      answer:
        "Because plans are quoted per account, moving to a larger volume is a re-quote rather than a migration between fixed tiers.",
    },
  ] satisfies FaqItem[],
};

/* ------------------------------------------------------------------- voices */

export const voicesPage = {
  eyebrow: "Voices",
  title: "Choose how your AI employee sounds.",
  summary:
    "Every AI employee runs on a voice you choose. The AOTMS catalogue is still being assembled, so this page shows the intended structure rather than final samples.",
  note: "Audio samples and the confirmed language list are pending. Nothing on this page is a published commitment.",
  // TODO(AOTMS): replace with the confirmed voice catalogue.
  languages: [
    { language: "Hindi", code: "hi-IN", status: "Sample pending" },
    { language: "English (India)", code: "en-IN", status: "Sample pending" },
    { language: "English (US)", code: "en-US", status: "Sample pending" },
    { language: "Tamil", code: "ta-IN", status: "Sample pending" },
    { language: "Telugu", code: "te-IN", status: "Sample pending" },
    { language: "Kannada", code: "kn-IN", status: "Sample pending" },
    { language: "Malayalam", code: "ml-IN", status: "Sample pending" },
    { language: "Marathi", code: "mr-IN", status: "Sample pending" },
    { language: "Bengali", code: "bn-IN", status: "Sample pending" },
    { language: "Gujarati", code: "gu-IN", status: "Sample pending" },
    { language: "Punjabi", code: "pa-IN", status: "Sample pending" },
    { language: "Odia", code: "or-IN", status: "Sample pending" },
  ],
  qualities: [
    {
      title: "Natural pacing",
      body: "Sentences are spoken at a conversational pace rather than read out at a constant speed.",
      icon: "headphones",
    },
    {
      title: "Language switching",
      body: "The intended behaviour is to follow the caller when they change language mid-conversation.",
      icon: "languages",
    },
    {
      title: "Pronunciation control",
      body: "Brand names, product names and place names can be corrected so they are spoken consistently.",
      icon: "message",
    },
    {
      title: "Tone by use case",
      body: "A collection call and a support call should not sound the same; tone is set per AI employee.",
      icon: "sparkles",
    },
  ] satisfies CardItem[],
  faq: [
    {
      question: "When will samples be available?",
      answer:
        "Once the voice catalogue is confirmed. Ask the team for a live sample if you need to evaluate one before then.",
    },
    {
      question: "Can we use our own recorded voice?",
      answer:
        "Custom voice cloning is not part of the confirmed scope. Treat it as unconfirmed until AOTMS states otherwise in writing.",
    },
    {
      question: "Does every language sound equally natural?",
      answer:
        "Quality differs by language and provider. Evaluate the specific languages you plan to use rather than assuming parity.",
    },
    {
      question: "Can one account use several voices?",
      answer:
        "Yes — a voice is set per AI employee, so different campaigns can sound different.",
    },
  ] satisfies FaqItem[],
};

/* ---------------------------------------------------------------- solutions */

export const solutionsPage = {
  eyebrow: "Solutions",
  title: "Start from the team that owns the phone.",
  summary:
    "The same platform is sold against different problems: sales chasing speed, support covering hours, operations working through lists. Pick the entry point that matches yours.",
  byTeam: [
    {
      title: "Sales",
      body: "Call new enquiries before they go cold, qualify them, and hand over only the ones worth a meeting.",
      icon: "megaphone",
      href: "/product/instant-leads",
    },
    {
      title: "Support",
      body: "Answer incoming calls outside working hours and capture what the caller needs for the morning team.",
      icon: "headphones",
      href: "/product/inbound",
    },
    {
      title: "Operations",
      body: "Work through existing contact lists with a consistent script and a record of every outcome.",
      icon: "workflow",
      href: "/product/campaigns",
    },
    {
      title: "Collections and renewals",
      body: "Reach contacts about a pending action, record what they said, and route the difficult ones to a person.",
      icon: "wallet",
      href: "/revenue-systems",
    },
  ] satisfies LinkItem[],
  byIndustry: [
    {
      title: "Real estate",
      body: "Enquiry calls arrive at all hours; the first caller to respond usually wins the site visit.",
      icon: "home",
      href: "/ai-voice-agents/for/real-estate",
    },
    {
      title: "Education",
      body: "Admission enquiries need a fast first call and a consistent set of qualifying questions.",
      icon: "education",
      href: "/ai-voice-agents/for/education",
    },
    {
      title: "Healthcare",
      body: "Appointment calls, reminders and follow-ups are repetitive and time-bound.",
      icon: "health",
      href: "/ai-voice-agents/for/healthcare",
    },
    {
      title: "Automobile",
      body: "Showroom enquiries and service reminders both need fast, scripted first contact.",
      icon: "car",
      href: "/ai-voice-agents/for/automobile",
    },
    {
      title: "Financial services",
      body: "Lead qualification before a licensed advisor spends time on the call.",
      icon: "building",
      href: "/ai-voice-agents/for/financial-services",
    },
    {
      title: "Local services",
      body: "Small teams miss calls while on site; an AI employee answers and books the job.",
      icon: "map-pin",
      href: "/ai-voice-agents/for/local-services",
    },
  ] satisfies LinkItem[],
  bundles: [
    {
      title: "Answer every call",
      body: "Inbound plus number routing, for teams losing enquiries to voicemail.",
      href: "/product/inbound",
    },
    {
      title: "Follow up on everything",
      body: "Campaigns plus outcome tagging, for lists that never get worked.",
      href: "/product/campaigns",
    },
    {
      title: "Respond in minutes",
      body: "Instant Leads plus routing, for enquiries that decay within the hour.",
      href: "/product/instant-leads",
    },
  ],
  faq: [
    {
      question: "Is there a different product per industry?",
      answer:
        "No. The platform is the same; industries differ in script, language and routing rules.",
    },
    {
      question: "Can we run two products at once?",
      answer:
        "Yes. Inbound, Campaigns and Instant Leads are designed to run on one account with shared numbers and records.",
    },
    {
      question: "Which industry should we start with?",
      answer:
        "Whichever has the clearest, most repetitive first conversation and the shortest time window to respond.",
    },
    {
      question: "Do you support our CRM?",
      answer:
        "Outcome write-back is part of the intended design; the confirmed integration list is not published yet.",
    },
  ] satisfies FaqItem[],
};

/* ----------------------------------------------------------- revenue systems */

export const revenuePage = {
  eyebrow: "Revenue systems",
  title: "The first call is a system, not an event.",
  summary:
    "Most revenue is lost between the enquiry and the first real conversation. Revenue systems is the AOTMS view of that gap: capture, contact, qualify, hand over and follow up.",
  stages: [
    {
      title: "Capture",
      body: "A form, advertisement or phone call arrives with context attached to it.",
      icon: "layers",
    },
    {
      title: "Contact",
      body: "An AI employee calls within the window where the enquiry still matters.",
      icon: "phone-call",
    },
    {
      title: "Qualify",
      body: "A fixed set of questions produces a tagged outcome rather than a free-text note.",
      icon: "workflow",
    },
    {
      title: "Hand over",
      body: "Qualified contacts reach a person with the transcript and summary already attached.",
      icon: "users",
    },
    {
      title: "Follow up",
      body: "Unanswered and unqualified contacts stay in a queue with a retry rule, not in someone's memory.",
      icon: "clock",
    },
    {
      title: "Measure",
      body: "Response time, contact rate and outcome mix are reported per campaign and per source.",
      icon: "bar-chart",
    },
  ] satisfies CardItem[],
  principles: [
    {
      title: "Speed is the product",
      body: "Every hour between enquiry and first contact reduces the chance of a conversation. Automation exists to remove that delay, not to replace judgement.",
    },
    {
      title: "One record per contact",
      body: "A contact should not exist in three systems with three different outcomes. Write-back keeps the source system authoritative.",
    },
    {
      title: "Humans own the hard calls",
      body: "The AI employee covers the first conversation and the repetition. Anything requiring negotiation or discretion is routed to a person.",
    },
  ],
  links: [
    {
      label: "Instant Leads",
      href: "/product/instant-leads",
      body: "The capture-to-call step.",
    },
    {
      label: "Campaigns",
      href: "/product/campaigns",
      body: "The follow-up loop across a list.",
    },
    {
      label: "Inbound",
      href: "/product/inbound",
      body: "The call the customer makes back.",
    },
  ],
  faq: [
    {
      question: "Do we have to replace our CRM?",
      answer:
        "No. The intent is to write outcomes back into the system your team already uses.",
    },
    {
      question: "Which stage should we automate first?",
      answer:
        "Start with the stage that loses the most opportunities. For most teams that is the first contact.",
    },
    {
      question: "Can we keep manual steps?",
      answer:
        "Yes. Any stage can stay manual; the platform only needs to know what should trigger a call.",
    },
    {
      question: "How is this measured?",
      answer:
        "By call outcomes and response time per source. A specific reporting template is part of the product scope and is not published here.",
    },
  ] satisfies FaqItem[],
};
