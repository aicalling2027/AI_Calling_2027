"use client";

/**
 * Holo Vinyl — a voice-assistant visualizer: a holographic ring of grooves around a spinning record.
 *
 *   <HoloVinyl state="speaking" level={level} label="AOTMS VOICE AGENT · " />
 *
 * States (feed `level` 0–1 from a mic / TTS analyser; it is smoothed inside):
 * - idle       — the record stops, the ring is quiet; now and then a faint glint passes.
 * - listening  — a rainbow rises from the bottom of the ring with the voice, the grooves pull in.
 * - thinking   — a comet with a rainbow tail runs round the ring, the record spins faster.
 * - speaking   — two mirrored rainbow spots run round the ring, the record and grooves swell with the voice.
 * States blend into each other over 0.7 s — nothing jumps.
 *
 * Theming: pass theme="light" to pin the ink colours, or theme="auto" to follow
 * shadcn variables and a `.dark` ancestor. The record label uses `accent` (any CSS color).
 *
 * Performance: one <canvas>; the label, its text and the grooves are drawn once into bitmaps and only
 * rotated/scaled per frame; quiet strokes are drawn in one batch; nothing is drawn while the disc is
 * off screen, the tab is hidden, or idle with nothing moving. `prefers-reduced-motion` stops the spin.
 *
 * Dependencies: none besides React. Works in Next.js as a client component.
 */

import * as React from "react";

export type HoloVinylState = "idle" | "listening" | "thinking" | "speaking";
export type HoloVinylTheme = "light" | "dark" | "auto";

export interface HoloVinylProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** What the assistant is doing. Default "idle". */
  state?: HoloVinylState;
  /** Voice loudness 0–1 (listening and speaking). Smoothed inside, so raw analyser values are fine. */
  level?: number;
  /** Text printed round the record label. Short is better; it is repeated to fill the circle if needed. */
  label?: string;
  /** Diameter: px number or any CSS length, e.g. "min(320px, 70vw)". Default 320. */
  size?: number | string;
  /** "light", "dark", or "auto" — follows a `.dark` ancestor and shadcn color variables. Default "auto". */
  theme?: HoloVinylTheme;
  /** Record label color (any CSS color). Default deep burgundy. */
  accent?: string;
  /** Motion speed multiplier for the spin and the light. Default 1. */
  speed?: number;
  /** Makes the disc a button (click, tap, Enter, Space) — e.g. tap to talk / interrupt. */
  onPress?: () => void;
  /** Accessible name. Default "Voice assistant". */
  name?: string;
}

/* ───────────────────────── styles ───────────────────────── */

const STYLE_ID = "holo-vinyl-styles";
const CSS = `
.hv{--hv-ink:hsl(var(--foreground,240 10% 3.9%));--hv-sub:hsl(var(--muted-foreground,240 3.8% 46.1%));position:relative;display:inline-block;flex:none;width:var(--hv-size);aspect-ratio:1;border-radius:9999px;outline:none;-webkit-tap-highlight-color:transparent}
.hv[data-theme=light]{--hv-ink:#19191b;--hv-sub:#5e5e63}
.hv[data-theme=dark]{--hv-ink:#f2f2f4;--hv-sub:#a1a1aa}
.hv[data-press]{cursor:pointer}
.hv[data-press]:focus-visible{outline:2px solid hsl(var(--ring,240 5% 64.9%));outline-offset:6px}
.hv>canvas{display:block;width:100%;height:100%}
.hv-probe{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}
.hv-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
`;

function useStyles() {
  React.useInsertionEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID))
      return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ───────────────────────── geometry & helpers ───────────────────────── */

const TAU = Math.PI * 2;
const N = 200; // strokes in the holographic ring
const BLEND = 0.7; // seconds for one state to flow into another
const STATES: HoloVinylState[] = ["idle", "listening", "thinking", "speaking"];
const SPOKEN: Record<HoloVinylState, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const CO = new Float32Array(N),
  SI = new Float32Array(N),
  HUE = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = (i / N) * TAU - Math.PI / 2;
  CO[i] = Math.cos(a);
  SI[i] = Math.sin(a);
  HUE[i] = (i / N) * 720; // two rainbows round the ring
}
const ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Frame-rate independent approach: same feel on 60, 120 and 144 Hz. */
const approach = (v: number, to: number, rate: number, dt: number) =>
  v + (to - v) * (1 - Math.exp(-rate * dt));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* Proportions in a 320-unit box (scaled to the real size). */
