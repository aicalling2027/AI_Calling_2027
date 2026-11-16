import { cn } from "@/lib/utils";

/** One placeholder bar. Widths vary so the block reads as text, not stripes. */
function Bar({ className }: { className?: string }) {
  return (
    <span className={cn("block rounded-md bg-mist", className)} aria-hidden />
  );
}

/**
 * The pricing block before its chunk arrives: the toggle, the plan header row
 * and four body rows, built from the real paddings so swapping in
 * `PricingComparison` shifts nothing.
 */
export function PricingSkeleton() {
  return (
    <div className="mt-10">
      <p className="sr-only" role="status">
        Loading plans
      </p>

      <div aria-hidden className="flex animate-pulse justify-center">
        <Bar className="h-9 w-56 rounded-full" />
      </div>

      <div
        aria-hidden
        className="mt-6 animate-pulse overflow-hidden rounded-3xl border border-hairline bg-surface"
      >
        <div className="grid md:grid-cols-[26%_repeat(3,minmax(0,1fr))]">
          <div className="hidden px-5 pt-7 pb-6 md:block">
            <Bar className="h-2.5 w-16" />
          </div>
          {[0, 1, 2].map((column) => (
            <div
              key={column}
              className="border-t border-line p-5 md:border-t-0 md:border-l md:px-5 md:pt-7 md:pb-6"
            >
              <div className="flex min-h-6 items-center justify-between gap-2">
                <Bar className="h-2.5 w-14" />
                {column === 2 ? (
                  <Bar className="h-4 w-16 rounded-full bg-cobalt/25" />
                ) : null}
              </div>
              <Bar className="mt-5 h-8 w-24" />
              <Bar className="mt-2 h-3 w-[70%]" />
              <Bar className="mt-5 h-10 w-full rounded-full" />
            </div>
          ))}
        </div>

        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="grid md:grid-cols-[26%_repeat(3,minmax(0,1fr))]"
          >
            <div className="border-t border-line px-5 py-3">
              <Bar className="h-2.5 w-28" />
            </div>
            {[0, 1, 2].map((cell) => (
              <div
                key={cell}
                className="hidden border-t border-l border-line px-5 py-3 md:block"
              >
                <Bar className="h-2.5 w-5" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
