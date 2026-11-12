"use client";

import { ChevronDown, Heart, Loader2, Pause, Play, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Container } from "@/components/layout/container";
import { voices, type VoiceSample } from "@/content/home";
import { cn } from "@/lib/utils";

/** Favourites live in the visitor's browser: the landing page has no account. */
const FAVOURITES_KEY = "aotms.voice-favourites";

/**
 * Waveform bars. Heights and timings are derived from the bar index rather than
 * Math.random(), so the server HTML and the hydrated client render the same
 * markup and the bars do not reshuffle on every re-render.
 */
const WAVE_HEIGHTS = Array.from({ length: 30 }, (_, index) => 6 + ((index * 53) % 19));

/** One avatar tint per card, in order. There are no portraits, so the initial carries the identity. */
const AVATAR_TINTS = [
  "bg-cobalt-tint text-cobalt-night",
  "bg-tangerine-tint text-tangerine-ink",
  "bg-mist-deep text-ink",
];

type CatalogueSource = "bundled" | "live";

export function VoiceSamples() {
  const [catalog, setCatalog] = useState<VoiceSample[]>(voices.catalog);
  const [source, setSource] = useState<CatalogueSource>("bundled");
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("all");
  const [useCase, setUseCase] = useState("all");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Live catalogue: the bundled list renders first, the API refines it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/voices");
        if (!response.ok) return;
        const payload: { items: VoiceSample[] | null; source: string } = await response.json();
        if (cancelled || !Array.isArray(payload.items) || payload.items.length === 0) return;
        setCatalog(payload.items);
        setSource("live");
      } catch {
        // Keep the bundled catalogue - it is the same content, one deploy older.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Favourites are read after the first paint: doing it during render would
  // make the server HTML and the first client render disagree.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(FAVOURITES_KEY);
        if (stored) setFavourites(JSON.parse(stored) as string[]);
      } catch {
        // Private mode or a corrupt value: start without favourites.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => audioRef.current?.pause(), []);

  const useCaseOptions = useMemo(
    () => Array.from(new Set(catalog.map((voice) => voice.use_case))),
    [catalog],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return catalog.filter((voice) => {
      if (gender !== "all" && voice.gender !== gender) return false;
      if (useCase !== "all" && voice.use_case !== useCase) return false;
      if (!term) return true;
      return [voice.name, voice.personality, voice.use_case, ...voice.languages.map((item) => item.label)]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [catalog, gender, query, useCase]);

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      } catch {
        // Favourites are a convenience; losing them is not worth an error.
      }
      return next;
    });
  }, []);

  const togglePreview = useCallback(
    async (voice: VoiceSample) => {
      setNotice(null);
      if (playingId === voice.id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      audioRef.current?.pause();
      setLoadingId(voice.id);
      try {
        const response = await fetch(`/api/voices/${voice.id}/preview`);
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
        setNotice("That sample could not be played. Try another voice, or listen again in a moment.");
      } finally {
        setLoadingId(null);
      }
    },
    [playingId],
  );

  return (
    <section id="voices" className="section bg-cream">
      <Container>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">{voices.eyebrow}</p>
            <h2 className="display mt-3 max-w-xl text-3xl leading-tight md:text-4xl">
              {voices.title}
            </h2>
          </div>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <p className="text-sm leading-relaxed text-ink-soft">{voices.body}</p>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", source === "live" ? "bg-cobalt" : "bg-tangerine")}
              />
              {source === "live" ? voices.sourceLive : voices.sourceBundled}
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-surface/70 p-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search voices</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, tone or language"
              className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15"
            />
          </label>
          <div className="flex gap-3">
            <FilterSelect
              label="Use case"
              value={useCase}
              onChange={setUseCase}
              options={[
                { value: "all", label: "All use cases" },
                ...useCaseOptions.map((item) => ({ value: item, label: item })),
              ]}
            />
            <FilterSelect
              label="Gender"
              value={gender}
              onChange={setGender}
              options={[
                { value: "all", label: "All voices" },
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
            />
          </div>
          <p className="shrink-0 text-xs text-ink-soft md:pl-1" aria-live="polite">
            {visible.length} of {catalog.length} voices
          </p>
        </div>

        {/* Voice cards: one card per voice, the strip at the bottom is the player. */}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((voice, index) => {
            const playing = playingId === voice.id;
            const busy = loadingId === voice.id;
            const saved = favourites.includes(voice.id);
            const extraLanguages = voice.languages.length - 1;

            return (
              <li key={voice.id} className="h-full">
                <article className="card card-lift flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                        AVATAR_TINTS[index % AVATAR_TINTS.length],
                      )}
                    >
                      {voice.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-ink">{voice.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">{voice.personality}</p>
                    </div>
                    {voice.featured ? (
                      <span className="shrink-0 rounded-full bg-tangerine-tint px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-tangerine-ink">
                        Featured
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleFavourite(voice.id)}
                      aria-pressed={saved}
                      aria-label={`${saved ? "Remove" : "Save"} ${voice.name} ${saved ? "from" : "to"} favourites`}
                      className={cn(
                        "-mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-mist",
                        saved ? "text-tangerine-deep" : "text-ink-soft/60 hover:text-cobalt",
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-4",
                          saved && "fill-tangerine text-tangerine-deep",
                        )}
                      />
                    </button>
                  </div>

                  <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
                    {voice.sample_text}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[0.68rem]">
                    <span className="rounded-full bg-mist px-2.5 py-1 font-medium text-ink-soft">
                      {voice.use_case}
                    </span>
                    <span className="rounded-full bg-mist px-2.5 py-1 font-medium capitalize text-ink-soft">
                      {voice.gender}
                    </span>
                    <span className="rounded-full bg-mist px-2.5 py-1 font-medium text-ink-soft">
                      {voice.languages[0]?.label}
                      {extraLanguages > 0 ? ` +${extraLanguages}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl bg-mist px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => void togglePreview(voice)}
                      aria-label={`${playing ? "Pause" : "Play"} ${voice.name}'s sample`}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-cobalt ring-1 ring-line transition-colors hover:bg-cobalt hover:text-white"
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : playing ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4 translate-x-[1px]" />
                      )}
                    </button>

                    <span
                      aria-hidden
                      className="flex h-8 min-w-0 flex-1 items-center justify-between gap-[2px] overflow-hidden"
                    >
                      {WAVE_HEIGHTS.map((height, bar) => (
                        <span
                          key={bar}
                          className={cn(
                            "w-[3px] shrink-0 rounded-full transition-colors",
                            playing ? "animate-wave bg-cobalt/70" : "bg-ink/20",
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

                    <Link
                      href="/free-trial"
                      className="shrink-0 rounded-full px-2 py-1 text-[0.7rem] font-semibold text-cobalt transition-colors hover:bg-surface hover:text-cobalt-night"
                    >
                      Use voice
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        {visible.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 px-5 py-10 text-center text-sm text-ink-soft">
            No voice matches those filters yet.
          </p>
        ) : null}

        <p className="mt-5 text-xs leading-relaxed text-ink-soft">{voices.footnote}</p>

        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-tangerine-ink">
          {notice}
        </p>
      </Container>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 appearance-none rounded-xl border border-line bg-surface pl-3 pr-8 text-sm text-ink outline-none focus:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
      />
    </label>
  );
}
