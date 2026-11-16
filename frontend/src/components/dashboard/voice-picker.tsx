"use client";

/**
 * The Voice Library for one employee, laid out the way the reference picker is:
 * a primary-language strip, the selected voice's other languages, a search box
 * with three dropdown filters, and two columns of compact rows - premium and
 * standard - each with its own rate and note.
 *
 * There are no cards here on purpose. A row carries everything a chooser needs
 * (name in the chosen language, speaker id, gender, what it is best for, the
 * languages it also speaks, a sample control and a rating) in about a third of
 * the height, so a whole catalogue can be compared without scrolling past
 * decoration.
 *
 * Two sources feed the catalogue. `/api/voices` is merged over the bundle, so a
 * voice added on the server appears without a redeploy; the bundle paints first
 * and stays if the API is unreachable. Cloned voices live in this browser under
 * "My voices", and unnamed catalogue ids stay hidden unless this employee
 * already uses one - they carry no speaker, so they cannot be heard.
 */

import * as React from "react";
import {
  Check,
  Copy,
  Globe,
  Info,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";

import { VoiceCloneDialog } from "@/components/dashboard/voice-clone-dialog";
import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  EmptyState,
  FilterPills,
  SearchField,
} from "@/components/dashboard/ui/kit";
import type { SaveOutcome } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { voices as marketingVoices, type VoiceSample } from "@/content/home";
import {
  languageCodeOf,
  languagesForVoice,
  nameOfSlug,
  nativeName,
  planForVoice,
  tierOfVoice,
  VOICE_LANGUAGES,
  VOICE_LANGUAGE_COUNT,
  VOICE_PLANS,
  VOICE_TIER_ORDER,
  type VoiceLanguage,
  type VoicePlan,
  type VoiceTier,
} from "@/content/voice-catalogue";
import { VOICES, type Voice } from "@/content/workspace";
import { readClones, writeClones, type ClonedVoice } from "@/lib/cloned-voices";
import { cn } from "@/lib/utils";

/** The operator's own ratings of each sample, per browser. */
const RATINGS_KEY = "aotms.voice-library-ratings";

/** One avatar tint per row, cycling in catalogue order. */
const AVATAR_TINTS = [
  "bg-cobalt-tint text-cobalt-deep",
  "bg-tangerine-tint text-tangerine-ink",
  "bg-mist-deep text-ink",
];

type GenderFilter = "all" | RowGender;
type SourceTab = "all" | "clones";

/** What a voice is, as opposed to what the filter is asking for. */
type RowGender = "female" | "male" | "unspecified";

/** One row of the catalogue: the stored voice plus what it can say. */
type VoiceRow = {
  voice: Voice;
  band: VoiceTier;
  plan: VoicePlan;
  /** The provider's entry, from the live catalogue or the bundled mirror. */
  sample: VoiceSample | undefined;
  languages: VoiceLanguage[];
  gender: RowGender;
  personality: string;
  useCase: string;
  featured: boolean;
};

const cloneDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "just now"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const takeLength = (value: number) => `${(value / 1000).toFixed(1)}s`;

/**
 * Which language a row leads with: the one being filtered for when the voice
 * offers it, otherwise the language its sample is synthesised in.
 */
const primaryFor = (row: VoiceRow, language: string): VoiceLanguage | undefined =>
  row.languages.find((item) => item.code === language) ??
  row.languages.find((item) => item.code === row.sample?.preview_language) ??
  row.languages[0];

/**
 * The mood filter, taken from the first word of the provider's personality line
 * ("Confident & bold" -> Confident). It is derived rather than invented, so a
 * voice added to the catalogue lands in a mood the moment it is published.
 */
const moodOf = (personality: string) => personality.trim().split(/\s+/)[0] ?? "";

const GENDER_CHIP: Record<Exclude<RowGender, "unspecified">, string> = {
  female: "bg-tangerine-tint text-tangerine-ink",
  male: "bg-cobalt-tint text-cobalt-deep",
};

const GENDER_LABEL: Record<Exclude<RowGender, "unspecified">, string> = {
  female: "Female",
  male: "Male",
};

