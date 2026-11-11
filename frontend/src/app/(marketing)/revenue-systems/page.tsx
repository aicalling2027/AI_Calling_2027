import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { CardGrid } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { RelatedLinks } from "@/components/sections/related-links";
import { revenuePage } from "@/content/marketing";

export const metadata: Metadata = {
  title: "Revenue systems",
  description:
    "How AOTMS fits into a revenue process: capture, contact, qualify, hand over, follow up and measure.",
  alternates: { canonical: "/revenue-systems" },
};

export default function RevenueSystemsPage() {
  return (
    <>
      <PageHero
        eyebrow={revenuePage.eyebrow}
        title={revenuePage.title}
        body={revenuePage.summary}
        breadcrumb={[{ label: "Revenue systems" }]}
        actions={[
          { label: "Start free", href: "/free-trial", tone: "primary" },
          { label: "Talk to us", href: "/contact", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="The chain"
            title="Six stages between an enquiry and a conversation."
            body="Each stage has one job. Automation is applied where the work is repetitive, not where it needs judgement."
          />
          <CardGrid items={revenuePage.stages} columns={3} className="mt-10" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="Principles"
            title="How the system is designed."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {revenuePage.principles.map((principle) => (
              <article
                key={principle.title}
                className="card card-lift p-6"
              >
                <h3 className="text-base font-semibold text-ink md:text-lg">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {principle.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <RelatedLinks
        eyebrow="Each stage is a product"
        title="Where to start."
        items={revenuePage.links}
      />

      <FaqSection title="Revenue system questions." items={revenuePage.faq} />

      <CtaBand
        title="Find the stage that is leaking."
        body="Start with one measurable step, then extend the system around it."
      />
    </>
  );
}
