"use client";

import { Check, Loader2, Pause, Play, RotateCcw, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import type { VoiceSample } from "@/content/home";
import { voicesPage } from "@/content/marketing";
import {
  languagesOf,
  nameIn,
  nativeName,
  planOf,
  tierOf,
  VOICE_PLANS,
  VOICE_TIER_ORDER,
  type VoiceTier,
} from "@/content/voice-catalogue";
import { cn } from "@/lib/utils";

/** The visitor's own ratings. The marketing site has no account to store them under. */
const RATINGS_KEY = "aotms.voice-ratings";

/**
 * Sample-strip bars. Heights come from the bar index, not Math.random(), so the
 * server HTML and the hydrated client agree and the bars never reshuffle.
 */
const WAVE_HEIGHTS = Array.from({ length: 26 }, (_, index) => 5 + ((index * 37) % 17));

/** One avatar tint per card, cycling in catalogue order. */
const AVATAR_TINTS = [
  "bg-cobalt-tint text-cobalt-night",
  "bg-tangerine-tint text-tangerine-ink",
  "bg-mist-deep text-ink",
];

/** `"all"` is a filter value, not a tier, so the two live in one union. */
type TierFilter = "all" | VoiceTier;

export function VoiceCatalogue({ catalog }: { catalog: VoiceSample[] }) {
  const [items, setItems] = useState(catalog);
  const [language, setLanguage] = useState("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [gender, setGender] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // The bundled catalogue paints first; the live one refines it if the API
  // answers. A missing API leaves the page working, one deploy old.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/voices");
        if (!response.ok) return;
        const payload: { items: VoiceSample[] | null } = await response.json();
        if (cancelled || !Array.isArray(payload.items) || payload.items.length === 0) return;
        setItems(payload.items);
      } catch {
        // Keep the bundled catalogue: it carries the same voices.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ratings are read after the first paint; reading during render would make
  // the server HTML and the first client render disagree.
  useEffect(() => {
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

  useEffect(() => () => audioRef.current?.pause(), []);

  /**
   * A sample belongs to the language it was synthesised in, so changing the
   * filter stops it: leaving it playing would leave a card claiming one
   * language while the audio speaks another.
   */
  const chooseLanguage = (next: string) => {
    if (next === language) return;
    audioRef.current?.pause();
    setPlayingId(null);
    setLanguage(next);
  };

  const languageOptions = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((voice) =>
      voice.languages.forEach((item) => {
        if (!seen.has(item.code)) seen.set(item.code, item.label);
      }),
    );
    return Array.from(seen, ([code, label]) => ({ code, label }));
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter((voice) => {
        if (language !== "all" && !voice.languages.some((item) => item.code === language)) {
          return false;
        }
        if (tier !== "all" && tierOf(voice.id) !== tier) return false;
        if (gender !== "all" && voice.gender !== gender) return false;
        return true;
      }),
    [items, language, tier, gender],
  );

  const filtered = language !== "all" || tier !== "all" || gender !== "all";

  /** The language a sample is spoken in: the filter, when this voice offers it. */
  const spokenFor = (voice: VoiceSample) =>
    language !== "all" && voice.languages.some((item) => item.code === language)
      ? language
      : voice.preview_language;

  const rate = (id: string, value: number) => {
    setRatings((current) => {
      const next = { ...current, [id]: value };
      try {
        window.localStorage.setItem(RATINGS_KEY, JSON.stringify(next));
      } catch {
        // A rating is a convenience; losing it is not worth an error.
      }
      return next;
    });
  };

  const togglePreview = async (voice: VoiceSample) => {
    setNotice(null);
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    setPlayingId(null);
    setLoadingId(voice.id);
    const spoken = spokenFor(voice);

    try {
      const response = await fetch(
        `/api/voices/${voice.id}/preview?language=${encodeURIComponent(spoken)}`,
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
      setPlayingId(voice.id);
    } catch {
      setPlayingId(null);
      setNotice(
        `The ${nameIn(voice, spoken)} sample could not be played in ${nativeName(spoken)}. Try again in a moment, or pick another voice.`,
      );
    } finally {
      setLoadingId(null);
    }
  };

  const clearFilters = () => {
    setLanguage("all");
    setTier("all");
    setGender("all");
  };

  const selected = items.find((voice) => voice.id === selectedId) ?? null;

  return (
    <Section id="catalogue">
      <Container>
        <SectionHeader
          eyebrow={voicesPage.catalogue.eyebrow}
          title={voicesPage.catalogue.title}
          body={voicesPage.catalogue.body}
        />

        {/* Filters: three groups, one selected chip each. */}
        <div className="mt-8 space-y-3 rounded-2xl border border-line bg-surface/70 p-4">
          <FilterRow label="Language">
            <FilterChip active={language === "all"} onClick={() => chooseLanguage("all")}>
              All languages
            </FilterChip>
            {languageOptions.map((option) => (
              <FilterChip
                key={option.code}
                active={language === option.code}
                onClick={() => chooseLanguage(option.code)}
                title={option.label}
              >
                {nativeName(option.code)}
                <span className="ml-1 text-[0.6rem] font-normal opacity-60">
                  {option.label}
                </span>
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="Mode">
            <FilterChip active={tier === "all"} onClick={() => setTier("all")}>
              All modes
            </FilterChip>
            {VOICE_TIER_ORDER.map((value) => (
              <FilterChip
                key={value}
                active={tier === value}
                onClick={() => setTier(value)}
                title={VOICE_PLANS[value].blurb}
              >
                {VOICE_PLANS[value].label}
                <span className="ml-1 text-[0.6rem] font-normal opacity-60">
                  ₹{VOICE_PLANS[value].rate}/min
                </span>
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="Gender">
            {[
              { value: "all", label: "All voices" },
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ].map((option) => (
              <FilterChip
                key={option.value}
                active={gender === option.value}
                onClick={() => setGender(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </FilterRow>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <p className="text-xs text-ink-soft" aria-live="polite">
              {visible.length} of {items.length} voices
              {language !== "all" ? ` · listening in ${nativeName(language)}` : ""}
            </p>
            {filtered ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-cobalt transition-colors hover:text-cobalt-deep"
              >
                <RotateCcw className="size-3" aria-hidden />
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((voice, index) => {
            const plan = planOf(voice.id);
            const premium = tierOf(voice.id) === "premium";
            const { primary, also } = languagesOf(voice, language);
            const display = nameIn(voice, primary.code);
            const chosen = voice.id === selectedId;
            const playing = voice.id === playingId;
            const busy = voice.id === loadingId;
            const mine = ratings[voice.id] ?? 0;
            const spoken = spokenFor(voice);

            return (
              <li key={voice.id} className="h-full">
                <article
                  className={cn(
                    "card card-lift flex h-full flex-col gap-4 p-5",
                    chosen && "border-cobalt-line ring-2 ring-cobalt/35",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-full text-base font-semibold",
                        AVATAR_TINTS[index % AVATAR_TINTS.length],
                      )}
                    >
                      {display.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="truncate text-base font-semibold text-ink">
                          {display}
                        </h3>
                        {display !== voice.name ? (
                          <span className="truncate text-xs text-ink-soft">{voice.name}</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">
                        {voice.personality} · {voice.use_case}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em]",
                        premium
                          ? "bg-tangerine-tint text-tangerine-ink"
                          : "bg-mist text-ink-soft",
                      )}
                    >
                      {plan.label}
                    </span>
                  </div>

                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      Primary language
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-cobalt-tint px-2.5 py-1 text-[0.7rem] font-semibold text-cobalt-night">
                        {nativeName(primary.code)}
                        <span className="ml-1 font-normal opacity-70">{primary.label}</span>
                      </span>
                    </p>
                    <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      Also speaks
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {also.length === 0 ? (
                        <span className="text-[0.7rem] text-ink-soft">This language only</span>
                      ) : (
                        also.map((item) => (
                          <span
                            key={item.code}
                            title={item.label}
                            className="rounded-full bg-mist px-2.5 py-1 text-[0.7rem] font-medium text-ink-soft"
                          >
                            {nativeName(item.code)}
                          </span>
                        ))
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl bg-mist px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => void togglePreview(voice)}
                      aria-label={`${playing ? "Pause" : "Play"} the ${display} sample in ${nativeName(spoken)}`}
                      className="btn-glass grid size-9 shrink-0 place-items-center rounded-full text-cobalt"
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : playing ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4 translate-x-[1px]" />
                      )}
                    </button>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.7rem] font-semibold text-ink">
                        {playing ? "Playing" : "Play sample"}
                      </span>
                      <span className="block truncate text-[0.66rem] text-ink-soft">
                        Spoken in {nativeName(spoken)}
                      </span>
                    </span>

                    <span
                      aria-hidden
                      className="hidden h-7 min-w-0 flex-1 items-center justify-between gap-[2px] overflow-hidden sm:flex"
                    >
                      {WAVE_HEIGHTS.map((height, bar) => (
                        <span
                          key={bar}
                          className={cn(
                            "w-[3px] shrink-0 rounded-full transition-colors",
                            playing ? "animate-wave bg-cobalt/70" : "bg-ink/15",
                          )}
                          style={
                            playing
                              ? {
                                  height,
                                  animationDuration: `${0.9 + (bar % 5) * 0.09}s`,
                                  animationDelay: `${(bar % 7) * 0.06}s`,
                                }
                              : { height }
                          }
                        />
                      ))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label={`Rate the ${display} sample`}
                      className="flex items-center gap-0.5"
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => rate(voice.id, value)}
                          aria-pressed={mine === value}
                          aria-label={value === 1 ? "Rate 1 star" : `Rate ${value} stars`}
                          className="grid size-7 place-items-center rounded-full transition-colors hover:bg-cream-deep"
                        >
                          <Star
                            aria-hidden
                            className={cn(
                              "size-3.5",
                              mine >= value
                                ? "fill-tangerine text-tangerine-deep"
                                : "text-ink-soft/40",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-[0.66rem] text-ink-soft" aria-live="polite">
                      {mine ? `Your rating ${mine}/5` : "Rate the sample"}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        ₹{plan.rate}
                        <span className="text-[0.7rem] font-normal text-ink-soft"> / min</span>
                      </p>
                      <p className="text-[0.62rem] text-ink-soft">per connected minute</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(chosen ? null : voice.id)}
                      aria-pressed={chosen}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                        chosen
                          ? "bg-cobalt text-white hover:bg-cobalt-deep"
                          : "border border-cobalt-line bg-surface text-cobalt hover:bg-cobalt-tint",
                      )}
                    >
                      {chosen ? (
                        <>
                          <Check className="size-3.5" aria-hidden />
                          Chosen
                        </>
                      ) : (
                        "Choose"
                      )}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        {visible.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 px-5 py-10 text-center">
            <p className="text-sm text-ink-soft">
              No voice matches those three filters yet.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm font-semibold text-cobalt transition-colors hover:text-cobalt-deep"
            >
              Clear the filters
            </button>
          </div>
        ) : null}

        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-tangerine-ink">
          {notice}
        </p>

        {selected ? (
          <div className="sticky bottom-4 z-20 mt-2">
            <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  AVATAR_TINTS[
                    Math.max(0, items.findIndex((item) => item.id === selected.id)) %
                      AVATAR_TINTS.length
                  ],
                )}
              >
                {nameIn(selected, languagesOf(selected, language).primary.code).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {nameIn(selected, languagesOf(selected, language).primary.code)}
                  <span className="ml-2 text-xs font-normal text-ink-soft">
                    {languagesOf(selected, language).primary.label}
                  </span>
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {planOf(selected.id).label} · ₹{planOf(selected.id).rate} per connected minute
                  {ratings[selected.id] ? ` · you rated it ${ratings[selected.id]}/5` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Clear the selected voice"
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-mist hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
              <Link
                href="/free-trial"
                className="btn-primary shrink-0 px-4 py-2 text-xs"
              >
                Start with this voice
              </Link>
            </div>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}

/** One labelled chip group. Chips are toggle buttons, so `aria-pressed` carries the state. */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={`Filter by ${label.toLowerCase()}`}
      className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
    >
      <span className="shrink-0 pt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-soft sm:w-20">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "btn-glass inline-flex items-center rounded-full px-3 py-1.5 text-[0.72rem] font-medium transition-colors",
        active ? "btn-glass-selected text-cobalt-night" : "text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
