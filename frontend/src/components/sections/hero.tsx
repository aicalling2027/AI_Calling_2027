import Image from "next/image";
import Link from "next/link";
import {
  Languages,
  PhoneCall,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import BlurText from "@/components/reactbits/BlurText";
import { buttonVariants } from "@/components/ui/button";
import { hero } from "@/content/home";
import { cta } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Black headline, one keyword in tangerine, and a cobalt marker underneath — the
 * two brand accents in one line.
 */
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
          className="absolute inset-x-0 -bottom-1.5 h-3 w-full text-cobalt/45 md:-bottom-2.5"
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

/**
 * The proof lines under the headline become floating cards beside the device on
 * large screens. The placement is presentation only, so it lives here while the
 * wording stays in `content/home`.
 */
const trustCards: { icon: LucideIcon; placement: string; tint: string }[] = [
  {
    icon: Languages,
    placement: "lg:left-[5%] lg:top-[14%]",
    tint: "icon-tile-blue",
  },
  {
    icon: PhoneCall,
    placement: "lg:bottom-[18%] lg:left-[7%]",
    tint: "icon-tile-accent",
  },
  {
    icon: UserRoundCheck,
    placement: "lg:right-[3%] lg:top-[34%]",
    tint: "icon-tile-blue",
  },
];

export function Hero() {
  return (
    <section className="relative min-h-svh overflow-hidden lg:min-h-0">
      {/* Cobalt behind the copy, tangerine at the corners, cobalt again behind the
          device — the two brand accents balanced on a white field. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="glow-blue absolute left-1/2 top-[-18rem] size-[46rem] -translate-x-1/2 rounded-full" />
        <div className="glow-coral absolute top-[-8rem] right-[-6rem] hidden size-[28rem] rounded-full sm:block" />
        <div className="glow-coral absolute top-[30rem] left-[-13rem] hidden size-[24rem] rounded-full opacity-80 lg:block" />
        <div className="glow-blue absolute left-1/2 top-[28rem] hidden size-[40rem] -translate-x-1/2 rounded-full lg:block" />
      </div>

      <Container className="relative pb-5 pt-[4.75rem] text-center md:pb-20 md:pt-20">
        <h1 className="display mx-auto max-w-5xl text-balance text-[2.6rem] leading-[1.03] text-ink sm:text-[3.6rem] lg:text-[4.6rem]">
          <Headline />
        </h1>

        <div className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft md:mt-5 md:text-lg">
          <BlurText
            text={hero.subtitle}
            animateBy="words"
            direction="top"
            delay={14}
            className="justify-center leading-relaxed"
          />
        </div>

        {/* The one <p> in the hero: a smaller, quieter line than the
            subheading above it. */}
        <p className="mx-auto mt-3 max-w-3xl text-pretty text-[11px] font-medium text-ink md:mt-4 md:text-xs">
          {hero.note}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:mt-8">
          <Link
            href={cta.primary.href}
            className={cn(
              buttonVariants({ variant: "glass", size: "lg" }),
              "h-11 px-6 text-sm font-semibold md:h-12 md:px-7",
            )}
          >
            {cta.primary.label}
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: "glass", size: "lg" }),
              "h-11 px-6 text-sm text-ink-soft md:h-12 md:px-7",
            )}
          >
            See pricing
          </Link>
        </div>

        <div className="relative mx-auto mt-4 w-full max-w-4xl sm:mt-10 lg:mt-16">
          {/* On phones the shot runs edge to edge as a cover band and fades
              into the page top and bottom. From tablet up the device keeps its
              own aspect and a radial mask dissolves the studio backdrop. */}
          <div className="relative -mx-5 sm:mx-auto sm:max-w-[22rem] lg:max-w-[24rem]">
            <Image
              src="/AI_Calling.png"
              alt="The AOTMS AI calling app open on a phone held in one hand."
              width={1536}
              height={1920}
              priority
              sizes="(min-width: 1024px) 384px, (min-width: 640px) 352px, 100vw"
              className={cn(
                "h-[25svh] w-full object-cover object-[50%_22%] select-none",
                "[mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]",
                "sm:h-auto sm:object-center",
                "sm:[mask-image:radial-gradient(36%_47%_at_50%_44%,#000_62%,transparent_100%)]",
              )}
            />
          </div>

          {/* Compact pills under the cover band on phones, floating cards
              beside the device from lg up. The list has no box at lg, so the
              cards resolve against the row. */}
          <ul className="mx-auto mt-2 flex w-full max-w-md flex-wrap justify-center gap-2 sm:mt-6 lg:mt-0 lg:block lg:max-w-none">
            {hero.trust.map((item, index) => {
              const card = trustCards[index];
              if (!card) return null;
              const Icon = card.icon;

              return (
                <li
                  key={item}
                  className={cn(
                    "flex items-center gap-2 rounded-full border border-line bg-white/90 py-1 pr-3 pl-1.5 text-left shadow-[0_18px_40px_-34px_rgba(13,42,107,0.6)] backdrop-blur-sm",
                    "lg:absolute lg:w-56 lg:gap-3 lg:rounded-2xl lg:px-3.5 lg:py-2.5 lg:shadow-[0_24px_50px_-36px_rgba(13,42,107,0.65)]",
                    card.placement,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg lg:size-9 lg:rounded-xl",
                      card.tint,
                    )}
                  >
                    <Icon className="size-3.5 lg:size-4" />
                  </span>
                  <span className="text-[11px] leading-tight font-semibold text-ink lg:text-xs lg:leading-snug">
                    {item}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
