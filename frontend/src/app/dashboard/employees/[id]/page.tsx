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
import { InstantLeadPanel } from "@/components/dashboard/instant-lead-panel";
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
  voicePreviewUrl,
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

/** Limits worth starting from. Clicking one appends it as its own line. */
const RULE_PRESETS = [
  {
    label: "No unapproved prices",
    rule: "Never quote a price that is not in the approved sheet.",
  },
  {
    label: "Respect do-not-call",
    rule: "Stop calling as soon as the customer asks not to be contacted.",
  },
  {
    label: "Escalate on request",
    rule: "Offer a human transfer when the caller asks twice.",
  },
];

const wordsIn = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

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
  const [description, setDescription] = React.useState(agent?.description ?? "");
  const [objectives, setObjectives] = React.useState(agent?.objectives ?? "");
  const [rules, setRules] = React.useState(agent?.rules ?? "");
  const [closingLine, setClosingLine] = React.useState(agent?.closingLine ?? "");
  const [closingRules, setClosingRules] = React.useState(agent?.closingRules ?? "");
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

  /* -- Call script -------------------------------------------------------
     Six fields saved together. One dirty flag keeps the tab honest about
     whether what is on screen is what the next call will actually read. */
  const scriptDirty =
    greeting !== (agent.greeting ?? "") ||
    description !== (agent.description ?? "") ||
    objectives !== (agent.objectives ?? "") ||
    rules !== (agent.rules ?? "") ||
    closingLine !== (agent.closingLine ?? "") ||
    closingRules !== (agent.closingRules ?? "") ||
    prompt !== (agent.prompt ?? "");

  const spokenWords =
    wordsIn(greeting) + wordsIn(description) + wordsIn(objectives) + wordsIn(closingLine);
  const spokenSeconds = Math.max(1, Math.round(spokenWords / 2.5));

  const saveScript = () => {
    store.updateAgent(agent.id, {
      greeting,
      description,
      objectives,
      rules,
      closingLine,
      closingRules,
      prompt,
    });
  };

  const discardScript = () => {
    setGreeting(agent.greeting ?? "");
    setDescription(agent.description ?? "");
    setObjectives(agent.objectives ?? "");
    setRules(agent.rules ?? "");
    setClosingLine(agent.closingLine ?? "");
    setClosingRules(agent.closingRules ?? "");
    setPrompt(agent.prompt ?? "");
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
              href={`/dashboard/instant-leads?agent=${agent.id}`}
              className={buttonVariants({ size: "lg" })}
            >
              <Phone aria-hidden />
              Instant lead
            </Link>
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
              className={buttonVariants({ variant: "outline", size: "lg" })}
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
        <InstantLeadPanel agent={agent} onEditScript={() => setTab("script")} />
      ) : null}

      {tab === "script" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink">Call script</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Read in order on every call: the intro opens, the description sets the
                  subject, the objectives and rules keep it on track, the ending closes it.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{agent.defaultLanguage}</Badge>
                <Badge variant="secondary">v{agent.configurationVersion ?? 1}</Badge>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <ScriptBlock
                step="1"
                title="Intro"
                hint="The first sentence, spoken before anything else. Keep it under 15 seconds."
                meta={`${wordsIn(greeting)} words`}
              >
                <TextArea
                  id="script-greeting"
                  value={greeting}
                  onChange={(event) => setGreeting(event.target.value)}
                  rows={2}
                  placeholder="Namaste, main Aarav bol raha hoon…"
                />
              </ScriptBlock>

              <ScriptBlock
                step="2"
                title="Description"
                hint="What the call is about, in plain language. It keeps the employee on subject."
                meta={`${wordsIn(description)} words`}
              >
                <TextArea
                  id="script-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Calls policyholders whose health cover is due for renewal…"
                />
              </ScriptBlock>

              <ScriptBlock
                step="3"
                title="Objectives"
                hint="What a good call has to achieve. One aim per line, in the order they matter."
                meta={`${wordsIn(objectives)} words`}
              >
                <TextArea
                  id="script-objectives"
                  value={objectives}
                  onChange={(event) => setObjectives(event.target.value)}
                  rows={4}
                  placeholder={"Confirm the policy is still wanted.\nState the renewal amount."}
                />
              </ScriptBlock>

              <ScriptBlock
                step="4"
                title="Rules"
                hint="Hard limits. Anything written here outranks the objectives."
              >
                <TextArea
                  id="script-rules"
                  value={rules}
                  onChange={(event) => setRules(event.target.value)}
                  rows={4}
                  placeholder="Never quote a premium that is not in the rate sheet."
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {RULE_PRESETS.map(({ label, rule }) => {
                    const added = rules.includes(rule);
                    return (
                      <button
                        key={rule}
                        type="button"
                        disabled={added}
                        title={rule}
                        onClick={() =>
                          setRules((current) =>
                            current.trim() ? `${current.trimEnd()}\n${rule}` : rule,
                          )
                        }
                        className={cn(
                          "rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
                          added
                            ? "border-line bg-mist text-ink-soft"
                            : "border-line bg-surface text-ink hover:border-cobalt/40 hover:text-cobalt-deep",
                        )}
                      >
                        {added ? `${label} · added` : `+ ${label}`}
                      </button>
                    );
                  })}
                </div>
              </ScriptBlock>

              <ScriptBlock
                step="5"
                title="Ending"
                hint="The last line the customer hears, and when the employee may hang up."
              >
                <TextArea
                  id="script-closing-line"
                  value={closingLine}
                  onChange={(event) => setClosingLine(event.target.value)}
                  rows={2}
                  placeholder="Dhanyavaad. Confirmation WhatsApp par bhej raha hoon."
                />
                <label
                  htmlFor="script-closing-rules"
                  className="mt-2 block text-[11px] font-semibold text-ink-soft"
                >
                  Closing rules
                </label>
                <TextArea
                  id="script-closing-rules"
                  value={closingRules}
                  onChange={(event) => setClosingRules(event.target.value)}
                  rows={2}
                  className="mt-1"
                  placeholder="End only after the customer confirms the next step."
                />
              </ScriptBlock>
            </div>

            <details className="mt-3 rounded-lg border border-hairline bg-mist-soft/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink">
                Instruction block
                <span className="ml-1.5 font-normal text-ink-soft">
                  Advanced · the full system prompt
                </span>
              </summary>
              <div className="mt-2.5">
                <TextArea
                  id="script-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={9}
                />
              </div>
            </details>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SaveButton label="Save script" onSave={saveScript} />
              <button
                type="button"
                onClick={discardScript}
                disabled={!scriptDirty}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-ink-soft transition-colors hover:bg-white hover:text-ink disabled:pointer-events-none disabled:opacity-50"
              >
                Discard changes
              </button>
              <span className="text-[11px] text-ink-soft">
                {scriptDirty
                  ? "Unsaved edits. A saved script applies to the next call, not the one in progress."
                  : "Saved. Applies to the next call, not the one in progress."}
              </span>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">How the call reads</h2>
                <Badge variant={scriptDirty ? "warning" : "success"}>
                  {scriptDirty ? "Unsaved" : "Saved"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                {agent.name} speaks {agent.defaultLanguage} in {agent.voice}.
              </p>
              <ol className="mt-3 space-y-2">
                {[
                  { label: "Intro", text: greeting },
                  { label: "Description", text: description },
                  { label: "Objectives", text: objectives },
                  { label: "Rules", text: rules },
                  { label: "Ending", text: closingLine },
                ].map((part) => (
                  <li key={part.label} className="rounded-lg bg-mist-soft/60 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                      {part.label}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 whitespace-pre-line text-[11px] leading-relaxed",
                        part.text.trim() ? "text-ink" : "text-ink-soft/70",
                      )}
                    >
                      {part.text.trim() || "Not written yet."}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
                <span>{spokenWords} words spoken</span>
                <span>≈ {spokenSeconds} s</span>
              </p>
              <Link
                href={`/dashboard/talk?agent=${agent.id}`}
                className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3 w-full" })}
              >
                <Phone aria-hidden />
                Run a test call
              </Link>
            </section>

            <section className="rounded-xl border border-line bg-cream/60 p-4">
              <h2 className="text-xs font-semibold text-ink">Bounds the call cannot cross</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                {agent.actions.length > 0
                  ? `It may only ${agent.actions.join(", ").toLowerCase()} — anything else is refused mid-call.`
                  : "No actions are allowed yet, so the call can only talk and take notes."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.outcomes.length > 0 ? (
                  agent.outcomes.map((outcome) => (
                    <Badge key={outcome} variant="outline">
                      {outcome}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-ink-soft">No outcomes chosen yet.</span>
                )}
              </div>
            </section>
          </aside>
        </div>
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
                {/* Same rule as the creation step: no speaker name, no sample. */}
                {voice.slug ? (
                  <VoicePreview
                    sources={voiceSampleSources(voice, index + 1)}
                    apiUrl={voicePreviewUrl(voice)}
                    label="Preview"
                  />
                ) : null}
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

/** One numbered part of the call script, with its own label and hint. */
function ScriptBlock({
  step,
  title,
  hint,
  meta,
  children,
}: {
  step: string;
  title: string;
  hint: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mist text-[10px] font-semibold text-ink"
          >
            {step}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{hint}</p>
          </div>
        </div>
        {meta ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-soft">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
