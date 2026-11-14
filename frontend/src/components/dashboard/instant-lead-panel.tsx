"use client";

import Link from "next/link";
import * as React from "react";
import { Check, Clock, Loader2, Phone, ShieldCheck } from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import { Field, StatusBadge, TextArea, TextInput } from "@/components/dashboard/ui/kit";
import { LanguageDropdown } from "@/components/dashboard/ui/language-dropdown";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { initialsOf, type Agent, type LeadStatus } from "@/content/workspace";
import { CALL_STEPS, DEFAULT_OUTCOMES, isInstantLead, planFor } from "@/lib/instant-call";
import { cn } from "@/lib/utils";

type CallOutcome = {
  id: string;
  outcome: string;
  status: LeadStatus;
  followUp: string;
  connected: boolean;
  credits: number;
  summary: string;
};

/** The funnel label, coloured the way the Instant Leads table colours it. */
function statusVariant(status: LeadStatus): "success" | "warning" | "outline" | "secondary" {
  if (status === "Appointment") return "warning";
  if (status === "Qualified") return "success";
  if (status === "Not interested") return "outline";
  return "secondary";
}

/**
 * "Start an instant lead" inside one employee's workspace.
 *
 * Same call as the Instant Leads screen, minus the employee picker: the
 * languages, outcomes, script and voice all come from the employee the page is
 * already about. The lead it writes is the same record, built by the same
 * `planFor`, so the two screens can never disagree about what an outcome means.
 */
