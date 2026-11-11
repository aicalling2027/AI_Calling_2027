"use client";

/**
 * Selection card with a radial "flood" on hover/selection, adapted from the
 * ColourFill pattern to this theme: the flood is a light tangerine tint, so
 * the card stays inside the quiet palette instead of turning into a dark tile.
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
  const ref = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [origin, setOrigin] = React.useState({ x: 50, y: 100 });

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setOrigin({
      x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
    });
  };

  const filled = hovered || selected;

  return (
    <div
      ref={ref}
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
      onPointerEnter={(event) => {
        track(event);
        setHovered(true);
      }}
      onPointerMove={track}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "relative isolate cursor-pointer overflow-hidden rounded-xl border bg-surface p-4 text-left outline-none transition-[border-color,box-shadow,transform] duration-300",
        "focus-visible:ring-3 focus-visible:ring-cobalt/25",
        selected
          ? "border-cobalt/60 shadow-[0_8px_24px_-16px_rgba(24,90,219,0.6)]"
          : "border-line hover:border-cobalt/35",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-tangerine-tint/60 transition-[clip-path] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
        style={{
          clipPath: filled
            ? `circle(150% at ${origin.x}% ${origin.y}%)`
            : `circle(0% at ${origin.x}% ${origin.y}%)`,
        }}
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
