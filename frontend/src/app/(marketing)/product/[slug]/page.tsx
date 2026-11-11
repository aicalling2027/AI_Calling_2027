import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BulletPanel } from "@/components/sections/bullet-panel";
import { CardGrid, NumberedSteps } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { ProblemSection } from "@/components/sections/problem-section";
import { RelatedLinks } from "@/components/sections/related-links";
import { getProductPage, productPages } from "@/content/products";
import { cta } from "@/lib/site";

type RouteParams = { slug: string };

// `cacheComponents` forbids route segment config (dynamicParams/revalidate),
// so unknown slugs are rejected inside the page via notFound().
export function generateStaticParams(): RouteParams[] {
  return productPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getProductPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/product/${page.slug}` },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const page = getProductPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        body={page.summary}
        breadcrumb={[{ label: "Product" }, { label: page.name }]}
        actions={[
          { label: cta.primary.label, href: cta.primary.href, tone: "primary" },
          { label: "Talk to us", href: "/contact", tone: "secondary" },
        ]}
        aside={
          <BulletPanel
            title={`What ${page.name} covers`}
            badge="Overview"
            items={page.heroBullets}
            footer="Capability summary — final product copy is pending approval."
          />
        }
      />

      <ProblemSection eyebrow="Why it matters" title="The problem with the manual version." items={page.problems} />

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="Capabilities"
            title={`What ${page.name} includes.`}
            body="The same capability set is available across products; what changes is the trigger and the conversation."
          />
          <CardGrid items={page.capabilities} columns={3} className="mt-10" />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="How it works"
            title="Three steps to the first conversation."
          />
          <NumberedSteps steps={page.steps} className="mt-10" />
        </Container>
      </Section>

      <RelatedLinks
        eyebrow="Also part of the platform"
        title="Pair it with the rest of AOTMS."
        items={page.related}
      />

      <FaqSection
        title={`${page.name} questions.`}
        body="Answers below describe the intended behaviour. Anything marked as pending is not yet confirmed for release."
        items={page.faq}
      />

      <CtaBand
        title={`Put ${page.name} to work on your next call.`}
        body="Start with one use case, review the transcripts, then decide how far to expand."
      />
    </>
  );
}
