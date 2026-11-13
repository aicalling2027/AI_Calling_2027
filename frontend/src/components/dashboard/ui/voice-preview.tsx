"use client";

/**
 * Plays one voice sample.
 *
 * A bundled file in `public/voices` wins, because it is instant and costs
 * nothing. When none has been uploaded yet the sample is synthesised on demand
 * through `apiUrl`. The button reports what actually happened: a preview that
 * spins for two seconds and stays silent is worse than one that admits it
 * cannot play.
 */

import * as React from "react";
import { Loader2, Pause, Play, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "playing" | "missing";

export function VoicePreview({
  sources,
  apiUrl,
  label = "Preview voice",
  playingLabel = "Playing…",
  className,
}: {
  /** Candidate files, tried in order; the first one that loads wins. */
  sources: string[];
  /** Live sample endpoint, used once every candidate file has failed. */
  apiUrl?: string;
  label?: string;
  playingLabel?: string;
  className?: string;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  /** Guards setState after unmount, which audio events can still trigger. */
  const alive = React.useRef(true);
  const [status, setStatus] = React.useState<Status>("idle");

  React.useEffect(() => {
    alive.current = true;
    const audio = audioRef.current;
    return () => {
      alive.current = false;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
    };
  }, []);

  const update = (next: Status) => {
    if (alive.current) setStatus(next);
  };

  /**
   * Ask the API to synthesise the sample.
   *
   * The response carries base64 audio rather than a stream, so it is turned into
   * a data URL: an `<audio src>` pointed at the endpoint would download JSON.
   */
  const playLive = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!apiUrl) {
      update("missing");
      return;
    }

    update("loading");
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`preview ${response.status}`);
      const payload: { audio_base64?: string; encoding?: string } =
        await response.json();
      if (!payload.audio_base64) throw new Error("empty preview");

      audio.src = `data:audio/${payload.encoding === "wav" ? "wav" : "mpeg"};base64,${payload.audio_base64}`;
      await audio.play();
      update("playing");
    } catch {
      update("missing");
    }
  };

  /** Try `sources[index]`; a file that will not load moves on to the next. */
  const playFrom = (index: number) => {
    const audio = audioRef.current;
    const source = sources[index];
    if (!audio) return;

    if (!source) {
      void playLive();
      return;
    }

    audio.src = source;
    update("loading");

    void audio.play().then(
      () => update("playing"),
      () => {
        if (!alive.current) return;
        if (index + 1 < sources.length) playFrom(index + 1);
        else void playLive();
      },
    );
  };

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    // The card underneath is also a button; the click is for the sample only.
    event.stopPropagation();
    event.preventDefault();

    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      audio.pause();
      update("idle");
      return;
    }
    playFrom(0);
  };

  const text =
    status === "playing"
      ? playingLabel
      : status === "loading"
        ? "Loading sample…"
        : status === "missing"
          ? "Preview unavailable"
          : label;

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => update("idle")}
        onPause={() => {
          // Fires for our own pause and for the browser stopping playback.
          if (alive.current) setStatus((current) => (current === "playing" ? "idle" : current));
        }}
      />
      {/* Right-aligned so the control sits at the card's trailing edge and
          every card's play button forms one column down the grid. */}
      <span className={cn("mt-2 flex justify-end", className)}>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={status === "playing"}
          title={status === "missing" ? sources[0] : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md bg-surface px-2 text-[11px] font-medium ring-1 ring-line transition-colors",
            status === "missing" ? "text-ink-soft/70" : "text-ink-soft hover:text-ink",
          )}
        >
          {status === "loading" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : status === "playing" ? (
            <Pause className="size-3" />
          ) : status === "missing" ? (
            <VolumeX className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
          {text}
        </button>
      </span>
    </>
  );
}
