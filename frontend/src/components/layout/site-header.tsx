"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Megaphone,
  Menu,
  Newspaper,
  PhoneIncoming,
  Scale,
  X,
  Zap,
} from "lucide-react";

import { AuthNav, AuthNavMobile } from "@/components/auth/auth-nav";
import { Container } from "@/components/layout/container";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { cta, primaryNav, site, type NavItem, type NavLink } from "@/lib/site";

/**
 * Icons are presentation, so they stay out of the nav data. Anything without an
 * entry here simply renders without a tile.
 */
const linkIcons: Record<string, LucideIcon> = {
  "/product/inbound": PhoneIncoming,
  "/product/campaigns": Megaphone,
  "/product/instant-leads": Zap,
  "/blog": Newspaper,
  "/glossary": BookOpen,
  "/compare": Scale,
  "/questions": CircleHelp,
};

/**
 * One promo card per panel keeps the menu from reading as a plain link list and
 * gives the current campaign a permanent home in the header. `tone` picks the
 * block colour: "grey" reads as a solid tile on the panel, "light" sits just
 * above it and needs its hairline to keep an edge.
 */
const panelPromos: Record<
  string,
  {
    eyebrow: string;
    title: string;
    body: string;
    href: string;
    cta: string;
    tone: "grey" | "light";
  }
> = {
  Product: {
    eyebrow: "Free trial",
    title: "Hear your own script",
    body: "Upload a list, pick a voice and listen to the first call before you commit.",
    href: "/free-trial",
    cta: "Start free",
    tone: "grey",
  },
  Resources: {
    eyebrow: "Talk to a human",
    title: "Map your first campaign",
    body: "Twenty minutes with our team to size the list, the script and the numbers.",
    href: "/contact",
    cta: "Book a call",
    tone: "light",
  },
};

const promoTones = {
  grey: "bg-mist-deep",
  light: "border border-line bg-mist-soft",
} as const;

function linkIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemIsActive(pathname: string, item: NavItem) {
  if (item.href && linkIsActive(pathname, item.href)) return true;
  return (item.children ?? []).some((child) => linkIsActive(pathname, child.href));
}

/** One row inside a desktop panel: icon tile, label and a one-line description. */
function PanelLink({ link, pathname }: { link: NavLink; pathname: string }) {
  const Icon = linkIcons[link.href];
  const active = linkIsActive(pathname, link.href);

  return (
    <NavigationMenuLink asChild>
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-start gap-3 rounded-xl p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
          // The selected page gets a white chip. On the grey panel that is the
          // only highlight strong enough to read without a hover state.
          active && "bg-white shadow-[0_1px_3px_rgba(13,42,107,0.12)]",
        )}
      >
        {Icon ? (
          <span
            aria-hidden
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl border",
              active
                ? "border-cobalt bg-cobalt text-white"
                : "border-line bg-white text-cobalt",
            )}
          >
            <Icon className="size-5.5" />
          </span>
        ) : null}
        <span className="min-w-0">
          <span
            className={cn(
              "block text-sm font-semibold",
              active ? "text-cobalt-deep" : "text-ink",
            )}
          >
            {link.label}
          </span>
          {link.description ? (
            <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
              {link.description}
            </span>
          ) : null}
        </span>
      </Link>
    </NavigationMenuLink>
  );
}

/** The promo tile that sits beside the link list — a quiet grey block, not a dark card. */
function PanelPromo({
  promo,
}: {
  promo: (typeof panelPromos)[string] | undefined;
}) {
  if (!promo) return null;

  return (
    <Link
      href={promo.href}
      className={cn(
        "flex flex-col justify-between rounded-xl p-4",
        promoTones[promo.tone],
      )}
    >
      <span className="block">
        <span className="block text-[0.65rem] font-semibold tracking-[0.18em] text-tangerine-ink uppercase">
          {promo.eyebrow}
        </span>
        <span className="mt-2 block text-sm leading-snug font-semibold text-ink">
          {promo.title}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
          {promo.body}
        </span>
      </span>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cobalt">
        {promo.cta}
        <ArrowRight
          aria-hidden
          className="size-3.5"
        />
      </span>
    </Link>
  );
}

