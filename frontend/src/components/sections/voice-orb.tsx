"use client";

import { Pause, Play } from "lucide-react";
import * as React from "react";

import { HoloVinyl, type HoloVinylState } from "@/components/ui/holo-vinyl";

/**
 * The hero's voice visualiser: a spinning record with the agent's play/pause in
 * the middle of the label and rings peeling off the edge while it runs.
 *
 * The sequence is illustrative — it acts out one call (listening, thinking,
 * speaking) with a speech-shaped envelope. Point `level` at an AnalyserNode and
 * the rest of the component stays the same.
 */

const SCRIPT: { state: HoloVinylState; hold: number }[] = [
  { state: "listening", hold: 5400 },
  { state: "thinking", hold: 2200 },
  { state: "speaking", hold: 6800 },
];

const VOICED: HoloVinylState[] = ["listening", "speaking"];

export function VoiceOrb() {
  const [step, setStep] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  const running = playing && !reduceMotion;
  const state = running ? SCRIPT[step].state : "idle";

  // Follow the OS setting rather than guessing at first paint.
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Hold each beat, then move to the next one — only while the demo is playing.
  React.useEffect(() => {
    if (!running) return;

    const id = window.setTimeout(
      () => setStep((value) => (value + 1) % SCRIPT.length),
      SCRIPT[step].hold,
    );
    return () => window.clearTimeout(id);
  }, [running, step]);

  // Phrases built from syllables — 20 updates a second is plenty, the disc
  // smooths the value itself.
  React.useEffect(() => {
    if (!running || !VOICED.includes(state)) return;

    const startedAt = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - startedAt) / 1000;
      const phrase = (Math.sin(t * 0.7) + 1) / 2;
      const syllable =
        Math.max(0, Math.sin(t * 6.2)) * 0.7 +
        Math.max(0, Math.sin(t * 9.1 + 1)) * 0.3;

      setLevel(Math.round((0.15 + 0.85 * phrase) * syllable * 100) / 100);
    }, 50);

    return () => window.clearInterval(id);
  }, [running, state]);

  return (
    <div className="relative inline-grid shrink-0 place-items-center">
      {/* Waves peel off the disc edge. They only exist while it is playing, so a
          paused agent reads as still rather than as a frozen ring. */}
      {running
        ? [0, 1, 2].map((index) => (
            <span
              key={index}
              aria-hidden
              className="animate-halo pointer-events-none absolute inset-0 rounded-full border border-cobalt-line"
              style={{ animationDelay: `${index * 1.1}s` }}
            />
          ))
        : null}

      <HoloVinyl
        accent="#185adb"
        className="col-start-1 row-start-1"
        label="AOTMS VOICE AGENT · TELUGU · INBOUND · "
        level={running ? level : 0}
        name="AOTMS voice agent"
        size="min(380px, 78vw, 46vh)"
        state={state}
        theme="light"
      />

      {/* Shares the grid cell with the disc, so it sits on the record label
          (25% of the disc) without absolute positioning. The printed ring
          around it stays visible, and the target is >= 44px at every size. */}
      <button
        type="button"
        onClick={() => setPlaying((value) => !value)}
        aria-label={playing ? "Pause the agent demo" : "Play the agent demo"}
        className="btn-fill col-start-1 row-start-1 grid aspect-square w-[26%] cursor-pointer place-items-center rounded-full border border-white/25 bg-cobalt text-white shadow-button transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {playing ? (
          <Pause aria-hidden className="size-[36%]" />
        ) : (
          <Play aria-hidden className="size-[36%]" />
        )}
      </button>
    </div>
  );
}
