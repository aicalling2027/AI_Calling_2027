"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Code2,
  ContactRound,
  ExternalLink,
  FileText,
  Gavel,
  GraduationCap,
  Megaphone,
  Newspaper,
  Package,
  PhoneIncoming,
  Scale,
  Zap,
} from "lucide-react";

import { AuthNav, AuthNavMobile } from "@/components/auth/auth-nav";
import { Container } from "@/components/layout/container";
import {
  LiquidNavLayer,
  LiquidPanelGlass,
} from "@/components/ui/liquid-nav-layer";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
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
import {
  cta,
  groupProducts,
  primaryNav,
  site,
  type NavItem,
  type NavLink,
} from "@/lib/site";

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

/** The sibling AOTMS properties, keyed by label so the URLs stay in one file. */
const groupIcons: Record<string, LucideIcon> = {
  LMS: GraduationCap,
  Auction: Gavel,
  CRM: ContactRound,
  ERP: Package,
};

/**
 * API and Docs are buttons only: there is no page behind them yet, so they never
 * navigate and stay labelled "Soon" until one exists. They render as the two
 * rows of the Developers panel, and again in the phone menu.
 */
const toolLinks: { label: string; icon: LucideIcon; description: string }[] = [
  {
    label: "API",
    icon: Code2,
    description: "Call the platform from your own stack.",
  },
  {
    label: "Docs",
    icon: FileText,
    description: "Endpoints, webhooks and integration guides.",
  },
];

function linkIsActive(pathname: string, href: string) {
  if (!href.startsWith("/")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemIsActive(pathname: string, item: NavItem) {
  if (item.href && linkIsActive(pathname, item.href)) return true;
  return (item.children ?? []).some((child) =>
    linkIsActive(pathname, child.href),
  );
}

/** Marks the API and Docs buttons that have no page behind them yet. */
function SoonChip() {
  return (
    <span className="text-[0.55rem] font-semibold tracking-[0.12em] text-ink-soft uppercase">
      Soon
    </span>
  );
}

/** One desktop panel row: icon tile, label and a one-line description. */
function PanelRow({
  label,
  description,
  href,
  icon: Icon,
  external,
  pathname,
}: {
  label: string;
  description?: string;
  href: string;
  icon?: LucideIcon;
  external?: boolean;
  pathname: string;
}) {
  const active = linkIsActive(pathname, href);

  return (
    <NavigationMenuLink asChild>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        data-liquid-row
        className={cn(
          // The sliding glass is the hover surface now, so the row keeps no
          // fill of its own: two whites would stack and read as a seam.
          "group/row flex cursor-pointer items-start gap-3 rounded-xl p-2.5 outline-none transition-colors",
          "focus-visible:ring-3 focus-visible:ring-ring/30",
          active && "bg-white shadow-[0_1px_3px_rgba(13,42,107,0.12)]",
        )}
      >
        {Icon ? (
          <span
            aria-hidden
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl border transition-colors",
              active
                ? "border-cobalt bg-cobalt text-white"
                : "border-line bg-white text-cobalt group-hover/row:border-cobalt/30 group-hover/row:bg-cobalt-tint",
            )}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <span className="min-w-0">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              active ? "text-cobalt-deep" : "text-ink",
            )}
          >
            {label}
            {external ? (
              <ExternalLink className="size-3 text-ink-soft" aria-hidden />
            ) : null}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
              {description}
            </span>
          ) : null}
        </span>
      </Link>
    </NavigationMenuLink>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-1.5 pb-1 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
      {children}
    </p>
  );
}

/**
 * Product panel: three narrow columns — the calling platform on the left, the
 * sibling AOTMS properties as a 2x2 grid on the right. The sibling rows open in
 * a new tab, which is why they keep the external glyph.
 */
