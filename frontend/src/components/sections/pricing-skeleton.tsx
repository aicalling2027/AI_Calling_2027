import { cn } from "@/lib/utils";

/** One placeholder bar. Widths vary so the block reads as text, not stripes. */
function Bar({ className }: { className?: string }) {
  return (
    <span className={cn("block rounded-md bg-mist", className)} aria-hidden />
  );
}

/**
 * The rate card before its prices arrive: the same frame, the same two internal
 * rules, the same column rhythm and the same blue edge on the third plan. Built
 * from the real paddings, so swapping in `PricingCards` shifts nothing.
 */
export function PricingSkeleton() {
  return (
    <div className="mt-12">
      <p className="sr-only" role="status">
        Loading plans
      </p>
      <div
        aria-hidden
        className="animate-pulse overflow-hidden rounded-3xl border border-hairline bg-surface"
      >
        <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col px-6 py-7 md:px-7 md:py-8">
              <div className="flex min-h-6 items-center justify-between gap-2">
                <Bar className="h-2.5 w-16" />
                {index === 2 ? (
                  <Bar className="h-4 w-16 rounded-full bg-cobalt/25" />
                ) : null}
              </div>
              <Bar className="mt-7 h-9 w-32" />
              <div className="mt-3 min-h-[3rem]">
                <Bar className="h-3 w-[68%]" />
              </div>
              <div className="mt-5 divide-y divide-line border-y border-line">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between py-2.5"
                  >
                    <Bar className="h-2.5 w-24" />
                    <Bar className="h-2.5 w-6" />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-1 flex-col gap-2.5">
                <Bar className="h-3 w-[76%]" />
                <Bar className="h-3 w-[58%]" />
                <Bar className="h-3 w-[66%]" />
              </div>
              <Bar className="mt-7 h-11 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
