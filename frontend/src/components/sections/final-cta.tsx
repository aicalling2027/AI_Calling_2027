import { Container } from "@/components/layout/container";
import { FlowButton } from "@/components/ui/flow-button";
import { finalCta } from "@/content/home";
import { cta } from "@/lib/site";

export function FinalCta() {
  return (
    // The band owns the clipping; the content box does not. The glows are
    // offset outside the content, so clipping there would slice a hard edge
    // through their bright cores.
    <section className="section section-night overflow-hidden">
      <Container>
        <div className="relative text-center">
          {/* Gradients, not blurred discs: each fades inside its own box, so
              wherever the band clips it the edge is already transparent. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 size-72 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--tangerine)_32%,transparent),transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-20 size-72 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--cobalt)_55%,transparent),transparent)]"
          />
          <div className="relative">
            <h2 className="display-on-night mx-auto max-w-2xl text-3xl leading-tight md:text-4xl">
              {finalCta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/75 md:text-base">
              {finalCta.body}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <FlowButton href={cta.primary.href} size="lg" tone="night">
                {cta.primary.label}
              </FlowButton>
              <FlowButton href={cta.secondary.href} size="lg" tone="nightQuiet">
                {cta.secondary.label}
              </FlowButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