const R = 150,
  R0 = R * 0.6,
  R1 = R * 0.92,
  LR = R * 0.27;

interface Bitmaps {
  grooves: HTMLCanvasElement;
  label: HTMLCanvasElement;
  px: number;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Grooves and the record label are static — draw them once per size / color / text change. */
function bakeBitmaps(
  px: number,
  ink: string,
  sub: string,
  accent: string,
  text: string,
): Bitmaps {
  const GS = 1.1; // grooves bitmap is a bit larger so they can swell while speaking
  const grooves = makeCanvas(320 * px * GS, 320 * px * GS);
  const g = grooves.getContext("2d");
  if (g) {
    g.setTransform(px * GS, 0, 0, px * GS, grooves.width / 2, grooves.height / 2);
    for (let j = 0; j < 20; j++) {
      g.beginPath();
      g.arc(0, 0, R * (0.31 + j * 0.0128), 0, TAU);
      const major = j % 5 === 0;
      g.lineWidth = major ? 0.55 : 0.28;
      g.strokeStyle = major ? ink : sub;
      g.globalAlpha = major ? 0.85 : 0.6;
      g.stroke();
    }
  }
  const LS = 1.3; // label bitmap is oversampled so it stays crisp when it swells
  const label = makeCanvas(LR * 2 * px * LS + 4, LR * 2 * px * LS + 4);
  const l = label.getContext("2d");
  if (l) {
    l.setTransform(px * LS, 0, 0, px * LS, label.width / 2, label.height / 2);
    l.beginPath();
    l.arc(0, 0, LR, 0, TAU);
    l.fillStyle = accent;
    l.fill();
    const paper = "rgba(255,255,255,.92)";
    const ring = (r: number, w: number, a: number) => {
      l.beginPath();
      l.arc(0, 0, r, 0, TAU);
      l.lineWidth = w;
      l.strokeStyle = paper;
      l.globalAlpha = a;
      l.stroke();
      l.globalAlpha = 1;
    };
    ring(LR * 0.94, 0.5, 0.5);
    ring(LR * 0.5, 0.4, 0.4);
    // text round the label, letters spaced by their real width
    l.fillStyle = paper;
    l.font = "600 8.5px ui-sans-serif, system-ui, sans-serif";
    l.textAlign = "center";
    l.textBaseline = "middle";
    const rr = LR * 0.75,
      circ = TAU * rr;
    const base = text.trim() ? text : "VOICE · ";
    const unit = /[\s·•|/-]$/.test(base) ? base : base + " · ";
    const widthOf = (s: string) =>
      [...s].reduce((sum, ch) => sum + l.measureText(ch).width + 0.65, 0);
    let t = unit;
    while (widthOf(t) < circ * 0.8) t += unit; // short text repeats round the circle
    const chars = [...t],
      ws = chars.map((ch) => l.measureText(ch).width + 0.65);
    const k = circ / ws.reduce((x, y) => x + y, 0); // < 1: long text gets smaller; > 1: letters spread a little
    if (k < 1)
      l.font = `600 ${(8.5 * k).toFixed(2)}px ui-sans-serif, system-ui, sans-serif`;
    let acc = 0;
    chars.forEach((ch, i) => {
      const w = ws[i] * k;
      l.save();
      l.rotate((acc + w / 2) / rr);
      l.translate(0, -rr);
      l.fillText(ch, 0, 0);
      l.restore();
      acc += w;
    });
    // spindle hole
    l.globalCompositeOperation = "destination-out";
    l.beginPath();
    l.arc(0, 0, R * 0.03, 0, TAU);
    l.fill();
    l.globalCompositeOperation = "source-over";
  }
  return { grooves, label, px };
}

/* ───────────────────────── component ───────────────────────── */

export const HoloVinyl = React.forwardRef<HTMLDivElement, HoloVinylProps>(
  function HoloVinyl(
    {
      state = "idle",
      level = 0,
      label = "LOREM IPSUM DOLOR SIT AMET · CONSECTETUR · ",
      size = 320,
      theme = "auto",
      accent = "#7A1E2C",
      speed = 1,
      onPress,
      name = "Voice assistant",
      className,
      style,
      onKeyDown,
      onClick,
      ...rest
    },
    ref,
  ) {
    useStyles();
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const inkRef = React.useRef<HTMLSpanElement>(null);
    const subRef = React.useRef<HTMLSpanElement>(null);
    const accRef = React.useRef<HTMLSpanElement>(null);
    React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

    // Live values read by the animation loop: synced after render rather than
    // during it, so a prop change never re-subscribes the loop.
    const live = React.useRef({ state, level, speed });
    React.useEffect(() => {
      live.current.state = STATES.includes(state) ? state : "idle";
      live.current.level = clamp01(Number.isFinite(level) ? level : 0);
      live.current.speed = Math.max(0, Number.isFinite(speed) ? speed : 1);
    });
    const kick = React.useRef<() => void>(() => {});
    React.useEffect(() => kick.current(), [state]);

    // Bitmaps depend on size, colors and text; rebuilt only when one of them changes.
    const looks = React.useRef({ label, theme });
    const rebake = React.useRef<() => void>(() => {});
    React.useEffect(() => {
      looks.current = { label, theme };
      rebake.current();
    }, [label, theme, accent]);

    React.useEffect(() => {
      const root = rootRef.current,
        cv = canvasRef.current;
      if (!root || !cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const reduce =
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;

      let css = 0,
        px = 1,
        bm: Bitmaps | null = null;
      let ink = "#19191b",
        sub = "#5e5e63",
        hueL = 52,
        quietA = 0.28;

      const readColors = () => {
        ink = inkRef.current ? getComputedStyle(inkRef.current).color : ink;
        sub = subRef.current ? getComputedStyle(subRef.current).color : sub;
        const m = sub.match(/\d+(\.\d+)?/g);
        const lum = m ? (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 : 0.4;
        const darkBg = lum > 0.5; // light grey "muted" means a dark page
        hueL = darkBg ? 62 : 52;
        quietA = darkBg ? 0.34 : 0.28;
      };
      const bake = () => {
        if (!css) return;
        readColors();
        const acc = accRef.current
          ? getComputedStyle(accRef.current).color
          : "#7A1E2C";
        bm = bakeBitmaps(px, ink, sub, acc, looks.current.label);
        dirty = true;
        start();
      };
      rebake.current = bake;

      const resize = () => {
        const w = root.getBoundingClientRect().width;
        if (!w) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const nextPx = (w / 320) * dpr;
        if (w === css && Math.abs(nextPx - px) < 1e-3) return;
        css = w;
        px = nextPx;
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(w * dpr);
        bake();
      };

      // animation state
      const W: Record<HoloVinylState, number> = {
        idle: 0,
        listening: 0,
        thinking: 0,
        speaking: 0,
      };
      W[live.current.state] = 1;
      let t = 0,
        lastT = -1,
        raf = 0,
        onScreen = true,
        dirty = true;
      let lvl = 0,
        lvlListen = 0,
        act = live.current.state === "idle" ? 0 : 1,
        eS = 0,
        eL = 0,
        core = 1;
      let ampS = 0.5,
        vS = 0.35,
        Ls = 0,
        Lc = 0,
        Li = 0,
        spin = 0,
        spinV = 0;
      const M = new Float32Array(N);

      const kOf = (s: HoloVinylState, a: number) => {
        if (s === "idle") {
          const g = Math.pow(Math.max(0, Math.sin(t * 0.8)), 6);
          if (g < 0.002) return 0;
          const d = ang(a - Li),
            d2 = ang(a - Li - Math.PI);
          return (
            0.75 *
            g *
            Math.max(
              Math.exp((-d * d) / 0.03),
              Math.exp((-d2 * d2) / 0.03),
            )
          );
        }
        if (s === "listening") {
          const reach = lvlListen * Math.PI * 0.85,
            dv = Math.abs(ang(a - Math.PI / 2)),
            x = (reach - dv) / 0.35;
          return x <= 0 ? 0 : Math.min(1, x) * (0.4 + 0.6 * (1 - dv / Math.PI));
        }
        if (s === "thinking") {
          const d = ang(a - Lc);
          return d <= 0 ? 0.95 * Math.exp(d * 2.4) : Math.exp((-d * d) / 0.004);
        }
        const sp = ampS * ampS * 0.18,
          d = ang(a - Ls),
          d2 = ang(a - Ls - Math.PI);
        return Math.max(Math.exp((-d * d) / sp), Math.exp((-d2 * d2) / sp));
      };

      const draw = () => {
        if (!bm) return;
        const u = px; // canvas px per design unit
        ctx.setTransform(u, 0, 0, u, 0, 0);
        ctx.clearRect(0, 0, 320, 320);
        const C = 160;
        const ks = STATES.filter((s) => W[s] > 0.001),
          ew = ks.map((s) => ease(W[s])),
          tw = ew.reduce((x, y) => x + y, 0) || 1;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * TAU - Math.PI / 2;
          let k = 0;
          for (let q = 0; q < ks.length; q++) k += ew[q] * kOf(ks[q], a);
          k = clamp01(k / tw);
          M[i] = k * k * (3 - 2 * k); // smooth, never a hard on/off
        }
        // quiet strokes: one batch
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          if (M[i] >= 0.02) continue;
          ctx.moveTo(C + R0 * CO[i], C + R0 * SI[i]);
          ctx.lineTo(C + R1 * CO[i], C + R1 * SI[i]);
        }
        ctx.strokeStyle = sub;
        ctx.globalAlpha = quietA + 0.25 * act;
        ctx.lineWidth = 0.65;
        ctx.stroke();
        // lit strokes: color slides from grey to rainbow with the light
        const hs = t * 30,
          wb = 2.9 + eS * 1.6;
        for (let i = 0; i < N; i++) {
          const m = M[i];
          if (m < 0.02) continue;
          ctx.beginPath();
          ctx.moveTo(C + R0 * CO[i], C + R0 * SI[i]);
          ctx.lineTo(C + R1 * CO[i], C + R1 * SI[i]);
          ctx.strokeStyle = `hsl(${((HUE[i] + hs) % 360) | 0},${(3 + 85 * m) | 0}%,${(38 + (hueL - 38) * m) | 0}%)`;
          ctx.globalAlpha = quietA + 0.25 * act + (1 - quietA - 0.25 * act) * m;
          ctx.lineWidth = (1.3 + m * wb) / 2;
          ctx.stroke();
        }
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(C, C, R * 0.985, 0, TAU);
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = sub;
        ctx.stroke();
        // grooves and label from bitmaps
        const sc = 1 + eS * 0.07 - eL * 0.08,
          gw = 320 * 1.1 * sc;
        ctx.globalAlpha = 0.55 + 0.45 * act;
        ctx.drawImage(bm.grooves, C - gw / 2, C - gw / 2, gw, gw);
        ctx.globalAlpha = 0.75 + 0.25 * act;
        ctx.translate(C, C);
        ctx.rotate(spin);
        const lw = ((bm.label.width / bm.px / 1.3) * core);
        ctx.drawImage(bm.label, -lw / 2, -lw / 2, lw, lw);
        ctx.globalAlpha = 1;
      };

      const tick = (now: number) => {
        raf = 0;
        const dt = lastT < 0 ? 1 / 60 : Math.min(0.05, (now - lastT) / 1000); // a long gap never turns into a jump
        lastT = now;
        const L = live.current,
          s = L.state,
          v = L.speed;
        t += dt;
        for (const k of STATES)
          W[k] =
            k === s ? Math.min(1, W[k] + dt / BLEND) : Math.max(0, W[k] - dt / BLEND);
        const voiced = s === "listening" || s === "speaking";
        lvl = approach(lvl, voiced ? L.level : 0, 11, dt);
        act = approach(act, s === "idle" ? 0 : 1, 2, dt);
        eS = approach(eS, s === "speaking" ? lvl : 0, s === "speaking" ? 8 : 2.5, dt);
        eL = approach(eL, s === "listening" ? lvl : 0, s === "listening" ? 8 : 2.5, dt);
        if (s === "listening") lvlListen = lvl; // the outgoing state keeps its last look while it fades
        if (s === "speaking") {
          vS = approach(vS, 0.35 + lvl * 1.1, 3, dt);
          ampS = approach(ampS, 0.5 + lvl, 8, dt);
        }
        Ls += dt * vS * v;
        Lc += dt * (reduce ? 1.1 : 2.2) * v;
        Li += dt * 0.22 * v;
        const coreT =
          s === "speaking"
            ? 1 + lvl * 0.22
            : s === "listening"
              ? 0.94 - lvl * 0.06
              : s === "thinking"
                ? 1 + 0.03 * Math.sin(t * 5)
                : 0.92;
        core = approach(core, coreT, 7, dt);
        spinV = approach(
          spinV,
          reduce || s === "idle" ? 0 : (s === "thinking" ? 1.3 : 0.4 + eS * 0.5) * v,
          2,
          dt,
        );
        spin = (spin + dt * spinV) % TAU;
        const still =
          s === "idle" &&
          W.idle >= 1 &&
          Math.pow(Math.max(0, Math.sin(t * 0.8)), 6) < 0.002 &&
          spinV < 0.002 &&
          act < 0.002 &&
          Math.abs(core - coreT) < 0.001 &&
          eS < 0.001 &&
          eL < 0.001;
        if (!still || dirty) {
          draw();
          dirty = false;
        }
        if (onScreen && !document.hidden) raf = requestAnimationFrame(tick);
      };
      const start = () => {
        if (!raf && onScreen && !document.hidden) {
          lastT = -1;
          raf = requestAnimationFrame(tick);
        }
      };
      const stop = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };
      kick.current = () => {
        dirty = true;
        start();
      };

      resize();
      const ro =
        typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      ro?.observe(root);
      const io =
        typeof IntersectionObserver !== "undefined"
          ? new IntersectionObserver(([e]) => {
              onScreen = e.isIntersecting;
              if (onScreen) start();
              else stop();
            })
          : null;
      io?.observe(root);
      const onVis = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVis);
      // theme="auto": recolor when the page switches .dark / data-theme
      const mo = new MutationObserver(() => {
        if (looks.current.theme === "auto") bake();
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
      if (document.body)
        mo.observe(document.body, {
          attributes: true,
          attributeFilter: ["class", "style", "data-theme"],
        });
      const dprMq =
        typeof matchMedia !== "undefined"
          ? matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
          : null;
      const onDpr = () => {
        css = 0;
        resize();
      };
      dprMq?.addEventListener?.("change", onDpr);
      start();
      return () => {
        stop();
        ro?.disconnect();
        io?.disconnect();
        mo.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        dprMq?.removeEventListener?.("change", onDpr);
        kick.current = () => {};
        rebake.current = () => {};
      };
    }, []);

    const pressable = !!onPress;
    const spoken = SPOKEN[STATES.includes(state) ? state : "idle"];
    return (
      <div
        ref={rootRef}
        data-theme={theme}
        data-state={state}
        data-press={pressable ? "" : undefined}
        className={["hv", className].filter(Boolean).join(" ")}
        style={
          {
            "--hv-size": typeof size === "number" ? `${size}px` : size,
            ...style,
          } as React.CSSProperties
        }
        role={pressable ? "button" : undefined}
        tabIndex={pressable ? 0 : undefined}
        aria-label={pressable ? `${name}: ${spoken.toLowerCase()}` : undefined}
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) onPress?.();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!pressable || e.defaultPrevented || e.repeat) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPress?.();
          }
        }}
      >
        <canvas
          ref={canvasRef}
          role={pressable ? undefined : "img"}
          aria-hidden={pressable ? true : undefined}
          aria-label={
            pressable ? undefined : `${name}: ${spoken.toLowerCase()}`
          }
        />
        <span
          ref={inkRef}
          className="hv-probe"
          style={{ color: "var(--hv-ink)" }}
          aria-hidden="true"
        />
        <span
          ref={subRef}
          className="hv-probe"
          style={{ color: "var(--hv-sub)" }}
          aria-hidden="true"
        />
        <span
          ref={accRef}
          className="hv-probe"
          style={{ color: accent }}
          aria-hidden="true"
        />
        {/* No role="status" here: the disc is decorative and its state changes
            every few seconds, so a live region would chatter at screen readers. */}
        <span className="hv-sr">{spoken}</span>
      </div>
    );
  },
);

export default HoloVinyl;
