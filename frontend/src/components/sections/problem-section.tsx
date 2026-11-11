import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section";
import { IconBadge } from "@/components/layout/icon";
import type { CardItem } from "@/components/sections/cards";
import { cn } from "@/lib/utils";

type ProblemSectionProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  items: CardItem[];
};

/**
 * "Problem" band used on product and solution pages: the heading sits on the
 * left and the pain points stack on the right, matching the reference layout.
 */
export function ProblemSection({
  eyebrow = "The problem",
  title,
  body,
  items,
}: ProblemSectionProps) {
  return (
    <section className="section">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader eyebrow={eyebrow} title={title} body={body} />

          <ul className="space-y-3">
            {items.map((item, index) => (
              <li
                key={item.title}
                className="card card-lift flex gap-4 p-5"
              >
                {item.icon ? (
                  <IconBadge
                    name={item.icon}
                    tone={index === 0 ? "coral" : "blue"}
                    className="shrink-0"
                  />
                ) : (
                  <span
                    className={cn(
                      "icon-tile shrink-0 text-sm font-semibold",
                      index === 0 ? "icon-tile-accent" : "icon-tile-blue",
                    )}
                  >
                    {index + 1}
                  </span>
                )}
                <div>
                  <h3 className="text-base font-semibold text-ink md:text-lg">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
