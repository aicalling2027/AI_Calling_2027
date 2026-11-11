import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { CardGrid } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { aboutPage } from "@/content/company";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "AOTMS Global Pvt. Ltd. builds AI voice employees for the first conversation — inbound answering, outbound campaigns and instant lead response.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow={aboutPage.eyebrow}
        title={aboutPage.title}
        body={aboutPage.summary}
        note={aboutPage.note}
        breadcrumb={[{ label: "About" }]}
        actions={[
          { label: "Talk to us", href: "/contact", tone: "primary" },
          { label: "See the products", href: "/product/inbound", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SectionHeader
              eyebrow={aboutPage.mission.eyebrow}
              title={aboutPage.mission.title}
            />
            <div>
              <p className="text-base leading-relaxed text-ink-soft md:text-lg">
                {aboutPage.mission.body}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {site.legalName} builds on one conviction: the first conversation is
                where enquiries are won or lost, and it should not depend on who happens
                to be free when the phone rings.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="Principles"
            title="Four rules we build against."
          />
          <CardGrid items={aboutPage.principles} columns={4} className="mt-10" />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="At a glance" title="What we can state today." />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {aboutPage.facts.map((fact) => (
              <article
                key={fact.title}
                className="card card-lift p-6"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-deep">
                  {fact.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {fact.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <FaqSection title="About AOTMS." items={aboutPage.faq} />

      <CtaBand
        title="See whether the fit is real."
        body="The fastest evaluation is one use case, one script and a week of transcripts."
      />
    </>
  );
}
