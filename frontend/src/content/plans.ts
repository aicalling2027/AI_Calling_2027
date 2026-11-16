/**
 * The three plans the landing page sells.
 *
 * `code` is the backend plan the card maps onto: `free` is the trial workspace
 * (500 credits, no subscription), `starter` and `growth` are the catalogue rows
 * in `app/core/constants.py`. Prices are whole rupees per month, exactly what
 * the API charges - if the catalogue changes, this file changes with it.
 */

export type PricingPlan = {
  code: "free" | "starter" | "growth";
  name: string;
  priceInr: number;
  /** The unit beside the price. Monthly only while no yearly row exists. */
  period: string;
  /** One line on who the plan is for. Sits under the price. */
  audience: string;
  /** The three numbers that actually change between plans. */
  limits: {
    employees: number;
    numbers: number;
    credits: number;
  };
  includes: string[];
  cta: { label: string; href: string };
  popular?: boolean;
};

/**
 * Razorpay Payment Page for each paid plan.
 *
 * One page per plan, created in the dashboard (Payment Pages -> Create) and
 * pasted into the public env. Kept out of the source so the same build works
 * against test and live keys with no code change, and so no merchant account id
 * is ever committed. When a link is missing the card asks for a quote instead -
 * a "Pay Now" button that cannot take money is worse than no payment button.
 */
const PAY_URL = {
  starter: process.env.NEXT_PUBLIC_RAZORPAY_PAY_BASIC_URL?.trim(),
  growth: process.env.NEXT_PUBLIC_RAZORPAY_PAY_POPULAR_URL?.trim(),
} as const;

function paidCta(code: keyof typeof PAY_URL) {
  const href = PAY_URL[code];
  return href
    ? { label: "Pay Now", href }
    : { label: "Request a quote", href: "/contact" };
}

export const pricingIntro = {
  eyebrow: "Pricing",
  title: "One rate card. Three ways to start.",
  body: "Every plan runs on the same dashboard, with transcripts, tagged outcomes and the same voice catalogue. What changes is how many AI employees you run, how many lines they answer and the credits behind them.",
  meta: "Billed monthly in Indian rupees. GST extra. Credits are shared across every call on the workspace.",
  footnote:
    "The free credits are granted once per workspace. Usage beyond a plan's included credits is billed at the published per-minute voice rates.",
  link: { label: "What every plan includes", href: "/pricing" },
};

export const landingPlans: PricingPlan[] = [
  {
    code: "free",
    name: "Free",
    priceInr: 0,
    period: "month",
    audience: "One line, end to end.",
    limits: { employees: 1, numbers: 1, credits: 500 },
    includes: [
      "Inbound calls and instant leads",
      "Transcripts and tagged outcomes",
    ],
    cta: { label: "Start free", href: "/free-trial" },
  },
  {
    code: "starter",
    name: "Basic",
    priceInr: 4999,
    period: "month",
    audience: "A small team answering its first calls.",
    limits: { employees: 2, numbers: 1, credits: 5000 },
    includes: [
      "Everything in Free",
      "WhatsApp notifications",
      "Number provisioning and routing",
    ],
    cta: paidCta("starter"),
  },
  {
    code: "growth",
    name: "Popular",
    priceInr: 14999,
    period: "month",
    audience: "Campaigns across several lines.",
    limits: { employees: 10, numbers: 5, credits: 20000 },
    includes: [
      "Everything in Basic",
      "Bulk campaigns and CRM sync",
      "Knowledge base and call analytics",
    ],
    cta: paidCta("growth"),
    popular: true,
  },
];
