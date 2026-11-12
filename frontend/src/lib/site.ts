/**
 * Single source of truth for brand-specific values.
 * Everything AOTMS-specific that a template might need lives here.
 */

export const site = {
  legalName: "AOTMS Global Pvt. Ltd.",
  shortName: "AOTMS",
  /** Official logo. Source asset is 720x183 (ratio 3.93) — never stretch it. */
  logo: {
    src: "/aotms-logo.png",
    width: 720,
    height: 183,
    alt: "AOTMS Global Pvt. Ltd.",
  },
  // TODO(AOTMS): confirm the live domain before launch.
  url: "https://aotms.example",
  // TODO(AOTMS): confirm the tagline and description used in metadata.
  tagline: "AI voice calling for growing businesses",
  description:
    "AOTMS Global builds multilingual AI voice agents for inbound and outbound calling, so growing teams reach every lead and answer every call.",
  locale: "en-IN",
  contact: {
    email: "ameen@aotms.com",
    salesEmail: "ameen@aotms.com",
    /** Number as supplied by AOTMS, with the India country code for dialling. */
    phone: "+91 80199 52233",
    phoneHref: "tel:+918019952233",
  },
  /** Set NEXT_PUBLIC_FORM_ENDPOINT to enable real form submissions. */
  formEndpoint: process.env.NEXT_PUBLIC_FORM_ENDPOINT ?? "",
} as const;

export const cta = {
  primary: { label: "Start free", href: "/free-trial" },
  secondary: { label: "Talk to us", href: "/contact" },
} as const;

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  /** A sibling AOTMS property: it opens in a new tab. */
  external?: boolean;
};

export type NavItem = {
  label: string;
  href?: string;
  children?: NavLink[];
};

export const primaryNav: NavItem[] = [
  {
    label: "Product",
    children: [
      {
        label: "Inbound",
        href: "/product/inbound",
        description: "Answer every incoming call with an AI employee.",
      },
      {
        label: "Campaigns",
        href: "/product/campaigns",
        description: "Work through a contact list at your own pace.",
      },
      {
        label: "Instant Leads",
        href: "/product/instant-leads",
        description: "Call a single new lead the moment it arrives.",
      },
    ],
  },
  { label: "Voices", href: "/voices" },
  { label: "Pricing", href: "/pricing" },
  { label: "Solutions", href: "/solutions" },
  {
    label: "Resources",
    children: [
      {
        label: "Blog",
        href: "/blog",
        description: "Notes on what to automate and what to measure.",
      },
      {
        label: "Glossary",
        href: "/glossary",
        description: "The vocabulary of AI calling, defined plainly.",
      },
      {
        label: "Comparisons",
        href: "/compare",
        description: "AI calling against IVR, manual dialling and outsourcing.",
      },
      {
        label: "Questions",
        href: "/questions",
        description: "The questions buyers ask before a pilot.",
      },
    ],
  },
];

/**
 * The other AOTMS properties listed in the Product menu. They live outside this
 * app, so every row opens in a new tab and keeps the current funnel intact.
 */
export const groupProducts: NavLink[] = [
  {
    label: "LMS",
    href: "https://lms.academyoftechmasters.com/",
    description: "Learning portal for students.",
    external: true,
  },
  {
    label: "Auction",
    href: "https://auction.aotms.com",
    description: "Live listings and online bidding.",
    external: true,
  },
  {
    label: "CRM",
    href: "https://crm.academyoftechmasters.com/",
    description: "Leads, pipelines and follow-ups.",
    external: true,
  },
  {
    label: "ERP",
    href: "https://www.biriyani-box.com/",
    description: "Orders, stock and back office.",
    external: true,
  },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Inbound", href: "/product/inbound" },
      { label: "Campaigns", href: "/product/campaigns" },
      { label: "Instant Leads", href: "/product/instant-leads" },
      { label: "Voices", href: "/voices" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Solutions", href: "/solutions" },
      { label: "Revenue systems", href: "/revenue-systems" },
      { label: "Industries", href: "/ai-voice-agents/for/real-estate" },
      { label: "Languages", href: "/ai-voice-agents/language/hindi" },
      { label: "Questions", href: "/questions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Glossary", href: "/glossary" },
      { label: "Comparisons", href: "/compare" },
      { label: "City coverage", href: "/fastest-employee/mumbai" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Start free", href: "/free-trial" },
    ],
  },
];

export const legalNav: NavLink[] = [
  { label: "Privacy policy", href: "/legal/privacy-policy" },
  { label: "Terms and conditions", href: "/legal/terms-and-conditions" },
  { label: "Refund policy", href: "/legal/refund-policy" },
];
