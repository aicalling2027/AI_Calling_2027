import Image from "next/image";
import {
  Languages,
  PhoneCall,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import BlurText from "@/components/reactbits/BlurText";
import { FlowButton } from "@/components/ui/flow-button";
import { hero } from "@/content/home";
import { cta } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The headline is two colours, not two gradients: the clause before the comma
 * carries the claim in tangerine, the rest carries the promise in ink. The
 * break is read from the copy rather than written into the markup, so editing
 * the sentence moves it.
 */
function Headline() {
  const cut = hero.title.indexOf(",");
  const lead = cut === -1 ? hero.title : hero.title.slice(0, cut + 1);
  const tail = cut === -1 ? "" : hero.title.slice(cut + 1);

  return (
    <>
      <span className="text-tangerine-deep">{lead}</span>
      {tail}
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
    placement: "lg:-left-40 lg:top-[16%]",
    tint: "icon-tile-accent",
  },
  {
    icon: PhoneCall,
    placement: "lg:-left-36 lg:bottom-[14%]",
    tint: "icon-tile-blue",
  },
  {
    icon: UserRoundCheck,
    placement: "lg:-right-40 lg:top-[40%]",
    tint: "icon-tile-accent",
  },
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* The field: white page falling to a pale blue that the device shot can
          sit on. It is paint, not the shader — at the opacity this layout
          needs the mesh only greyed the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#f2f8fe_32%,#e6f1fd_100%)]" />
        <div className="absolute left-1/2 top-[-26rem] size-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(89,168,255,0.14),transparent)]" />
      </div>

      {/* The bar over the hero is out of flow, so the section pays its height
          back here — and then leaves a deliberate gap, so the stack reads
          navbar / gap / hero rather than the headline starting under the bar. */}
      <Container className="relative pt-[6.25rem] text-center md:pt-28">
        {/* A label, then the headline, then the proof. The label is what stops
            the hero from opening on a single large sentence. */}
        <p className="inline-flex items-center gap-2 rounded-full border border-[#dbe7f7] bg-white/85 py-1 pr-3.5 pl-1 text-[0.68rem] font-medium text-ink-soft shadow-[0_8px_24px_-18px_rgba(13,42,107,0.7)] backdrop-blur-sm">
          <span className="rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.14em] text-[#0b6ff0] uppercase">
            New
          </span>
          {hero.eyebrow}
        </p>

        {/* Sized down from the previous pass: the headline is a caption over
            the device now, not the whole screen. The opening clause holds one
            line on phones at 1.9rem. */}
        <h1 className="display mx-auto mt-6 max-w-3xl text-balance text-[1.9rem] leading-[1.12] tracking-[-0.015em] sm:text-[2.85rem] sm:leading-[1.08] lg:text-[3.6rem]">
          <Headline />
        </h1>

        <div className="mx-auto mt-4 max-w-xl text-[0.9rem] leading-relaxed text-ink-soft sm:mt-5 sm:text-base">
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
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-[10.5px] font-medium text-ink md:mt-4 md:text-[11px]">
          {hero.note}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-7">
          <FlowButton href={cta.primary.href} size="lg" tone="brand">
            {cta.primary.label}
          </FlowButton>
          <FlowButton href="/pricing" size="lg" tone="paper">
            See pricing
          </FlowButton>
        </div>

        {/* The device. The shot is a portrait photo on its own pale-blue
            ground, so the band is a fixed height anchored at the top: the
            phone stands on the fold and runs off it, instead of being
            squeezed into a strip. `.hero-device` feathers the photo's backdrop
            into the field on all four sides. */}
        <div className="relative mx-auto mt-10 w-full max-w-[26rem] sm:mt-12 sm:max-w-[24rem] lg:mt-14 lg:max-w-[30rem]">
          {/* The mask sits on the band, not the image: on a phone the band
              shows only the top third of a 601px-tall shot, and a mask sized
              to the image would never reach its own bottom edge. */}
          <div className="hero-device relative h-[19rem] overflow-hidden sm:h-[20rem] lg:h-[23rem]">
            <Image
              src="/AI_Calling.png"
              alt="The AOTMS AI agent on a live support call, shown on a phone held in one hand."
              width={735}
              height={920}
              priority
              sizes="(min-width: 1024px) 480px, (min-width: 640px) 384px, 100vw"
              className="absolute inset-x-0 top-0 mx-auto w-full select-none"
            />
          </div>

          {/* Compact pills under the band on phones, floating cards beside the
              device from lg up. The list has no box at lg, so the cards
              resolve against the stage. */}
          <ul className="mx-auto mt-3 flex w-full max-w-md flex-wrap justify-center gap-2 sm:mt-5 lg:mt-0 lg:block lg:max-w-none">
            {hero.trust.map((item, index) => {
              const card = trustCards[index];
              if (!card) return null;
              const Icon = card.icon;

              return (
                <li
                  key={item}
                  className={cn(
                    "flex items-center gap-2 rounded-full border border-[#e6eefb] bg-white py-1 pr-3 pl-1.5 text-left shadow-[0_18px_40px_-30px_rgba(13,42,107,0.65)]",
                    "lg:absolute lg:w-60 lg:gap-3 lg:rounded-2xl lg:px-3.5 lg:py-2.5 lg:shadow-[0_24px_50px_-34px_rgba(13,42,107,0.6)]",
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
                  <span className="text-[11px] leading-tight font-semibold text-ink lg:text-[11.5px] lg:leading-snug">
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
