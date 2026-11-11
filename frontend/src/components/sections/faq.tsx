import { Plus } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section";
import { JsonLd } from "@/components/seo/json-ld";
import { cn } from "@/lib/utils";

export type FaqItem = { question: string; answer: string };

type FaqListProps = {
  items: FaqItem[];
  className?: string;
};

/**
 * Native <details>/<summary> accordion: keyboard accessible and works
 * without JavaScript, so long FAQ pages stay cheap to render.
 */
export function FaqList({ items, className }: FaqListProps) {
  return (
    <div className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((item) => (
        <details key={item.question} className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-base font-medium text-ink md:text-lg">
              {item.question}
            </span>
            <Plus
              aria-hidden
              className="mt-1 size-4 shrink-0 text-blue transition-transform duration-200 group-open:rotate-45"
            />
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft md:text-base">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

type FaqSectionProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  items: FaqItem[];
  /** Renders the questions as FAQPage structured data. */
  withSchema?: boolean;
};

export function FaqSection({
  eyebrow = "Questions",
  title,
  body,
  items,
  withSchema = true,
}: FaqSectionProps) {
  const schema = withSchema
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  return (
    <section className="section">
      <Container>
        <SectionHeader eyebrow={eyebrow} title={title} body={body} />
        <FaqList items={items} className="mt-10" />
      </Container>
      {schema ? <JsonLd data={schema} /> : null}
    </section>
  );
}
