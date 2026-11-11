import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { getLanguage, landingFaq, languages } from "@/content/landings";

type RouteParams = { language: string };

// [block] params are read to render the language page, so this route cannot stream an instant shell.
export const instant = false;

export function generateStaticParams(): RouteParams[] {
  return languages.map((language) => ({ language: language.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { language: slug } = await params;
  const language = getLanguage(slug);

  if (!language) {
    return {};
  }

  return {
    title: `AI voice agents in ${language.name}`,
    description: `${language.name} (${language.code}) AI calling: inbound answering, campaigns and lead follow-up. ${language.summary}`,
    alternates: { canonical: `/ai-voice-agents/language/${language.slug}` },
  };
}

const checklist = [
  "Real accents from the regions you actually serve",
  "Code-mixed sentences, not only clean scripted lines",
  "Numbers, dates and addresses spoken at natural speed",
  "Brand and place names pronounced the way customers say them",
  "A defined fallback when the caller switches language mid-call",
];

export default async function LanguagePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { language: slug } = await params;
  const language = getLanguage(slug);

  if (!language) {
    notFound();
  }

  const others = languages.filter((item) => item.slug !== language.slug);

  const useCases = [
    {
      title: `Answer incoming calls in ${language.name}`,
      body: `Callers reach an AI employee that greets them in ${language.name}, captures the reason for the call and records it against their number.`,
    },
    {
      title: `Run a ${language.name} campaign`,
      body: `Work through a contact list with a script written in ${language.name}, including the retry and calling-window rules.`,
    },
    {
      title: `Follow up on new leads in ${language.name}`,
      body: `Trigger a call the moment an enquiry arrives, so the first conversation happens in the caller's language rather than a second call later.`,
    },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Language · ${language.code}`}
        title={`AI voice calling in ${language.name}.`}
        body={language.summary}
        note={`${language.name} · ${language.nativeName} · ${language.code}`}
        breadcrumb={[
          { label: "Languages", href: "/voices" },
          { label: language.name },
        ]}
        actions={[
          { label: "Request a sample", href: "/contact", tone: "primary" },
          { label: "See all languages", href: "/voices", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Where it is used"
            title={`Three ways teams call in ${language.name}.`}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {useCases.map((useCase) => (
              <article
                key={useCase.title}
                className="card card-lift p-6"
              >
                <h3 className="text-base font-semibold text-ink md:text-lg">
                  {useCase.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {useCase.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SectionHeader
              eyebrow="Before you commit"
              title={`How to evaluate a ${language.name} voice.`}
              body="A language on a data sheet is not the same as a language that works on a real call."
            />
            <ul className="space-y-3">
              {checklist.map((item) => (
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

      <Section>
        <Container>
          <SectionHeader eyebrow="Other languages" title="Switch or add a language." />
          <ul className="mt-8 flex flex-wrap gap-2">
            {others.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/ai-voice-agents/language/${item.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-blue-line hover:text-blue"
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-ink-soft">{item.nativeName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <FaqSection
        title={`${language.name} calling questions.`}
        items={[
          {
            question: `Is ${language.name} fully supported today?`,
            answer:
              "The published catalogue is not finalised. Ask for a live sample in this language before committing, and judge the call rather than the list.",
          },
          ...landingFaq,
        ]}
      />

      <CtaBand
        title={`Hear ${language.name} before you decide.`}
        body="A live call in your own script is the only reliable test."
        primary={{ label: "Request a sample", href: "/contact" }}
        secondary={{ label: "See all voices", href: "/voices" }}
      />
    </>
  );
}
