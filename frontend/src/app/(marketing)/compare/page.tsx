import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { LinkCards } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { comparisons } from "@/content/articles";

export const metadata: Metadata = {
  title: "Comparisons",
  description:
    "Compare AI voice calling with an IVR, a manual dial desk and an outsourced calling team.",
  alternates: { canonical: "/compare" },
};

export default function CompareIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="Comparisons"
        title="Compare the alternatives honestly."
        body="Each comparison states what the other approach is actually good at. If a row claims AOTMS wins everything, it is not a comparison."
        breadcrumb={[{ label: "Comparisons" }]}
        actions={[
          { label: "Talk to us", href: "/contact", tone: "primary" },
          { label: "See pricing", href: "/pricing", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow={`${comparisons.length} comparisons`}
            title="Pick the decision you are making."
          />
          <LinkCards
            items={comparisons.map((comparison) => ({
              title: comparison.title,
              body: comparison.excerpt,
              href: `/compare/${comparison.slug}`,
              label: "Read comparison",
            }))}
            className="mt-10"
          />
        </Container>
      </Section>

      <CtaBand
        title="Still not sure which shape you need?"
        body="Describe the calls you handle today and the team will tell you which approach fits."
      />
    </>
  );
}
