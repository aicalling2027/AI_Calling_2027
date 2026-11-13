"use client";

/**
 * Plays one voice sample from `public/voices`.
 *
 * The button reports what actually happened. There is no timer standing in for
 * playback: if no file has been uploaded yet it says so, because a preview that
 * spins for two seconds and stays silent is worse than one that admits it is
 * missing.
 */

import * as React from "react";
import { Loader2, Pause, Play, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "playing" | "missing";

export function VoicePreview({
  sources,
  label = "Preview voice",
  playingLabel = "Playing…",
  className,
}: {
  /** Candidate files, tried in order; the first one that loads wins. */
  sources: string[];
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

  /** Try `sources[index]`; a file that will not load moves on to the next. */
  const playFrom = (index: number) => {
    const audio = audioRef.current;
    const source = sources[index];
    if (!audio) return;

    if (!source) {
      update("missing");
      return;
    }

    audio.src = source;
    update("loading");

    void audio.play().then(
      () => update("playing"),
      () => {
        if (!alive.current) return;
        if (index + 1 < sources.length) playFrom(index + 1);
        else update("missing");
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
          ? "Sample not uploaded"
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
      <button
        type="button"
        onClick={toggle}
        aria-pressed={status === "playing"}
        title={status === "missing" ? sources[0] : undefined}
        className={cn(
          "mt-2 inline-flex h-7 items-center gap-1.5 rounded-md bg-surface px-2 text-[11px] font-medium ring-1 ring-line transition-colors",
          status === "missing" ? "text-ink-soft/70" : "text-ink-soft hover:text-ink",
          className,
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
    </>
  );
}
