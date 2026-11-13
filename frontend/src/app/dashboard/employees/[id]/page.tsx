"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  Loader2,
  Mic,
  Pause,
  Phone,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

import {
  EmptyState,
  Field,
  SaveButton,
  SelectInput,
  StatTile,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { SelectCard } from "@/components/dashboard/ui/select-card";
import { VoicePreview } from "@/components/dashboard/ui/voice-preview";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  AGENT_ACTIONS,
  type Agent,
  type AgentStatus,
  LANGUAGES,
  MODELS,
  OUTCOME_OPTIONS,
  VOICES,
  initialsOf,
  voiceById,
  voiceSampleSources,
} from "@/content/workspace";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "instant", label: "Instant leads" },
  { id: "script", label: "Call script" },
  { id: "training", label: "Training" },
  { id: "actions", label: "Actions" },
  { id: "outcomes", label: "Outcomes" },
  { id: "voices", label: "Voices" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SENTIMENT_DOT: Record<string, string> = {
  Positive: "bg-[#1c7a4c]",
  Neutral: "bg-cobalt",
  Negative: "bg-destructive",
  Unknown: "bg-ink-soft/40",
};

export default function EmployeeWorkspacePage() {
  const params = useParams<{ id: string }>();
  const store = useWorkspace();
  const agent = store.agents.find((item) => item.id === params.id);

  if (store.agentsStatus === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl border border-line bg-surface p-6 text-sm text-ink-soft">
        <Loader2 className="size-4 animate-spin" />
        Loading this employee…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title="Employee not found"
          description="It may have been archived, or this link is stale. Open My employees to pick another one."
          action={
            <Link href="/dashboard/employees" className={buttonVariants({ size: "lg" })}>
              Back to employees
            </Link>
          }
        />
      </div>
    );
  }

  // Mounted per employee so the editable fields below start from the record
  // that was actually loaded instead of an empty first render.
  return <EmployeeWorkspace key={agent.id} agent={agent} />;
}

