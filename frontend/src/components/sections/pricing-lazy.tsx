"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { PricingSkeleton } from "@/components/sections/pricing-skeleton";
import type { PricingPlan } from "@/content/plans";

/**
 * The animated grid is its own chunk. Browsers that never reach this section
 * never download it; the skeleton holds the space until they do.
 */
const PricingCards = dynamic(
  () =>
    import("@/components/sections/pricing-cards").then(
      (module) => module.PricingCards,
    ),
  { ssr: false, loading: () => <PricingSkeleton /> },
);

/**
 * Mounts the plan grid when the visitor is about to scroll to it.
 *
 * The root margin starts the download roughly one screen early, so the cards
 * are ready by the time the section is in view and the skeleton covers only
 * the delay it was designed for - not a network round trip the visitor caused.
 */
export function LazyPricingGrid({ plans }: { plans: PricingPlan[] }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (requested) return;
    const node = anchor.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // No observer to wait on: show the cards on the next frame rather than
      // leaving the skeleton up. Deferred so the effect itself sets no state.
      const frame = requestAnimationFrame(() => setRequested(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [requested]);

  return (
    <div ref={anchor}>
      {requested ? <PricingCards plans={plans} /> : <PricingSkeleton />}
    </div>
  );
}