export function VoicePicker({
  employeeName,
  defaultLanguage,
  selectedId,
  onSelect,
}: {
  employeeName: string;
  /** Language the clone dialog opens on, and the strip opens filtered by. */
  defaultLanguage: string;
  selectedId: string;
  /** Saves the choice and reports whether the server kept it. */
  onSelect: (voice: Voice) => Promise<SaveOutcome>;
}) {
  const [query, setQuery] = React.useState("");
  // The employee's own language is the useful starting point: it is the one the
  // calls happen in, so its voices - and their native names - come first.
  const [language, setLanguage] = React.useState(
    () => languageCodeOf(defaultLanguage) ?? "all",
  );
  const [mood, setMood] = React.useState("all");
  const [gender, setGender] = React.useState<GenderFilter>("all");
  const [tab, setTab] = React.useState<SourceTab>("all");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [live, setLive] = React.useState<VoiceSample[] | null>(null);
  const [clones, setClones] = React.useState<ClonedVoice[]>([]);
  const [cloning, setCloning] = React.useState(false);
  const [ratings, setRatings] = React.useState<Record<string, number>>({});
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // The bundled catalogue paints first; the live one refines it if the API
  // answers. A missing API leaves the library one deploy old, not broken.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/voices");
        if (!response.ok) return;
        const payload: { items: VoiceSample[] | null } = await response.json();
        if (cancelled || !Array.isArray(payload.items) || payload.items.length === 0) {
          return;
        }
        setLive(payload.items);
      } catch {
        // Keep the bundled catalogue: it carries the same voices.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clones and ratings are read after the first paint: storage does not exist
  // on the server, and reading it during render would break hydration.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setClones(readClones()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(RATINGS_KEY);
        if (stored) setRatings(JSON.parse(stored) as Record<string, number>);
      } catch {
        // Private mode or a corrupt value: start with no ratings.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => () => audioRef.current?.pause(), []);

  const commit = React.useCallback((next: ClonedVoice[]) => {
    setClones(next);
    writeClones(next);
  }, []);

  const rows = React.useMemo<VoiceRow[]>(() => {
    const liveById = new Map((live ?? []).map((item) => [item.id, item]));
    // The bundled mirror of the provider's profiles, so a row keeps its
    // languages and sample text when the API is unreachable.
    const bundledById = new Map(marketingVoices.catalog.map((item) => [item.id, item]));

    const bundled = VOICES.map((voice) => ({
      voice,
      sample: voice.slug
        ? (liveById.get(voice.slug) ?? bundledById.get(voice.slug))
        : undefined,
    }));

    const known = new Set(
      bundled.flatMap(({ voice }) => [voice.id, voice.slug]).filter(Boolean),
    );
    const extra = (live ?? [])
      .filter((item) => !known.has(item.id))
      .map((item) => ({
        sample: item,
        voice: {
          id: item.id,
          // A live id is a speaker name, so it can be previewed as well as stored.
          slug: item.id,
          name: item.name,
          gender:
            item.gender === "female"
              ? "Female"
              : item.gender === "male"
                ? "Male"
                : "Unspecified",
          language: item.languages.map((entry) => entry.label).join(", "),
          tone: item.personality,
        } satisfies Voice,
      }));

    return [...bundled, ...extra]
      .filter(({ voice }) => voice.slug !== "" || voice.id === selectedId)
      .map(({ voice, sample }) => ({
        voice,
        band: tierOfVoice(voice),
        plan: planForVoice(voice),
        sample,
        languages: sample ? sample.languages : languagesForVoice(voice),
        gender: sample
          ? sample.gender
          : voice.gender === "Female"
            ? ("female" as const)
            : voice.gender === "Male"
              ? ("male" as const)
              : ("unspecified" as const),
        personality: sample?.personality ?? voice.tone,
        useCase: sample?.use_case ?? "",
        featured: sample?.featured ?? false,
      }));
  }, [live, selectedId]);

  /** One predicate for both tabs, so "sales" also finds the voice filed under it. */
  const matches = React.useCallback(
    (text: string) => !query || text.toLowerCase().includes(query.toLowerCase()),
    [query],
  );

  const visible = React.useMemo(
    () =>
      rows.filter((row) => {
        if (language !== "all" && !row.languages.some((item) => item.code === language)) {
          return false;
        }
        if (mood !== "all" && moodOf(row.personality) !== mood) return false;
        if (gender !== "all" && row.gender !== gender) return false;

        const haystack = [
          row.voice.name,
          row.voice.slug,
          row.personality,
          row.useCase,
          // The name a speaker goes by in each language, so "शुभ" finds Shubh.
          row.languages
            .map((item) =>
              [
                item.label,
                nativeName(item.code),
                nameOfSlug(row.voice.slug || row.voice.id, row.voice.name, item.code),
              ].join(" "),
            )
            .join(" "),
        ].join(" ");
        return matches(haystack);
      }),
    [rows, language, mood, gender, matches],
  );

  const visibleClones = clones.filter((clone) =>
    matches(`${clone.name} ${clone.language}`),
  );

  /** Only languages some voice in the library actually offers. */
  const languageOptions = React.useMemo(() => {
    const offered = new Set(rows.flatMap((row) => row.languages.map((item) => item.code)));
    return VOICE_LANGUAGES.filter((option) => offered.has(option.code));
  }, [rows]);

  const moodOptions = React.useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((row) => {
      const value = moodOf(row.personality);
      if (value) seen.set(value, (seen.get(value) ?? 0) + 1);
    });
    return Array.from(seen, ([value, count]) => ({ value, count })).sort((a, b) =>
      a.value.localeCompare(b.value),
    );
  }, [rows]);

  const filtered =
    language !== "all" || mood !== "all" || gender !== "all" || query !== "";

  /** The employee's current voice, which the "Selected" line and chips describe. */
  const current = rows.find((row) => row.voice.id === selectedId);
  const currentPrimary = current ? primaryFor(current, language) : undefined;
  const currentName =
    current && currentPrimary
      ? nameOfSlug(
          current.voice.slug || current.voice.id,
          current.voice.name,
          currentPrimary.code,
        )
      : (current?.voice.name ?? "");
  const currentAlso =
    current && currentPrimary
      ? current.languages.filter((item) => item.code !== currentPrimary.code)
      : [];

  /** The language a sample is spoken in: the filter, when this voice offers it. */
  const spokenFor = (row: VoiceRow) =>
    language !== "all" && row.languages.some((item) => item.code === language)
      ? language
      : (row.sample?.preview_language ?? row.languages[0]?.code ?? "en-IN");

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };

  /**
   * A sample belongs to the language it was synthesised in, so changing the
   * filter stops it: leaving it playing would leave a row claiming one language
   * while the audio speaks another.
   */
  const chooseLanguage = (next: string) => {
    if (next === language) return;
    stop();
    setLanguage(next);
  };

  const togglePreview = async (row: VoiceRow) => {
    setNotice(null);
    if (playingId === row.voice.id) {
      stop();
      return;
    }

    stop();
    if (!row.voice.slug) {
      setNotice({
        tone: "error",
        text: `${row.voice.name} has no speaker name on the server, so there is no sample to play.`,
      });
      return;
    }

    const spoken = spokenFor(row);
    setLoadingId(row.voice.id);

    try {
      const response = await fetch(
        `/api/voices/${row.voice.slug}/preview?language=${encodeURIComponent(spoken)}`,
      );
      if (!response.ok) throw new Error(`preview ${response.status}`);
      const payload: { audio_base64?: string; encoding?: string } = await response.json();
      if (!payload.audio_base64) throw new Error("empty preview");

      const audio = new Audio(
        `data:audio/${payload.encoding === "wav" ? "wav" : "mpeg"};base64,${payload.audio_base64}`,
      );
      audio.addEventListener("ended", () => setPlayingId(null));
      audioRef.current = audio;
      await audio.play();
      setPlayingId(row.voice.id);
    } catch {
      setPlayingId(null);
      setNotice({
        tone: "error",
        text: `The ${nameOfSlug(row.voice.slug, row.voice.name, spoken)} sample did not play in ${nativeName(spoken)}. Try again in a moment, or pick another language.`,
      });
    } finally {
      setLoadingId(null);
    }
  };

  const rate = (id: string, value: number) => {
    setRatings((current2) => {
      const next = { ...current2, [id]: value };
      try {
        window.localStorage.setItem(RATINGS_KEY, JSON.stringify(next));
      } catch {
        // A rating is a convenience; losing it is not worth an error.
      }
      return next;
    });
  };

  const choose = async (row: VoiceRow) => {
    if (row.voice.id === selectedId || savingId !== null) return;

    setSavingId(row.voice.id);
    const outcome = await onSelect(row.voice);
    setSavingId(null);

    // The row flips immediately, so say which of the two things happened: a
    // refused save quietly reverses itself and would otherwise read as success.
    setNotice(
      outcome.ok
        ? { tone: "ok", text: `${employeeName} now speaks with ${row.voice.name}.` }
        : { tone: "error", text: `${row.voice.name} was not saved. ${outcome.error}` },
    );
  };

  const savedClone = (clone: ClonedVoice) => {
    setCloning(false);
    commit([clone, ...readClones()]);
    setNotice({
      tone: "ok",
      text: `${clone.name} was saved. It becomes assignable once voice cloning is enabled here.`,
    });
  };

  const removeClone = (clone: ClonedVoice) => {
    commit(readClones().filter((item) => item.id !== clone.id));
    setNotice({ tone: "ok", text: `${clone.name} was removed from this device.` });
  };

  const clearFilters = () => {
    stop();
    setLanguage("all");
    setMood("all");
    setGender("all");
    setQuery("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Voice Library</h2>
          <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-ink-soft">
            Pick the language first: the names, the chips and the sample all
            follow it. Changing the voice does not change the script.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCloning(true)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Plus aria-hidden />
          Clone a voice
        </button>
      </div>

      {notice ? (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            notice.tone === "ok"
              ? "border-cobalt-line bg-cobalt-tint/50 text-cobalt-deep"
              : "border-line bg-cream/70 text-ink",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills<SourceTab>
          label="Voice source"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All voices", count: rows.length },
            { value: "clones", label: "My voices", count: clones.length },
          ]}
        />
        <p className="text-[11px] text-ink-soft">
          {live ? `Live catalogue · ${rows.length} voices` : "Curated catalogue"}
        </p>
      </div>

      {tab === "all" ? (
        <>
          <section className="space-y-2">
            <SectionLabel
              hint="Filters every row below, and the language each sample is spoken in."
            >
              Primary language
            </SectionLabel>
            <div
              role="radiogroup"
              aria-label="Primary language"
              className="flex flex-wrap gap-1.5"
            >
              <LanguagePill
                active={language === "all"}
                onClick={() => chooseLanguage("all")}
                glyph={<Globe aria-hidden className="size-2.5" />}
                title="Every language in the library"
              >
                All languages
              </LanguagePill>
              {languageOptions.map((option) => (
                <LanguagePill
                  key={option.code}
                  active={language === option.code}
                  onClick={() => chooseLanguage(option.code)}
                  glyph={nativeName(option.code).slice(0, 1)}
                  title={`${option.label} · ${nativeName(option.code)}`}
                >
                  {nativeName(option.code)}
                </LanguagePill>
              ))}
            </div>
            <p className="text-xs text-ink-soft">
              {language === "all"
                ? "Every voice, in the language it is published in."
                : `Every voice below speaks ${nativeName(language)}, and the rows are named in it.`}
            </p>
          </section>

          <section className="space-y-2">
            <SectionLabel>Also speaks</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {!current ? (
                <span className="text-xs text-ink-soft">No voice selected yet.</span>
              ) : currentAlso.length === 0 ? (
                <span className="text-xs text-ink-soft">
                  {currentName} speaks this language only.
                </span>
              ) : (
                currentAlso.map((item) => (
                  <span
                    key={item.code}
                    title={item.label}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 text-[0.7rem] font-medium text-ink-soft"
                  >
                    <Check aria-hidden className="size-3 text-cobalt" />
                    {nativeName(item.code)}
                  </span>
                ))
              )}
            </div>
            <p className="text-xs text-ink-soft">
              {current
                ? `The other languages ${currentName} speaks. Pick one above to hear the sample in it.`
                : "Select a voice below to see the rest of its languages."}
            </p>
          </section>
        </>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionLabel hint="Who takes the call, and what it bills at.">
            Voice
          </SectionLabel>
          {current && currentPrimary ? (
            <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
              Selected:
              <span className="font-semibold text-ink">{currentName}</span>
              <span className="rounded bg-mist px-1.5 py-0.5 font-semibold text-ink-soft">
                ₹{current.plan.rate}/min
              </span>
              <VoiceId value={current.voice.slug || current.voice.id} />
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={
              tab === "all"
                ? "Search by name, id, language or use case"
                : "Search your cloned voices"
            }
            className="sm:max-w-none"
          />
          {tab === "all" ? (
            <>
              <CategoryDropdown
                label="Language"
                value={language}
                onChange={chooseLanguage}
                className="w-full shrink-0 sm:w-40"
                options={[
                  { value: "all", label: "All languages", icon: Globe },
                  ...languageOptions.map((option) => ({
                    value: option.code,
                    label: option.label,
                    description:
                      nativeName(option.code) === option.label
                        ? undefined
                        : nativeName(option.code),
                    badge: nativeName(option.code).slice(0, 1),
                  })),
                ]}
              />
              <CategoryDropdown
                label="Mood"
                value={mood}
                onChange={setMood}
                className="w-full shrink-0 sm:w-36"
                options={[
                  { value: "all", label: "Any mood" },
                  ...moodOptions.map((option) => ({
                    value: option.value,
                    label: option.value,
                    hint: `${option.count}`,
                  })),
                ]}
              />
              <CategoryDropdown
                label="Gender"
                value={gender}
                onChange={(next) => setGender(next as GenderFilter)}
                className="w-full shrink-0 sm:w-36"
                options={[
                  { value: "all", label: "Any gender" },
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                  // Plenty of speakers ship with no label at all, and hiding
                  // them behind "Any gender" would make them unfindable here.
                  { value: "unspecified", label: "Not stated" },
                ]}
              />
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-ink-soft" aria-live="polite">
            {visible.length} of {rows.length} voices
            {language !== "all" ? ` · in ${nativeName(language)}` : ""}
            {mood !== "all" ? ` · ${mood.toLowerCase()}` : ""}
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-cobalt transition-colors hover:text-cobalt-deep"
            >
              <RotateCcw className="size-3" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>

        {tab === "all" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {VOICE_TIER_ORDER.map((tier) => {
              const plan = VOICE_PLANS[tier];
              const inBand = visible.filter((row) => row.band === tier);

              return (
                <div
                  key={tier}
                  className="flex min-w-0 flex-col rounded-xl border border-line bg-mist-soft"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">
                      {plan.label} voices
                      <span className="ml-1.5 text-[11px] font-normal text-ink-soft">
                        {inBand.length} {inBand.length === 1 ? "voice" : "voices"}
                      </span>
                    </p>
                    <span className="shrink-0 rounded-md bg-cobalt-tint px-1.5 py-0.5 text-[0.65rem] font-semibold text-cobalt-deep">
                      ₹{plan.rate}/min
                    </span>
                  </header>

                  {inBand.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-ink-soft">
                      No {plan.label.toLowerCase()} voice matches these filters.
                    </p>
                  ) : (
                    <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto p-2">
                      {inBand.map((row) => (
                        <VoiceRowItem
                          key={row.voice.id}
                          row={row}
                          language={language}
                          spoken={spokenFor(row)}
                          chosen={row.voice.id === selectedId}
                          playing={row.voice.id === playingId}
                          loading={row.voice.id === loadingId}
                          saving={row.voice.id === savingId}
                          saveBusy={savingId !== null}
                          rating={ratings[row.voice.id] ?? 0}
                          onPlay={() => void togglePreview(row)}
                          onChoose={() => void choose(row)}
                          onRate={(value) => rate(row.voice.id, value)}
                        />
                      ))}
                    </ul>
                  )}

                  <p className="mt-auto border-t border-line px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
                    {plan.blurb}
                  </p>
                </div>
              );
            })}
          </div>
        ) : visibleClones.length === 0 ? (
          <EmptyState
            icon={<Mic aria-hidden className="size-4" />}
            title={
              clones.length === 0
                ? "No cloned voices yet."
                : "No clone matches this search."
            }
            description={
              clones.length === 0
                ? "Record ten seconds of clear speech, name the clone, and it appears here. Clones are kept in this browser."
                : "Clear the search to see every clone again."
            }
            action={
              clones.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setCloning(true)}
                  className={buttonVariants({})}
                >
                  <Plus aria-hidden />
                  Clone a voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Clear search
                </button>
              )
            }
          />
        ) : (
          <div className="flex flex-col rounded-xl border border-line bg-mist-soft">
            <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <p className="text-sm font-semibold text-ink">
                My voices
                <span className="ml-1.5 text-[11px] font-normal text-ink-soft">
                  {visibleClones.length} recorded here
                </span>
              </p>
              <span className="rounded-md bg-mist px-1.5 py-0.5 text-[0.65rem] font-semibold text-ink-soft">
                Not billed yet
              </span>
            </header>

            <ul className="space-y-1.5 p-2">
              {visibleClones.map((clone, index) => (
                <li key={clone.id}>
                  <div className="flex items-start gap-2 rounded-lg border border-line bg-surface p-2">
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold",
                        AVATAR_TINTS[index % AVATAR_TINTS.length],
                      )}
                    >
                      {clone.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <span className="truncate text-[0.82rem] font-semibold text-ink">
                          {clone.name}
                        </span>
                        <Badge variant="success">{clone.status}</Badge>
                      </p>
                      <p className="mt-0.5 truncate text-[0.68rem] text-ink-soft">
                        {clone.language} · {takeLength(clone.durationMs)} recorded ·{" "}
                        {cloneDate(clone.createdAt)}
                      </p>
                      <p className="mt-1 text-[0.62rem] text-ink-soft">
                        The take stayed on this device, so there is no sample to
                        play back and no billing rate to quote yet.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeClone(clone)}
                      aria-label={`Delete ${clone.name}`}
                      className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-ink-soft transition-colors hover:border-destructive/40 hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-auto border-t border-line px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
              A clone becomes assignable once voice cloning is enabled on this
              deployment.
            </p>
          </div>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-ink-soft">
        Rates are billed per connected minute; a call that never connects is not
        billed. Every voice above speaks all {VOICE_LANGUAGE_COUNT} languages
        with the same one-line sample, so judge the speaker rather than the
        words. Ratings stay in this browser. Unnamed catalogue voices appear
        only when this employee already uses one, because they have no speaker
        to synthesise a sample from.
      </p>

      {cloning ? (
        <VoiceCloneDialog
          onClose={() => setCloning(false)}
          onSaved={savedClone}
          defaultLanguage={defaultLanguage}
        />
      ) : null}
    </div>
  );
}

/** One compact catalogue row: sample, identity, what it is for, rating. */
function VoiceRowItem({
  row,
  language,
  spoken,
  chosen,
  playing,
  loading,
  saving,
  saveBusy,
  rating,
  onPlay,
  onChoose,
  onRate,
}: {
  row: VoiceRow;
  language: string;
  spoken: string;
  chosen: boolean;
  playing: boolean;
  loading: boolean;
  saving: boolean;
  saveBusy: boolean;
  rating: number;
  onPlay: () => void;
  onChoose: () => void;
  onRate: (value: number) => void;
}) {
  const primary = primaryFor(row, language);
  const display = primary
    ? nameOfSlug(row.voice.slug || row.voice.id, row.voice.name, primary.code)
    : row.voice.name;
  const headline = row.useCase
    ? `Best for ${row.useCase.toLowerCase()}`
    : row.languages.length >= VOICE_LANGUAGE_COUNT
      ? `Speaks all ${VOICE_LANGUAGE_COUNT} languages`
      : row.languages.length > 0
        ? `Speaks ${row.languages.length} of ${VOICE_LANGUAGE_COUNT} languages`
        : "No languages published by the provider";

  return (
    <li>
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border bg-surface p-2 transition-colors",
          chosen
            ? "border-cobalt/50 bg-cobalt-tint/25 ring-1 ring-cobalt/25"
            : "border-line hover:border-cobalt/25",
        )}
      >
        <button
          type="button"
          onClick={onPlay}
          disabled={loading}
          aria-label={`${playing ? "Pause" : "Play"} the ${display} sample in ${nativeName(spoken)}`}
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
            playing
              ? "border-cobalt bg-cobalt text-white"
              : "border-line bg-surface text-cobalt hover:border-cobalt/40 hover:bg-cobalt-tint",
          )}
        >
          {loading ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : playing ? (
            <Pause aria-hidden className="size-3.5" />
          ) : (
            <Play aria-hidden className="size-3.5 translate-x-[1px]" />
          )}
        </button>

        <button
          type="button"
          onClick={onChoose}
          disabled={saveBusy}
          aria-pressed={chosen}
          aria-label={
            chosen ? `${display} is the voice in use` : `Use ${display} for this agent`
          }
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[0.82rem] font-semibold text-ink">
              {display}
            </span>
            <span
              title="Voice ID"
              className="shrink-0 font-mono text-[0.6rem] text-ink-soft/80"
            >
              {row.voice.slug || row.voice.id}
            </span>
            {row.gender === "unspecified" ? null : (
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-px text-[0.55rem] font-semibold uppercase tracking-[0.06em]",
                  GENDER_CHIP[row.gender],
                )}
              >
                {GENDER_LABEL[row.gender]}
              </span>
            )}
            {saving ? (
              <Loader2 aria-hidden className="size-3 shrink-0 animate-spin text-cobalt" />
            ) : chosen ? (
              <Check aria-hidden className="size-3 shrink-0 text-cobalt" />
            ) : null}
          </span>

          <span className="mt-0.5 block truncate text-[0.68rem] text-ink-soft">
            {headline}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-1">
            {language !== "all" && primary ? (
              <span className="rounded bg-tangerine-tint px-1.5 py-px text-[0.58rem] font-medium text-tangerine-ink">
                Great {nativeName(primary.code)}
              </span>
            ) : null}
            {row.personality ? (
              <span className="rounded bg-mist px-1.5 py-px text-[0.58rem] font-medium text-ink-soft">
                {row.personality}
              </span>
            ) : null}
            {row.featured ? (
              <span className="rounded bg-cobalt-tint px-1.5 py-px text-[0.58rem] font-semibold text-cobalt-deep">
                Featured
              </span>
            ) : null}
          </span>
        </button>

        <div
          role="group"
          aria-label={`Rate the ${display} sample`}
          className="flex shrink-0 items-center"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRate(value)}
              aria-pressed={rating === value}
              aria-label={value === 1 ? "Rate 1 star" : `Rate ${value} stars`}
              title={rating ? `Your rating: ${rating}/5` : "Rate this sample"}
              className="grid size-6 place-items-center rounded-full transition-colors hover:bg-cream-deep"
            >
              <Star
                aria-hidden
                className={cn(
                  "size-3",
                  rating >= value
                    ? "fill-tangerine text-tangerine-deep"
                    : "text-ink-soft/35",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </li>
  );
}

