"use client";

import { Fragment, useState } from "react";
import { Check, Star } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { FlowButton } from "@/components/ui/flow-button";
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualPriceInr,
  comparisonGroups,
  planAdditions,
  planBelow,
  type BillingPeriod,
  type ComparisonCell,
  type PricingPlan,
} from "@/content/plans";
import { formatCount, formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Both entry plans ask for the same thing - a conversation - so they carry the
 * same ink outline. The recommendation is the only filled pill on the page.
 */
const CTA_TONE = {
  free: "default",
  starter: "default",
  growth: "brand",
} as const;

const PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

/**
 * The price for the selected period. `sub` carries the per-month equivalent of
 * an annual plan, so the two settings stay comparable at a glance.
 */
function priceParts(plan: PricingPlan, billing: BillingPeriod) {
  if (plan.priceInr === 0) {
    return { amount: formatInr(0), unit: null, sub: null };
  }
  if (billing === "monthly") {
    return { amount: formatInr(plan.priceInr), unit: "/ month", sub: null };
  }
  const annual = annualPriceInr(plan);
  return {
    amount: formatInr(annual),
    unit: "/ year",
    sub: `${formatInr(Math.round(annual / 12))} a month`,
  };
}

/**
 * A two-state segmented control. The thumb is one `layoutId` element rather
 * than two backgrounds, so it slides between the options instead of blinking.
 * `aria-pressed` is what actually announces the state; the thumb is paint.
 */
function BillingToggle({
  billing,
  onChange,
}: {
  billing: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex rounded-full border border-hairline bg-surface p-1"
      >
        {PERIODS.map((option) => {
          const active = billing === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative rounded-full px-4 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "text-white" : "text-ink-soft hover:text-ink",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="billing-period"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{
                    duration: reduceMotion ? 0 : 0.32,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ) : null}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p
        className={cn(
          "text-xs font-medium transition-colors",
          billing === "annual" ? "text-cobalt" : "text-ink-soft",
        )}
      >
        Two months free · save {ANNUAL_DISCOUNT_PERCENT}%
      </p>
    </div>
  );
}

/** A tick, a dash, or the value itself. Screen readers get words, not glyphs. */
function FeatureCell({ value }: { value: ComparisonCell }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center">
        <Check className="size-4 shrink-0 text-cobalt" aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    ) : (
      <span className="inline-flex items-center">
        <span aria-hidden className="text-base leading-none text-ink-soft/50">
          —
        </span>
        <span className="sr-only">Not included</span>
      </span>
    );
  }

  return <span className="text-sm text-ink tabular-nums">{value}</span>;
}

function PlanBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cobalt px-2 py-0.5 text-[0.55rem] font-semibold tracking-[0.1em] text-white uppercase">
      <Star className="size-2 fill-white" aria-hidden />
      Best value
    </span>
  );
}

/** The name, price and call to action at the top of a plan column. */
function PlanHeaderCell({
  plan,
  billing,
}: {
  plan: PricingPlan;
  billing: BillingPeriod;
}) {
  const price = priceParts(plan, billing);
  const popular = plan.popular === true;

  return (
    <th
      scope="col"
      className="relative border-l border-line px-5 pt-7 pb-6 align-top"
    >
      {popular ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-cobalt" />
      ) : null}

      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink-soft uppercase">
          {plan.name}
        </span>
        {popular ? <PlanBadge /> : null}
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="display text-3xl leading-none tabular-nums md:text-4xl">
          {price.amount}
        </span>
        {price.unit ? (
          <span className="text-xs text-ink-soft">{price.unit}</span>
        ) : null}
      </p>
      {/* Reserved: on annual the per-month equivalent appears here, and the
          table must not resize when the toggle moves. */}
      <p className="mt-1.5 min-h-4 text-xs text-ink-soft">{price.sub}</p>

      <p className="mt-3 text-xs leading-relaxed font-normal text-ink-soft">
        {plan.audience}
      </p>

      <FlowButton
        href={plan.cta.href}
        tone={CTA_TONE[plan.code]}
        size="sm"
        className="mt-5 w-full"
      >
        {plan.cta.label}
      </FlowButton>
    </th>
  );
}

/**
 * The matrix, above `md`. A real <table> because that is what this is: the row
 * headers are the questions and the column headers are the plans, which is what
 * a screen reader needs to read a tick in context.
 */
