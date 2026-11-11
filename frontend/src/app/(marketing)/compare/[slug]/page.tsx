import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { ComparisonTable } from "@/components/sections/comparison-table";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { Prose } from "@/components/sections/prose";
import { comparisons, getComparison } from "@/content/articles";
import { site } from "@/lib/site";

type RouteParams = { slug: string };

// [block] params are read to render the comparison, so this route cannot stream an instant shell.
export const instant = false;

export function generateStaticParams(): RouteParams[] {
  return comparisons.map((comparison) => ({ slug: comparison.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);

  if (!comparison) {
    return {};
  }

  return {
    title: comparison.title,
    description: comparison.metaDescription,
    alternates: { canonical: `/compare/${comparison.slug}` },
  };
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const comparison = getComparison(slug);

  if (!comparison) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow="Comparison"
        title={comparison.title}
        body={comparison.summary}
        breadcrumb={[
          { label: "Comparisons", href: "/compare" },
          { label: comparison.against },
        ]}
        actions={[
          { label: "Talk to us", href: "/contact", tone: "primary" },
          { label: "All comparisons", href: "/compare", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Side by side"
            title={`${site.shortName} and ${comparison.against}.`}
          />
          <div className="mt-8">
            <ComparisonTable rows={comparison.rows} against={comparison.against} />
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <div className="max-w-2xl">
            <Prose blocks={comparison.body} />
          </div>
        </Container>
      </Section>

      <FaqSection
        title="Choosing between them."
        items={[
          {
            question: `When is ${comparison.against} the better option?`,
            answer:
              "When the work genuinely needs people, or when the calls are too varied for a fixed script. The comparison above names the rows where the other approach leads.",
          },
          {
            question: "Can the two run together?",
            answer:
              "Yes. Most teams keep people on complex calls and automate the repeatable portion, with routing between them.",
          },
          {
            question: "Is this comparison independent?",
            answer:
              "No. It is written by AOTMS and describes intended behaviour. Verify any row that matters to your decision.",
          },
        ]}
      />

      <CtaBand
        title="Test the comparison on your own calls."
        body="One use case and a week of transcripts will tell you more than any table."
      />
    </>
  );
}
