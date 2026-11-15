import type { Metadata } from "next";

import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { VoiceCatalogue } from "@/components/sections/voice-catalogue";
import { voices } from "@/content/home";
import { voicesPage } from "@/content/marketing";
import { VOICE_PLANS, VOICE_TIER_ORDER } from "@/content/voice-catalogue";

export const metadata: Metadata = {
  title: "Voices",
  description:
    "Play every AOTMS voice in the languages it speaks, filter by language, mode and gender, and see the per-minute rate for each one.",
  alternates: { canonical: "/voices" },
};

export default function VoicesPage() {
  return (
    <>
      <PageHero
        eyebrow={voicesPage.eyebrow}
        title={voicesPage.title}
        body={voicesPage.summary}
        note={voicesPage.note}
        breadcrumb={[{ label: "Voices" }]}
        actions={[
          { label: "Hear a sample", href: "#catalogue", tone: "primary" },
          { label: "See what is included", href: "/pricing", tone: "secondary" },
        ]}
        aside={<RatePanel />}
      />

      <VoiceCatalogue catalog={voices.catalog} />

      <FaqSection
        title="Voice questions."
        body="Rates, names and samples, answered the way they behave on a real call."
        items={voicesPage.faq}
      />

      <CtaBand
        title="Found the voice? Hear it on your own script."
        body="Build an employee with that voice, add one real case, and listen to the call before you commit to a rollout."
        primary={{ label: "Start free", href: "/free-trial" }}
        secondary={{ label: "Talk to us", href: "/contact" }}
      />
    </>
  );
}

/** The two rate bands, stated once at the top so every card can stay short. */
function RatePanel() {
  return (
    <div className="panel p-5">
      <p className="eyebrow">Sample rates</p>
      <ul className="mt-3 divide-y divide-line">
        {VOICE_TIER_ORDER.map((tier) => {
          const plan = VOICE_PLANS[tier];
          return (
            <li key={tier} className="flex items-baseline justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{plan.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                  {plan.blurb}
                </span>
              </span>
              <span className="shrink-0 text-base font-semibold text-ink">
                ₹{plan.rate}
                <span className="text-[0.7rem] font-normal text-ink-soft">/min</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-[0.7rem] leading-relaxed text-ink-soft">
        Billed per connected minute only. A call that never connects is not billed.
      </p>
    </div>
  );
}
