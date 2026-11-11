import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { LinkCards } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { articles } from "@/content/articles";
import { formatDate } from "@/lib/date";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes on AI voice calling: what an AI employee handles, response time, first use cases and multilingual calls.",
  alternates: { canonical: "/blog" },
};

const resources = [
  {
    title: "Glossary",
    body: "Definitions for the terms used across AI calling — agent, disposition, DND, webhook.",
    href: "/glossary",
    label: "Open glossary",
  },
  {
    title: "Comparisons",
    body: "How an AI voice employee differs from IVR, a manual dial desk and outsourced calling.",
    href: "/compare",
    label: "Compare approaches",
  },
  {
    title: "Questions",
    body: "Straight answers to the questions buyers ask before a pilot.",
    href: "/questions",
    label: "Read questions",
  },
];

export default function BlogIndexPage() {
  const [featured, ...rest] = articles;

  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Notes on the first conversation."
        body="Practical writing about AI calling: what to automate, what to measure, and what to leave with a person."
        breadcrumb={[{ label: "Blog" }]}
        actions={[
          { label: "Start free", href: "/free-trial", tone: "primary" },
          { label: "Talk to us", href: "/contact", tone: "secondary" },
        ]}
      />

      {featured ? (
        <Section>
          <Container>
            <Link
              href={`/blog/${featured.slug}`}
              className="card card-lift group grid gap-8 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center md:p-10"
            >
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-coral-tint px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-coral-ink">
                  Featured
                </span>
                <h2 className="display mt-4 text-2xl leading-tight text-ink md:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
                  {featured.excerpt}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue">
                  Read the article
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>

              <dl className="grid gap-3 rounded-2xl border border-line bg-ivory-light p-5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                    Category
                  </dt>
                  <dd className="font-medium text-ink">{featured.category}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                    Published
                  </dt>
                  <dd className="font-medium text-ink">
                    {formatDate(featured.publishedAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                    Reading time
                  </dt>
                  <dd className="font-medium text-ink">
                    {featured.readingMinutes} min
                  </dd>
                </div>
              </dl>
            </Link>
          </Container>
        </Section>
      ) : null}

      <Section tone="raised">
        <Container>
          <SectionHeader eyebrow="All articles" title="Everything else." />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="card card-lift group flex flex-col p-6"
              >
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-blue-deep">
                  {article.category}
                </span>
                <h3 className="mt-3 text-base font-semibold leading-snug text-ink md:text-lg">
                  {article.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                  {article.excerpt}
                </p>
                <span className="mt-5 flex items-center justify-between text-xs text-ink-soft">
                  {formatDate(article.publishedAt)}
                  <span>{article.readingMinutes} min read</span>
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Reference" title="The rest of the library." />
          <LinkCards items={resources} className="mt-10" />
        </Container>
      </Section>

      <CtaBand
        title="Reading is not the same as hearing it."
        body="Ask for a live call in your use case before you decide anything."
      />
    </>
  );
}
