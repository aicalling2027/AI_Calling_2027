"use client";

import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Loader2, Mic, Phone, PhoneOff, Send, Sparkles, Zap } from "lucide-react";

import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { type TranscriptTurn, initialsOf } from "@/content/workspace";
import { cn } from "@/lib/utils";

type Stage = "idle" | "dialling" | "live" | "ended";

const REPLIES = [
  "I understand. Let me confirm that on my side — could you share the policy number once more?",
  "That works. I can book that slot and send the confirmation on WhatsApp.",
  "Let me check the options available to you. One moment.",
  "Perfect. I have noted that. Is there anything else you would like me to include?",
  "I am not able to change that on this call, so I will arrange a callback with a specialist.",
];

export default function TalkPage() {
  return (
    <React.Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-mist" />}>
      <TalkInner />
    </React.Suspense>
  );
}

function TalkInner() {
  const search = useSearchParams();
  const { agents } = useWorkspace();
  const requested = search.get("agent");
  const [agentId, setAgentId] = React.useState(() =>
    requested && agents.some((agent) => agent.id === requested)
      ? requested
      : (agents[0]?.id ?? ""),
  );
  const [stage, setStage] = React.useState<Stage>("idle");
  const [lines, setLines] = React.useState<TranscriptTurn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [elapsed, setElapsed] = React.useState(0);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const agent = agents.find((item) => item.id === agentId) ?? agents[0];

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  React.useEffect(() => {
    if (stage !== "live") return;
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [stage]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title="No employees to talk to"
          description="Build an employee first; test calls run the saved script without charging credits."
        />
      </div>
    );
  }

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const start = () => {
    setStage("dialling");
    setElapsed(0);
    setLines([]);
    later(() => {
      setStage("live");
      setLines([{ who: "Agent", text: agent.greeting }]);
    }, 1200);
  };

  const end = () => setStage("ended");

  const send = () => {
    const text = draft.trim();
    if (!text || stage !== "live") return;
    setLines((current) => [...current, { who: "Customer", text }]);
    setDraft("");
    const reply = REPLIES[lines.filter((line) => line.who === "Customer").length % REPLIES.length];
    later(() => {
      setLines((current) => [...current, { who: "Agent", text: reply }]);
    }, 900);
  };

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Talk"
        title="Talk to an employee"
        description="A test line for every AI employee. Nothing is dialled and no credits are used — this is the same model and script a real call would use."
        actions={<Badge variant="secondary">Test mode · free</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="h-fit rounded-xl border border-line bg-surface p-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Choose an employee
          </h2>
          <ul className="mt-2 space-y-1">
            {agents.map((item) => {
              const selected = item.id === agent.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setAgentId(item.id);
                      setStage("idle");
                      setLines([]);
                      setElapsed(0);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                      selected ? "bg-cobalt-tint/60" : "hover:bg-mist",
                    )}
                  >
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-xs font-semibold text-cobalt-deep ring-1 ring-line"
                    >
                      {initialsOf(item.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {item.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-soft">
                        {item.purpose}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        item.status === "Active" ? "bg-[#1c7a4c]" : "bg-ink-soft/40",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded-lg bg-mist-soft p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Speaking
            </p>
            <p className="mt-1 text-xs text-ink">
              {agent.voice} · {agent.defaultLanguage}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {agent.languages.map((language) => (
                <Badge key={language} variant="outline">
                  {language}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
              The employee replies in whichever language you type or speak.
            </p>
          </div>
        </section>

        <section className="flex min-h-[520px] flex-col rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div className="flex items-center gap-2">
              <StatusBadge
                variant={stage === "live" ? "success" : stage === "dialling" ? "warning" : "secondary"}
              >
                {stage === "live"
                  ? "Connected"
                  : stage === "dialling"
                    ? "Dialling…"
                    : stage === "ended"
                      ? "Call ended"
                      : "Ready"}
              </StatusBadge>
              <span className="text-xs text-ink-soft">
                {agent.name} · {agent.model}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-md bg-mist px-2 py-1 font-mono text-xs text-ink-soft"
                aria-label="Call duration"
              >
                {clock}
              </span>
              {stage === "live" ? (
                <button
                  type="button"
                  onClick={end}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15"
                >
                  <PhoneOff className="size-3.5" />
                  End call
                </button>
              ) : null}
            </div>
          </div>

          {stage === "idle" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-cobalt-tint text-cobalt-deep">
                <Mic className="size-6" />
              </span>
              <p className="text-sm font-semibold text-ink">Start a test conversation</p>
              <p className="max-w-sm text-xs leading-relaxed text-ink-soft">
                You play the customer. The employee opens with
                &ldquo;{agent.greeting.slice(0, 78)}…&rdquo;
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg bg-cobalt px-4 text-sm font-semibold text-white transition-colors hover:bg-cobalt-deep"
              >
                <Phone className="size-4" />
                Start test call
              </button>
            </div>
          ) : null}

          {stage === "dialling" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Loader2 className="size-6 animate-spin text-cobalt" />
              <p className="text-sm font-medium text-ink">Connecting to {agent.name}…</p>
              <p className="text-xs text-ink-soft">Loading the script, voice and training.</p>
            </div>
          ) : null}

          {stage === "live" ? (
            <>
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                aria-live="polite"
                aria-label="Test call transcript"
              >
                {lines.map((line, index) => (
                  <div
                    key={`${line.who}-${index}`}
                    className={cn(
                      "flex max-w-[85%] flex-col gap-1",
                      line.who === "Customer" ? "ml-auto items-end" : "items-start",
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide text-ink-soft">
                      {line.who}
                    </span>
                    <p
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm leading-relaxed",
                        line.who === "Customer"
                          ? "bg-cobalt text-white"
                          : "bg-mist text-ink",
                      )}
                    >
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-hairline p-3">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                  className="flex items-center gap-2"
                >
                  <label className="sr-only" htmlFor="talk-input">
                    Say something as the customer
                  </label>
                  <input
                    id="talk-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Reply as the customer…"
                    className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="inline-flex size-9 items-center justify-center rounded-lg bg-cobalt text-white transition-colors hover:bg-cobalt-deep disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <Send className="size-4" />
                  </button>
                </form>
              </div>
            </>
          ) : null}

          {stage === "ended" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-[#e6f5ec] text-[#1c7a4c]">
                <Zap className="size-5" />
              </span>
              <p className="text-sm font-semibold text-ink">Test call finished · {clock}</p>
              <p className="max-w-sm text-xs leading-relaxed text-ink-soft">
                {lines.filter((line) => line.who === "Customer").length} customer turns were
                handled by {agent.name}. Real calls record the same transcript and an outcome.
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg bg-cobalt px-4 text-sm font-semibold text-white transition-colors hover:bg-cobalt-deep"
              >
                <Phone className="size-4" />
                Start another call
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
