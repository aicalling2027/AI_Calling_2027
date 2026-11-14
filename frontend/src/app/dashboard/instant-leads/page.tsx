"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Phone,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import { LeadImportCard } from "@/components/dashboard/lead-import-card";
import { LeadRowActions } from "@/components/dashboard/lead-row-actions";
import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  Field,
  PageHeader,
  StatTile,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { LanguageDropdown } from "@/components/dashboard/ui/language-dropdown";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { initialsOf, type Lead, type LeadStatus } from "@/content/workspace";
import { CALL_STEPS, DEFAULT_OUTCOMES, isInstantLead, planFor } from "@/lib/instant-call";
import { phoneKey } from "@/lib/lead-import";
import { cn } from "@/lib/utils";

/**
 * The screen reads `?agent=` so an employee's workspace can hand over to it
 * with that employee already picked. `useSearchParams` needs a boundary, so
 * the page itself only renders the inner component.
 */
export default function InstantLeadsPage() {
  return (
    <React.Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-mist" />}>
      <InstantLeadsInner />
    </React.Suspense>
  );
}

function InstantLeadsInner() {
  const search = useSearchParams();
  const requestedAgent = search.get("agent") ?? "";
  const {
    agents,
    leads,
    addConversation,
    addLead,
    refreshLeads,
    leadsStatus,
    leadsError,
  } = useWorkspace();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [identity, setIdentity] = React.useState("");
  const [agentChoice, setAgentChoice] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [outcomeChoice, setOutcomeChoice] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "calling" | "done">("idle");
  const [step, setStep] = React.useState(0);
  const [result, setResult] = React.useState<{
    id: string;
    outcome: string;
    status: LeadStatus;
    followUp: string;
    connected: boolean;
    credits: number;
    summary: string;
  } | null>(null);
  /* The phone number of the lead this session just created, so its row can be
     marked instead of leaving the person to hunt for it in the table. */
  const [justCalled, setJustCalled] = React.useState<string | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // The employee list arrives after the first paint, so the employee is
  // resolved during the render: the one the person picked, else the one the
  // link asked for (`?agent=`), else the first on the account.
  const agent =
    agents.find((item) => item.id === agentChoice) ??
    agents.find((item) => item.id === requestedAgent) ??
    agents[0];
  const agentId = agent?.id ?? "";
  /* Everything below is read from the selected employee, so the form can only
     offer a language it speaks and an outcome it is allowed to report. */
  const outcomes = agent?.outcomes.length ? agent.outcomes : DEFAULT_OUTCOMES;
  const outcome = outcomes.includes(outcomeChoice) ? outcomeChoice : outcomes[0];
  const plan = planFor(outcome);
  const languages = agent?.languages.length
    ? agent.languages
    : [agent?.defaultLanguage ?? "Hindi"];
  const spokenLanguage = languages.includes(language) ? language : languages[0];
  const instantLeads = leads.filter(isInstantLead);
  const justAdded = (lead: Lead) =>
    justCalled !== null && phoneKey(lead.phone) === phoneKey(justCalled);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const call = () => {
    if (!agent) return;
    if (!name.trim()) {
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
    setJustCalled(null);

    const credits = plan.connected ? 5 : 0;
    const summary = `${outcome} on a ${spokenLanguage} call with ${name.trim()}.${
      notes.trim() ? ` ${notes.trim()}` : ""
    }`;

    later(() => setStep(2), 900);
    later(() => setStep(3), 2100);
    later(() => {
      const id = addConversation({
        contact: name.trim(),
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
        name: name.trim(),
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
      setJustCalled(phone);
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
      setName("");
      setPhone("");
      setEmail("");
      setIdentity("");
      setNotes("");
      setConsent(false);
    }, 3200);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Instant leads"
        title="Call a lead instantly"
        description="Paste a number, pick the employee and the call starts within seconds. Use it for web forms, WhatsApp enquiries and walk-ins."
        actions={<Badge variant="success"><Sparkles className="size-3" /> Live</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Instant leads" value={String(instantLeads.length)} hint="All time" />
        <StatTile
          label="Queued today"
          value={String(phase === "calling" ? 1 + instantLeads.length : instantLeads.length)}
          hint="Includes the call in progress"
        />
        <StatTile label="Average pickup" value="6.4 s" hint="Last 30 days" />
        <StatTile label="Credits per call" value="5" hint="Charged on connect only" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">New instant lead</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            The employee uses the saved script and reports one outcome at the end.
            The languages, the capabilities and the outcome list are read from the
            employee you pick, so the lead record matches what it can actually do.
          </p>
          {agent && agent.id === requestedAgent ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-cobalt-deep">
              <Check className="size-3" aria-hidden />
              Opened from {agent.name}&apos;s workspace, with that employee selected.
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Contact name" htmlFor="instant-name">
              <TextInput
                id="instant-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Rohit Sharma"
              />
            </Field>
            <Field label="Phone number" htmlFor="instant-phone">
              <TextInput
                id="instant-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98204 11822"
                inputMode="tel"
              />
            </Field>
            <Field
              label="Email"
              hint="Optional. Used for the written follow-up."
              htmlFor="instant-email"
            >
              <TextInput
                id="instant-email"
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
              htmlFor="instant-identity"
            >
              <TextInput
                id="instant-identity"
                value={identity}
                onChange={(event) => setIdentity(event.target.value)}
                placeholder="POL-884213"
                autoComplete="off"
              />
            </Field>
            <Field label="Employee" htmlFor="instant-agent">
              <CategoryDropdown
                id="instant-agent"
                label="Employee"
                value={agentId}
                onChange={(next) => {
                  const found = agents.find((item) => item.id === next);
                  setAgentChoice(next);
                  if (found) setLanguage(found.defaultLanguage);
                }}
                options={agents.map((item) => ({
                  value: item.id,
                  label: item.name,
                  description: item.purpose,
                  badge: initialsOf(item.name),
                  accent: "#185adb",
                }))}
              />
            </Field>
            <Field label="Language" htmlFor="instant-language">
              <LanguageDropdown
                id="instant-language"
                label="Language"
                value={spokenLanguage}
                onChange={setLanguage}
                options={languages}
              />
            </Field>
            {agent && agent.actions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-medium text-ink-soft">
                  On the call it can
                </span>
                {agent.actions.map((action) => (
                  <Badge key={action} variant="outline">
                    {action}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Field
              label="Outcome to report"
              hint={
                agent
                  ? `Reported when the call ends. Lands in Leads as ${plan.status}${
                      plan.followUp === "No follow-up"
                        ? " with no follow-up"
                        : `, follow-up ${plan.followUp.toLowerCase()}`
                    }.`
                  : "Pick an employee first."
              }
              htmlFor="instant-outcome"
              className="sm:col-span-2"
            >
              <CategoryDropdown
                id="instant-outcome"
                label="Outcome to report"
                value={outcome}
                onChange={setOutcomeChoice}
                options={outcomes.map((label) => ({ value: label, label }))}
              />
            </Field>
            <Field
              label="Context"
              hint="Anything the employee should know before it dials."
              htmlFor="instant-notes"
              className="sm:col-span-2"
            >
              <TextArea
                id="instant-notes"
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
              disabled={phase === "calling" || !agent}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-cobalt px-4 text-sm font-semibold text-white transition-colors hover:bg-cobalt-deep disabled:opacity-60"
            >
              {phase === "calling" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Phone className="size-4" />
              )}
              {phase === "calling" ? "Calling…" : "Call now"}
            </button>
            <span className="text-[11px] text-ink-soft">
              {agent
                ? `${agent.name} · ${agent.voice} · ${spokenLanguage}`
                : "No employee available"}
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
                      {done ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
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
                  result.connected
                    ? "bg-[#e6f5ec] text-[#1c7a4c]"
                    : "bg-cream/70 text-ink",
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
                <div className="mt-2 flex gap-3">
                  <Link href="/dashboard/conversations" className="font-semibold underline">
                    Open transcript
                  </Link>
                  <Link href="/dashboard/leads" className="font-semibold underline">
                    View lead
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
                Calls ring for 30 seconds. If nobody answers, the lead is marked
                &ldquo;No answer&rdquo; and a retry is scheduled for the evening slot.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-cream/60 p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Timer className="size-3.5" />
              Speed matters
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Leads called within a minute of submitting a form convert about four
              times better than a callback the next day.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-soft">
              <ShieldCheck className="size-3.5" />
              Consent is recorded with the call log.
            </p>
          </section>
        </div>

        {/* Third grid child: it lands under the form, so the sheet you want to
            import sits beside the call it belongs to rather than below the
            whole page. */}
        <LeadImportCard employeeId={agentId} />
      </div>

      {leadsStatus === "error" ? (
        <div
          role="status"
          className="flex flex-wrap items-start gap-2 rounded-xl border border-line bg-cream/60 px-4 py-3 text-xs text-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9a6b00]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">The saved lead list could not be read.</p>
            <p className="mt-0.5 leading-relaxed text-ink-soft">
              {leadsError ?? "The server did not answer."} Leads added on this screen
              stay here; retry to read the saved list again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshLeads()}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Recent instant leads</h2>
          <Link href="/dashboard/leads" className="text-xs font-medium text-cobalt hover:underline">
            All leads
          </Link>
        </div>
        {instantLeads.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-ink-soft">
            No instant leads yet. Add one above, or place a call and it lands here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Follow-up</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Summary</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {instantLeads.map((lead) => (
                  <tr key={lead.id} className={justAdded(lead) ? "bg-cobalt-tint/30" : undefined}>
                    <td className="px-4 py-2.5">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                        {lead.name}
                        {justAdded(lead) ? <Badge variant="outline">Just added</Badge> : null}
                      </p>
                      <p className="text-[11px] text-ink-soft">{lead.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {lead.agentId ? (
                        <Link
                          href={`/dashboard/employees/${lead.agentId}`}
                          className="transition-colors hover:text-ink hover:underline"
                        >
                          {agents.find((item) => item.id === lead.agentId)?.name ?? "Open employee"}
                        </Link>
                      ) : (
                        "Unassigned"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          lead.status === "Appointment"
                            ? "warning"
                            : lead.status === "Qualified"
                              ? "success"
                              : lead.status === "Not interested"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {lead.followUp}
                      </span>
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-ink-soft">
                      {lead.summary}
                    </td>
                    <td className="px-4 py-2.5">
                      <LeadRowActions lead={lead} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/campaigns" className={buttonVariants({ variant: "outline" })}>
          Send a bulk campaign instead
        </Link>
        <Link href="/dashboard/employees" className={buttonVariants({ variant: "ghost" })}>
          Change the employee script
        </Link>
      </div>
    </div>
  );
}
