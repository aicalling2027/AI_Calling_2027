/**
 * About, Contact and Free Trial copy.
 *
 * PLACEHOLDER policy: no team members, offices, customer counts or founding
 * dates are invented. Anything unknown is described as pending.
 */

import type { CardItem } from "@/components/sections/cards";
import type { FaqItem } from "@/components/sections/faq";

/* -------------------------------------------------------------------- about */

export const aboutPage = {
  eyebrow: "About",
  title: "We are building the calling layer for growing businesses.",
  // TODO(AOTMS): replace with the approved company narrative.
  summary:
    "AOTMS Global Pvt. Ltd. builds AI voice employees that handle the first conversation — the repetitive, time-critical call that most teams cannot answer fast enough.",
  note: "Company facts on this page are intentionally limited to what has been confirmed for publication.",
  mission: {
    eyebrow: "Why we exist",
    title: "The first conversation should not depend on who is free.",
    body: "Most businesses do not lose enquiries because the offer is wrong. They lose them because nobody picked up in time. An AI employee removes that constraint without removing the people who handle the parts that need judgement.",
  },
  principles: [
    {
      title: "Repetition is not skill",
      body: "Asking the same five qualifying questions is not where a trained person adds value. Automate the repetition, protect the judgement.",
      icon: "workflow",
    },
    {
      title: "Every call leaves a record",
      body: "A conversation without a transcript, a summary and an outcome is not usable by the rest of the business.",
      icon: "layers",
    },
    {
      title: "Language is not a feature",
      body: "If a customer calls in Tamil and the system answers in English, nothing else about the product matters.",
      icon: "languages",
    },
    {
      title: "Say what is confirmed",
      body: "We would rather publish an honest pending status than a number we cannot stand behind.",
      icon: "shield",
    },
  ] satisfies CardItem[],
  facts: [
    {
      title: "What we build",
      body: "AI voice employees for inbound answering, outbound campaigns and instant lead response.",
    },
    {
      title: "Who we build for",
      body: "Sales, support and operations teams whose first conversation is repetitive and time-bound.",
    },
    {
      title: "How we start",
      body: "One use case, one script, one measurable outcome, reviewed on real transcripts before expanding.",
    },
    {
      title: "Where we are",
      body: "AOTMS Global Pvt. Ltd. is registered in India. Office and contact details are being confirmed for publication.",
    },
  ],
  faq: [
    {
      question: "Who owns the data from a call?",
      answer:
        "Account data belongs to the customer. The specific retention and export terms are being documented and should be confirmed in writing.",
    },
    {
      question: "Do you sell customer data?",
      answer: "No. Call data is used only to operate the account.",
    },
    {
      question: "Can we see the product before buying?",
      answer:
        "Yes — a scoped pilot on one use case is the intended way to evaluate, and the transcripts are the evaluation material.",
    },
    {
      question: "Where can I find company registration details?",
      answer:
        "Registration and statutory details will be published with the legal pages once confirmed.",
    },
  ] satisfies FaqItem[],
};

/* ------------------------------------------------------------------ contact */

export const contactPage = {
  eyebrow: "Contact",
  title: "Talk to the team behind the calls.",
  summary:
    "Tell us which conversations you want covered and what breaks today. We will reply with a scoped next step rather than a generic deck.",
  note: "This form is connected to an AOTMS endpoint only when one is configured. Until then it opens a prepared email instead.",
  channels: [
    {
      title: "Email",
      body: "For a scoped quote, a pilot, a live voice sample or anything else.",
      value: "ameen@aotms.com",
      href: "mailto:ameen@aotms.com",
      icon: "message" as const,
    },
    {
      title: "Phone",
      body: "Prefer to talk it through? Call us directly.",
      value: "+91 80199 52233",
      href: "tel:+918019952233",
      icon: "phone-call" as const,
    },
    {
      title: "Registered office",
      body: "The registered address is being confirmed for publication.",
      value: "Pending",
      href: "",
      icon: "map-pin" as const,
    },
  ],
  expectations: [
    {
      title: "Within one working day",
      body: "A reply from a person, not an automated sequence.",
    },
    {
      title: "A scoped next step",
      body: "Usually a 30-minute call to define the use case and the volume.",
    },
    {
      title: "No pricing surprise",
      body: "Any number you are quoted comes in writing with its basis attached.",
    },
  ],
  faq: [
    {
      question: "Can we book a demo?",
      answer:
        "Ask for one in the form. A demo is a live conversation with your own script rather than a recorded walkthrough.",
    },
    {
      question: "Do you support customers outside India?",
      answer:
        "The intended market includes international numbers; confirm coverage for your country before planning.",
    },
    {
      question: "How do I report a problem with a live account?",
      answer:
        "Email ameen@aotms.com and mark it as an account issue so it is routed correctly.",
    },
  ] satisfies FaqItem[],
};

/* --------------------------------------------------------------- free trial */

export const freeTrialPage = {
  eyebrow: "Start free",
  title: "Start with one use case, not a full rollout.",
  summary:
    "Request access to an AOTMS workspace, pick a single conversation to automate, and review real transcripts before deciding anything else.",
  note: "Account creation is handled by the AOTMS team. There is no self-serve signup on this website yet.",
  steps: [
    {
      title: "Tell us the use case",
      body: "One conversation type: incoming enquiries, a contact list, or new leads.",
    },
    {
      title: "We set up the workspace",
      body: "The team configures the AI employee, the script and the number with you.",
    },
    {
      title: "Run and review",
      body: "Run the first calls, read the transcripts, then decide whether to expand.",
    },
  ],
  included: [
    "A configured AI employee for one use case",
    "A script reviewed with you before the first call",
    "Transcripts and summaries for every call",
    "A review session on what the calls actually said",
  ],
  requirements: [
    "A business phone number for inbound or outbound calls",
    "One clearly defined conversation to automate first",
    "An owner on your side who can approve the script",
  ],
  faq: [
    {
      question: "Is this a self-serve signup?",
      answer:
        "No. Access is provisioned by the AOTMS team so the first script is reviewed before anything is dialled.",
    },
    {
      question: "How long does setup take?",
      answer:
        "It depends on the script and the number. A confirmed timeline has not been published; ask when you request access.",
    },
    {
      question: "What does it cost?",
      answer:
        "Pricing is quoted per account and is not published yet. Ask for the commercial terms together with the access request.",
    },
    {
      question: "Can we cancel after the pilot?",
      answer:
        "Commitment terms are part of the commercial model and should be confirmed in writing before you start.",
    },
  ] satisfies FaqItem[],
};
