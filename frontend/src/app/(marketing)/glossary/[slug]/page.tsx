import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { Prose } from "@/components/sections/prose";
import { JsonLd } from "@/components/seo/json-ld";
import { getGlossaryTerm, glossaryTerms } from "@/content/articles";
import { site } from "@/lib/site";

type RouteParams = { slug: string };

// [block] params are read to render the term, so this route cannot stream an instant shell.
export const instant = false;

export function generateStaticParams(): RouteParams[] {
  return glossaryTerms.map((term) => ({ slug: term.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = getGlossaryTerm(slug);

  if (!term) {
    return {};
  }

  return {
    title: `${term.term} — glossary`,
    description: term.short,
    alternates: { canonical: `/glossary/${term.slug}` },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const term = getGlossaryTerm(slug);

  if (!term) {
    notFound();
  }

  const others = glossaryTerms.filter((item) => item.slug !== term.slug).slice(0, 4);

  return (
    <>
      <PageHero
        eyebrow="Glossary"
        title={term.term}
        body={term.short}
        breadcrumb={[
          { label: "Glossary", href: "/glossary" },
          { label: term.term },
        ]}
        actions={[
          { label: "Talk to us", href: "/contact", tone: "primary" },
          { label: "Back to glossary", href: "/glossary", tone: "secondary" },
        ]}
      />

      <section className="section">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <article className="max-w-2xl">
              <Prose blocks={term.body} />
            </article>

            <aside className="lg:sticky lg:top-28">
              <div className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  More terms
                </p>
                <ul className="mt-4 space-y-3">
                  {others.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/glossary/${item.slug}`}
                        className="group flex items-start justify-between gap-2 text-sm font-medium text-ink transition-colors hover:text-blue"
                      >
                        <span>{item.term}</span>
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
        title="See the definition in practice."
        body="Ask for a live call in the use case you are evaluating."
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: term.term,
          description: term.short,
          inDefinedTermSet: {
            "@type": "DefinedTermSet",
            name: `${site.shortName} glossary`,
            url: `${site.url}/glossary`,
          },
        }}
      />
    </>
  );
}