function ProductPanel({ pathname }: { pathname: string }) {
  const product = primaryNav.find((item) => item.label === "Product");
  const platform = product?.children ?? [];

  return (
    <div
      data-liquid-panel
      className="relative isolate w-[38rem] max-w-[calc(100vw-2rem)] p-2"
    >
      <LiquidPanelGlass />
      <div className="grid grid-cols-3 gap-x-3">
        <div className="min-w-0">
          <PanelLabel>Platform</PanelLabel>
          <ul className="grid gap-1">
            {platform.map((link) => (
              <li key={link.href}>
                <PanelRow
                  label={link.label}
                  description={link.description}
                  href={link.href}
                  icon={linkIcons[link.href]}
                  pathname={pathname}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 min-w-0">
          <PanelLabel>AOTMS products</PanelLabel>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
            {groupProducts.map((link) => (
              <li key={link.href} className="min-w-0">
                <PanelRow
                  label={link.label}
                  description={link.description}
                  href={link.href}
                  icon={groupIcons[link.label]}
                  external={link.external}
                  pathname={pathname}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Resources panel: one column of link rows. The developer tools are not in here
 * — they have their own trigger and panel beside it.
 */
function ResourcesPanel({ pathname }: { pathname: string }) {
  const resources = primaryNav.find((item) => item.label === "Resources");
  const links = resources?.children ?? [];

  return (
    <div
      data-liquid-panel
      className="relative isolate w-[26rem] max-w-[calc(100vw-2rem)] p-2"
    >
      <LiquidPanelGlass />
      <ul className="grid gap-1">
        {links.map((link) => (
          <li key={link.href}>
            <PanelRow
              label={link.label}
              description={link.description}
              href={link.href}
              icon={linkIcons[link.href]}
              pathname={pathname}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A panel row with no page behind it. It is a button, not a link, so the row
 * cannot promise a destination it does not have; the chip says when.
 */
function PanelSoonRow({ tool }: { tool: (typeof toolLinks)[number] }) {
  const Icon = tool.icon;

  return (
    <button
      type="button"
      title="Coming soon"
      aria-label={`${tool.label} — coming soon`}
      data-liquid-row
      className="group/row flex w-full cursor-pointer items-start gap-3 rounded-xl p-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-cobalt transition-colors group-hover/row:border-cobalt/30 group-hover/row:bg-cobalt-tint"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {tool.label}
          <SoonChip />
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
          {tool.description}
        </span>
      </span>
    </button>
  );
}

/** Developers panel: the two tools, and nothing else competing with them. */
function DevelopersPanel() {
  return (
    <div
      data-liquid-panel
      className="relative isolate w-[22rem] max-w-[calc(100vw-2rem)] p-2"
    >
      <LiquidPanelGlass />
      <ul className="grid gap-1">
        {toolLinks.map((tool) => (
          <li key={tool.label}>
            <PanelSoonRow tool={tool} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One row in the phone menu: the same tile and copy, sized for a thumb. */
function MobileRow({ link, pathname }: { link: NavLink; pathname: string }) {
  const Icon = linkIcons[link.href] ?? groupIcons[link.label];
  const active = linkIsActive(pathname, link.href);

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noreferrer" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
        active ? "bg-cobalt-tint/60" : "hover:bg-mist",
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
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {link.label}
          {link.external ? (
            <ExternalLink className="size-3 text-ink-soft" aria-hidden />
          ) : null}
        </span>
        {link.description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            {link.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * The phone menu is portalled to the body: the header gains a backdrop filter
 * once the page scrolls, and a filtered ancestor would otherwise become the
 * containing block for this fixed panel.
 */
function MobileMenu({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      id="mobile-nav"
      className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-y border-line bg-white/95 backdrop-blur-xl md:top-[4.5rem] xl:hidden"
    >
      {children}
    </div>,
    document.body,
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  // The open state remembers the pathname it was opened on, so following a link
  // inside a panel closes it as the new page renders.
  const [mobile, setMobile] = useState<{ pathname: string; open: boolean }>({
    pathname,
    open: false,
  });
  const [openMenu, setOpenMenu] = useState<{ pathname: string; value: string }>(
    {
      pathname,
      value: "",
    },
  );
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

  // The overlay covers the viewport, so the page behind it must not scroll.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Transparent over the hero, a blurred white bar once the page moves. The
  // effect also re-runs on navigation: a client-side route change lands at the
  // top of the next page, and the bar has to drop its scrolled state with it.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // The home hero runs edge to edge behind the bar, so there the header is
  // taken out of flow and the hero pays the space back with its own top
  // padding. Every other page keeps a sticky bar that owns its row.
  const overHero = pathname === "/";

  return (
    <header
      className={cn(
        "z-50 w-full border-b transition-[background-color,border-color,box-shadow] duration-300",
        overHero ? "fixed inset-x-0 top-0" : "sticky top-0",
        scrolled
          ? "border-line bg-white/85 shadow-[0_18px_40px_-34px_rgba(13,42,107,0.8)] backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-6 md:h-[4.5rem]">
          <Link
            href="/"
            aria-label={`${site.legalName} home`}
            className="flex shrink-0 cursor-pointer items-center"
          >
            {/* The artwork carries a white box, so it sits on a white pill. */}
            <span className="brand-pill">
              <Image
                src={site.logo.src}
                alt={site.logo.alt}
                width={site.logo.width}
                height={site.logo.height}
                priority
                className="h-8 w-auto md:h-9"
              />
            </span>
          </Link>

          {/* The desktop links sit on a pill of water. The layer is purely
              decorative, so it is a sibling of the menu rather than a wrapper:
              Radix positions the shared panel against the menu, and nesting
              the list would move it. */}
          <div
            data-liquid-nav
            className="relative hidden self-stretch items-center xl:flex"
          >
            <LiquidNavLayer
              tone="light"
              className="inset-y-2 -inset-x-3 rounded-full"
            />
            <NavigationMenu
              aria-label="Main"
              delayDuration={120}
              skipDelayDuration={400}
              value={menuValue}
              onValueChange={(value) => setOpenMenu({ pathname, value })}
              // self-stretch makes the menu as tall as the header bar, so the
              // shared viewport hangs from the header edge instead of the text
              // baseline. The colour comes from the bar through `text-current`.
              className="relative z-10 self-stretch text-ink-soft xl:flex"
            >
              <NavigationMenuList>
                {primaryNav.map((item) =>
                  item.children ? (
                    <NavigationMenuItem key={item.label}>
                      <NavigationMenuTrigger
                        data-liquid-item
                        aria-current={
                          itemIsActive(pathname, item) ? "page" : undefined
                        }
                        // No fill on hover or open: the water drop behind the row
                        // is what marks the target now.
                        className={cn(
                          "cursor-pointer hover:bg-transparent hover:text-ink data-[state=open]:bg-transparent data-[state=open]:text-ink",
                          itemIsActive(pathname, item) && "text-cobalt-deep",
                        )}
                      >
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        {item.label === "Product" ? (
                          <ProductPanel pathname={pathname} />
                        ) : (
                          <ResourcesPanel pathname={pathname} />
                        )}
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  ) : (
                    <NavigationMenuItem key={item.label}>
                      <NavigationMenuLink asChild>
                        <Link
                          data-liquid-item
                          href={item.href ?? "#"}
                          aria-current={
                            itemIsActive(pathname, item) ? "page" : undefined
                          }
                          // The active classes must merge with the trigger style
                          // in one cn() call: Slot concatenates className strings,
                          // so Tailwind order — not our intent — would decide.
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "cursor-pointer hover:bg-transparent hover:text-ink",
                            itemIsActive(pathname, item) && "text-cobalt-deep",
                          )}
                        >
                          {item.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ),
                )}

                {/* API and Docs are a pair, not two loose buttons, so they get
                    their own trigger beside Resources. The trigger joins the
                    water like any other item. */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    data-liquid-item
                    className="cursor-pointer hover:bg-transparent hover:text-ink data-[state=open]:bg-transparent data-[state=open]:text-ink"
                  >
                    Developers
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <DevelopersPanel />
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* The header corner holds two actions: the cobalt CTA and the account
              entry. The account control sits outside the xl-only cluster on
              purpose — otherwise a visitor on a 1024-1279px screen has no
              account entry at all. */}
          <div className="flex items-center gap-2">
            <div className="hidden xl:block">
              <Link
                href={cta.primary.href}
                className="btn-glass inline-flex h-10 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold"
              >
                {cta.primary.label}
              </Link>
            </div>
            <AuthNav />

            <button
              type="button"
              className="btn-glass inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink xl:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobile({ pathname, open: !mobileOpen })}
            >
              <MenuToggleIcon open={mobileOpen} className="size-5" />
            </button>
          </div>
        </div>
      </Container>

      <MobileMenu open={mobileOpen}>
        <Container className="flex min-h-full flex-col py-5">
          <nav aria-label="Mobile" className="flex flex-col gap-5">
            {primaryNav.map((item) =>
              item.children ? (
                <div key={item.label}>
                  <p className="px-1 pb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
                    {item.label}
                  </p>
                  <ul className="grid gap-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <MobileRow link={child} pathname={pathname} />
                      </li>
                    ))}
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
                    "flex cursor-pointer items-center justify-between border-b border-line px-1 pb-3 text-base font-medium transition-colors",
                    itemIsActive(pathname, item)
                      ? "text-cobalt-deep"
                      : "text-ink",
                  )}
                >
                  {item.label}
                  <ChevronRight aria-hidden className="size-4 text-ink-soft" />
                </Link>
              ),
            )}

            <div>
              <p className="px-1 pb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
                Other AOTMS products
              </p>
              <ul className="grid gap-1">
                {groupProducts.map((link) => (
                  <li key={link.href}>
                    <MobileRow link={link} pathname={pathname} />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="px-1 pb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-soft uppercase">
                Developers
              </p>
              <div className="grid grid-cols-2 gap-2">
                {toolLinks.map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    title="Coming soon"
                    aria-label={`${tool.label} — coming soon`}
                    className="btn-glass flex cursor-pointer items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium text-ink"
                  >
                    <tool.icon aria-hidden className="size-4 text-cobalt" />
                    {tool.label}
                    <SoonChip />
                  </button>
                ))}
              </div>
            </div>
          </nav>

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Link
              href={cta.primary.href}
              className="btn-glass inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full text-sm font-semibold"
            >
              {cta.primary.label}
            </Link>
            <AuthNavMobile />
          </div>
        </Container>
      </MobileMenu>
    </header>
  );
}
