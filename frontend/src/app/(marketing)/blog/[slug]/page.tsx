import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Prose } from "@/components/sections/prose";
import { CtaBand } from "@/components/sections/cta-band";
import { PageHero } from "@/components/sections/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { articles, getArticle } from "@/content/articles";
import { formatDate } from "@/lib/date";
import { site } from "@/lib/site";

type RouteParams = { slug: string };

// [block] params are read to render the article, so this route cannot stream an instant shell.
export const instant = false;

export function generateStaticParams(): RouteParams[] {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return {};
  }

  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishedAt,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const related = articles
    .filter((item) => item.slug !== article.slug)
    .slice(0, 2);

  return (
    <>
      <PageHero
        eyebrow={article.category}
        title={article.title}
        body={article.excerpt}
        note={`${formatDate(article.publishedAt)} · ${article.readingMinutes} min read`}
        breadcrumb={[{ label: "Blog", href: "/blog" }, { label: article.title }]}
        actions={[]}
      />

      <section className="section">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <article className="max-w-2xl">
              <Prose blocks={article.body} />
            </article>

            <aside className="lg:sticky lg:top-28">
              <div className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  In this article
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-soft">Category</dt>
                    <dd className="font-medium text-ink">{article.category}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-soft">Published</dt>
                    <dd className="font-medium text-ink">
                      {formatDate(article.publishedAt)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-soft">Reading time</dt>
                    <dd className="font-medium text-ink">
                      {article.readingMinutes} min
                    </dd>
                  </div>
                </dl>

                <Link
                  href="/contact"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-deep"
                >
                  Talk to us
                </Link>
              </div>

              {related.length ? (
                <div className="mt-5 rounded-2xl border border-line bg-ivory-light p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    Keep reading
                  </p>
                  <ul className="mt-4 space-y-3">
                    {related.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/blog/${item.slug}`}
                          className="group flex items-start gap-1.5 text-sm font-medium text-ink transition-colors hover:text-blue"
                        >
                          <span>{item.title}</span>
                          <ArrowRight
                            aria-hidden
                            className="mt-0.5 size-3.5 shrink-0 text-blue transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Put the idea into one call."
        body="The fastest way to test any of this is a single use case measured on real transcripts."
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description: article.excerpt,
          datePublished: article.publishedAt,
          author: { "@type": "Organization", name: site.legalName },
          publisher: { "@type": "Organization", name: site.legalName },
          mainEntityOfPage: `${site.url}/blog/${article.slug}`,
        }}
      />
    </>
  );
}
