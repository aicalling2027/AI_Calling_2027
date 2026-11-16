import { formatCount } from "@/lib/money";

/**
 * The three plans the landing page sells.
 *
 * `code` is the backend plan the card maps onto: `free` is the trial workspace
 * (500 credits, no subscription), `starter` and `growth` are the catalogue rows
 * in `app/core/constants.py`. Prices are whole rupees per month, exactly what
 * the API charges - if the catalogue changes, this file changes with it.
 *
 * There is no annual row in the catalogue. Annual billing is a display rule
 * priced here (see `ANNUAL_MONTHS_CHARGED`) and is taken on a Razorpay payment
 * page, so nothing in the API enforces it.
 */

export type PricingPlan = {
  code: "free" | "starter" | "growth";
  name: string;
  priceInr: number;
  /** One line on who the plan is for. Sits under the price. */
  audience: string;
  /** The three numbers that actually change between plans. */
  limits: {
    employees: number;
    numbers: number;
    credits: number;
  };
  cta: { label: string; href: string };
  popular?: boolean;
};

export type BillingPeriod = "monthly" | "annual";

/**
 * Annual billing charges ten months for twelve - the two free months are the
 * whole reason the toggle exists. Change this one number and every price,
 * badge and per-month equivalent follows.
 */
export const ANNUAL_MONTHS_CHARGED = 10;

/** Derived, so the badge can never disagree with the arithmetic. */
export const ANNUAL_DISCOUNT_PERCENT = Math.round(
  (1 - ANNUAL_MONTHS_CHARGED / 12) * 100,
);

export function annualPriceInr(plan: PricingPlan): number {
  return plan.priceInr * ANNUAL_MONTHS_CHARGED;
}

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
  meta: "Billed monthly or annually in Indian rupees. GST extra. Credits are shared across every call on the workspace.",
  footnote:
    "The free credits are granted once per workspace. Usage beyond a plan's included credits is billed at the published per-minute voice rates.",
  link: { label: "What every plan includes", href: "/pricing" },
};

export const landingPlans: PricingPlan[] = [
  {
    code: "free",
    name: "Free",
    priceInr: 0,
    audience: "One line, end to end.",
    limits: { employees: 1, numbers: 1, credits: 500 },
    cta: { label: "Start free", href: "/free-trial" },
  },
  {
    code: "starter",
    name: "Basic",
    priceInr: 4999,
    audience: "A small team answering its first calls.",
    limits: { employees: 2, numbers: 1, credits: 5000 },
    cta: paidCta("starter"),
  },
  {
    code: "growth",
    name: "Popular",
    priceInr: 14999,
    audience: "Campaigns across several lines.",
    limits: { employees: 10, numbers: 5, credits: 20000 },
    cta: paidCta("growth"),
    popular: true,
  },
];

/** A comparison cell: a tick/no-tick, or the value the plan carries. */
export type ComparisonCell = string | boolean;

export type ComparisonRow = {
  label: string;
  /** Keyed by plan code, so reordering `landingPlans` cannot shift a column. */
  value: Record<PricingPlan["code"], ComparisonCell>;
};

export type ComparisonGroup = { title: string; rows: ComparisonRow[] };

/** Reads one value off every plan, so limits are never retyped here. */
function perPlan(resolve: (plan: PricingPlan) => ComparisonCell) {
  return landingPlans.reduce(
    (cells, plan) => ({ ...cells, [plan.code]: resolve(plan) }),
    {} as Record<PricingPlan["code"], ComparisonCell>,
  );
}

/**
 * The comparison table, in reading order. Every capability below is already
 * claimed by `landingPlans`; nothing new is promised here.
 */
export const comparisonGroups: ComparisonGroup[] = [
  {
    title: "What's included",
    rows: [
      {
        label: "Inbound calls",
        value: { free: true, starter: true, growth: true },
      },
      {
        label: "Instant lead calls",
        value: { free: true, starter: true, growth: true },
      },
      {
        label: "Transcripts and tagged outcomes",
        value: { free: true, starter: true, growth: true },
      },
      {
        label: "WhatsApp notifications",
        value: { free: false, starter: true, growth: true },
      },
      {
        label: "Number provisioning and routing",
        value: { free: false, starter: true, growth: true },
      },
      {
        label: "Bulk campaigns",
        value: { free: false, starter: false, growth: true },
      },
      {
        label: "CRM sync",
        value: { free: false, starter: false, growth: true },
      },
      {
        label: "Knowledge base",
        value: { free: false, starter: false, growth: true },
      },
      {
        label: "Call analytics",
        value: { free: false, starter: false, growth: true },
      },
    ],
  },
  {
    title: "Every month",
    rows: [
      {
        label: "AI employees",
        value: perPlan((plan) => formatCount(plan.limits.employees)),
      },
      {
        label: "Phone numbers",
        value: perPlan((plan) => formatCount(plan.limits.numbers)),
      },
      {
        label: "Credits",
        value: perPlan((plan) =>
          plan.priceInr === 0
            ? `${formatCount(plan.limits.credits)}, one-off`
            : `${formatCount(plan.limits.credits)} / month`,
        ),
      },
    ],
  },
];

/** The plan one rung below, whose features this one inherits. */
export function planBelow(code: PricingPlan["code"]): PricingPlan | null {
  const index = landingPlans.findIndex((plan) => plan.code === code);
  return index > 0 ? landingPlans[index - 1] : null;
}

/**
 * What this plan turns on that the rung below does not - the delta, so the
 * stacked mobile card lists five lines instead of repeating nine ticks.
 */
export function planAdditions(code: PricingPlan["code"]): string[] {
  const index = landingPlans.findIndex((plan) => plan.code === code);
  if (index < 0) return [];
  const below = planBelow(code);
  return comparisonGroups
    .flatMap((group) => group.rows)
    .filter(
      (row) =>
        row.value[code] === true && (!below || row.value[below.code] !== true),
    )
    .map((row) => row.label);
}
