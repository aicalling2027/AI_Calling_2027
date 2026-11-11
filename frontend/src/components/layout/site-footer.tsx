import Link from "next/link";
import Image from "next/image";
import { cacheLife } from "next/cache";
import { Mail, Phone } from "lucide-react";

import { Container } from "@/components/layout/container";
import { footerNav, legalNav, site } from "@/lib/site";

// `cacheComponents` rejects unstable values (like `new Date()`) during
// prerendering, so the copyright year is computed once and cached.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="section-night border-t border-white/10">
      <Container className="py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label={`${site.legalName} home`}
            >
              <span className="brand-pill">
                <Image
                  src={site.logo.src}
                  alt={site.logo.alt}
                  width={site.logo.width}
                  height={site.logo.height}
                  className="h-9 w-auto"
                />
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">
              {site.tagline}.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm font-medium">
              <a
                href={`mailto:${site.contact.email}`}
                className="inline-flex items-center gap-2 text-white transition-colors hover:underline hover:underline-offset-4"
              >
                <Mail className="size-4 shrink-0 text-coral" aria-hidden />
                {site.contact.email}
              </a>
              <a
                href={site.contact.phoneHref}
                className="inline-flex items-center gap-2 text-white transition-colors hover:underline hover:underline-offset-4"
              >
                <Phone className="size-4 shrink-0 text-coral" aria-hidden />
                {site.contact.phone}
              </a>
            </div>
          </div>

          {footerNav.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                {group.title}
              </p>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/80 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © <CopyrightYear /> {site.legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legalNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
