import Link from "next/link";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { ToolGlyph, toolMarks } from "@/components/ui/tool-marks";
import { integrations } from "@/content/home";
import { cn } from "@/lib/utils";

/**
 * The tool strip that sits directly under the hero: where leads come from and
 * where call outcomes land. Wording lives in `content/home`; the marks and
 * their colours in `ui/tool-marks`.
 */
export function Integrations() {
  return (
    <section className="section bg-mist">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{integrations.eyebrow}</p>
          <h2 className="display mt-3 text-3xl leading-tight text-balance md:text-4xl">
            {integrations.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft md:text-base">
            {integrations.body}
          </p>
        </div>

        <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {toolMarks.map((tool) => (
            <li
              key={tool.id}
              className="card card-lift flex flex-col items-center gap-3 px-3 py-5"
            >
              <span className="size-11 shrink-0">
                <ToolGlyph tool={tool} className="rounded-xl" />
              </span>
              <span className="text-xs leading-tight font-semibold text-ink">
                {tool.name}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href={integrations.cta.href}
            className={cn(
              buttonVariants({ variant: "glass", size: "lg" }),
              "h-11 px-6 text-sm",
            )}
          >
            {integrations.cta.label}
          </Link>
          <p className="max-w-md text-center text-xs leading-relaxed text-ink-soft">
            {integrations.note}
          </p>
        </div>
      </Container>
    </section>
  );
}