/** Small uppercase group label, with the reference's info affordance. */
function SectionLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
      {children}
      {hint ? (
        <span title={hint} className="inline-flex">
          <Info aria-hidden className="size-3" />
        </span>
      ) : null}
    </p>
  );
}

/** One option of the primary-language strip. A radio: exactly one is on. */
function LanguagePill({
  active,
  onClick,
  glyph,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  glyph: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.72rem] font-medium transition-colors",
        active
          ? "border-cobalt bg-cobalt text-white"
          : "border-line bg-surface text-ink-soft hover:border-cobalt/40 hover:text-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full text-[0.55rem] font-semibold",
          active ? "bg-white/25 text-white" : "bg-mist text-ink-soft",
        )}
      >
        {glyph}
      </span>
      {children}
    </button>
  );
}

/**
 * The id the API takes for this voice, with the copy control the docs point
 * operators to. Clipboard access can be blocked; the id stays selectable then.
 */
function VoiceId({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Blocked by permissions: the id is on screen and can be selected by hand.
    }
  };

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="truncate font-mono text-[0.62rem]">{value}</code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Voice ID copied" : `Copy voice ID ${value}`}
        className="shrink-0 rounded p-0.5 text-ink-soft transition-colors hover:text-ink"
      >
        {copied ? (
          <Check aria-hidden className="size-3" />
        ) : (
          <Copy aria-hidden className="size-3" />
        )}
      </button>
    </span>
  );
}
