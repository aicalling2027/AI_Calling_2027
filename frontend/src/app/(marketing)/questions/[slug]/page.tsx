import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { Prose } from "@/components/sections/prose";
import { JsonLd } from "@/components/seo/json-ld";
import { getQuestion, questions } from "@/content/questions";

type RouteParams = { slug: string };

export function generateStaticParams(): RouteParams[] {
  return questions.map((question) => ({ slug: question.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getQuestion(slug);

  if (!entry) {
    return {};
  }

  return {
    title: entry.question,
    description: entry.short,
    alternates: { canonical: `/questions/${entry.slug}` },
  };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const entry = getQuestion(slug);

  if (!entry) {
    notFound();
  }

  const related = questions
    .filter((item) => item.slug !== entry.slug && item.topic === entry.topic)
    .slice(0, 4);

  return (
    <>
      <PageHero
        eyebrow={entry.topic}
        title={entry.question}
        body={entry.short}
        breadcrumb={[
          { label: "Questions", href: "/questions" },
          { label: entry.question },
        ]}
        actions={[
          { label: "Talk to us", href: "/contact", tone: "primary" },
          { label: "All questions", href: "/questions", tone: "secondary" },
        ]}
      />

      <section className="section">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <article className="max-w-2xl">
              <Prose blocks={entry.answer} />
            </article>

            <aside className="lg:sticky lg:top-28">
              <div className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  More on {entry.topic.toLowerCase()}
                </p>
                <ul className="mt-4 space-y-3">
                  {(related.length ? related : questions.slice(0, 4)).map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/questions/${item.slug}`}
                        className="group flex items-start justify-between gap-2 text-sm font-medium text-ink transition-colors hover:text-blue"
                      >
                        <span>{item.question}</span>
                        <ArrowRight
                          aria-hidden
                          className="mt-0.5 size-3.5 shrink-0 text-blue transition-transform group-hover:translate-x-0.5"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Still deciding?"
        body="A short call usually resolves the remaining questions faster than a page of answers."
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "QAPage",
          mainEntity: {
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: entry.short,
            },
          },
        }}
      />
    </>
  );
}
