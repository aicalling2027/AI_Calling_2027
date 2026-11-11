import type { Metadata } from "next";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BulletPanel } from "@/components/sections/bullet-panel";
import { CardGrid, NumberedSteps } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { pricingPage } from "@/content/marketing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AOTMS pricing follows call volume, languages and channels. Request a written quote for your use case.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow={pricingPage.eyebrow}
        title={pricingPage.title}
        body={pricingPage.summary}
        note={pricingPage.note}
        breadcrumb={[{ label: "Pricing" }]}
        actions={[
          { label: "Request a quote", href: "/contact", tone: "primary" },
          { label: "Start free", href: "/free-trial", tone: "secondary" },
        ]}
        aside={
          <BulletPanel
            title="Included in every account"
            badge="All plans"
            items={pricingPage.included}
            footer="List reflects the intended scope; confirm the final inclusion list with your quote."
          />
        }
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="How the quote is built"
            title="Three things decide what you pay."
            body="Nothing here is a price. These are the variables the team uses when scoping an account."
          />
          <CardGrid items={pricingPage.factors} columns={3} className="mt-10" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader
            eyebrow="Getting a number"
            title="From use case to written quote."
          />
          <NumberedSteps steps={pricingPage.quoteSteps} className="mt-10" />
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SectionHeader
              eyebrow="Every account"
              title="What you get regardless of volume."
            />
            <ul className="grid gap-3 sm:grid-cols-2">
              {pricingPage.included.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-line bg-ivory-light px-4 py-3"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-coral-deep" aria-hidden />
                  <span className="text-sm leading-relaxed text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <FaqSection
        title="Pricing questions."
        body="If the answer is not here, ask the team directly — nothing about pricing is finalised yet."
        items={pricingPage.faq}
      />

      <CtaBand
        title="Get a quote against your real volume."
        body="Share the use case and an approximate monthly call count, and the team will scope it in writing."
        primary={{ label: "Request a quote", href: "/contact" }}
        secondary={{ label: "See the products", href: "/product/inbound" }}
      />
    </>
  );
}
