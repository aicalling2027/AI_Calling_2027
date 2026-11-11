"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cta, primaryNav, site } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  // Each menu records the pathname it was opened on, so a client-side
  // navigation closes it during the render that follows — no effect needed.
  const [menu, setMenu] = useState<{ pathname: string; label: string | null }>({
    pathname,
    label: null,
  });
  const [mobile, setMobile] = useState<{ pathname: string; open: boolean }>({
    pathname,
    open: false,
  });
  const navRef = useRef<HTMLDivElement>(null);

  const openMenu = menu.pathname === pathname ? menu.label : null;
  const mobileOpen = mobile.pathname === pathname && mobile.open;

  function toggleMenu(label: string) {
    setMenu((current) => {
      const active = current.pathname === pathname ? current.label : null;
      return { pathname, label: active === label ? null : label };
    });
  }

  // Escape closes, outside click closes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu((current) => ({ ...current, label: null }));
        setMobile((current) => ({ ...current, open: false }));
      }
    }
    function onClick(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenu((current) => ({ ...current, label: null }));
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ivory-light/85 backdrop-blur-md">
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

          <nav
            ref={navRef}
            aria-label="Main"
            className="hidden items-center gap-1 xl:flex"
          >
            {primaryNav.map((item) =>
              item.children ? (
                <div key={item.label} className="relative">
                  <button
                    type="button"
                    aria-expanded={openMenu === item.label}
                    aria-controls={`menu-${item.label}`}
                    onClick={() => toggleMenu(item.label)}
                    className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-blue-tint/70 hover:text-blue"
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform",
                        openMenu === item.label && "rotate-180",
                      )}
                    />
                  </button>

                  {openMenu === item.label ? (
                    <div
                      id={`menu-${item.label}`}
                      className="absolute left-0 top-full mt-2 w-[22rem] rounded-2xl border border-line bg-surface p-2 shadow-card"
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-blue-tint/60"
                        >
                          <span className="block text-sm font-semibold text-ink">
                            {child.label}
                          </span>
                          {child.description ? (
                            <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                              {child.description}
                            </span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href ?? "#"}
                  className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-blue-tint/70 hover:text-blue"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="hidden items-center gap-2 xl:flex">
            <Link
              href={cta.secondary.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-10 px-4 text-sm",
              )}
            >
              {cta.secondary.label}
            </Link>
            <Link
              href={cta.primary.href}
              className={cn(buttonVariants({ size: "lg" }), "h-10 px-5 text-sm")}
            >
              {cta.primary.label}
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobile({ pathname, open: !mobileOpen })}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-line bg-ivory-light xl:hidden">
          <Container className="py-4">
            <nav aria-label="Mobile" className="flex flex-col">
              {primaryNav.map((item) =>
                item.children ? (
                  <div key={item.label} className="py-2">
                    <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                      {item.label}
                    </p>
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-1 py-2 text-sm font-medium text-ink"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href ?? "#"}
                    className="border-b border-line px-1 py-3 text-base font-medium text-ink"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={cta.primary.href}
                className={cn(buttonVariants({ size: "lg" }), "h-11 w-full text-sm")}
              >
                {cta.primary.label}
              </Link>
              <Link
                href={cta.secondary.href}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 w-full text-sm",
                )}
              >
                {cta.secondary.label}
              </Link>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
