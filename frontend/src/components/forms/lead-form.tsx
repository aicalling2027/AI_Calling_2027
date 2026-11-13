"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { FlowButton } from "@/components/ui/flow-button";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type FormKind = "contact" | "trial";

type Status = "idle" | "submitting" | "sent" | "failed" | "unconfigured";

type LeadFormProps = {
  kind: FormKind;
  submitLabel: string;
  /** Shown above the fields; use it to set expectations honestly. */
  intro?: string;
};

const useCaseOptions = [
  "Answer incoming calls",
  "Call a list of contacts",
  "Call new leads instantly",
  "Qualify and route enquiries",
  "Not sure yet",
];

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-hairline bg-ivory-light px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/70 focus:border-blue focus:ring-2 focus:ring-blue/20";

const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft";

/**
 * Lead capture form.
 *
 * It never pretends to have sent something. Without a configured endpoint the
 * submission is turned into a prepared email so the request still reaches a
 * person; with an endpoint it performs a real POST and reports the real result.
 */
export function LeadForm({ kind, submitLabel, intro }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [mailto, setMailto] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Honeypot: real users never fill this in.
    if (data.get("company_website")) {
      return;
    }

    const payload = {
      kind,
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      company: String(data.get("company") ?? ""),
      phone: String(data.get("phone") ?? ""),
      useCase: String(data.get("useCase") ?? ""),
      message: String(data.get("message") ?? ""),
      source: typeof window === "undefined" ? "" : window.location.pathname,
    };

    const endpoint = site.formEndpoint;

    if (!endpoint) {
      const subject = encodeURIComponent(
        `${kind === "trial" ? "Access request" : "Website enquiry"} — ${payload.company || payload.name}`,
      );
      const body = encodeURIComponent(
        [
          `Name: ${payload.name}`,
          `Email: ${payload.email}`,
          `Company: ${payload.company}`,
          `Phone: ${payload.phone}`,
          `Use case: ${payload.useCase}`,
          "",
          payload.message,
        ].join("\n"),
      );
      setMailto(`mailto:${site.contact.salesEmail}?subject=${subject}&body=${body}`);
      setStatus("unconfigured");
      setMessage(
        "This form is not connected to a submission endpoint yet, so nothing was sent automatically.",
      );
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      form.reset();
      setStatus("sent");
      setMessage("Thanks — the request reached the AOTMS team.");
    } catch {
      setStatus("failed");
      setMessage(
        "The request could not be delivered. Please email us directly instead.",
      );
      setMailto(`mailto:${site.contact.salesEmail}`);
    }
  }

  return (
    <div className="card p-5 md:p-7">
      {intro ? (
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">{intro}</p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate={false} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`${kind}-name`}>
              Full name
            </label>
            <input
              id={`${kind}-name`}
              name="name"
              type="text"
              required
              autoComplete="name"
              className={fieldClass}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor={`${kind}-email`}>
              Work email
            </label>
            <input
              id={`${kind}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              className={fieldClass}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor={`${kind}-company`}>
              Company
            </label>
            <input
              id={`${kind}-company`}
              name="company"
              type="text"
              required
              autoComplete="organization"
              className={fieldClass}
              placeholder="Company name"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor={`${kind}-phone`}>
              Phone <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id={`${kind}-phone`}
              name="phone"
              type="tel"
              autoComplete="tel"
              className={fieldClass}
              placeholder="+91"
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${kind}-use-case`}>
            What should we cover first?
          </label>
          <select
            id={`${kind}-use-case`}
            name="useCase"
            className={fieldClass}
            defaultValue={useCaseOptions[0]}
          >
            {useCaseOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${kind}-message`}>
            {kind === "trial" ? "What do you want to automate?" : "How can we help?"}
          </label>
          <textarea
            id={`${kind}-message`}
            name="message"
            rows={4}
            className={cn(fieldClass, "resize-y")}
            placeholder="A sentence or two is enough."
          />
        </div>

        {/* Honeypot — hidden from assistive tech and users. */}
        <div aria-hidden className="hidden">
          <label htmlFor={`${kind}-website`}>Company website</label>
          <input id={`${kind}-website`} name="company_website" type="text" tabIndex={-1} />
        </div>

        <div className="flex items-start gap-3">
          <input
            id={`${kind}-consent`}
            name="consent"
            type="checkbox"
            required
            className="mt-0.5 size-4 rounded border-hairline text-blue accent-blue"
          />
          <label htmlFor={`${kind}-consent`} className="text-xs leading-relaxed text-ink-soft">
            I agree to be contacted about this enquiry. Submitted details are used only
            to respond to it.
          </label>
        </div>

        {/* The same CTA as the rest of the page, in submit form: `type`
            overrides the component's `button` default, so Enter still submits. */}
        <FlowButton
          type="submit"
          size="lg"
          disabled={status === "submitting"}
          className="w-full gap-2 sm:w-auto"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending
            </>
          ) : (
            submitLabel
          )}
        </FlowButton>

        <div role="status" aria-live="polite" className="text-sm">
          {status === "sent" ? (
            <p className="flex items-start gap-2 rounded-xl bg-blue-tint px-3.5 py-3 text-blue-deep">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              {message}
            </p>
          ) : null}

          {status === "unconfigured" || status === "failed" ? (
            <div className="rounded-xl border border-line bg-ivory-light px-3.5 py-3">
              <p className="text-ink-soft">{message}</p>
              {mailto ? (
                <a
                  href={mailto}
                  className="mt-2 inline-block font-semibold text-blue underline underline-offset-4 hover:text-blue-deep"
                >
                  Open a prepared email instead
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
