import { ListChecks, Phone, RotateCw, ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { featureGrid } from "@/content/home";
import { cn } from "@/lib/utils";

const icons = [Phone, RotateCw, ShieldCheck, ListChecks];

export function FeatureGrid() {
  return (
    <section className="section bg-ivory">
      <Container>
        <p className="eyebrow">{featureGrid.eyebrow}</p>
        <h2 className="display mt-3 max-w-2xl text-3xl leading-tight md:text-4xl">
          {featureGrid.title}
        </h2>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {featureGrid.features.map((feature, index) => {
            const Icon = icons[index % icons.length];
            return (
              <li key={feature.title} className="card card-lift p-6">
                <span
                  className={cn(
                    "icon-tile",
                    index === 0 ? "icon-tile-accent" : "icon-tile-blue",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {feature.body}
                </p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
