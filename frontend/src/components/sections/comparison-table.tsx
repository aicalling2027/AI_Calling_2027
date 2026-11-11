import type { ComparisonRow } from "@/content/articles";
import { site } from "@/lib/site";

type ComparisonTableProps = {
  rows: ComparisonRow[];
  against: string;
};

/**
 * Two-column comparison table. Scrolls horizontally on small screens rather
 * than collapsing, so the row labels stay aligned with the values.
 */
export function ComparisonTable({ rows, against }: ComparisonTableProps) {
  return (
    <div className="-mx-5 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
        <caption className="sr-only">
          Comparison between {site.shortName} and {against}
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-[28%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              Dimension
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-blue-deep">
              {site.shortName}
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {against}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line align-top">
              <th
                scope="row"
                className="px-4 py-4 text-sm font-medium text-ink"
              >
                {row.label}
              </th>
              <td className="rounded-lg bg-blue-tint/60 px-4 py-4 text-ink">
                {row.aotms}
              </td>
              <td className="px-4 py-4 text-ink-soft">{row.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
