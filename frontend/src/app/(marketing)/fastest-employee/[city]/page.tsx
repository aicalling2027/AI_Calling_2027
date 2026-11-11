import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { LinkCards, NumberedSteps } from "@/components/sections/cards";
import { CtaBand } from "@/components/sections/cta-band";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import {
  cities,
  getCity,
  getIndustry,
  getLanguage,
  landingFaq,
} from "@/content/landings";

type RouteParams = { city: string };

export function generateStaticParams(): RouteParams[] {
  return cities.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCity(slug);

  if (!city) {
    return {};
  }

  return {
    title: `AI voice calling in ${city.name}`,
    description: `${city.name}, ${city.state}: AI employees that answer enquiries, run campaigns and follow up on new leads. ${city.summary}`,
    alternates: { canonical: `/fastest-employee/${city.slug}` },
  };
}

const playbook = [
  {
    title: "Start in the local language",
    body: "Set the greeting to the language most enquiries arrive in, not the language of your head office.",
  },
  {
    title: "Match the working hours",
    body: "Calling windows and after-hours answering should follow the city's business rhythm, not a single national default.",
  },
  {
    title: "Give one team ownership",
    body: "A city rollout succeeds when one person owns the script and reads the transcripts every week.",
  },
];

export default async function CityPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { city: slug } = await params;
  const city = getCity(slug);

  if (!city) {
    notFound();
  }

  const sectors = city.sectors
    .map((name) => {
      const industry = getIndustry(name.toLowerCase().replace(/\s+/g, "-"));
      return industry
        ? {
            title: industry.name,
            body: industry.summary,
            href: `/ai-voice-agents/for/${industry.slug}`,
            label: "View industry",
            icon: industry.icon,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const cityLanguages = city.languageSlugs
    .map((languageSlug) => getLanguage(languageSlug))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const otherCities = cities.filter((item) => item.slug !== city.slug).slice(0, 6);

  return (
    <>
      <PageHero
        eyebrow={`City · ${city.name}, ${city.state}`}
        title={`An AI employee that answers in ${city.name}.`}
        body={city.summary}
        note="Numbering, language availability and calling windows are confirmed during scoping."
        breadcrumb={[{ label: "City coverage" }, { label: city.name }]}
        actions={[
          { label: "Start free", href: "/free-trial", tone: "primary" },
          { label: "Talk to us", href: "/contact", tone: "secondary" },
        ]}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Where the calls come from"
            title={`Sectors driving enquiry volume in ${city.name}.`}
            body="Each sector page describes the script that is usually configured first."
          />
          <LinkCards items={sectors} className="mt-10" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SectionHeader
              eyebrow="Languages"
              title={`What callers speak in ${city.name}.`}
              body="A local-language first sentence usually changes how the rest of the call goes."
            />
            <ul className="flex flex-wrap gap-2">
              {cityLanguages.map((language) => (
                <li key={language.slug}>
                  <Link
                    href={`/ai-voice-agents/language/${language.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-blue-line hover:text-blue"
                  >
                    <span>{language.name}</span>
                    <span className="text-xs text-ink-soft">{language.nativeName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Local playbook"
            title="Three decisions that make a city rollout work."
          />
          <NumberedSteps steps={playbook} className="mt-10" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader eyebrow="Other cities" title="Compare coverage." />
          <ul className="mt-8 flex flex-wrap gap-2">
            {otherCities.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/fastest-employee/${item.slug}`}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-blue-line hover:text-blue"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <FaqSection
        title={`Calling in ${city.name}.`}
        items={[
          {
            question: `Do you support numbers in ${city.name}?`,
            answer:
              "Number provisioning depends on the carrier and the plan, and is confirmed during scoping. Ask for the specific arrangement for your account.",
          },
          ...landingFaq,
        ]}
      />

      <CtaBand
        title={`Start with one use case in ${city.name}.`}
        body="Pick the call you lose most often, write the script for it, and measure the first week."
      />
    </>
  );
}
