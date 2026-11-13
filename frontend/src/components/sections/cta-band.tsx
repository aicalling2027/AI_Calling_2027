import { Container } from "@/components/layout/container";
import { FlowButton } from "@/components/ui/flow-button";

type CtaAction = { label: string; href: string };

type CtaBandProps = {
  title: string;
  body?: string;
  primary?: CtaAction;
  secondary?: CtaAction;
  /** Small print under the buttons — use for honest disclaimers. */
  note?: string;
};

/**
 * Closing call-to-action used at the bottom of every marketing page.
 * Full-bleed blue-night band that runs straight into the blue-night footer.
 */
export function CtaBand({
  title,
  body,
  primary = { label: "Start free", href: "/free-trial" },
  secondary = { label: "Talk to us", href: "/contact" },
  note,
}: CtaBandProps) {
  return (
    // `overflow-hidden` belongs to the full-bleed band, not to the content box:
    // the glow is deliberately offset outside the content, and clipping it
    // there would slice through its bright core and show a hard rectangle.
    <section className="section section-night overflow-hidden">
      <Container>
        <div className="relative">
          {/* A gradient rather than a blurred disc: it fades inside its own box,
              so wherever the band clips it the edge is already transparent. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-72 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--tangerine)_32%,transparent),transparent)]"
          />
          <div className="relative grid gap-8 md:grid-cols-[1.3fr_0.7fr] md:items-end">
            <div>
              <h2 className="display-on-night max-w-xl text-3xl leading-tight md:text-4xl">
                {title}
              </h2>
              {body ? (
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/75 md:text-base">
                  {body}
                </p>
              ) : null}
              {note ? (
                <p className="mt-4 text-xs text-white/60">{note}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <FlowButton href={primary.href} size="lg" tone="night">
                {primary.label}
              </FlowButton>
              <FlowButton href={secondary.href} size="lg" tone="nightQuiet">
                {secondary.label}
              </FlowButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
