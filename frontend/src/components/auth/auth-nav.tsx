"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/use-auth-user";
import { userDisplayName, userInitials } from "@/lib/user";
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
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-10 gap-2 px-4 text-sm",
        )}
      >
        <UserRound className="size-4" />
        Sign in
      </Link>
    );
  }

  const user = auth.user;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label="Account menu"
        onClick={() =>
          setMenu((current) => ({
            pathname,
            open: !(current.pathname === pathname && current.open),
          }))
        }
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors hover:bg-blue-tint"
      >
        <span className="grid size-8 place-items-center rounded-full bg-blue text-[0.7rem] font-semibold uppercase tracking-wide text-white">
          {userInitials(user)}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-ink-soft transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

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
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-11 w-full gap-2 text-sm",
        )}
      >
        <UserRound className="size-4" />
        Sign in
      </Link>
    );
  }

  const user = auth.user;

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue text-xs font-semibold uppercase tracking-wide text-white">
          {userInitials(user)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {userDisplayName(user)}
          </p>
          <p className="truncate text-xs text-ink-soft">{user.email}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/account"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-10 text-sm",
          )}
        >
          Account
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "h-10 text-sm",
          )}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