/** Desktop mega panel: link rows on the left, promo tile on the right. */
function NavPanel({ item, pathname }: { item: NavItem; pathname: string }) {
  const children = item.children ?? [];
  const promo = panelPromos[item.label];

  return (
    <div className="grid gap-2 p-2 md:grid-cols-[minmax(0,22rem)_15rem]">
      <ul className="grid content-start gap-1">
        {children.map((child) => (
          <li key={child.href}>
            <PanelLink link={child} pathname={pathname} />
          </li>
        ))}
      </ul>
      <PanelPromo promo={promo} />
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobile, setMobile] = useState<{ pathname: string; open: boolean }>({
    pathname,
    open: false,
  });
  // Same trick for the desktop panels: the open item remembers the pathname it
  // was opened on, so following a link inside a panel collapses it as the new
  // page renders — Radix's own value would otherwise outlive the navigation.
  const [openMenu, setOpenMenu] = useState<{ pathname: string; value: string }>({
    pathname,
    value: "",
  });
  const [scrolled, setScrolled] = useState(false);

  const mobileOpen = mobile.pathname === pathname && mobile.open;
  const menuValue = openMenu.pathname === pathname ? openMenu.value : "";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobile((current) => ({ ...current, open: false }));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // A shadow only once the page has moved, so the header reads as part of the
  // hero at rest and lifts away from content on scroll.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-line bg-white text-ink transition-shadow duration-300",
        scrolled && "shadow-[0_18px_40px_-34px_rgba(13,42,107,0.8)]",
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-6 md:h-20">
          <Link
            href="/"
            aria-label={`${site.legalName} home`}
            className="flex shrink-0 items-center"
          >
            {/* The artwork carries a white box, so it sits on a white pill. */}
            <span className="brand-pill">
              <Image
                src={site.logo.src}
                alt={site.logo.alt}
                width={site.logo.width}
                height={site.logo.height}
                priority
                className="h-9 w-auto md:h-10"
              />
            </span>
          </Link>

          <NavigationMenu
            aria-label="Main"
            delayDuration={120}
            skipDelayDuration={400}
            value={menuValue}
            onValueChange={(value) => setOpenMenu({ pathname, value })}
            // self-stretch makes the menu as tall as the header bar, so the
            // shared viewport hangs from the header edge instead of the text
            // baseline. The colour comes from the white bar through
            // `text-current`, so the triggers stay ink on white.
            className="hidden self-stretch text-ink xl:flex"
          >
            <NavigationMenuList>
              {primaryNav.map((item) =>
                item.children ? (
                  <NavigationMenuItem key={item.label}>
                    <NavigationMenuTrigger
                      aria-current={
                        itemIsActive(pathname, item) ? "page" : undefined
                      }
                      className={cn(
                        itemIsActive(pathname, item) &&
                          "bg-cobalt-tint text-cobalt-deep",
                      )}
                    >
                      {item.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <NavPanel item={item} pathname={pathname} />
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                ) : (
                  <NavigationMenuItem key={item.label}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={item.href ?? "#"}
                        aria-current={
                          itemIsActive(pathname, item) ? "page" : undefined
                        }
                        // The active classes must merge with the trigger style
                        // in one cn() call: Slot concatenates className strings,
                        // so Tailwind order — not our intent — would decide.
                        className={cn(
                          navigationMenuTriggerStyle(),
                          itemIsActive(pathname, item) &&
                            "bg-cobalt-tint text-cobalt-deep",
                        )}
                      >
                        {item.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ),
              )}
            </NavigationMenuList>
          </NavigationMenu>

          {/* The header corner holds two actions only: the cobalt CTA and the
              account entry. The account control sits outside the xl-only cluster
              on purpose — otherwise a signed-in visitor on a 1024-1279px screen
              has no account entry at all. */}
          <div className="flex items-center gap-2">
            <div className="hidden xl:block">
              {/* Filled cobalt, not an outline: on a white bar the account
                  control is already an outline pill, and two identical pills
                  would read as the same level of action. */}
              <Link
                href={cta.secondary.href}
                className="btn-fill inline-flex h-10 items-center justify-center rounded-xl bg-cobalt px-4 text-sm font-medium text-white hover:text-ink"
              >
                {cta.secondary.label}
              </Link>
            </div>
            <AuthNav />

            <button
              type="button"
              className="btn-fill inline-flex size-10 items-center justify-center rounded-xl border border-line text-ink xl:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobile({ pathname, open: !mobileOpen })}
            >
              {mobileOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </div>
      </Container>

      {mobileOpen ? (
        <div
          id="mobile-nav"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white xl:hidden"
        >
          <Container className="py-5">
            <nav aria-label="Mobile" className="flex flex-col gap-5">
              {primaryNav.map((item) =>
                item.children ? (
                  <div key={item.label}>
                    <p className="px-1 pb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
                      {item.label}
                    </p>
                    <ul className="grid gap-1">
                      {item.children.map((child) => {
                        const Icon = linkIcons[child.href];
                        const active = linkIsActive(pathname, child.href);
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-2 py-2.5",
                                active && "bg-cobalt-tint/60",
                              )}
                            >
                              {Icon ? (
                                <span
                                  aria-hidden
                                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-cobalt-tint text-cobalt"
                                >
                                  <Icon className="size-5" />
                                </span>
                              ) : null}
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-ink">
                                  {child.label}
                                </span>
                                {child.description ? (
                                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                                    {child.description}
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href ?? "#"}
                    aria-current={
                      itemIsActive(pathname, item) ? "page" : undefined
                    }
                    className={cn(
                      "flex items-center justify-between border-b border-line px-1 pb-3 text-base font-medium transition-colors",
                      itemIsActive(pathname, item)
                        ? "text-cobalt-deep"
                        : "text-ink",
                    )}
                  >
                    {item.label}
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-ink-soft"
                    />
                  </Link>
                ),
              )}
            </nav>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={cta.secondary.href}
                className="btn-fill inline-flex h-11 w-full items-center justify-center rounded-xl bg-cobalt text-sm font-medium text-white hover:text-ink"
              >
                {cta.secondary.label}
              </Link>
              <AuthNavMobile />
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
