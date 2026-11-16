"use client";

import { Check, Star } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { FlowButton } from "@/components/ui/flow-button";
import type { PricingPlan } from "@/content/plans";
import { formatCount } from "@/lib/money";
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

/** One line of the limit table. The label is the small-caps rate-card voice. */
function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-[0.68rem] font-medium tracking-[0.1em] text-ink-soft uppercase">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Owns the structural devices that make the sheet work: the plan label and
 * price sit at fixed offsets so they line up across every column no matter how
 * long the copy is. Only the recommendation departs, and only by a 3px cobalt
 * edge - its ground stays white like the other two.
 */
function PlanColumn({ plan }: { plan: PricingPlan }) {
  const popular = plan.popular === true;

  return (
    <article className="relative flex flex-col bg-surface px-6 py-7 md:px-7 md:py-8">
      {popular ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-cobalt" />
      ) : null}

      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink-soft uppercase">
          {plan.name}
        </p>
        {popular ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-cobalt px-2 py-0.5 text-[0.55rem] font-semibold tracking-[0.1em] text-white uppercase">
            <Star className="size-2 fill-white" aria-hidden />
            Best value
          </span>
        ) : null}
      </div>

      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="display text-4xl leading-none tabular-nums md:text-[2.6rem]">
          ₹{formatCount(plan.priceInr)}
        </span>
        <span className="text-xs text-ink-soft">/ {plan.period}</span>
      </p>

      {/* Two lines reserved: the limits table below has to start on the same
          baseline in all three columns. */}
      <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-ink-soft">
        {plan.audience}
      </p>

      <dl className="mt-5 divide-y divide-line border-y border-line">
        <LimitRow label="AI employees" value={formatCount(plan.limits.employees)} />
        <LimitRow label="Phone numbers" value={formatCount(plan.limits.numbers)} />
        <LimitRow label="Credits / month" value={formatCount(plan.limits.credits)} />
      </dl>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {plan.includes.map((item) => (
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
        className="mt-7 w-full"
      >
        {plan.cta.label}
      </FlowButton>
    </article>
  );
}

/**
 * The three plans as one printed rate card rather than three floating boxes:
 * a single hairline frame, two internal rules, one shadow. On a white section
 * the frame is what gives the group an edge - separate cards on white had
 * nothing holding them together.
 *
 * The whole sheet animates as one object; staggering three separate cards
 * would have contradicted the reading that these are columns of the same table.
 */
export function PricingCards({ plans }: { plans: PricingPlan[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "mt-12 overflow-hidden rounded-3xl border border-hairline bg-surface",
        "shadow-[0_1px_2px_rgba(13,42,107,0.05),0_28px_64px_-48px_rgba(13,42,107,0.45)]",
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {plans.map((plan) => (
          <PlanColumn key={plan.code} plan={plan} />
        ))}
      </div>
    </motion.div>
  );
}
