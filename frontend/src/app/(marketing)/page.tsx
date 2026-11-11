import type { Metadata } from "next";

import { ApiSection } from "@/components/sections/api-section";
import { FeatureGrid } from "@/components/sections/feature-grid";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { PricingSection } from "@/components/sections/pricing-section";
import { UseCases } from "@/components/sections/use-cases";
import { VoiceSamples } from "@/components/sections/voice-samples";
import { LandingSpiderCursor } from "@/components/ui/landing-spider-cursor";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.legalName} — ${site.tagline}`,
  description: site.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <VoiceSamples />
      <UseCases />
      <FeatureGrid />
      <ApiSection />
      <PricingSection />
      <FinalCta />

      {/* Decorative cursor companion: home page only. */}
      <LandingSpiderCursor />
    </>
  );
}
