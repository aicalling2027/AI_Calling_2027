import Link from "next/link";
import { Check, Play } from "lucide-react";

import { Container } from "@/components/layout/container";
import BlurText from "@/components/reactbits/BlurText";
import { buttonVariants } from "@/components/ui/button";
import { hero } from "@/content/home";
import { cta } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Illustrative call data for the hero card. Deliberately fictional and
 * labelled as such on the card — never presented as a real customer record.
 */
const callRows = [
  { label: "Contact", value: "Priya S." },
  { label: "Employee", value: "AOTMS Voice Agent (Telugu)" },
  { label: "Outcome", value: "Interested", badge: true },
  { label: "Talk time", value: "02:41" },
];

/** Static bar heights keep the waveform identical on server and client. */
const waveBars = [
  0.45, 0.8, 0.35, 0.65, 1, 0.5, 0.75, 0.4, 0.6, 0.9, 0.45, 0.7, 0.55, 0.95,
  0.5, 0.8, 0.38, 0.66,
];

/** The headline with one keyword in coral and a hand-drawn underline. */
function Headline() {
  const index = hero.title.indexOf(hero.highlight);

  if (index < 0) {
    return <>{hero.title}</>;
  }

  return (
    <>
      {hero.title.slice(0, index)}
      <span className="relative inline-block text-coral-deep">
        {hero.highlight}
        <svg
          aria-hidden
          viewBox="0 0 220 14"
          preserveAspectRatio="none"
          className="absolute inset-x-0 -bottom-1.5 h-3 w-full text-coral md:-bottom-2.5"
        >
          <path
            d="M3 10.4C46 4.2 96 2.4 145 4.8c26 1.3 51 3.4 72 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M18 12.6c40-3.2 88-4 132-2.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
      {hero.title.slice(index + hero.highlight.length)}
    </>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="glow-blue absolute -left-40 -top-48 size-[38rem] rounded-full" />
        <div className="glow-coral absolute -right-24 top-6 size-[30rem] rounded-full" />
      </div>

      <Container className="relative pb-16 pt-14 md:pb-24 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
              <span className="size-1.5 rounded-full bg-coral-deep" aria-hidden />
              {hero.eyebrow}
            </span>

            <h1 className="display mt-6 text-[2.6rem] leading-[1.06] sm:text-6xl lg:text-[4.1rem]">
              <Headline />
            </h1>

            <div className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg">
              <BlurText
                text={hero.subtitle}
                animateBy="words"
                direction="top"
                delay={14}
                className="leading-relaxed"
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={cta.primary.href}
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-7 text-sm")}
              >
                {cta.primary.label}
              </Link>
              <Link
                href="/pricing"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 px-7 text-sm",
                )}
              >
                See pricing
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
              {hero.trust.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft"
                >
                  <Check className="size-3.5 shrink-0 text-coral-deep" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Illustrative call summary — sample data, clearly labelled. */}
          <div className="relative">
            <div className="card p-5 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-ink">Call summary</p>
                <span className="rounded-full bg-coral-tint px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-coral-ink">
                  Illustrative
                </span>
              </div>

              <dl className="mt-4 space-y-2.5">
                {callRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 rounded-xl border border-line bg-ivory-light px-3 py-2.5"
                  >
                    <dt className="text-xs uppercase tracking-[0.1em] text-ink-soft">
                      {row.label}
                    </dt>
                    <dd className="text-right text-sm font-medium text-ink">
                      {row.badge ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-tint px-2.5 py-1 text-[0.7rem] font-semibold text-coral-ink">
                          <span className="size-1.5 rounded-full bg-coral" aria-hidden />
                          {row.value}
                        </span>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-tint text-blue">
                  <Play className="size-4 translate-x-[1px]" aria-hidden />
                </span>
                <div aria-hidden className="flex h-8 flex-1 items-center gap-[3px]">
                  {waveBars.map((height, index) => (
                    <span
                      key={index}
                      className="wave-bar w-[3px] shrink-0 rounded-full bg-blue"
                      style={{
                        height: `${Math.round(height * 30)}px`,
                        animationDelay: `${index * 70}ms`,
                        animationDuration: `${1000 + (index % 4) * 140}ms`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold tabular-nums text-ink-soft">
                  02:41
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-line px-3.5 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Transcript preview
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  <span className="font-semibold text-blue">Agent</span> Good
                  evening, is this Priya?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  <span className="font-semibold text-blue">Priya</span> Yes, who
                  is calling?
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
