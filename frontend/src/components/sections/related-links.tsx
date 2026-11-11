import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section";

type RelatedItem = { label: string; href: string; body: string };

type RelatedLinksProps = {
  eyebrow?: string;
  title: string;
  items: RelatedItem[];
};

/** Cross-links between marketing pages — reduces the need for deep nav menus. */
export function RelatedLinks({
  eyebrow = "Keep going",
  title,
  items,
}: RelatedLinksProps) {
  return (
    <section className="section border-t border-line">
      <Container>
        <SectionHeader eyebrow={eyebrow} title={title} />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card card-lift group flex flex-col p-5"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-blue">
                {item.label}
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="mt-2 text-sm leading-relaxed text-ink-soft">
                {item.body}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
