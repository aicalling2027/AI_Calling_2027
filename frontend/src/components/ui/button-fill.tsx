"use client";

import { useEffect } from "react";

/**
 * Pointer origin for the shared `.btn-fill` hover (see globals.css).
 *
 * Every button in the app renders the same tangerine disc, and the disc has to
 * start where the cursor entered. One delegated listener writes `--btn-x`,
 * `--btn-y` and `--btn-d` on the nearest `.btn-fill` element, so <Button> and
 * buttonVariants() links both get the effect without per-call-site wiring.
 */

/** Circle that still covers the furthest corner from (x, y). */
function coverDiameter(width: number, height: number, x: number, y: number) {
  return Math.ceil(
    2 *
      Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, height - y),
        Math.hypot(width - x, height - y),
      ),
  );
}

function setOrigin(button: HTMLElement, clientX: number, clientY: number) {
  const rect = button.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  button.style.setProperty("--btn-x", `${x}px`);
  button.style.setProperty("--btn-y", `${y}px`);
  button.style.setProperty(
    "--btn-d",
    `${coverDiameter(rect.width, rect.height, x, y)}px`,
  );
}

export function ButtonFill() {
  useEffect(() => {
    function handlePointerOver(event: PointerEvent) {
      // Touch has no hover, and leaving the default origin is better than a
      // disc that sticks to the last tap.
      if (event.pointerType === "touch") return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLElement>(".btn-fill");
      if (!button) return;

      setOrigin(button, event.clientX, event.clientY);
    }

    document.addEventListener("pointerover", handlePointerOver, {
      passive: true,
    });
    return () => document.removeEventListener("pointerover", handlePointerOver);
  }, []);

  return null;
}
