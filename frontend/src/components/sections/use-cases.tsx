"use client";

import { useState } from "react";

import { Container } from "@/components/layout/container";
import { useCases } from "@/content/home";
import { cn } from "@/lib/utils";

export function UseCases() {
  const [active, setActive] = useState(useCases.tabs[0].id);
  const current =
    useCases.tabs.find((tab) => tab.id === active) ?? useCases.tabs[0];

  return (
    <section className="section bg-surface/80">
      <Container>
        <p className="eyebrow">{useCases.eyebrow}</p>
        <h2 className="display mt-3 max-w-2xl text-3xl leading-tight md:text-4xl">
          {useCases.title}
        </h2>

        <div
          role="tablist"
          aria-label="Use cases"
          className="mt-8 flex flex-wrap gap-2"
        >
          {useCases.tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={cn(
                // Same glass pill as the rest of the page. Without a fill to
                // switch, the selected tab brightens and takes a cobalt
                // hairline instead.
                "btn-glass cursor-pointer px-4 py-2 text-sm font-medium",
                active === tab.id
                  ? "btn-glass-selected font-semibold text-ink"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-${current.id}`}
          aria-labelledby={`tab-${current.id}`}
          className="mt-6 grid gap-8 rounded-2xl border border-line bg-ivory-light p-6 md:grid-cols-[1.1fr_0.9fr] md:p-10"
        >
          <div>
            <h3 className="text-2xl font-semibold leading-snug text-ink">
              {current.heading}
            </h3>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft md:text-base">
              {current.body}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Industry templates
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {useCases.industries.map((industry) => (
                <li
                  key={industry}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink"
                >
                  {industry}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
