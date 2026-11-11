import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BulletPanel } from "@/components/sections/bullet-panel";
import { CardGrid } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { voicesPage } from "@/content/marketing";

export const metadata: Metadata = {
  title: "Voices",
  description:
    "Choose the voice and language an AOTMS AI employee speaks. The published catalogue is still being confirmed.",
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
          { label: "Request a sample", href: "/contact", tone: "primary" },
          { label: "See what is included", href: "/pricing", tone: "secondary" },
        ]}
        aside={
          <BulletPanel
            title="Catalogue status"
            badge="Pending"
            items={[
              "Language list not finalised",
              "Voice samples not published",
              "Pronunciation library in progress",
              "Custom voice cloning not confirmed",
            ]}
            footer="This panel is intentionally a status list, not a feature claim."
          />
        }
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Languages"
            title="The languages AOTMS plans to support."
            body="Codes and names below describe the intended catalogue. Every sample is marked pending until audio is published."
          />

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {voicesPage.languages.map((voice) => (
              <li
                key={voice.code}
                className="card card-lift flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {voice.language}
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-ink-soft">
                    {voice.code}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-dashed border-hairline px-2.5 py-1 text-[0.65rem] font-medium text-ink-soft">
                  {voice.status}
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="Voice quality"
            title="What a usable voice has to do."
            body="These are the qualities the catalogue is being built against."
          />
          <CardGrid items={voicesPage.qualities} columns={4} className="mt-10" />
        </Container>
      </Section>

      <FaqSection
        title="Voice questions."
        body="Anything about the catalogue that is not confirmed is marked as such rather than presented as a feature."
        items={voicesPage.faq}
      />

      <CtaBand
        title="Hear a voice before you commit."
        body="Ask the team for a live sample in the language you actually plan to use."
        primary={{ label: "Request a sample", href: "/contact" }}
        secondary={{ label: "Talk to us", href: "/contact" }}
      />
    </>
  );
}
