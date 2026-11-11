import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import BlurText from "@/components/reactbits/BlurText";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export type HeroAction = {
  label: string;
  href: string;
  tone?: "primary" | "secondary";
};

type PageHeroProps = {
  /** Unique <h1> for the page — never reuse the homepage headline. */
  title: string;
  eyebrow?: string;
  body?: string;
  /** Sits next to the buttons, used for honest disclaimers. */
  note?: string;
  breadcrumb?: Crumb[];
  actions?: HeroAction[];
  aside?: React.ReactNode;
  className?: string;
};

const defaultActions: HeroAction[] = [
  { label: "Start free", href: "/free-trial", tone: "primary" },
  { label: "Talk to us", href: "/contact", tone: "secondary" },
];

/**
 * Interior-page hero. Every non-homepage template uses this so the
 * heading scale, spacing and CTA treatment stay consistent.
 */
export function PageHero({
  title,
  eyebrow,
  body,
  note,
  breadcrumb,
  actions = defaultActions,
  aside,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-line",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="glow-blue absolute -left-48 -top-56 size-[34rem] rounded-full" />
        <div className="glow-coral absolute -right-32 top-10 size-[26rem] rounded-full" />
      </div>

      <Container className="relative pb-14 pt-10 md:pb-20 md:pt-14">
        {breadcrumb?.length ? (
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
              <li>
                <Link href="/" className="transition-colors hover:text-blue">
                  Home
                </Link>
              </li>
              {breadcrumb.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-blue"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-ink">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div
          className={cn(
            "grid items-center gap-12",
            aside && "lg:grid-cols-[1.05fr_0.95fr]",
          )}
        >
          <div className={cn(!aside && "max-w-3xl")}>
            {eyebrow ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-coral-ink">
                <span className="size-1.5 rounded-full bg-coral-deep" aria-hidden />
                {eyebrow}
              </span>
            ) : null}

            <h1 className="display mt-5 text-[2.35rem] leading-[1.06] sm:text-5xl lg:text-[3.6rem]">
              {title}
            </h1>

            {body ? (
              <div className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
                {aside ? (
                  <BlurText
                    text={body}
                    animateBy="words"
                    direction="top"
                    delay={12}
                    className="leading-relaxed"
                  />
                ) : (
                  <p>{body}</p>
                )}
              </div>
            ) : null}

            {actions.length ? (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {actions.map((action) => (
                  <Link
                    key={action.href + action.label}
                    href={action.href}
                    className={cn(
                      buttonVariants({
                        variant: action.tone === "secondary" ? "outline" : "default",
                        size: "lg",
                      }),
                      "h-12 px-7 text-sm",
                    )}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {note ? <p className="mt-5 text-xs text-ink-soft">{note}</p> : null}
          </div>

          {aside ? <div className="relative">{aside}</div> : null}
        </div>
      </Container>
    </section>
  );
}