function EmployeeWorkspace({ agent }: { agent: Agent }) {
  const store = useWorkspace();

  const [tab, setTab] = React.useState<TabId>("overview");
  const [greeting, setGreeting] = React.useState(agent?.greeting ?? "");
  const [prompt, setPrompt] = React.useState(agent?.prompt ?? "");
  const [contact, setContact] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [callResult, setCallResult] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sourceName, setSourceName] = React.useState("");
  const [sourceKind, setSourceKind] = React.useState<"PDF" | "DOCX" | "TXT" | "URL" | "FAQ">("PDF");
  const [name, setName] = React.useState(agent?.name ?? "");
  const [purpose, setPurpose] = React.useState(agent?.purpose ?? "");
  const [status, setStatus] = React.useState<AgentStatus>(agent?.status ?? "Draft");
  const [defaultLanguage, setDefaultLanguage] = React.useState(agent?.defaultLanguage ?? "Hindi");
  const [modelId, setModelId] = React.useState(agent?.modelId ?? "sarvam-24b");
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const calls = store.conversations.filter((item) => item.agentId === agent.id);
  const active = agent.status === "Active";

  const [deploying, setDeploying] = React.useState(false);
  const [deployError, setDeployError] = React.useState<string | null>(null);

  const callsEnabled = agent.calling?.enabled ?? false;
  const callingState = (agent.calling?.state ?? "not_configured").replaceAll("_", " ");

  const enableCalls = async () => {
    setDeploying(true);
    setDeployError(null);
    try {
      await store.enableCalling(agent.id);
    } catch (error) {
      setDeployError(
        error instanceof Error ? error.message : "Calls could not be enabled.",
      );
    } finally {
      setDeploying(false);
    }
  };

  const startInstantLead = () => {
    if (!contact.trim()) {
      setFormError("Contact name is required.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setFormError("Enter a phone number with at least 10 digits.");
      return;
    }
    setFormError(null);
    const id = store.addConversation({
      contact: contact.trim(),
      phone,
      agentId: agent.id,
      direction: "Outbound",
      outcome: "Callback requested",
      sentiment: "Neutral",
      duration: "1:48",
      credits: 5,
      startedAt: "Just now",
      summary: notes.trim()
        ? `Call placed from the ${agent.name} workspace. ${notes.trim()}`
        : `Call placed from the ${agent.name} workspace with the default script.`,
      transcript: [
        { who: "Agent", text: agent.greeting },
        { who: "Customer", text: notes.trim() || "Haan, boliye." },
        {
          who: "Agent",
          text: "Thank you. I have noted the details and will call back at the time you suggested.",
        },
      ],
    });
    store.addLead({
      name: contact.trim(),
      phone,
      email: "",
      source: "Instant leads",
      agentId: agent.id,
      status: "Contacted",
      followUp: "Tomorrow, 11:00 am",
      lastContact: "just now",
      summary: notes.trim() || `Instant lead created from ${agent.name}.`,
    });
    setCallResult(id);
    setContact("");
    setPhone("");
    setNotes("");
  };

  const addSource = () => {
    if (!sourceName.trim()) return;
    const id = store.addKnowledge(agent.id, {
      name: sourceName.trim(),
      kind: sourceKind,
      status: "Processing",
    });
    setSourceName("");
    later(() => store.setKnowledgeStatus(agent.id, id, "Ready"), 2600);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <Link
        href="/dashboard/employees"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All employees
      </Link>

      {/* Identity ---------------------------------------------------------- */}
      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-xl bg-cobalt-tint text-lg font-semibold text-cobalt-deep"
            >
              {initialsOf(agent.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink">
                  {agent.name}
                </h1>
                <StatusBadge
                  variant={
                    agent.status === "Active"
                      ? "success"
                      : agent.status === "Paused"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {agent.status}
                </StatusBadge>
              </div>
              <p className="text-sm text-ink-soft">{agent.purpose}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{agent.voice}</Badge>
                <Badge variant="secondary">{agent.model}</Badge>
                {agent.languages.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
                <Badge variant="outline">Created {agent.createdAt}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/talk?agent=${agent.id}`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Zap aria-hidden />
              Test call
            </Link>
            <button
              type="button"
              onClick={() =>
                store.updateAgent(agent.id, {
                  status: active ? "Paused" : "Active",
                })
              }
              className={buttonVariants({ size: "lg" })}
            >
              {active ? <Pause aria-hidden /> : <Play aria-hidden />}
              {active ? "Pause" : "Activate"}
            </button>
          </div>
        </div>
      </section>

      {/* Tabs -------------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Employee sections"
        className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === item.id
                ? "bg-cobalt-tint text-cobalt-deep"
                : "text-ink-soft hover:bg-mist hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Calls handled" value={agent.calls.toLocaleString("en-IN")} hint="All time" />
            <StatTile label="Success rate" value={`${agent.successRate}%`} hint="Outcome based" />
            <StatTile label="Knowledge" value={String(agent.knowledge.length)} hint="Sources ready" />
            <StatTile label="Last active" value={agent.lastActive} hint={agent.defaultLanguage} />
          </div>

          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink">Calls</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Nothing answers until you turn calls on. Turning them off keeps
                  the number, so call history survives and they can come back.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void enableCalls()}
                disabled={deploying || callsEnabled}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-mist px-2.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
              >
                {deploying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {callsEnabled ? "Calls are on" : "Turn on calls"}
              </button>
            </div>

            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-lg bg-mist-soft p-2">
                <dt className="text-[10px] uppercase tracking-wide text-ink-soft">Status</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {callingState}
                  {agent.calling?.simulated ? " · simulated" : ""}
                </dd>
              </div>
              <div className="rounded-lg bg-mist-soft p-2">
                <dt className="text-[10px] uppercase tracking-wide text-ink-soft">
                  Configuration
                </dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  v{agent.configurationVersion ?? 1}
                </dd>
              </div>
              <div className="rounded-lg bg-mist-soft p-2">
                <dt className="text-[10px] uppercase tracking-wide text-ink-soft">
                  Next step
                </dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {agent.calling?.actionRequired?.replaceAll("_", " ") ?? "—"}
                </dd>
              </div>
            </dl>

            {deployError ? (
              <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {deployError}
              </p>
            ) : null}
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="xl:col-span-2 rounded-xl border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Recent conversations</h2>
                <span className="text-xs text-ink-soft">{calls.length} calls</span>
              </div>
              {calls.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Phone className="size-5" />}
                    title="No calls yet"
                    description="Place a test call or trigger an instant lead to see conversations here."
                    action={
                      <button type="button" onClick={() => setTab("instant")} className={buttonVariants({ size: "lg" })}>
                        Start an instant lead
                      </button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {calls.slice(0, 5).map((call) => (
                    <li key={call.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={cn("size-2 shrink-0 rounded-full", SENTIMENT_DOT[call.sentiment])} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{call.contact}</p>
                        <p className="truncate text-[11px] text-ink-soft">
                          {call.outcome} · {call.duration} · {call.startedAt}
                        </p>
                      </div>
                      <Badge variant={call.direction === "Inbound" ? "secondary" : "outline"}>
                        {call.direction}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">What this employee can do</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.actions.length === 0 ? (
                  <p className="text-xs text-ink-soft">
                    No actions yet. Add them in the Actions tab.
                  </p>
                ) : (
                  agent.actions.map((action) => (
                    <Badge key={action} variant="secondary">
                      <Check className="size-3" />
                      {action}
                    </Badge>
                  ))
                )}
              </div>
              <h3 className="mt-4 text-xs font-semibold text-ink">Outcomes</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.outcomes.length === 0 ? (
                  <p className="text-xs text-ink-soft">No outcomes configured.</p>
                ) : (
                  agent.outcomes.map((outcome) => (
                    <Badge key={outcome} variant="outline">
                      {outcome}
                    </Badge>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setTab("script")}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-mist px-2.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
              >
                <FileText className="size-3.5" />
                Edit the call script
              </button>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "instant" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">Start an instant lead</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {agent.name} calls the contact within 30 seconds using the saved script.
            </p>
            <div className="mt-4 space-y-3">
              <Field label="Contact name" htmlFor="instant-contact">
                <TextInput
                  id="instant-contact"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
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
                label="Context for the employee"
                hint="Optional. The employee opens with the saved greeting."
                htmlFor="instant-notes"
              >
                <TextArea
                  id="instant-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Asked about the family floater renewal."
                />
              </Field>
              {formError ? (
                <p role="alert" className="text-xs text-destructive">
                  {formError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={startInstantLead}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-cobalt px-3.5 text-sm font-medium text-white transition-colors hover:bg-cobalt-deep"
              >
                <Phone className="size-4" />
                Start call
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">What happens next</h2>
            <ol className="mt-3 space-y-2.5">
              {[
                "The call is queued and the number is dialled from the active line.",
                "The employee follows the call script and captures the outcome.",
                "The contact appears in Leads & results with a summary.",
                "Credits are deducted for the connected duration only.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-ink-soft">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-mist text-[10px] font-semibold text-ink">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {callResult ? (
              <div className="mt-4 rounded-lg bg-[#e6f5ec] p-3 text-xs text-[#1c7a4c]">
                <p className="font-semibold">Call queued</p>
                <p className="mt-0.5">
                  Reference {callResult.toUpperCase()}. The lead and the summary are now in the
                  leads module.
                </p>
                <Link href="/dashboard/leads" className="mt-1.5 inline-block font-semibold underline">
                  Open Leads &amp; results
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "script" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Call script</h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                Used on every call. Keep the opening line short and the rules explicit.
              </p>
            </div>
            <Badge variant="outline">{agent.defaultLanguage}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            <Field label="Opening line" htmlFor="script-greeting">
              <TextArea
                id="script-greeting"
                value={greeting}
                onChange={(event) => setGreeting(event.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Instruction block" htmlFor="script-prompt">
              <TextArea
                id="script-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={9}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <SaveButton onSave={() => store.updateAgent(agent.id, { greeting, prompt })} />
            <span className="text-[11px] text-ink-soft">
              Saved scripts apply to the next call, not the one in progress.
            </span>
          </div>
        </section>
      ) : null}

      {tab === "training" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Knowledge sources</h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                Pricing sheets, FAQs and policies the employee may quote on a call.
              </p>
            </div>
            <Badge variant="secondary">{agent.knowledge.length} sources</Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Source name or URL" htmlFor="source-name" className="flex-1">
              <TextInput
                id="source-name"
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                placeholder="Renewal rate sheet.pdf or https://…"
              />
            </Field>
            <Field label="Kind" htmlFor="source-kind">
              <SelectInput
                id="source-kind"
                value={sourceKind}
                onChange={(event) =>
                  setSourceKind(event.target.value as typeof sourceKind)
                }
              >
                {["PDF", "DOCX", "TXT", "URL", "FAQ"].map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <button
              type="button"
              onClick={addSource}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-cobalt px-3 text-sm font-medium text-white transition-colors hover:bg-cobalt-deep"
            >
              <Plus className="size-4" />
              Add source
            </button>
          </div>

          {agent.knowledge.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<BookOpen className="size-5" />}
                title="No training yet"
                description="Add a pricing sheet or FAQ so the employee stops guessing. PDF, DOCX, text and URLs are supported."
              />
            </div>
          ) : (
            <table className="mt-4 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="py-2 font-semibold">Source</th>
                  <th scope="col" className="py-2 font-semibold">Kind</th>
                  <th scope="col" className="py-2 font-semibold">Status</th>
                  <th scope="col" className="py-2 font-semibold">Added</th>
                  <th scope="col" className="py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {agent.knowledge.map((source) => (
                  <tr key={source.id}>
                    <td className="max-w-[280px] truncate py-2.5 font-medium text-ink">
                      {source.name}
                    </td>
                    <td className="py-2.5 text-ink-soft">{source.kind}</td>
                    <td className="py-2.5">
                      <Badge
                        variant={
                          source.status === "Ready"
                            ? "success"
                            : source.status === "Failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {source.status === "Processing" ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        {source.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-ink-soft">{source.addedAt}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => store.removeKnowledge(agent.id, source.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-ink-soft transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === "actions" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Allowed actions</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            What the employee may do mid-call. Anything not selected is refused.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {AGENT_ACTIONS.map((action) => {
              const enabled = agent.actions.includes(action);
              return (
                <button
                  key={action}
                  type="button"
                  aria-pressed={enabled}
                  onClick={() =>
                    store.updateAgent(agent.id, {
                      actions: enabled
                        ? agent.actions.filter((item) => item !== action)
                        : [...agent.actions, action],
                    })
                  }
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                    enabled
                      ? "border-cobalt/40 bg-cobalt-tint/50 text-cobalt-deep"
                      : "border-line bg-surface text-ink-soft hover:border-cobalt/30 hover:text-ink",
                  )}
                >
                  {action}
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 place-items-center rounded-full border",
                      enabled ? "border-cobalt bg-cobalt text-white" : "border-line text-transparent",
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "outcomes" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Outcomes to report</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Each call ends with exactly one outcome, used in the dashboard charts.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {OUTCOME_OPTIONS.map((outcome) => {
              const enabled = agent.outcomes.includes(outcome);
              return (
                <button
                  key={outcome}
                  type="button"
                  aria-pressed={enabled}
                  onClick={() =>
                    store.updateAgent(agent.id, {
                      outcomes: enabled
                        ? agent.outcomes.filter((item) => item !== outcome)
                        : [...agent.outcomes, outcome],
                    })
                  }
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
                    enabled
                      ? "border-cobalt/40 bg-cobalt-tint text-cobalt-deep"
                      : "border-line bg-surface text-ink-soft hover:border-cobalt/30 hover:text-ink",
                  )}
                >
                  {enabled ? <Check className="size-3" /> : null}
                  {outcome}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "voices" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Voice</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Changing the voice does not change the script. Preview before you switch.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {VOICES.map((voice, index) => (
              <SelectCard
                key={voice.id}
                selected={agent.voiceId === voice.id}
                onSelect={() =>
                  store.updateAgent(agent.id, { voiceId: voice.id, voice: voice.name })
                }
                title={voice.name}
                description={
                  voice.gender === "Unspecified"
                    ? voice.tone
                    : `${voice.gender} · ${voice.tone}`
                }
                meta={voice.language}
                icon={<Mic className="size-4" />}
              >
                <VoicePreview
                  sources={voiceSampleSources(voice, index + 1)}
                  label="Preview"
                />
              </SelectCard>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Employee settings</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Identity changes are audited. Deleting an employee removes its training.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="settings-name">
              <TextInput
                id="settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Role" htmlFor="settings-purpose">
              <TextInput
                id="settings-purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              />
            </Field>
            <Field label="Status" htmlFor="settings-status">
              <SelectInput
                id="settings-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as AgentStatus)}
              >
                {(["Active", "Paused", "Draft"] as AgentStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="First language" htmlFor="settings-language">
              <SelectInput
                id="settings-language"
                value={defaultLanguage}
                onChange={(event) => setDefaultLanguage(event.target.value)}
              >
                {agent.languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Model" htmlFor="settings-model" className="sm:col-span-2">
              <SelectInput
                id="settings-model"
                value={modelId}
                onChange={(event) =>
                  setModelId(event.target.value as typeof agent.modelId)
                }
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} · {model.speed}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SaveButton
              onSave={() =>
                store.updateAgent(agent.id, {
                  name: name.trim() || agent.name,
                  purpose: purpose.trim() || agent.purpose,
                  status,
                  defaultLanguage,
                  modelId,
                  model: MODELS.find((model) => model.id === modelId)?.name ?? agent.model,
                })
              }
            />
            <p className="ml-auto max-w-[40ch] text-right text-[11px] text-ink-soft">
              Employees are never deleted. Pause one instead - its agent, call history
              and phone number are kept.
            </p>
          </div>
          <p className="mt-3 text-[11px] text-ink-soft">
            Voice: {voiceById(agent.voiceId).name} · Languages: {agent.languages.join(", ")} ·
            Available in {LANGUAGES.length} Indian languages
          </p>
        </section>
      ) : null}
    </div>
  );
}
