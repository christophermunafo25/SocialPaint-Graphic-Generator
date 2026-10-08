import type { InsightsRange, InsightTemplateRow } from "@/lib/insights/buildInsights";
import { dayKeyInZone } from "@/lib/stores/dailyActivity";

/** RFC-4180 quoting: a field holding a comma, quote, or newline is wrapped
 * and its quotes doubled — template names are user content. */
const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The export rate convention from the old table: a dash when there were
 * no opens, never a divide-by-zero percentage. */
const exportRate = (exports: number, opens: number): string =>
  opens === 0 ? "—" : `${Math.round((exports / opens) * 100)}%`;

/** Pure CSV body for the per-template rows of the selected window. */
export function insightsCsv(rows: InsightTemplateRow[]): string {
  const lines = [
    [
      "Template",
      "Opens",
      "Exports",
      "Export rate",
      "Posted",
      "Through public links",
      "Bulk exports",
      "Last used",
    ].join(","),
  ];
  for (const r of rows) {
    lines.push(
      [
        esc(r.name),
        String(r.opens),
        String(r.exports),
        exportRate(r.exports, r.opens),
        String(r.posted),
        String(r.publicDownloads),
        String(r.bulk),
        r.lastUsedAt ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** A file-name piece from a filter's label: "Product launch" → "product-launch". */
const slug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** "insights-30d-2026-10-06.csv", or with the active filters,
 * "insights-30d-product-launch-tiktok-2026-10-06.csv" (D11). */
export function insightsCsvName(
  range: InsightsRange,
  date: string,
  filters: string[] = [],
): string {
  const parts = filters.map(slug).filter(Boolean);
  return ["insights", range, ...parts, date].join("-") + ".csv";
}

/** Client-side download, no dependency: a Blob behind a temporary anchor.
 * The file date follows the workspace timezone like every other Insights
 * boundary; the rows and the name follow the filters. */
export function downloadInsightsCsv(
  rows: InsightTemplateRow[],
  range: InsightsRange,
  timeZone: string,
  /** The active filters' labels, for the file name. */
  filters: string[] = [],
): void {
  const date = dayKeyInZone(new Date().toISOString(), timeZone);
  const blob = new Blob([insightsCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = insightsCsvName(range, date, filters);
  a.click();
  URL.revokeObjectURL(url);
}
