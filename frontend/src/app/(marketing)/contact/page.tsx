import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { IconBadge } from "@/components/layout/icon";
import { Section, SectionHeader } from "@/components/layout/section";
import { FaqSection } from "@/components/sections/faq";
import { PageHero } from "@/components/sections/page-hero";
import { LeadForm } from "@/components/forms/lead-form";
import { contactPage } from "@/content/company";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact AOTMS Global Pvt. Ltd. about a scoped quote, a pilot or a live voice sample.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow={contactPage.eyebrow}
        title={contactPage.title}
        body={contactPage.summary}
        note={contactPage.note}
        breadcrumb={[{ label: "Contact" }]}
        actions={[]}
      />

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <SectionHeader eyebrow="Direct lines" title="Reach the right team." />

              <ul className="mt-8 space-y-3">
                {contactPage.channels.map((channel) => (
                  <li
                    key={channel.title}
                    className="card card-lift flex gap-4 p-5"
                  >
                    <IconBadge name={channel.icon} tone="blue" className="shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-ink">
                        {channel.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                        {channel.body}
                      </p>
                      {channel.href ? (
                        <a
                          href={channel.href}
                          className="mt-2 inline-block text-sm font-medium text-blue underline underline-offset-4 hover:text-blue-deep"
                        >
                          {channel.value}
                        </a>
                      ) : (
                        <span className="mt-2 inline-block rounded-full border border-dashed border-hairline px-2.5 py-1 text-[0.65rem] font-medium text-ink-soft">
                          {channel.value}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-xs leading-relaxed text-ink-soft">
                Prefer to read first?{" "}
                <Link href="/pricing" className="font-medium text-blue underline underline-offset-4">
                  See how pricing is quoted
                </Link>
                .
              </p>
            </div>

            <div>
              <SectionHeader
                eyebrow="Send a message"
                title="Tell us what breaks today."
              />
              <div className="mt-8">
                <LeadForm
                  kind="contact"
                  submitLabel="Send message"
                  intro="A sentence about the conversation you want covered is more useful than a full brief."
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <SectionHeader eyebrow="What happens next" title="No funnel, just a reply." />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {contactPage.expectations.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-line bg-ivory-light p-6"
              >
                <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <FaqSection title="Contact questions." items={contactPage.faq} />
    </>
  );
}
