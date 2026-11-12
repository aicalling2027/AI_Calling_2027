import type { Metadata } from "next";

import { ApiSection } from "@/components/sections/api-section";
import { FeatureGrid } from "@/components/sections/feature-grid";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Integrations } from "@/components/sections/integrations";
import { PricingSection } from "@/components/sections/pricing-section";
import { UseCases } from "@/components/sections/use-cases";
import { VoiceSamples } from "@/components/sections/voice-samples";
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
      <Integrations />
      <HowItWorks />
      <VoiceSamples />
      <UseCases />
      <FeatureGrid />
      <ApiSection />
      <PricingSection />
      <FinalCta />
    </>
  );
}
