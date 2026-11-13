import Link from "next/link";

import { Container } from "@/components/layout/container";
import { finalCta } from "@/content/home";
import { cta } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="section section-night">
      <Container>
        <div className="relative overflow-hidden text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-coral/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-blue/50 blur-3xl"
          />
          <div className="relative">
            <h2 className="display-on-night mx-auto max-w-2xl text-3xl leading-tight md:text-4xl">
              {finalCta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/75 md:text-base">
              {finalCta.body}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={cta.primary.href}
                className="btn-glass btn-glass-night inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-semibold"
              >
                {cta.primary.label}
              </Link>
              <Link
                href={cta.secondary.href}
                className="btn-glass btn-glass-night inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-medium text-ink-soft"
              >
                {cta.secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
