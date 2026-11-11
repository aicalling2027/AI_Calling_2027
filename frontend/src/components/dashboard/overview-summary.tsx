import { dashboardSummary } from "@/content/dashboard-overview";

/**
 * "Recent summary" (PRD Dashboard D) — today only. A single light band with
 * hairline separators rather than another row of cards.
 */
export function OverviewSummary() {
  return (
    <section aria-labelledby="overview-summary-heading">
      <h2 id="overview-summary-heading" className="sr-only">
        Today at a glance
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line sm:grid-cols-3 xl:grid-cols-6">
        {dashboardSummary.map((item) => (
          <div key={item.id} className="bg-surface px-4 py-3">
            <dt className="text-[0.65rem] font-semibold tracking-[0.12em] text-ink-soft uppercase">
              {item.label}
            </dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-semibold tabular-nums text-ink">
                {item.value}
              </span>
              <span className="text-[0.7rem] text-ink-soft">{item.hint}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
