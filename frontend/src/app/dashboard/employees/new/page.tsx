"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  ArrowLeft,
  Building2,
  Cpu,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  Field,
  PageHeader,
  TextArea,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { LanguageDropdown } from "@/components/dashboard/ui/language-dropdown";
import { SelectCard } from "@/components/dashboard/ui/select-card";
import { VoicePreview } from "@/components/dashboard/ui/voice-preview";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  BUSINESS_CATEGORIES,
  MODELS,
  type ModelId,
  TEMPLATES,
  VOICES,
  type VoiceId,
  initialsOf,
  templateById,
  voiceById,
  voiceSampleSources,
} from "@/content/workspace";
import { cn } from "@/lib/utils";

const SAMPLE_DICTATION =
  " Always stay polite, confirm the customer's name at the start, and never promise a discount without approval.";

export default function NewEmployeePage() {
  const router = useRouter();
  const { addAgent, addKnowledge, agents } = useWorkspace();

  const [templateId, setTemplateId] = React.useState(TEMPLATES[0].id);
  const [name, setName] = React.useState("");
  const [purpose, setPurpose] = React.useState(TEMPLATES[0].role);
  const [category, setCategory] = React.useState(TEMPLATES[0].category);
  const [languages, setLanguages] = React.useState<string[]>(TEMPLATES[0].languages);
  const [defaultLanguage, setDefaultLanguage] = React.useState(
    TEMPLATES[0].languages[0],
  );
  const [modelId, setModelId] = React.useState<ModelId>("sarvam-24b");
  const [voiceId, setVoiceId] = React.useState<VoiceId>(TEMPLATES[0].voiceId);
  const [greeting, setGreeting] = React.useState("");
  const [prompt, setPrompt] = React.useState(TEMPLATES[0].prompt);
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [listening, setListening] = React.useState(false);

  const fileRef = React.useRef<HTMLInputElement>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const template = templateById(templateId);
  const voice = voiceById(voiceId);
  const model = MODELS.find((item) => item.id === modelId) ?? MODELS[0];

  const applyTemplate = (id: string) => {
    const next = templateById(id);
    setTemplateId(id);
    setPurpose(next.role);
    setCategory(next.category);
    setLanguages(next.languages);
    setDefaultLanguage(next.languages[0]);
    setVoiceId(next.voiceId);
    setPrompt(next.prompt);
  };

  const toggleLanguage = (language: string) => {
    setLanguages((current) => {
      if (current.includes(language)) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== language);
        if (defaultLanguage === language) setDefaultLanguage(next[0]);
        return next;
      }
      return [...current, language];
    });
  };

  const dictate = () => {
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    later(() => {
      setPrompt((current) => `${current}${current.endsWith(".") ? "" : "."}${SAMPLE_DICTATION}`);
      setListening(false);
    }, 2200);
  };

  const onPickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length) setFiles((current) => [...current, ...picked]);
    event.target.value = "";
  };

  const build = async () => {
    if (building) return;
    if (!name.trim()) {
      setError("Give your employee a name.");
      return;
    }
    if (prompt.trim().length < 40) {
      setError("The instruction block needs at least 40 characters so the employee knows the job.");
      return;
    }
    setError(null);
    setBuilding(true);

    try {
      // One call creates the record and its Sarvam deployment, so the employee
      // the dashboard opens below already has an agent behind it.
      const agent = await addAgent({
        name: name.trim(),
        purpose,
        category,
        templateKey: templateId,
        languages,
        defaultLanguage,
        voice: voice.name,
        voiceId: voice.id,
        model: model.name,
        modelId: model.id,
        greeting:
          greeting.trim() ||
          `Namaste, main ${name.trim()} bol raha hoon. Aap kaise hain?`,
        prompt,
      });

      files.forEach((file) => {
        const kind = file.name.toLowerCase().endsWith(".pdf")
          ? "PDF"
          : file.name.toLowerCase().endsWith(".docx")
            ? "DOCX"
            : "TXT";
        addKnowledge(agent.id, { name: file.name, kind, status: "Processing" });
      });

      router.push(`/dashboard/employees/${agent.id}`);
    } catch (failure) {
      // The backend refuses a repeated name; show that message verbatim rather
      // than a generic failure.
      setError(
        failure instanceof Error ? failure.message : "The employee could not be created.",
      );
      setBuilding(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Employees"
        title="Build an AI employee"
        description="Start from a template or describe the job in your own words. The employee is created as a draft until you activate it."
        actions={
          <Link href="/dashboard/employees" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ArrowLeft aria-hidden />
            My employees
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* Prompt composer ------------------------------------------------ */}
          <section className="rounded-xl border border-line bg-mist p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-cobalt-tint text-cobalt-deep">
                <Wand2 className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Describe the job</h2>
                <p className="text-xs text-ink-soft">
                  One or two sentences is enough. You can refine the prompt below.
                </p>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              aria-label="Employee instruction"
              className="mt-3 w-full resize-y rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink outline-none transition-colors focus-visible:border-cobalt focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-cobalt/15"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={dictate}
                aria-pressed={listening}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                  listening
                    ? "bg-destructive/10 text-destructive"
                    : "bg-surface text-ink-soft ring-1 ring-line hover:text-ink",
                )}
              >
                {listening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
                {listening ? "Listening… tap to stop" : "Dictate"}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-xs font-medium text-ink-soft ring-1 ring-line transition-colors hover:text-ink"
              >
                <Paperclip className="size-3.5" />
                Attach knowledge
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={onPickFiles}
                className="sr-only"
              />
              <span className="ml-auto text-[11px] text-ink-soft">
                {prompt.trim().length} characters
              </span>
            </div>
            {files.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) => current.filter((item) => item !== file))
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] text-ink-soft ring-1 ring-line hover:text-ink"
                      aria-label={`Remove ${file.name}`}
                    >
                      <FileText className="size-3" />
                      {file.name}
                      <span aria-hidden>×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* Templates ------------------------------------------------------ */}
          <Panel
            step="1"
            title="Pick a starting point"
            hint="Templates pre-fill the role, languages, voice and instruction block."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map((item) => (
                <SelectCard
                  key={item.id}
                  selected={templateId === item.id}
                  onSelect={() => applyTemplate(item.id)}
                  title={item.name}
                  description={item.category}
                  meta={item.languages.join(" · ")}
                  icon={<Building2 className="size-4" />}
                />
              ))}
            </div>
          </Panel>

          {/* Identity ------------------------------------------------------ */}
          <Panel
            step="2"
            title="Name and role"
            hint="This is what customers hear and what your team sees in the sidebar."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee name" htmlFor="employee-name">
                <TextInput
                  id="employee-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Aarav"
                  autoComplete="off"
                />
              </Field>
              <Field label="Role" htmlFor="employee-role">
                <TextInput
                  id="employee-role"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="e.g. Renewals"
                />
              </Field>
              <Field label="Business category" htmlFor="employee-category" className="sm:col-span-2">
                <CategoryDropdown
                  id="employee-category"
                  label="Business category"
                  value={category}
                  onChange={setCategory}
                  options={BUSINESS_CATEGORIES.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
              </Field>
            </div>
            <Field
              label="Opening line"
              hint="Leave it blank and we will write one from the name and language."
              htmlFor="employee-greeting"
              className="mt-3"
            >
              <TextInput
                id="employee-greeting"
                value={greeting}
                onChange={(event) => setGreeting(event.target.value)}
                placeholder={`Namaste, main ${name || "Aarav"} bol raha hoon…`}
              />
            </Field>
          </Panel>

          {/* Languages ----------------------------------------------------- */}
          <Panel
            step="3"
            title="Languages"
            hint="The employee answers in whichever language the customer speaks."
            action={<Badge variant="secondary">{languages.length} selected</Badge>}
          >
            <div className="max-w-sm">
              <Field
                label="Languages the employee can speak"
                hint="Pick every language your customers use. The employee follows the caller."
              >
                <LanguageDropdown
                  multiple
                  label="Languages the employee can speak"
                  value={languages}
                  onChange={(next) => {
                    if (next.length === 0) return;
                    setLanguages(next);
                    if (!next.includes(defaultLanguage)) setDefaultLanguage(next[0]);
                  }}
                  placeholder="Choose languages"
                  footer={
                    <p className="text-[11px] leading-relaxed text-ink-soft">
                      {languages.length} selected · the employee switches to the
                      caller&apos;s language automatically.
                    </p>
                  }
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {languages.map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => toggleLanguage(language)}
                  aria-label={`Remove ${language}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-cobalt/30 bg-cobalt-tint px-3 text-xs font-medium text-cobalt-deep transition-colors hover:border-cobalt/50"
                >
                  {language}
                  <X aria-hidden className="size-3 opacity-70" />
                </button>
              ))}
            </div>
            <div className="mt-4 max-w-xs">
              <Field label="First language" htmlFor="employee-default-language">
                <LanguageDropdown
                  id="employee-default-language"
                  label="First language"
                  options={languages}
                  value={defaultLanguage}
                  onChange={setDefaultLanguage}
                />
              </Field>
            </div>
          </Panel>

          {/* Model --------------------------------------------------------- */}
          <Panel
            step="4"
            title="AI model"
            hint="All three are Indic conversation models, billed per minute of conversation."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {MODELS.map((item) => (
                <SelectCard
                  key={item.id}
                  selected={modelId === item.id}
                  onSelect={() => setModelId(item.id)}
                  title={item.name}
                  description={item.note}
                  meta={item.speed}
                  icon={<Cpu className="size-4" />}
                />
              ))}
            </div>
          </Panel>

          {/* Voice --------------------------------------------------------- */}
          <Panel
            step="5"
            title="Voice"
            hint="Preview a voice before you commit. You can change it later in the workspace."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {VOICES.map((item, index) => (
                <SelectCard
                  key={item.id}
                  selected={voiceId === item.id}
                  onSelect={() => setVoiceId(item.id)}
                  title={item.name}
                  description={
                    item.gender === "Unspecified"
                      ? item.tone
                      : `${item.gender} · ${item.tone}`
                  }
                  meta={item.language}
                  icon={<Mic className="size-4" />}
                >
                  <VoicePreview sources={voiceSampleSources(item, index + 1)} />
                </SelectCard>
              ))}
            </div>
          </Panel>

          {/* Instruction --------------------------------------------------- */}
          <Panel
            step="6"
            title="Instruction block"
            hint="Rules, objection handling and what the employee must never say."
            action={<Badge variant="outline">{template.name}</Badge>}
          >
            <TextArea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={8}
              aria-label="System prompt"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-ink-soft">
                {prompt.trim().length} characters · saved to the employee on build
              </p>
              <button
                type="button"
                onClick={() => setPrompt(template.prompt)}
                className="text-[11px] font-medium text-cobalt hover:underline"
              >
                Reset to template
              </button>
            </div>
          </Panel>
        </div>

        {/* Summary --------------------------------------------------------- */}
        <aside className="h-fit space-y-3 xl:sticky xl:top-20">
          <section className="rounded-xl border border-line bg-mist p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Preview
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-12 place-items-center rounded-xl bg-cobalt-tint text-base font-semibold text-cobalt-deep"
              >
                {name ? initialsOf(name) : "AI"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {name || "Your employee"}
                </p>
                <p className="truncate text-xs text-ink-soft">{purpose || "Role"}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-xs">
              <Row label="Template" value={template.name} />
              <Row label="Category" value={category} />
              <Row
                label="Languages"
                value={`${languages.length} · ${languages.slice(0, 2).join(", ")}`}
              />
              <Row label="Model" value={model.name} />
              <Row label="Voice" value={`${voice.name} (${voice.gender})`} />
              <Row
                label="Knowledge"
                value={files.length ? `${files.length} file(s)` : "Add later"}
              />
            </dl>

            <div className="mt-4 rounded-lg bg-surface p-3 text-[11px] leading-relaxed text-ink-soft ring-1 ring-line">
              New employees start as <span className="font-semibold text-ink">Draft</span>.
              Activate from the workspace once the phone number and outcomes are set.
            </div>

            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={build}
              disabled={building}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cobalt text-sm font-semibold text-white transition-colors hover:bg-cobalt-deep focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cobalt/30 disabled:opacity-70"
            >
              {building ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {building ? "Building employee…" : "Build my employee"}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-soft">
              Takes a few seconds. Nothing is charged until the first call.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-cream/60 p-4">
            <p className="text-xs font-semibold text-ink">Already have {agents.length} employees</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Duplicate an existing employee from My employees to keep its prompt and
              training, then change the voice.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Panel({
  step,
  title,
  hint,
  action,
  children,
}: {
  step: string;
  title: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-mist p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold text-ink-soft ring-1 ring-line">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {action}
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
        </div>
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="max-w-[62%] text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
