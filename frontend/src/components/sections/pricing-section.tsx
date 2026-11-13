import Link from "next/link";

import { Container } from "@/components/layout/container";
import { pricingSection } from "@/content/home";

export function PricingSection() {
  return (
    <section className="section bg-ivory">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{pricingSection.eyebrow}</p>
          <h2 className="display mt-3 text-3xl leading-tight md:text-4xl">
            {pricingSection.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft md:text-base">
            {pricingSection.body}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="btn-glass inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold"
            >
              Request a quote
            </Link>
            <Link
              href="/pricing"
              className="btn-glass inline-flex h-11 items-center rounded-full px-6 text-sm font-medium text-ink-soft"
            >
              Pricing overview
            </Link>
          </div>

          <p className="mt-5 text-xs text-ink-soft">{pricingSection.note}</p>
        </div>
      </Container>
    </section>
  );
}
