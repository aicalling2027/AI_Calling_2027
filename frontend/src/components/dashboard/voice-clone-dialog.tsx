"use client";

/**
 * Instant voice cloning, in the three steps the product promises: record,
 * personalise, consent.
 *
 * The take is captured with MediaRecorder in the browser and never leaves it -
 * this deployment has no provider-side cloning, so the flow ends by saving the
 * clone's identity (name, language, length) through `onSaved`. The consent
 * checkbox is mandatory because a clone without recorded permission must not
 * exist anywhere, even as a local record.
 *
 * Ten seconds is the whole take: long enough for a usable persona, short enough
 * that re-recording after a stumble costs nothing.
 */

import * as React from "react";
import { Mic, RotateCcw, Shuffle, Square } from "lucide-react";

import {
  Field,
  Modal,
  SelectInput,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { buttonVariants } from "@/components/ui/button";
import { LANGUAGES } from "@/content/workspace";
import type { ClonedVoice } from "@/lib/cloned-voices";
import { newCloneId } from "@/lib/cloned-voices";
import { cn } from "@/lib/utils";

/** The take length the product promises. */
const MAX_TAKE_MS = 10_000;

/** Short enough to read in about ten seconds, plain enough to read cleanly. */
const PASSAGES = [
  "The morning train leaves at seven, and the platform is already full of people on their way to work.",
  "Every good phone call starts with a clear hello, a short reason for calling, and one simple question.",
  "Our support desk answers in twelve Indian languages, and a real person reads every request that comes in.",
];

const STEP_LABELS = ["Record", "Personalise", "Consent"] as const;

type Phase = "idle" | "recording" | "recorded";

const seconds = (value: number) => `${(value / 1000).toFixed(1)}s`;

export function VoiceCloneDialog({
  onClose,
  onSaved,
  defaultLanguage,
}: {
  onClose: () => void;
  /** Called with the saved clone once consent has been given. */
  onSaved: (clone: ClonedVoice) => void;
  defaultLanguage: string;
}) {
  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  const [language, setLanguage] = React.useState(defaultLanguage);
  const [passage, setPassage] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [takeUrl, setTakeUrl] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const tickerRef = React.useRef<number | null>(null);
  const takeRef = React.useRef<string | null>(null);

  /** Stop the microphone, the clock and the take URL. Safe to call twice. */
  const release = React.useCallback(() => {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const dropTake = React.useCallback(() => {
    if (takeRef.current) {
      URL.revokeObjectURL(takeRef.current);
      takeRef.current = null;
    }
    setTakeUrl(null);
  }, []);

  // Mounted only while the dialog is open, so the first render is already a
  // clean sheet; unmounting is where the microphone goes back to the browser.
  React.useEffect(
    () => () => {
      release();
      if (takeRef.current) URL.revokeObjectURL(takeRef.current);
    },
    [release],
  );

  const startRecording = async () => {
    setError(null);
    dropTake();

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("This browser cannot record audio. Chrome, Edge or Safari can.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (tickerRef.current !== null) {
          window.clearInterval(tickerRef.current);
          tickerRef.current = null;
        }
        setPhase("recorded");
        if (chunks.length === 0) {
          setError("The take came back empty. Record it again.");
          return;
        }
        const url = URL.createObjectURL(
          new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
        );
        takeRef.current = url;
        setTakeUrl(url);
      };

      recorder.start();
      setPhase("recording");
      setElapsed(0);

      const startedAt = Date.now();
      tickerRef.current = window.setInterval(() => {
        const run = Date.now() - startedAt;
        if (run >= MAX_TAKE_MS) {
          setElapsed(MAX_TAKE_MS);
          if (recorder.state === "recording") recorder.stop();
          return;
        }
        setElapsed(run);
      }, 100);
    } catch (cause) {
      const blocked =
        cause instanceof Error && cause.name === "NotAllowedError";
      setError(
        blocked
          ? "Microphone access was blocked. Allow it in the browser, then record again."
          : "The microphone could not be opened. Check your input device and try again.",
      );
      setPhase("idle");
      release();
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const save = () => {
    if (!name.trim() || !consent) return;
    release();
    dropTake();
    onSaved({
      id: newCloneId(),
      name: name.trim(),
      language,
      durationMs: elapsed,
      createdAt: new Date().toISOString(),
      status: "Saved",
    });
  };

  const readSeconds = Math.max(
    1,
    Math.round(PASSAGES[passage].split(/\s+/).length / 2.5),
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Clone a voice"
      description="Record ten seconds of clear speech, name the clone, then confirm you have the rights to use it."
      footer={
        step === 0 ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!takeUrl}
              className={buttonVariants({})}
            >
              Continue
            </button>
          </>
        ) : step === 1 ? (
          <>
            <button
              type="button"
              onClick={() => setStep(0)}
              className={buttonVariants({ variant: "outline" })}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className={buttonVariants({})}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(1)}
              className={buttonVariants({ variant: "outline" })}
            >
              Back
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!consent}
              className={buttonVariants({})}
            >
              Save clone
            </button>
          </>
        )
      }
    >
      <ol className="flex items-center gap-2 text-[11px] font-medium">
        {STEP_LABELS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5",
              step === index
                ? "text-ink"
                : index < step
                  ? "text-cobalt-deep"
                  : "text-ink-soft/70",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border text-[10px]",
                step === index
                  ? "border-cobalt bg-cobalt text-white"
                  : index < step
                    ? "border-cobalt/40 bg-cobalt-tint text-cobalt-deep"
                    : "border-line bg-surface",
              )}
            >
              {index + 1}
            </span>
            {label}
            {index < STEP_LABELS.length - 1 ? (
              <span aria-hidden className="text-ink-soft/40">
                ·
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="space-y-3">
          <Field
            label="Language"
            htmlFor="clone-language"
            hint="Record in the language you will use the clone for. A clone does not carry an accent across languages."
          >
            <SelectInput
              id="clone-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
          </Field>

          <div className="rounded-lg border border-line bg-mist-soft p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink">Read this aloud</p>
              <button
                type="button"
                onClick={() =>
                  setPassage((index) => (index + 1) % PASSAGES.length)
                }
                disabled={phase === "recording"}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                <Shuffle aria-hidden className="size-3" />
                Shuffle
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {PASSAGES[passage]}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-soft">
              About {readSeconds} seconds. Speak clearly, in a quiet room, with
              no music.
            </p>
          </div>

          {phase === "recording" ? (
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                  <Mic aria-hidden className="size-3.5" />
                  Recording
                </span>
                <span className="tabular-nums text-ink-soft">
                  {seconds(elapsed)} / {seconds(MAX_TAKE_MS)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist">
                <div
                  aria-hidden
                  className="h-full bg-destructive transition-[width] duration-100"
                  style={{ width: `${(elapsed / MAX_TAKE_MS) * 100}%` }}
                />
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-3 w-full",
                })}
              >
                <Square aria-hidden />
                Stop recording
              </button>
            </div>
          ) : takeUrl ? (
            <div className="space-y-2">
              <audio
                src={takeUrl}
                controls
                aria-label="Your recording"
                className="w-full"
              />
              <button
                type="button"
                onClick={() => void startRecording()}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <RotateCcw aria-hidden />
                Re-record
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              className={buttonVariants({ className: "w-full" })}
            >
              <Mic aria-hidden />
              Start recording
            </button>
          )}

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <Field
            label="Name this voice"
            htmlFor="clone-name"
            hint="A specific name beats a default label: Course narrator v2 is easier to find than My voice."
          >
            <TextInput
              id="clone-name"
              value={name}
              maxLength={40}
              placeholder="e.g. Priya - course narrator"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-surface p-3 text-xs">
            <dt className="text-ink-soft">Language</dt>
            <dd className="text-ink">{language}</dd>
            <dt className="text-ink-soft">Take</dt>
            <dd className="text-ink">{seconds(elapsed)}</dd>
            <dt className="text-ink-soft">Recording</dt>
            <dd className="text-ink">Stays in this browser</dd>
          </dl>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-cream/60 p-3 text-xs leading-relaxed text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 size-3.5 rounded border-line accent-cobalt"
            />
            <span>
              I have the rights to clone this voice, and I consent to it being
              used as an AI voice on this workspace.
            </span>
          </label>

          <p className="text-[11px] leading-relaxed text-ink-soft">
            This deployment saves the clone&apos;s name, language and length on
            this device; the recording itself is not uploaded. A cloned voice
            can be assigned to an employee once voice cloning is enabled here.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
