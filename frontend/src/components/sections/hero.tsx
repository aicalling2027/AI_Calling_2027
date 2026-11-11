import Link from "next/link";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import BlurText from "@/components/reactbits/BlurText";
import { VoiceOrb } from "@/components/sections/voice-orb";
import { buttonVariants } from "@/components/ui/button";
import { hero } from "@/content/home";
import { cta } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The headline with one keyword in tangerine and a hand-drawn underline. */
function Headline() {
  const index = hero.title.indexOf(hero.highlight);

  if (index < 0) {
    return <>{hero.title}</>;
  }

  return (
    <>
      {hero.title.slice(0, index)}
      <span className="relative inline-block text-tangerine-deep">
        {hero.highlight}
        <svg
          aria-hidden
          viewBox="0 0 220 14"
          preserveAspectRatio="none"
          className="absolute inset-x-0 -bottom-1.5 h-3 w-full text-tangerine md:-bottom-2.5"
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
              <span className="size-1.5 rounded-full bg-tangerine-deep" aria-hidden />
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
                  <Check className="size-3.5 shrink-0 text-tangerine-deep" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Voice visualiser — one illustrative call on a loop, no real audio.
              It sits straight on the page: no panel, no background colour. */}
          <div className="relative flex items-center justify-center">
            <VoiceOrb />
          </div>
        </div>
      </Container>
    </section>
  );
}
