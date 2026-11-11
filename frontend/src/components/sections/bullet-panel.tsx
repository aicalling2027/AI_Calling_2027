import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type BulletPanelProps = {
  title: string;
  items: string[];
  /** Small label rendered in the panel header. */
  badge?: string;
  footer?: string;
  className?: string;
};

/**
 * The bordered aside used inside page heroes. Shows promised outcomes as a
 * plain checklist — no invented numbers or customer logos.
 */
export function BulletPanel({
  title,
  items,
  badge,
  footer,
  className,
}: BulletPanelProps) {
  return (
    <div className={cn("card p-5 md:p-6", className)}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {badge ? (
          <span className="rounded-full bg-coral-tint px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-coral-ink">
            {badge}
          </span>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 rounded-xl border border-line bg-ivory-light px-3 py-2.5"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-coral-deep" aria-hidden />
            <span className="text-sm leading-relaxed text-ink">{item}</span>
          </li>
        ))}
      </ul>

      {footer ? (
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">{footer}</p>
      ) : null}
    </div>
  );
}
