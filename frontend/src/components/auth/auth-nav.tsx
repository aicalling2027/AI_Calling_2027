"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, LogOut, UserRound } from "lucide-react";

import { UserAvatar } from "@/components/auth/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { FlowButton } from "@/components/ui/flow-button";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/use-auth-user";
import { userDisplayName } from "@/lib/user";
import { cn } from "@/lib/utils";

function useSignOut() {
  const router = useRouter();

  return async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.refresh();
    router.push("/");
  };
}

/** Desktop header control: "Sign in" when anonymous, profile menu when signed in. */
export function AuthNav() {
  const auth = useAuthUser();
  const signOut = useSignOut();
  const pathname = usePathname();
  // Stamping the pathname closes the menu on navigation without an effect.
  const [menu, setMenu] = useState({ pathname, open: false });
  const open = menu.pathname === pathname && menu.open;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu((current) => ({ ...current, open: false }));
      }
    }
    function onClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenu((current) => ({ ...current, open: false }));
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  if (auth.status === "loading") {
    return (
      <span
        aria-hidden
        className="size-10 animate-pulse rounded-full border border-line bg-blue-tint"
      />
    );
  }

  if (auth.status === "signed-out") {
    return (
      <FlowButton
        href="/login"
        aria-label="Sign in"
        size="sm"
        tone="quiet"
        arrow={false}
        className="size-10 px-0 xl:w-auto xl:px-8"
      >
        <span className="flex items-center gap-2">
          <UserRound className="size-4" />
          {/* Below xl the header collapses to icons, so the label comes back
              only when the full navigation is visible. */}
          <span className="hidden xl:inline">Sign in</span>
        </span>
      </FlowButton>
    );
  }

  const user = auth.user;

  return (
    <div ref={containerRef} className="relative">
      <FlowButton
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account menu for ${userDisplayName(user)}`}
        onClick={() =>
          setMenu((current) => ({
            pathname,
            open: !(current.pathname === pathname && current.open),
          }))
        }
        // The avatar is the icon, so the arrows stay out and the pill only
        // changes geometry and colour on hover.
        size="sm"
        arrow={false}
        className="pl-1 pr-2.5"
      >
        {/* FlowButton wraps its children in an inline label, so the row has to
            be built here: with no flex parent the chevron baseline-aligns
            against the square avatar and hangs low. */}
        <span className="flex items-center gap-1.5">
          <UserAvatar user={user} />
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-ink-soft transition-transform group-hover:text-white",
              open && "rotate-180",
            )}
          />
        </span>
      </FlowButton>

      {open ? (
        <div
          id="account-menu"
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-card"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">
              {userDisplayName(user)}
            </p>
            <p className="truncate text-xs text-ink-soft">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            href="/dashboard"
            role="menuitem"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-blue-tint/60"
          >
            <LayoutGrid className="size-4 text-ink-soft" />
            Dashboard
          </Link>
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-blue-tint/60"
          >
            <UserRound className="size-4 text-ink-soft" />
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-coral-tint"
          >
            <LogOut className="size-4 text-ink-soft" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Mobile drawer equivalent: a profile card instead of a popover. */
export function AuthNavMobile() {
  const auth = useAuthUser();
  const signOut = useSignOut();

  if (auth.status === "loading") {
    return (
      <span
        aria-hidden
        className="h-11 animate-pulse rounded-full bg-blue-tint"
      />
    );
  }

  if (auth.status === "signed-out") {
    return (
      <FlowButton
        href="/login"
        size="sm"
        tone="quiet"
        arrow={false}
        className="h-11 w-full text-sm"
      >
        <span className="flex items-center gap-2">
          <UserRound className="size-4" />
          Sign in
        </span>
      </FlowButton>
    );
  }

  const user = auth.user;

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} className="size-9 text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {userDisplayName(user)}
          </p>
          <p className="truncate text-xs text-ink-soft">{user.email}</p>
        </div>
      </div>
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "glass", size: "lg" }),
          "mt-3 h-10 w-full gap-2 text-sm font-semibold",
        )}
      >
        <LayoutGrid className="size-4" />
        Dashboard
      </Link>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          href="/account"
          className={cn(
            buttonVariants({ variant: "glass", size: "lg" }),
            "h-10 text-sm",
          )}
        >
          Account
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            buttonVariants({ variant: "glass", size: "lg" }),
            "h-10 text-sm text-ink-soft",
          )}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
