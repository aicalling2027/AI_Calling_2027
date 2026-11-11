"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { WorkspaceProvider } from "@/components/dashboard/workspace-store";
import type { DashboardProfile } from "@/content/dashboard";
import { cn } from "@/lib/utils";

/**
 * Holds the two layout states the chrome needs (desktop rail width, mobile
 * drawer) so the sidebar and the top bar can each drive the other.
 */
export function DashboardShell({
  profile,
  children,
}: {
  profile: DashboardProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  // The drawer remembers which route it was opened on, so navigating closes it
  // without a state-syncing effect. The rail width is left alone.
  const [drawerPath, setDrawerPath] = React.useState<string | null>(null);
  const mobileOpen = drawerPath === pathname;

  const openDrawer = React.useCallback(
    () => setDrawerPath(pathname),
    [pathname],
  );
  const closeDrawer = React.useCallback(() => setDrawerPath(null), []);

  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerPath(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh bg-mist-soft">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-xl focus:bg-cobalt focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <DashboardSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={closeDrawer}
        onToggle={() => setCollapsed((value) => !value)}
      />

      {/* Drawer scrim — only reachable while the drawer is open. */}
      <button
        type="button"
        onClick={closeDrawer}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-300 motion-reduce:transition-none lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar profile={profile} onOpenMenu={openDrawer} />
        <main id="dashboard-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Module screens share one client store, so creating an employee or a
              lead is visible everywhere without a round trip. */}
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </main>
      </div>
    </div>
  );
}
