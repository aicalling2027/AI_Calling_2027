import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";

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
    <section className="section section-night">
      <Container>
        <div className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-coral/20 blur-3xl"
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
              <Link
                href={primary.href}
                className="btn-accent h-12 gap-2 px-7 text-sm"
              >
                {primary.label}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={secondary.href}
                className="btn-on-night h-12 px-7 text-sm"
              >
                {secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
