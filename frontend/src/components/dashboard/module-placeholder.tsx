import type { LucideIcon } from "lucide-react";

/**
 * Shared frame for every dashboard module. The module list, routing and the
 * sidebar are real; each screen's content is still to be written, so this
 * states that plainly instead of inventing widgets.
 */
export function ModulePlaceholder({
  group,
  title,
  description,
  icon: Icon,
}: {
  group: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-cobalt-tint text-cobalt"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            {group}
          </p>
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{description}</p>
        </div>
      </header>

      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
        <p className="text-sm font-semibold text-ink">Screen not built yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
          This module is wired into the sidebar, the URL and the page title. Its
          content is the next step.
        </p>
      </div>
    </div>
  );
}
