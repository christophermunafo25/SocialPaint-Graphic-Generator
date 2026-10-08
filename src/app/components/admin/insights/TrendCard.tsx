import React, { useMemo, useState } from "react";
import type { InsightsMetric, InsightsRange, TrendPoint } from "@/lib/insights/buildInsights";
import { Tabs, Tooltip } from "../../primitives";

const METRIC_TAB: Record<InsightsMetric, string> = {
  exports: "Exports",
  opens: "Opens",
  posted: "Posted",
};

/** Each metric's series colour (D6): its tab's dot and the highlighted
 * bar. The same families as the headline chips. */
const METRIC_DOT = { exports: "green", opens: "blue", posted: "purple" } as const;
const METRIC_COLOUR: Record<InsightsMetric, string> = {
  exports: "var(--accent-green)",
  opens: "var(--accent-blue)",
  posted: "var(--accent-purple)",
};

/** "56 exports" / "1 open" / "2 posts": the tooltip's and live region's
 * value words. */
export const metricPhrase = (metric: InsightsMetric, n: number): string => {
  const noun = metric === "exports" ? "export" : metric === "opens" ? "open" : "post";
  return `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;
};

const utc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1));
};
const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
  utc(key).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/** The tooltip's point: "Tue, Sep 8"; on 12 months, "Sep 2026". */
export const pointLabel = (key: string, range: InsightsRange): string =>
  range === "12m"
    ? fmt(key, { month: "short", year: "numeric" })
    : fmt(key, { weekday: "short", month: "short", day: "numeric" });

/** An axis label: "Aug 17" (shown upper case), or "Sep" on 12 months. */
const axisLabel = (key: string, range: InsightsRange): string =>
  range === "12m" ? fmt(key, { month: "short" }) : fmt(key, { month: "short", day: "numeric" });

/** A round axis top with four steps of 1, 2 or 5 × 10ⁿ (0–80 for a peak
 * of 56): the axis comes from the data, not a fixed 80 (D9). */
export function axisTop(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s * 4 >= max) ?? 10 * pow;
  return { top: step * 4, step };
}

/** The busiest bucket: the most, the latest on a tie. */
const busiestOf = (series: TrendPoint[]): number =>
  series.reduce((best, p, i) => (p.current >= series[best].current ? i : best), 0);

/** The trend (13:975): the metric tabs and the range note, then the
 * window's buckets as bars. At rest the busiest bar is highlighted with its
 * tooltip (D9); hover and the arrow keys move the highlight, and leaving
 * the chart puts it back. The value is announced in a polite live region. */
export function TrendCard({
  metric,
  onMetricChange,
  series,
  range,
  rangeNote,
  summary,
}: {
  metric: InsightsMetric;
  onMetricChange(metric: InsightsMetric): void;
  series: TrendPoint[];
  range: InsightsRange;
  /** "Daily, Aug 17 to Sep 15". */
  rangeNote: string;
  /** "Exports over the last 30 days: 1,128, up 18%": the chart's name. */
  summary: string;
}) {
  const busiest = useMemo(() => busiestOf(series), [series]);
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? busiest;
  const point = series[shown];
  const { top, step } = axisTop(Math.max(0, ...series.map((p) => p.current)));
  const pitch = series.length > 1 ? 100 / (series.length - 1) : 0;
  // 14 wide at 30 bars, as drawn; narrower when 90 must fit.
  const barWidth = Math.max(3, Math.min(14, Math.floor(560 / Math.max(series.length, 1)) - 4));
  // An axis label every 7th day from the first; every month on 12 months.
  const labelEvery = range === "12m" ? 1 : 7;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = series.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(last, shown + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, shown - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const left = series.length > 1 ? shown * pitch : 50;

  return (
    <section className="sp-in-card sp-in-trend" aria-label="Trend">
      <div className="sp-in-trend__head">
        <Tabs
          aria-label="Trend metric"
          items={(["exports", "opens", "posted"] as const).map((m) => ({
            id: m,
            label: METRIC_TAB[m],
            dot: METRIC_DOT[m],
          }))}
          selectedId={metric}
          onSelect={(id) => {
            setActive(null);
            onMetricChange(id as InsightsMetric);
          }}
        />
        <p className="t-caption-m sp-in-muted">{rangeNote}</p>
      </div>

      <div
        className="sp-in-chart"
        role="group"
        aria-label={summary}
        aria-roledescription="chart"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        style={{ "--sp-in-series": METRIC_COLOUR[metric] } as React.CSSProperties}
      >
        <div className="sp-in-chart__plot" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              <span className="sp-in-chart__grid" style={{ bottom: `${(i / 4) * 100}%` }} />
              <span
                className="t-caption-xs sp-in-chart__ylabel"
                style={{ bottom: `${(i / 4) * 100}%` }}
              >
                {(step * i).toLocaleString("en-US")}
              </span>
            </React.Fragment>
          ))}
          <div className="sp-in-chart__bars">
            {series.map((p, i) => (
              <span
                key={p.date}
                className="sp-in-chart__bar"
                data-selected={i === shown || undefined}
                style={{ width: barWidth, height: `${(p.current / top) * 100}%` }}
                onMouseEnter={() => setActive(i)}
              />
            ))}
          </div>
          {point && (
            <div
              className="sp-in-chart__tooltip"
              // Near an end the tooltip hangs off its bar's inner side, so it
              // never leaves the card.
              data-edge={left < 12 ? "start" : left > 88 ? "end" : undefined}
              style={{
                left: `calc(${left}% + ${(0.5 - left / 100) * barWidth}px)`,
                bottom: `calc(${(point.current / top) * 100}% + 10px)`,
              }}
            >
              <Tooltip
                label={pointLabel(point.date, range)}
                value={metricPhrase(metric, point.current)}
              />
            </div>
          )}
        </div>
        <div className="sp-in-chart__xlabels" aria-hidden>
          {series.map((p, i) =>
            i % labelEvery === 0 ? (
              <span
                key={p.date}
                className="sp-in-chart__xlabel"
                data-first={i === 0 || undefined}
                style={{
                  left:
                    i === 0 ? 0 : `calc(${i * pitch}% + ${(0.5 - (i * pitch) / 100) * barWidth}px)`,
                }}
              >
                {axisLabel(p.date, range)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {active !== null && point
          ? `${pointLabel(point.date, range)}: ${metricPhrase(metric, point.current)}`
          : ""}
      </p>
    </section>
  );
}
