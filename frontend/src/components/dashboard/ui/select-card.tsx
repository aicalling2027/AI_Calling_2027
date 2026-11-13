"use client";

/**
 * Selection card.
 *
 * Only selection changes the colour. Hover used to flood the card with a
 * tangerine tint, which made a pointer crossing the grid look like a choice
 * that had already been made - on a step with a long list of voices that reads
 * as a state, not as a hint. The cursor and the focus ring are the only hover
 * affordances now.
 */

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export function SelectCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  icon,
  children,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  meta?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative isolate cursor-pointer overflow-hidden rounded-xl border bg-surface p-4 text-left outline-none transition-[border-color,box-shadow,transform] duration-300",
        "focus-visible:ring-3 focus-visible:ring-cobalt/25",
        selected
          ? "border-cobalt/60 shadow-[0_8px_24px_-16px_rgba(24,90,219,0.6)]"
          : "border-line",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-0 bg-tangerine-tint/60 transition-opacity duration-300",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="relative z-10 block">
        <span className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2">
            {icon ? (
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-cobalt ring-1 ring-line">
                {icon}
              </span>
            ) : null}
            <span className="text-sm font-semibold text-ink">{title}</span>
          </span>
          <span
            aria-hidden
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
              selected
                ? "border-cobalt bg-cobalt text-white"
                : "border-line bg-surface text-transparent",
            )}
          >
            <Check className="size-3" />
          </span>
        </span>
        {description ? (
          <span className="mt-2 block text-xs leading-relaxed text-ink-soft">
            {description}
          </span>
        ) : null}
        {meta ? (
          <span className="mt-2 inline-flex rounded bg-surface/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft ring-1 ring-line">
            {meta}
          </span>
        ) : null}
        {children}
      </span>
    </div>
  );
}
