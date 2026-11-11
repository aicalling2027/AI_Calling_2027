"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import {
  activeDashboardHref,
  dashboardGroups,
} from "@/content/dashboard";
import { cn } from "@/lib/utils";

/**
 * The dashboard's left navigation.
 *
 * Two independent states: `collapsed` is the desktop icon rail, `mobileOpen` is
 * the off-canvas drawer. Collapsing swaps the brand block for a labelled
 * "Open" control, which is the only way back out of the rail.
 */
export function DashboardSidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const activeHref = activeDashboardHref(pathname);

  return (
    <aside
      id="dashboard-sidebar"
      aria-label="Dashboard"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface",
        // Tailwind v4 writes translate-x-* to the `translate` property, not
        // `transform`, so that is what has to be in the transition list.
        "transition-[width,translate,box-shadow] duration-300 ease-out motion-reduce:transition-none",
        "lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
        collapsed ? "lg:w-[4.75rem]" : "lg:w-72",
        mobileOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full",
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-3">
        <Link
          href="/dashboard"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-mist-soft",
            collapsed && "lg:hidden",
          )}
        >
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-cobalt text-sm font-bold text-white"
          >
            A
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight font-semibold text-ink">
              AOTMS
            </span>
            <span className="block truncate text-[0.7rem] leading-tight font-medium text-ink-soft">
              Dashboard
            </span>
          </span>
        </Link>

        {/* Collapsed rail: the only visible way to reopen the sidebar. */}
        <button
          type="button"
          onClick={onToggle}
          title="Open sidebar"
          aria-label="Open sidebar"
          aria-expanded={!collapsed}
          aria-controls="dashboard-sidebar"
          className={cn(
            "hidden w-full flex-col items-center gap-1 rounded-xl py-2 text-[0.65rem] font-semibold tracking-wide text-ink-soft uppercase transition-colors hover:bg-mist hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
            collapsed && "lg:flex",
          )}
        >
          <PanelLeftOpen className="size-5" />
          Open
        </button>

        <button
          type="button"
          onClick={onToggle}
          title="Minimize sidebar"
          aria-label="Minimize sidebar"
          aria-expanded={!collapsed}
          aria-controls="dashboard-sidebar"
          className={cn(
            "ml-auto hidden size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none lg:grid",
            collapsed && "lg:hidden",
          )}
        >
          <PanelLeftClose className="size-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none lg:hidden",
            !collapsed && "ml-auto",
          )}
        >
          <X className="size-4" />
        </button>
      </div>

      <nav aria-label="Modules" className="flex-1 overflow-y-auto px-3 py-4">
        {dashboardGroups.map((group) => (
          <div key={group.heading} className="mb-5 last:mb-0">
            <p
              className={cn(
                "px-3 pb-2 text-[0.65rem] font-semibold tracking-[0.14em] text-ink-soft uppercase",
                collapsed && "lg:sr-only",
              )}
            >
              {group.heading}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-cobalt-tint text-cobalt-deep"
                          : "text-ink-soft hover:bg-mist hover:text-ink",
                        collapsed && "lg:justify-center lg:px-0",
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active
                            ? "text-cobalt"
                            : "text-ink-soft group-hover:text-cobalt",
                        )}
                      />
                      <span className={cn("truncate", collapsed && "lg:sr-only")}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/"
          title={collapsed ? "Back to site" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-mist hover:text-ink",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <ArrowLeft aria-hidden className="size-4 shrink-0" />
          <span className={cn("truncate", collapsed && "lg:sr-only")}>
            Back to site
          </span>
        </Link>
      </div>
    </aside>
  );
}
