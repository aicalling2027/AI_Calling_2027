import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { IconBadge, type IconName } from "@/components/layout/icon";
import { cn } from "@/lib/utils";

export type CardItem = {
  title: string;
  body: string;
  icon?: IconName;
};

type CardGridProps = {
  items: CardItem[];
  columns?: 2 | 3 | 4;
  className?: string;
  /** Show the icon badge above each card title. */
  withIcons?: boolean;
};

const columnClass: Record<NonNullable<CardGridProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** The card grid repeated across product, solution and template pages. */
export function CardGrid({
  items,
  columns = 3,
  className,
  withIcons = true,
}: CardGridProps) {
  return (
    <div className={cn("grid gap-5", columnClass[columns], className)}>
      {items.map((item, index) => (
        <article key={item.title} className="card card-lift p-6">
          {withIcons && item.icon ? (
            /* One icon per group carries the coral accent. */
            <IconBadge name={item.icon} tone={index === 0 ? "coral" : "blue"} />
          ) : null}
          <h3 className="mt-4 text-base font-semibold text-ink md:text-lg">
            {item.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {item.body}
          </p>
        </article>
      ))}
    </div>
  );
}

export type StepItem = { title: string; body: string };

type NumberedStepsProps = {
  steps: StepItem[];
  className?: string;
};

export function NumberedSteps({ steps, className }: NumberedStepsProps) {
  return (
    <ol className={cn("grid gap-5 md:grid-cols-3", className)}>
      {steps.map((step, index) => (
        <li key={step.title} className="card card-lift p-6">
          <span
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold",
              index === 0 ? "bg-coral text-ink" : "bg-blue-tint text-blue",
            )}
          >
            {index + 1}
          </span>
          <h3 className="mt-4 text-base font-semibold text-ink md:text-lg">
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

export type LinkCardItem = {
  title: string;
  body: string;
  href: string;
  label?: string;
  icon?: IconName;
};

/** Cards that navigate — used by index pages (blog, glossary, comparisons). */
export function LinkCards({ items, className }: { items: LinkCardItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, index) => (
        <Link
          key={item.href}
          href={item.href}
          className="card card-lift group flex flex-col p-6"
        >
          {item.icon ? (
            <IconBadge name={item.icon} tone={index === 0 ? "coral" : "blue"} />
          ) : null}
          <h3 className="mt-4 text-base font-semibold text-ink md:text-lg">
            {item.title}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
            {item.body}
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue">
            {item.label ?? "Read more"}
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Compact chip row for tags, languages or industries. */
export function ChipRow({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-line bg-ivory-light px-3 py-1.5 text-xs font-medium text-ink-soft"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
