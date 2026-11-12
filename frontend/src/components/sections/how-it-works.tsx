import {
  BatteryFull,
  Bot,
  ClipboardCheck,
  MicOff,
  PhoneCall,
  PhoneOff,
  Signal,
  Users,
  Wifi,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { howItWorks } from "@/content/home";
import { cn } from "@/lib/utils";

/** One icon per step, in the same order as `howItWorks.steps`. */
const stepIcons = [Users, Bot, ClipboardCheck];

/** Waveform bar heights in px; the timing comes from the `animate-wave` token. */
const waveBars = [10, 18, 26, 14, 22, 30, 16, 24, 12];

export function HowItWorks() {
  const { demo } = howItWorks;

  return (
    <section className="section overflow-hidden bg-surface">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-16 lg:gap-y-12">
          {/* Heading — the reading column starts here. */}
          <div className="lg:col-start-2 lg:row-start-1">
            <p className="eyebrow">{howItWorks.eyebrow}</p>
            <h2 className="display mt-3 max-w-xl text-3xl leading-tight md:text-4xl">
              {howItWorks.title}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
              {howItWorks.body}
            </p>
          </div>

          {/* The device: an automatic call in progress. It repeats the copy
              beside it, so readers may skip it. */}
          <div className="relative lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center">
            <div
              aria-hidden
              className="relative mx-auto w-[252px] rounded-[2.6rem] bg-ink p-[7px] shadow-[0_36px_70px_-32px_rgba(13,42,107,0.55)]"
            >
              <div className="glow-blue pointer-events-none absolute -inset-x-24 -top-12 -bottom-12 rounded-full" />
              <div className="glow-coral pointer-events-none absolute -right-20 top-1/3 size-52 rounded-full opacity-80" />

              {/* Hardware: side buttons and the notch. */}
              <span className="absolute -left-[9px] top-24 h-9 w-[3px] rounded-full bg-ink" />
              <span className="absolute -left-[9px] top-[9.5rem] h-9 w-[3px] rounded-full bg-ink" />
              <span className="absolute -right-[9px] top-28 h-14 w-[3px] rounded-full bg-ink" />

              <div className="relative flex h-[516px] flex-col overflow-hidden rounded-[2.15rem] bg-surface px-4 pt-4 pb-4">
                <span className="absolute left-1/2 top-0 h-1.5 w-16 -translate-x-1/2 rounded-b-xl bg-ink" />

                <div className="flex items-center justify-between text-[10px] font-semibold text-ink">
                  <span>9:41</span>
                  <span className="flex items-center gap-1 text-ink-soft">
                    <Signal className="size-3" />
                    <Wifi className="size-3" />
                    <BatteryFull className="size-3.5" />
                  </span>
                </div>

                <div className="mt-6 text-center">
                  <div className="relative mx-auto size-16">
                    <span className="absolute inset-0 animate-ping rounded-full bg-cobalt/15 [animation-duration:2.6s]" />
                    <span className="absolute inset-0 animate-ping rounded-full bg-cobalt/10 [animation-duration:2.6s] [animation-delay:0.9s]" />
                    <span className="relative flex size-16 items-center justify-center rounded-full bg-cobalt-tint text-cobalt ring-1 ring-cobalt/15">
                      <PhoneCall className="size-7" />
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-ink">{demo.agent}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">{demo.meta}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-tangerine-tint px-2.5 py-1 text-[10px] font-semibold text-tangerine-ink">
                    <span className="size-1.5 animate-pulse rounded-full bg-tangerine-deep" />
                    {demo.status}
                  </span>
                </div>

                <div className="mt-5 flex flex-col items-center">
                  <div className="flex h-8 items-center gap-1">
                    {waveBars.map((height, index) => (
                      <span
                        key={index}
                        style={{ height, animationDelay: `${index * 0.09}s` }}
                        className="w-1 animate-wave rounded-full bg-cobalt/70"
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-ink">
                    {demo.timer}
                  </p>
                </div>

                {/* Two turns of the call, so the screen reads like a live transcript. */}
                <div className="mt-5">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-soft uppercase">
                    {demo.transcriptLabel}
                  </p>
                  <p className="mt-2 rounded-xl rounded-tl-sm bg-cobalt-tint px-3 py-2 text-[11px] leading-relaxed text-ink">
                    {demo.reply}
                  </p>
                  <p className="mt-2 ml-5 rounded-xl rounded-br-sm bg-mist px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
                    {demo.transcript}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-center gap-5 pt-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-mist text-ink">
                    <MicOff className="size-4" />
                  </span>
                  <span className="flex size-11 items-center justify-center rounded-full bg-tangerine text-ink shadow-[0_10px_20px_-10px_rgba(210,100,26,0.9)]">
                    <PhoneOff className="size-5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* The steps, one card each. */}
          <ol className="space-y-3 lg:col-start-2 lg:row-start-2">
            {howItWorks.steps.map((step, index) => {
              const Icon = stepIcons[index] ?? Users;

              return (
                <li key={step.title} className="card card-lift flex gap-4 p-5">
                  <span
                    className={cn(
                      "icon-tile",
                      index === 1 ? "icon-tile-accent" : "icon-tile-blue",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-soft uppercase">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}
