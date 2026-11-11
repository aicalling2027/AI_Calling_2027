import type { Metadata } from "next";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BulletPanel } from "@/components/sections/bullet-panel";
import { NumberedSteps } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { LeadForm } from "@/components/forms/lead-form";
import { freeTrialPage } from "@/content/company";

export const metadata: Metadata = {
  title: "Start free",
  description:
    "Request access to an AOTMS workspace, start with one use case and review real call transcripts before expanding.",
  alternates: { canonical: "/free-trial" },
};

export default function FreeTrialPage() {
  return (
    <>
      <PageHero
        eyebrow={freeTrialPage.eyebrow}
        title={freeTrialPage.title}
        body={freeTrialPage.summary}
        note={freeTrialPage.note}
        breadcrumb={[{ label: "Start free" }]}
        actions={[]}
        aside={
          <BulletPanel
            title="What the first rollout includes"
            badge="Scope"
            items={freeTrialPage.included}
            footer="One use case only — expansion is a separate decision once the transcripts are reviewed."
          />
        }
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="How access works"
            title="Three steps before the first call."
            body="Because the script is reviewed with you, access is provisioned by the team rather than self-serve."
          />
          <NumberedSteps steps={freeTrialPage.steps} className="mt-10" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <SectionHeader eyebrow="Before you start" title="What you need ready." />
              <ul className="mt-8 space-y-3">
                {freeTrialPage.requirements.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-line bg-ivory-light px-4 py-3"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-coral-deep" aria-hidden />
                    <span className="text-sm leading-relaxed text-ink">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-xs leading-relaxed text-ink-soft">
                Nothing here creates an account automatically. The AOTMS team provisions
                the workspace after reviewing the use case with you.
              </p>
            </div>

            <div>
              <SectionHeader eyebrow="Request access" title="Tell us the first use case." />
              <div className="mt-8">
                <LeadForm
                  kind="trial"
                  submitLabel="Request access"
                  intro="We need one conversation type and an approximate call volume to scope a workspace."
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <FaqSection
        title="Access questions."
        body="These answers describe the intended onboarding process; commercial terms are still being finalised."
        items={freeTrialPage.faq}
      />

      <CtaBand
        title="Rather talk it through first?"
        body="A short call is often faster than a written request if the use case is still fuzzy."
        primary={{ label: "Talk to us", href: "/contact" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />
    </>
  );
}
