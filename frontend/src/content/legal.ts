/**
 * Legal page content.
 *
 * These are DRAFTS. Every document is marked as not yet reviewed by counsel,
 * because inventing binding legal commitments would be worse than showing an
 * unfinished page. Replace the text once Legal approves it.
 */

import type { Block } from "@/components/sections/prose";

export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  /** ISO date of the last editorial change, not of legal approval. */
  updatedAt: string;
  body: Block[];
};

const draftNotice: Block = {
  type: "note",
  text: "DRAFT — this document has not been reviewed by counsel and is not yet a binding policy. It is published so the structure and scope can be reviewed before launch.",
};

export const legalDocuments: LegalDocument[] = [
  {
    slug: "privacy-policy",
    title: "Privacy policy",
    summary:
      "What information AOTMS collects through this website, why it is collected and how long it is kept.",
    updatedAt: "2026-03-01",
    body: [
      draftNotice,
      {
        type: "heading",
        text: "What this policy covers",
      },
      {
        type: "paragraph",
        text: "This policy covers information submitted through the AOTMS marketing website: enquiry forms, email correspondence and basic technical data collected when a page is served.",
      },
      {
        type: "heading",
        text: "Information you provide",
      },
      {
        type: "list",
        items: [
          "Name, work email, company name and optional phone number",
          "The message you write in an enquiry form",
          "Any additional information you choose to send by email",
        ],
      },
      {
        type: "paragraph",
        text: "This information is used to respond to the enquiry and to keep a record of the conversation. It is not sold.",
      },
      {
        type: "heading",
        text: "Call data for customer accounts",
      },
      {
        type: "paragraph",
        text: "Recording, transcription and retention for calls placed through an AOTMS account are governed by the contract for that account, not by this page. Those terms are still being documented.",
      },
      {
        type: "heading",
        text: "Retention",
      },
      {
        type: "paragraph",
        text: "Enquiry records are kept for as long as needed to handle the request and any related commercial discussion. A specific retention period has not been approved for publication.",
      },
      {
        type: "heading",
        text: "Your requests",
      },
      {
        type: "paragraph",
        text: "To ask for a copy of the information held about you, or to request its deletion, contact the address listed on the contact page.",
      },
    ],
  },
  {
    slug: "terms-and-conditions",
    title: "Terms and conditions",
    summary:
      "The terms that will govern use of the AOTMS website and the AOTMS calling platform.",
    updatedAt: "2026-03-01",
    body: [
      draftNotice,
      {
        type: "heading",
        text: "Scope",
      },
      {
        type: "paragraph",
        text: "These terms will cover two things separately: use of this marketing website, and use of the AOTMS platform under a subscription agreement. The platform terms take precedence where the two differ.",
      },
      {
        type: "heading",
        text: "Use of the website",
      },
      {
        type: "list",
        items: [
          "Content is provided for information and may change without notice",
          "Capability statements marked as pending are not commitments",
          "You may not use the site to distribute malicious code or to attempt unauthorised access",
        ],
      },
      {
        type: "heading",
        text: "Use of the platform",
      },
      {
        type: "paragraph",
        text: "Accounts are governed by a separate agreement covering scope, data handling, calling rules and commercial terms. Nothing on this website forms part of that agreement until it is signed.",
      },
      {
        type: "heading",
        text: "Compliance obligations",
      },
      {
        type: "paragraph",
        text: "Customers are responsible for holding a lawful basis to contact the numbers they call, and for complying with the calling regulations that apply to their business.",
      },
      {
        type: "heading",
        text: "Limitation of liability",
      },
      {
        type: "paragraph",
        text: "Liability terms have not been drafted. They will be defined in the platform agreement with counsel review before launch.",
      },
    ],
  },
  {
    slug: "refund-policy",
    title: "Refund policy",
    summary:
      "How cancellation and refunds will be handled for AOTMS accounts.",
    updatedAt: "2026-03-01",
    body: [
      draftNotice,
      {
        type: "heading",
        text: "Status",
      },
      {
        type: "paragraph",
        text: "AOTMS does not publish a refund policy yet because the commercial model is not finalised. No refund terms should be inferred from this page.",
      },
      {
        type: "heading",
        text: "What will be defined",
      },
      {
        type: "list",
        items: [
          "Whether a pilot period is refundable",
          "How unused committed volume is treated at cancellation",
          "The notice period required to stop a subscription",
          "How charges already incurred for placed calls are handled",
        ],
      },
      {
        type: "heading",
        text: "Before you sign",
      },
      {
        type: "paragraph",
        text: "Ask for the cancellation and refund terms in writing as part of your quote. If they are not in the document you are asked to sign, they do not apply.",
      },
    ],
  },
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments.find((document) => document.slug === slug);
}
