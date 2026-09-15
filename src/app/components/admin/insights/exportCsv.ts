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

/** Client-side download, no dependency: a Blob behind a temporary anchor.
 * The file date follows the workspace timezone like every other Insights
 * boundary. */
export function downloadInsightsCsv(
  rows: InsightTemplateRow[],
  range: InsightsRange,
  timeZone: string,
): void {
  const date = dayKeyInZone(new Date().toISOString(), timeZone);
  const blob = new Blob([insightsCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `insights-${range}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
