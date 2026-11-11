import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { glossaryTerms } from "@/content/articles";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "Definitions for AI calling terms: AI voice agent, inbound calling, outbound campaign, disposition, DND, transcript and webhook.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="Glossary"
        title="The words used in AI calling, defined plainly."
        body="No acronym soup. Each term explains what it means and why it matters when you are evaluating a calling platform."
        breadcrumb={[{ label: "Glossary" }]}
        actions={[
          { label: "Read the blog", href: "/blog", tone: "primary" },
          { label: "Compare approaches", href: "/compare", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow={`${glossaryTerms.length} terms`}
            title="Browse the glossary."
          />

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {glossaryTerms.map((term) => (
              <li key={term.slug}>
                <Link
                  href={`/glossary/${term.slug}`}
                  className="card card-lift group flex h-full flex-col p-5"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-ink">
                      {term.term}
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-blue transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {term.short}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBand
        title="Definitions only get you so far."
        body="A live call in your own use case answers the rest."
      />
    </>
  );
}
