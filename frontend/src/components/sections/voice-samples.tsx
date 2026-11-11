import { Play } from "lucide-react";

import { Container } from "@/components/layout/container";
import { voices } from "@/content/home";
import { cn } from "@/lib/utils";

export function VoiceSamples() {
  return (
    <section className="section bg-ivory">
      <Container>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">{voices.eyebrow}</p>
            <h2 className="display mt-3 max-w-xl text-3xl leading-tight md:text-4xl">
              {voices.title}
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            {voices.body}
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {voices.samples.map((sample, index) => (
            <li
              key={sample.language}
              className="card card-lift flex items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-ink">
                  {sample.language}
                </p>
                <p className="mt-1 text-xs text-ink-soft">{sample.label}</p>
              </div>
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
                  index === 0
                    ? "bg-coral-tint text-coral-ink"
                    : "bg-blue-tint text-blue",
                )}
              >
                <Play className="size-4 translate-x-[1px]" />
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
