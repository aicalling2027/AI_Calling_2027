import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/sections/page-hero";
import { Prose } from "@/components/sections/prose";
import { getLegalDocument, legalDocuments } from "@/content/legal";
import { formatDate } from "@/lib/date";

type RouteParams = { slug: string };

// [block] params are read to render the document, so this route cannot stream an instant shell.
export const instant = false;

export function generateStaticParams(): RouteParams[] {
  return legalDocuments.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = getLegalDocument(slug);

  if (!document) {
    return {};
  }

  return {
    title: document.title,
    description: document.summary,
    alternates: { canonical: `/legal/${document.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const document = getLegalDocument(slug);

  if (!document) {
    notFound();
  }

  const others = legalDocuments.filter((item) => item.slug !== document.slug);

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={document.title}
        body={document.summary}
        note={`Last edited ${formatDate(document.updatedAt)} · draft`}
        breadcrumb={[{ label: "Legal" }, { label: document.title }]}
        actions={[]}
      />

      <section className="section">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
            <article className="max-w-2xl">
              <Prose blocks={document.body} />
            </article>

            <aside className="lg:sticky lg:top-28">
              <div className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Other documents
                </p>
                <ul className="mt-4 space-y-2.5">
                  {others.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/legal/${item.slug}`}
                        className="text-sm font-medium text-ink transition-colors hover:text-blue"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-soft">
                  Questions about these documents can be sent to the address on the
                  contact page.
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
