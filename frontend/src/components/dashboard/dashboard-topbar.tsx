"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { dashboardNotifications, type DashboardProfile } from "@/content/dashboard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCOUNT_LINKS = [
  { label: "Your account", href: "/account", icon: UserRound },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

/**
 * Dashboard top bar: the module search, the notification tray and the account
 * menu. `onOpenMenu` is the only hook the shell needs — everything else here is
 * self-contained.
 */
export function DashboardTopbar({
  profile,
  onOpenMenu,
}: {
  profile: DashboardProfile;
  onOpenMenu: () => void;
}) {
  const router = useRouter();
  const searchRef = React.useRef<HTMLInputElement>(null);
  const unread = dashboardNotifications.filter((item) => item.unread).length;

  // ⌘K / Ctrl-K jumps to search from anywhere on the page.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function signOut() {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        aria-controls="dashboard-sidebar"
        className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-mist hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none lg:hidden"
      >
        <Menu className="size-4" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
        />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search employees, leads, calls…"
          aria-label="Search the dashboard"
          className="h-10 w-full rounded-xl border border-line bg-mist-soft pr-14 pl-9 text-sm text-ink transition-colors placeholder:text-ink-soft/80 focus:border-blue-line focus:bg-white focus:ring-3 focus:ring-ring/25 focus:outline-none"
        />
        <Kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 sm:inline-flex"
          size="xs"
        >
          ⌘K
        </Kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={
                unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
              }
              className="relative grid size-10 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-mist hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <Bell className="size-[1.05rem]" />
              {unread > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-2 right-2 size-2 rounded-full bg-tangerine ring-2 ring-surface"
                />
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[min(22rem,calc(100vw-2rem))]"
          >
            <DropdownMenuLabel icon={Bell}>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {dashboardNotifications.map((item) => {
              const Icon = item.icon;

              return (
                <DropdownMenuItem key={item.id} icon={Icon}>
                  <span className="block">
                    <span
                      className={cn(
                        "block text-sm",
                        item.unread ? "font-semibold text-ink" : "text-ink",
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-soft">
                      {item.detail}
                    </span>
                    <span className="mt-0.5 block text-[0.7rem] text-ink-soft">
                      {item.time}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="flex items-center gap-2 rounded-xl border border-line p-1 pr-2 transition-colors hover:bg-mist focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="size-8 rounded-full border border-line object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-full bg-cobalt text-[0.7rem] font-semibold tracking-wide text-white uppercase"
                >
                  {profile.initials}
                </span>
              )}
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink xl:block">
                {profile.name}
              </span>
              <ChevronDown className="size-4 shrink-0 text-ink-soft" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <span className="block min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {profile.name}
                </span>
                <span className="block truncate text-xs font-normal text-ink-soft">
                  {profile.email}
                </span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACCOUNT_LINKS.map((link) => {
              const Icon = link.icon;

              return (
                <DropdownMenuItem
                  key={link.href}
                  icon={Icon}
                  onSelect={() => router.push(link.href)}
                >
                  {link.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={LogOut}
              variant="destructive"
              onSelect={() => void signOut()}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
