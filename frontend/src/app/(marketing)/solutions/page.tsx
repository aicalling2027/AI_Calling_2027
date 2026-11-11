import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { LinkCards } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { ProblemSection } from "@/components/sections/problem-section";
import { solutionsPage } from "@/content/marketing";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "AOTMS solutions by team and industry: sales speed, support coverage, operations throughput and first-contact revenue.",
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow={solutionsPage.eyebrow}
        title={solutionsPage.title}
        body={solutionsPage.summary}
        breadcrumb={[{ label: "Solutions" }]}
        actions={[
          { label: "Start free", href: "/free-trial", tone: "primary" },
          { label: "Talk to us", href: "/contact", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="By team"
            title="Find the team that owns the missed call."
            body="Each entry point maps to one product, so the first rollout stays small."
          />
          <LinkCards items={solutionsPage.byTeam} className="mt-10" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="By industry"
            title="Where repetitive first calls cost the most."
            body="Industry pages describe the same platform with scripts and routing shaped for the sector."
          />
          <LinkCards
            items={solutionsPage.byIndustry.map((item) => ({
              ...item,
              label: "View industry",
            }))}
            className="mt-10"
          />
        </Container>
      </Section>

      <ProblemSection
        eyebrow="Packages"
        title="Pick a starting point, not a bundle."
        body="Three ways teams start. Each one runs on the same account and can be extended later."
        items={solutionsPage.bundles.map((bundle) => ({
          title: bundle.title,
          body: bundle.body,
          icon: "layers" as const,
        }))}
      />

      <FaqSection
        title="Solutions questions."
        items={solutionsPage.faq}
      />

      <CtaBand
        title="Tell us which team is losing the calls."
        body="We will map that problem to one product and one measurable outcome."
      />
    </>
  );
}
