import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { questions, topics } from "@/content/questions";

export const metadata: Metadata = {
  title: "Questions",
  description:
    "Straight answers about AI voice calling: languages, pricing, numbers, consent, integrations and pilots.",
  alternates: { canonical: "/questions" },
};

export default function QuestionsIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="Questions"
        title="The questions buyers actually ask."
        body="No marketing answers. Where something is not confirmed, the answer says so instead of inventing a figure."
        breadcrumb={[{ label: "Questions" }]}
        actions={[
          { label: "Talk to us", href: "/contact", tone: "primary" },
          { label: "Read the blog", href: "/blog", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <nav aria-label="Topics" className="mb-12">
            <ul className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <li key={topic}>
                  <a
                    href={`#${topic.toLowerCase().replace(/\s+/g, "-")}`}
                    className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-blue-line hover:text-blue"
                  >
                    {topic}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-14">
            {topics.map((topic) => {
              const items = questions.filter((question) => question.topic === topic);

              if (!items.length) {
                return null;
              }

              return (
                <div
                  key={topic}
                  id={topic.toLowerCase().replace(/\s+/g, "-")}
                  className="scroll-mt-28"
                >
                  <SectionHeader eyebrow={`${items.length} questions`} title={topic} />

                  <ul className="mt-6 divide-y divide-line border-y border-line">
                    {items.map((question) => (
                      <li key={question.slug}>
                        <Link
                          href={`/questions/${question.slug}`}
                          className="group flex items-start justify-between gap-6 py-5"
                        >
                          <span>
                            <span className="block text-base font-medium text-ink transition-colors group-hover:text-blue md:text-lg">
                              {question.question}
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                              {question.short}
                            </span>
                          </span>
                          <ArrowRight
                            aria-hidden
                            className="mt-1 size-4 shrink-0 text-blue transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Container>
      </Section>

      <CtaBand
        title="Question not here?"
        body="Ask it directly — if the answer is not confirmed, we will say so."
      />
    </>
  );
}
