import { LandingBackdrop } from "@/components/layout/landing-backdrop";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The shader ground is mounted once, here, so every public page scrolls
    // over the same continuous wash instead of each page starting its own.
    // `isolate` scopes its -z-10 to this wrapper, and `flex-1` keeps `main`
    // filling the column now that the layout is a single element, not a
    // fragment of three siblings.
    <div className="relative isolate flex flex-1 flex-col">
      <LandingBackdrop />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
