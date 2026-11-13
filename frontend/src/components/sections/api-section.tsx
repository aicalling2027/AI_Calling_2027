import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { FlowButton } from "@/components/ui/flow-button";
import { apiSection } from "@/content/home";

export function ApiSection() {
  return (
    <section className="section bg-surface/80">
      <Container>
        <div className="overflow-hidden rounded-2xl bg-blue-tint px-6 py-10 md:px-12 md:py-14">
          <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <p className="eyebrow">{apiSection.eyebrow}</p>
              <h2 className="display mt-3 text-3xl leading-tight md:text-4xl">
                {apiSection.title}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft md:text-base">
                {apiSection.body}
              </p>
              <FlowButton href="/contact" className="mt-7">
                Request API access
              </FlowButton>
            </div>

            <ul className="space-y-3">
              {apiSection.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-coral-deep" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