function ComparisonTable({
  plans,
  billing,
}: {
  plans: PricingPlan[];
  billing: BillingPeriod;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        AOTMS plans compared. Prices in Indian rupees, exclusive of GST.
      </caption>

      <thead>
        <tr>
          <th scope="col" className="w-[26%] px-5 pt-7 pb-6 align-top">
            <div className="flex min-h-6 items-center">
              <span className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink-soft uppercase">
                Compare
              </span>
            </div>
          </th>
          {plans.map((plan) => (
            <PlanHeaderCell key={plan.code} plan={plan} billing={billing} />
          ))}
        </tr>
      </thead>

      <tbody>
        {comparisonGroups.map((group) => (
          <Fragment key={group.title}>
            <tr>
              <th colSpan={plans.length + 1} className="pt-7 pb-1 pl-5 text-left">
                <span className="text-[0.68rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
                  {group.title}
                </span>
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="border-t border-line py-3 pr-6 pl-5 text-left text-sm font-normal text-ink"
                >
                  {row.label}
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.code}
                    className="border-t border-l border-line px-5 py-3"
                  >
                    <FeatureCell value={row.value[plan.code]} />
                  </td>
                ))}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Below `md` the matrix cannot be read as columns, so each plan becomes a
 * stacked block: its own price, its limits, and only the features it turns on
 * compared with the rung below.
 */
function StackedPlan({
  plan,
  billing,
}: {
  plan: PricingPlan;
  billing: BillingPeriod;
}) {
  const price = priceParts(plan, billing);
  const popular = plan.popular === true;
  const below = planBelow(plan.code);
  const additions = planAdditions(plan.code);

  return (
    <article className="p-6">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink-soft uppercase">
          {plan.name}
        </p>
        {popular ? <PlanBadge /> : null}
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="display text-4xl leading-none tabular-nums">
          {price.amount}
        </span>
        {price.unit ? (
          <span className="text-xs text-ink-soft">{price.unit}</span>
        ) : null}
      </p>
      <p className="mt-1.5 min-h-4 text-xs text-ink-soft">{price.sub}</p>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {plan.audience}
      </p>

      <dl className="mt-5 divide-y divide-line border-y border-line">
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-[0.68rem] font-medium tracking-[0.1em] text-ink-soft uppercase">
            AI employees
          </dt>
          <dd className="text-sm font-semibold text-ink tabular-nums">
            {formatCount(plan.limits.employees)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-[0.68rem] font-medium tracking-[0.1em] text-ink-soft uppercase">
            Phone numbers
          </dt>
          <dd className="text-sm font-semibold text-ink tabular-nums">
            {formatCount(plan.limits.numbers)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-[0.68rem] font-medium tracking-[0.1em] text-ink-soft uppercase">
            Credits
          </dt>
          <dd className="text-sm font-semibold text-ink tabular-nums">
            {formatCount(plan.limits.credits)}
            {plan.priceInr === 0 ? ", one-off" : ""}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 flex flex-col gap-2.5">
        {below ? (
          <li className="text-sm leading-relaxed text-ink-soft">
            Everything in {below.name}
          </li>
        ) : null}
        {additions.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm leading-relaxed text-ink"
          >
            <Check className="mt-1 size-3.5 shrink-0 text-cobalt" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <FlowButton
        href={plan.cta.href}
        tone={CTA_TONE[plan.code]}
        className="mt-6 w-full"
      >
        {plan.cta.label}
      </FlowButton>
    </article>
  );
}

/**
 * The whole payment surface: a billing toggle over one framed comparison
 * table. White on white, so the frame and the internal rules carry the
 * structure rather than a tinted ground.
 *
 * The sheet animates in as one object; the toggle only swaps text, so moving
 * it never re-runs the entrance.
 */
export function PricingComparison({ plans }: { plans: PricingPlan[] }) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-10">
      <BillingToggle billing={billing} onChange={setBilling} />

      <motion.div
        className={cn(
          "mt-6 overflow-hidden rounded-3xl border border-hairline bg-surface",
          "shadow-[0_1px_2px_rgba(13,42,107,0.05),0_28px_64px_-48px_rgba(13,42,107,0.45)]",
        )}
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.05 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hidden md:block">
          <ComparisonTable plans={plans} billing={billing} />
        </div>

        <div className="divide-y divide-line md:hidden">
          {plans.map((plan) => (
            <StackedPlan key={plan.code} plan={plan} billing={billing} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
