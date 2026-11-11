"use client";

import dynamic from "next/dynamic";
import * as React from "react";

/**
 * Loads the silk-spider cursor on the client only: three.js, the embedded GLB
 * and the texture projections stay out of the server render and the shared
 * first-load JS.
 */
const SilkSpiderCursor = dynamic(() => import("@/components/ui/silk-spider-cursor"), {
  ssr: false,
  loading: () => null,
});

/** A pointer that cannot hover precisely (touch) gets the plain page. */
const FINE_POINTER = "(min-width: 768px) and (pointer: fine)";

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(FINE_POINTER);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

const getSnapshot = () => window.matchMedia(FINE_POINTER).matches;
const getServerSnapshot = () => false;

type LandingSpiderCursorProps = {
  /** CSS selector for the boxes the silk is allowed to tack onto. */
  anchorSelector?: string;
  /** Leg span in px. */
  size?: number;
  silkColor?: string;
  maxThreads?: number;
  seedWebs?: number;
};

/**
 * The landing page cursor companion. Decorative only: both canvases ignore
 * pointer events, so links, forms and keyboard focus behave exactly as before.
 * Mounted on the home page only.
 */
export function LandingSpiderCursor({
  anchorSelector = "[data-silk-anchor], .card",
  size = 190,
  silkColor = "#8fa3cc",
  maxThreads = 90,
  seedWebs = 2,
}: LandingSpiderCursorProps) {
  const enabled = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!enabled) {
    return null;
  }

  return (
    <SilkSpiderCursor
      anchorSelector={anchorSelector}
      size={size}
      silkColor={silkColor}
      maxThreads={maxThreads}
      seedWebs={seedWebs}
      sleepAfter={5200}
      maxDpr={1.75}
      zIndex={30}
    />
  );
}
