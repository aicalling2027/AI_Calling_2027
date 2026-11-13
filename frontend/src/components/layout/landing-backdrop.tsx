import { ShaderBackground } from "@/components/ui/shader-background";

/**
 * The landing page's ground.
 *
 * A fixed layer rather than a section backdrop: the page scrolls over one
 * continuous wash instead of restarting it per band, so the tangerine light
 * reads as the page's own background and not as nine separate panels.
 *
 * The veil is what keeps the copy legible. The shader's deepest stop is the
 * brand tangerine, and body text must never sit on it undiluted - the gradient
 * holds the mesh below the contrast it needs while leaving the colour visible.
 *
 * Section bands stay in the flow above this layer at partial opacity (the
 * translucent `bg-` tokens on the marketing sections), which is what lets the
 * wash show through the whole page rather than only the hero.
 */
export function LandingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <ShaderBackground className="size-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/30 to-white/45" />
    </div>
  );
}
