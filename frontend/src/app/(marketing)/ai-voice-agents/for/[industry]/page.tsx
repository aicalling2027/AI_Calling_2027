import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BulletPanel } from "@/components/sections/bullet-panel";
import { LinkCards, NumberedSteps } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { ProblemSection } from "@/components/sections/problem-section";
import { getIndustry, industries } from "@/content/landings";

type RouteParams = { industry: string };

export function generateStaticParams(): RouteParams[] {
  return industries.map((industry) => ({ industry: industry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { industry: slug } = await params;
  const industry = getIndustry(slug);

  if (!industry) {
    return {};
  }

  return {
    title: `AI voice agents for ${industry.name.toLowerCase()}`,
    description: industry.metaDescription,
    alternates: { canonical: `/ai-voice-agents/for/${industry.slug}` },
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { industry: slug } = await params;
  const industry = getIndustry(slug);

  if (!industry) {
    notFound();
  }

  const others = industries
    .filter((item) => item.slug !== industry.slug)
    .slice(0, 3)
    .map((item) => ({
      title: item.name,
      body: item.summary,
      href: `/ai-voice-agents/for/${item.slug}`,
      label: "View industry",
      icon: item.icon,
    }));

  return (
    <>
      <PageHero
        eyebrow={`Industry · ${industry.name}`}
        title={industry.title}
        body={industry.summary}
        breadcrumb={[
          { label: "Solutions", href: "/solutions" },
          { label: industry.name },
        ]}
        actions={[
          { label: "Start free", href: "/free-trial", tone: "primary" },
          { label: "Talk to us", href: "/contact", tone: "secondary" },
        ]}
        aside={
          <BulletPanel
            title="Review after the first week"
            badge="Measurement"
            items={industry.review}
            footer="Measure these three things before expanding the script."
          />
        }
      />

      <ProblemSection
        eyebrow="What breaks today"
        title={`The ${industry.name.toLowerCase()} calling problem.`}
        items={industry.challenges}
      />

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="Playbook"
            title="Three plays to configure first."
            body="Each play is a script, not a feature. Start with the one that costs you the most enquiries."
          />
          <NumberedSteps steps={industry.plays} className="mt-10" />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Same platform, other sectors"
            title="How the script changes by industry."
          />
          <LinkCards items={others} className="mt-10" />
        </Container>
      </Section>

      <FaqSection
        title={`${industry.name} questions.`}
        body="Sector pages describe intended use. Verify anything that affects a regulated or contractual decision."
        items={industry.faq}
      />

      <CtaBand
        title={`Put an AI employee on your ${industry.name.toLowerCase()} calls.`}
        body="Start with the single script that loses you the most enquiries today."
      />
    </>
  );
}
