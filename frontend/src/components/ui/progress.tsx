import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Thin progress track used for per-agent rates. Kept deliberately quiet: a mist
 * track with a cobalt bar, so a row of them reads as texture rather than a
 * row of coloured blocks.
 */
function Progress({
  value,
  className,
  barClassName,
  ...props
}: React.ComponentProps<"div"> & {
  value: number;
  barClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-mist",
        className,
      )}
      {...props}
    >
      <div
        className={cn("h-full rounded-full bg-cobalt", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
