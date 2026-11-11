import Link from "next/link";

import { Container } from "@/components/layout/container";

const suggestions = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/product/inbound" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

/**
 * Shared 404 body. Used by both the root not-found (unknown URL) and the
 * marketing group not-found (`notFound()` from a valid route, wrong slug).
 */
export function NotFoundPanel() {
  return (
    <section className="section">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow">404</p>
          <h1 className="display mt-3 text-3xl leading-tight md:text-4xl">
            This page does not exist.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            The link may be out of date, or the page may have moved. Nothing has been
            deleted — start from one of these.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {suggestions.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block rounded-full border border-blue-line bg-surface px-4 py-2 text-sm font-medium text-blue transition-colors hover:bg-blue-tint"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