export function InstantLeadPanel({
  agent,
  onEditScript,
}: {
  agent: Agent;
  onEditScript: () => void;
}) {
  const { leads, addLead, addConversation } = useWorkspace();
  const [contact, setContact] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [identity, setIdentity] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [outcomeChoice, setOutcomeChoice] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "calling" | "done">("idle");
  const [step, setStep] = React.useState(0);
  const [result, setResult] = React.useState<CallOutcome | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const outcomes = agent.outcomes.length > 0 ? agent.outcomes : DEFAULT_OUTCOMES;
  const outcome = outcomes.includes(outcomeChoice) ? outcomeChoice : outcomes[0];
  const plan = planFor(outcome);
  const languages = agent.languages.length > 0 ? agent.languages : [agent.defaultLanguage];
  const spokenLanguage = languages.includes(language) ? language : languages[0];

  /* The script is what the employee actually reads on the call, so the panel
     names the part that is still empty instead of letting a call start blind. */
  const scriptParts = [
    { label: "Intro", value: agent.greeting },
    { label: "Description", value: agent.description ?? "" },
    { label: "Objectives", value: agent.objectives ?? "" },
    { label: "Ending", value: agent.closingLine ?? "" },
  ];
  const missing = scriptParts
    .filter((part) => !part.value.trim())
    .map((part) => part.label);

  const recent = leads
    .filter((lead) => isInstantLead(lead) && lead.agentId === agent.id)
    .slice(0, 4);

  const call = () => {
    if (!contact.trim()) {
      setError("Contact name is required.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number with at least 10 digits.");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("That email address is incomplete. Fix it or leave the field blank.");
      return;
    }
    if (!consent) {
      setError("Confirm that the contact has agreed to receive this call.");
      return;
    }
    setError(null);
    setPhase("calling");
    setStep(1);
    setResult(null);

    const credits = plan.connected ? 5 : 0;
    const summary = `${outcome} on a ${spokenLanguage} call with ${contact.trim()}.${
      notes.trim() ? ` ${notes.trim()}` : ""
    }`;

    later(() => setStep(2), 900);
    later(() => setStep(3), 2100);
    later(() => {
      const id = addConversation({
        contact: contact.trim(),
        phone,
        agentId: agent.id,
        direction: "Outbound",
        outcome,
        sentiment: plan.sentiment,
        duration: plan.connected ? "1:48" : "0:30",
        credits,
        startedAt: "Just now",
        summary,
        transcript: plan.connected
          ? [
              { who: "Agent", text: agent.greeting },
              { who: "Customer", text: notes.trim() || "Haan, boliye." },
              { who: "Agent", text: plan.closing },
            ]
          : [{ who: "Agent", text: plan.closing }],
      });
      addLead({
        name: contact.trim(),
        phone,
        email: email.trim(),
        identity: identity.trim(),
        source: "Instant leads",
        agentId: agent.id,
        status: plan.status,
        followUp: plan.followUp,
        lastContact: "just now",
        summary,
      });
      setStep(4);
      setResult({
        id,
        outcome,
        status: plan.status,
        followUp: plan.followUp,
        connected: plan.connected,
        credits,
        summary,
      });
      setPhase("done");
      setContact("");
      setPhone("");
      setEmail("");
      setIdentity("");
      setNotes("");
      setConsent(false);
    }, 3200);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Start an instant lead</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {agent.name} dials within 30 seconds, reads the saved script and reports
              one outcome. The lead is written to Leads with the status that outcome
              implies.
            </p>
          </div>
          {missing.length > 0 ? (
            <div className="flex flex-col items-end gap-1">
              <Badge variant="warning">{missing.join(", ")} not written</Badge>
              <button
                type="button"
                onClick={onEditScript}
                className="text-[11px] font-medium text-cobalt hover:underline"
              >
                Edit the call script
              </button>
            </div>
          ) : (
            <Badge variant="success">
              <Check className="size-3" />
              Script ready
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-mist-soft px-3 py-2">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-[11px] font-semibold text-cobalt-deep"
          >
            {initialsOf(agent.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{agent.name}</p>
            <p className="truncate text-[11px] text-ink-soft">
              {agent.voice} · {spokenLanguage} · {agent.model}
            </p>
          </div>
          <Badge variant="outline">{outcomes.length} outcomes</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="employee-instant-name">
            <TextInput
              id="employee-instant-name"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Rohit Sharma"
            />
          </Field>
          <Field label="Phone number" htmlFor="employee-instant-phone">
            <TextInput
              id="employee-instant-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98204 11822"
              inputMode="tel"
            />
          </Field>
          <Field
            label="Email"
            hint="Optional. Used for the written follow-up."
            htmlFor="employee-instant-email"
          >
            <TextInput
              id="employee-instant-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="rohit@example.com"
              inputMode="email"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Identity"
            hint="Your reference for this customer."
            htmlFor="employee-instant-identity"
          >
            <TextInput
              id="employee-instant-identity"
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder="POL-884213"
              autoComplete="off"
            />
          </Field>
          <Field label="Language" htmlFor="employee-instant-language">
            <LanguageDropdown
              id="employee-instant-language"
              label="Language"
              value={spokenLanguage}
              onChange={setLanguage}
              options={languages}
            />
          </Field>
          <Field
            label="Outcome to report"
            hint={`Lands in Leads as ${plan.status}${
              plan.followUp === "No follow-up"
                ? " with no follow-up"
                : `, follow-up ${plan.followUp.toLowerCase()}`
            }.`}
            htmlFor="employee-instant-outcome"
          >
            <CategoryDropdown
              id="employee-instant-outcome"
              label="Outcome to report"
              value={outcome}
              onChange={setOutcomeChoice}
              options={outcomes.map((label) => ({ value: label, label }))}
            />
          </Field>
          <Field
            label="Context"
            hint="Anything the employee should know before it dials."
            htmlFor="employee-instant-notes"
            className="sm:col-span-2"
          >
            <TextArea
              id="employee-instant-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Renewal due 28 Nov, wants the 10-lakh cover."
            />
          </Field>
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 size-3.5 rounded border-line accent-cobalt"
          />
          <span>
            I confirm this contact agreed to receive the call and is not on the
            do-not-call list.
          </span>
        </label>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={call}
            disabled={phase === "calling"}
            className={cn(buttonVariants({ size: "lg" }), "disabled:opacity-60")}
          >
            {phase === "calling" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Phone className="size-4" aria-hidden />
            )}
            {phase === "calling" ? "Calling…" : "Start call"}
          </button>
          <Link
            href={`/dashboard/instant-leads?agent=${agent.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Open Instant leads
          </Link>
          <span className="text-[11px] text-ink-soft">
            Credits are charged on connect only.
          </span>
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Call progress</h2>
            {phase === "done" ? (
              plan.connected ? (
                <StatusBadge variant="success">Completed</StatusBadge>
              ) : (
                <StatusBadge variant="warning">No answer</StatusBadge>
              )
            ) : phase === "calling" ? (
              <StatusBadge variant="warning">In progress</StatusBadge>
            ) : (
              <StatusBadge variant="secondary">Waiting</StatusBadge>
            )}
          </div>

          <ol className="mt-3 space-y-2">
            {CALL_STEPS.map((label, index) => {
              // A call nobody answered stops after the dial: the later steps
              // must not turn green and claim a conversation happened.
              const done = step > index + 1 && (plan.connected || index < 2);
              const active = step === index + 1 && phase === "calling";
              return (
                <li key={label} className="flex items-center gap-2.5 text-xs">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border",
                      done
                        ? "border-cobalt bg-cobalt text-white"
                        : active
                          ? "border-cobalt bg-cobalt-tint text-cobalt-deep"
                          : "border-line bg-surface text-transparent",
                    )}
                  >
                    {done ? (
                      <Check className="size-3" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span className={done || active ? "font-medium text-ink" : "text-ink-soft"}>
                    {label}
                  </span>
                  {active ? <Loader2 className="size-3 animate-spin text-cobalt" /> : null}
                </li>
              );
            })}
          </ol>

          {result ? (
            <div
              className={cn(
                "mt-4 rounded-lg p-3 text-xs",
                result.connected ? "bg-[#e6f5ec] text-[#1c7a4c]" : "bg-cream/70 text-ink",
              )}
            >
              <p className="font-semibold">
                {result.connected ? "Call completed" : "Call ended without an answer"} ·{" "}
                {result.outcome}
              </p>
              <p className="mt-1 leading-relaxed opacity-90">{result.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{result.status}</Badge>
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <Clock className="size-3" />
                  {result.followUp}
                </span>
              </div>
              <p className="mt-1 text-[11px]">
                Reference {result.id.toUpperCase()} ·{" "}
                {result.credits > 0
                  ? `${result.credits} credits deducted`
                  : "no credits deducted"}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link href="/dashboard/leads" className="font-semibold underline">
                  Open the lead
                </Link>
                <Link href="/dashboard/conversations" className="font-semibold underline">
                  Read the transcript
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
              Calls ring for 30 seconds. If nobody answers, the lead is marked
              &ldquo;No answer&rdquo; and a retry is booked for the evening slot.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <h2 className="text-xs font-semibold text-ink">Recent instant leads</h2>
            <Link
              href={`/dashboard/instant-leads?agent=${agent.id}`}
              className="text-[11px] font-medium text-cobalt hover:underline"
            >
              All of them
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-4 text-[11px] leading-relaxed text-ink-soft">
              No instant leads for {agent.name} yet. The first one appears here the
              moment a call starts.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {recent.map((lead) => (
                <li key={lead.id} className="flex items-start gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{lead.name}</p>
                    <p className="truncate text-[11px] text-ink-soft">{lead.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                    <span className="text-[10px] text-ink-soft">{lead.followUp}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-line bg-cream/60 p-4 text-[11px] leading-relaxed text-ink-soft">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <ShieldCheck className="size-3.5" />
            Consent is recorded with the call log.
          </p>
          <p className="mt-1">
            Only a connected call is charged, so a number that never picks up costs
            nothing and still gets a retry slot.
          </p>
        </section>
      </div>
    </div>
  );
}
