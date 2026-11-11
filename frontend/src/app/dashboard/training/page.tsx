"use client";

import Link from "next/link";
import * as React from "react";
import {
  BookOpen,
  Check,
  FileText,
  FileType,
  Globe2,
  HelpCircle,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  EmptyState,
  Field,
  PageHeader,
  StatTile,
  StatusBadge,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { initialsOf } from "@/content/workspace";
import { cn } from "@/lib/utils";

type Kind = "PDF" | "DOCX" | "TXT" | "URL" | "FAQ";

const KINDS: {
  value: Kind;
  label: string;
  description: string;
  icon: typeof FileText;
  accent: string;
}[] = [
  { value: "PDF", label: "PDF", description: "Rate cards, brochures, policy PDFs", icon: FileText, accent: "#b91c1c" },
  { value: "DOCX", label: "DOCX", description: "Scripts and process documents", icon: FileText, accent: "#185adb" },
  { value: "TXT", label: "TXT", description: "Plain notes or FAQ exports", icon: FileType, accent: "#0f766e" },
  { value: "URL", label: "URL", description: "Public page the crawler can read", icon: Globe2, accent: "#b45309" },
  { value: "FAQ", label: "FAQ", description: "Question and answer pairs", icon: HelpCircle, accent: "#7c3aed" },
];

export default function TrainingPage() {
  const { agents, addKnowledge, setKnowledgeStatus, removeKnowledge } = useWorkspace();
  const [agentId, setAgentId] = React.useState(agents[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<Kind>("PDF");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const agent = agents.find((item) => item.id === agentId) ?? agents[0];
  const ready = agent ? agent.knowledge.filter((source) => source.status === "Ready") : [];
  const readiness = agent && agent.knowledge.length
    ? Math.round((ready.length / agent.knowledge.length) * 100)
    : 0;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="No employees to train"
          description="Build an employee first, then add the pricing sheets and FAQs it may quote."
          action={
            <Link href="/dashboard/employees/new" className={buttonVariants({ size: "lg" })}>
              Build an employee
            </Link>
          }
        />
      </div>
    );
  }

  const addSource = () => {
    if (!name.trim()) return;
    const id = addKnowledge(agent.id, { name: name.trim(), kind, status: "Processing" });
    setName("");
    later(() => setKnowledgeStatus(agent.id, id, "Ready"), 2600);
  };

  const ask = () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    const source = ready[0];
    later(() => {
      setAnswer(
        source
          ? `According to “${source.name}”, the answer depends on the plan you hold. ${agent.name} would quote the exact figure for the customer's policy and offer a callback if the number differs.`
          : `I have no ready training sources yet, so I would not answer that on a call. ${agent.name} would say: “Main aapko sahi jaankari nahi de sakta, main specialist se callback arrange kar dunga.”`,
      );
      setAsking(false);
    }, 900);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Training"
        title="Train your employees"
        description="Give each employee the documents and answers it needs. Sources marked Ready are quoted on calls; Processing means the index is still being built."
        actions={<Badge variant="secondary">{agents.length} employees</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Sources" value={String(agent.knowledge.length)} hint={`for ${agent.name}`} />
        <StatTile label="Ready" value={String(ready.length)} hint={`${readiness}% of the index`} />
        <StatTile label="Languages" value={String(agent.languages.length)} hint="Answers follow the caller" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
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
                      setAnswer(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                      selected ? "bg-cobalt-tint/60" : "hover:bg-mist",
                    )}
                  >
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-[11px] font-semibold text-cobalt-deep ring-1 ring-line"
                    >
                      {initialsOf(item.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {item.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-soft">
                        {item.knowledge.length} sources
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Link href="/dashboard/employees/new" className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>
              <Plus aria-hidden />
              New employee
            </Link>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink">{agent.name}&apos;s sources</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  PDF, DOCX, text, FAQ entries and public URLs are supported.
                </p>
              </div>
              <StatusBadge variant={readiness === 100 && ready.length > 0 ? "success" : "secondary"}>
                {readiness}% indexed
              </StatusBadge>
            </div>

            <div className="mt-3">
              <Progress value={readiness} aria-label="Training readiness" />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Source name or URL" htmlFor="training-source" className="flex-1">
                <TextInput
                  id="training-source"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Renewal rate sheet.pdf or https://…"
                />
              </Field>
              <Field label="Kind" htmlFor="training-kind">
                <CategoryDropdown
                  id="training-kind"
                  label="Kind"
                  size="sm"
                  className="w-32"
                  value={kind}
                  onChange={(next) => setKind(next as Kind)}
                  options={KINDS.map((item) => ({
                    value: item.value,
                    label: item.label,
                    description: item.description,
                    icon: item.icon,
                    accent: item.accent,
                  }))}
                />
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
                  title={`${agent.name} has no training yet`}
                  description="Start with the price list and the five questions customers ask most."
                />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-hairline">
                {agent.knowledge.map((source) => (
                  <li key={source.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-mist text-ink-soft">
                      {source.status === "Ready" ? (
                        <Check className="size-4" />
                      ) : source.status === "Failed" ? (
                        <HelpCircle className="size-4" />
                      ) : (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">{source.name}</p>
                      <p className="text-[11px] text-ink-soft">
                        {source.kind} · added {source.addedAt}
                      </p>
                    </div>
                    <StatusBadge
                      variant={
                        source.status === "Ready"
                          ? "success"
                          : source.status === "Failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {source.status}
                    </StatusBadge>
                    <button
                      type="button"
                      onClick={() => removeKnowledge(agent.id, source.id)}
                      className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${source.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-tangerine-tint text-tangerine-ink">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Test the training</h2>
                <p className="text-xs text-ink-soft">Ask what a customer would ask on a call.</p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask();
              }}
              className="mt-3 flex items-center gap-2"
            >
              <label className="sr-only" htmlFor="training-question">
                Question
              </label>
              <input
                id="training-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What is the waiting period for maternity cover?"
                className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15"
              />
              <button
                type="submit"
                disabled={!question.trim() || asking}
                className="inline-flex size-9 items-center justify-center rounded-lg bg-cobalt text-white transition-colors hover:bg-cobalt-deep disabled:opacity-40"
                aria-label="Ask the employee"
              >
                {asking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
            {answer ? (
              <div className="mt-3 rounded-lg bg-mist-soft p-3 text-xs leading-relaxed text-ink">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  {agent.name} would say
                </p>
                {answer}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-ink-soft">
                Answers only come from Ready sources. With none, the employee is instructed to
                offer a callback instead of guessing.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
