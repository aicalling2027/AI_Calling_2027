import { Container } from "@/components/layout/container";
import { LazyPricingGrid } from "@/components/sections/pricing-lazy";
import { FlowButton } from "@/components/ui/flow-button";
import { landingPlans, pricingIntro } from "@/content/plans";
import { formatCount, formatInr } from "@/lib/money";

export function PricingSection() {
  return (
    // White, like the page itself. The band is held by two hairlines and the
    // rate card below does the rest - no tinted ground, no coloured warm card.
    <section className="section border-y border-line bg-surface">
      <Container>
        <div className="max-w-2xl">
          <p className="eyebrow">{pricingIntro.eyebrow}</p>
          <h2 className="display mt-3 text-3xl leading-[1.08] md:text-[2.6rem]">
            {pricingIntro.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft md:text-base">
            {pricingIntro.body}
          </p>
        </div>

        <LazyPricingGrid plans={landingPlans} />

        {/* The grid only mounts in a browser, so the same three prices are
            printed here as well: search engines read them, and a visitor
            without scripting still sees what each plan costs. */}
        <noscript>
          <ul className="mt-12 divide-y divide-line overflow-hidden rounded-3xl border border-hairline">
            {landingPlans.map((plan) => (
              <li key={plan.code} className="p-6">
                <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink-soft uppercase">
                  {plan.name}
                </p>
                <p className="display mt-3 text-3xl tabular-nums">
                  {formatInr(plan.priceInr)}
                  <span className="text-sm font-normal text-ink-soft">
                    {" "}
                    / {plan.period}
                  </span>
                </p>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">AI employees</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {formatCount(plan.limits.employees)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Phone numbers</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {formatCount(plan.limits.numbers)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Credits / month</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {formatCount(plan.limits.credits)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </noscript>

        <div className="mt-6 flex flex-col items-start justify-between gap-5 md:flex-row md:items-start">
          <div className="max-w-xl space-y-1.5">
            <p className="text-xs leading-relaxed text-ink">{pricingIntro.meta}</p>
            <p className="text-xs leading-relaxed text-ink-soft">
              {pricingIntro.footnote}
            </p>
          </div>
          <FlowButton href={pricingIntro.link.href} tone="quiet" size="sm">
            {pricingIntro.link.label}
          </FlowButton>
        </div>
      </Container>
    </section>
  );
}
