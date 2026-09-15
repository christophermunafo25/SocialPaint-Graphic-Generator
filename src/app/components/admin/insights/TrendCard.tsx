import React, { useEffect, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  INSIGHTS_METRICS,
  type InsightsMetric,
  type InsightsRange,
  type TrendPoint,
} from "@/lib/insights/buildInsights";

const METRIC_TAB: Record<InsightsMetric, string> = {
  exports: "Exports",
  opens: "Opens",
  posted: "Posted",
};

/** Series identity per metric — the same accent its KPI card wears. */
export const METRIC_ACCENT: Record<InsightsMetric, string> = {
  exports: "var(--viz-series-1)",
  opens: "var(--viz-series-2)",
  posted: "var(--viz-series-5)",
};

/** "3 exports" / "1 open" / "2 posts" — the tooltip's and live region's
 * value words. */
const metricPhrase = (metric: InsightsMetric, n: number): string => {
  const noun = metric === "exports" ? "export" : metric === "opens" ? "open" : "post";
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
};

/** "SEP 9" for a day key, "SEP" for a 12m month key — eyebrow-cased. */
const fmtBucket = (key: string, range: InsightsRange): string => {
  if (range === "12m") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1))
      .toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })
      .toUpperCase();
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
};

const eyebrowTick = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.04em",
  fill: "var(--text-muted)",
} as const;

/** The trend card (Figma 106:2): metric tabs, the current window as an
 * accent area over the previous window's dashed neutral line. Selection
 * carries aria-selected and full-strength text, never colour alone. */
export function TrendCard({
  metric,
  onMetricChange,
  series,
  range,
  rangeLabel,
  summary,
}: {
  metric: InsightsMetric;
  onMetricChange: (metric: InsightsMetric) => void;
  series: TrendPoint[];
  range: InsightsRange;
  rangeLabel: string;
  /** "Exports over the last 30 days: 1,128, up 18%" — the chart's label. */
  summary: string;
}) {
  const accent = METRIC_ACCENT[metric];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Keyboard stepping: Left/Right move the active bucket; the value is
  // announced through the polite live region below the chart.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  useEffect(() => setActiveIdx(null), [metric, series]);

  const onTablistKeyDown = (e: React.KeyboardEvent) => {
    const i = INSIGHTS_METRICS.indexOf(metric);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % INSIGHTS_METRICS.length;
    else if (e.key === "ArrowLeft")
      next = (i + INSIGHTS_METRICS.length - 1) % INSIGHTS_METRICS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = INSIGHTS_METRICS.length - 1;
    if (next === null) return;
    e.preventDefault();
    onMetricChange(INSIGHTS_METRICS[next]);
    tabRefs.current[next]?.focus();
  };

  const onChartKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActiveIdx((prev) => {
      const start = prev ?? series.length - 1;
      const next = e.key === "ArrowRight" ? start + 1 : start - 1;
      return Math.max(0, Math.min(series.length - 1, prev === null ? start : next));
    });
  };
  const active = activeIdx !== null ? series[activeIdx] : null;

  return (
    <div className="sp-card sp-card--content flex flex-col" style={{ minWidth: 0 }}>
      <div className="flex items-center flex-wrap" style={{ gap: "var(--space-sm)" }}>
        <div
          role="tablist"
          aria-label="Trend metric"
          className="flex items-center"
          style={{ gap: "var(--space-sm)" }}
        >
          {INSIGHTS_METRICS.map((m, i) => (
            <button
              key={m}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={metric === m}
              tabIndex={metric === m ? 0 : -1}
              className="sp-section-title"
              onClick={() => onMetricChange(m)}
              onKeyDown={onTablistKeyDown}
              style={{
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                minHeight: 32,
                color: metric === m ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {METRIC_TAB[m]}
            </button>
          ))}
        </div>
        <span aria-hidden style={{ width: 1, height: 16, background: "var(--border-strong)" }} />
        <div
          className="flex items-center"
          style={{
            gap: "var(--space-sm)",
            fontSize: "var(--type-caption-size)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
            <span aria-hidden style={{ width: 14, height: 0, borderTop: `2px solid ${accent}` }} />
            This period
          </span>
          <span className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
            <span
              aria-hidden
              style={{ width: 14, height: 0, borderTop: "2px dashed var(--viz-neutral-3)" }}
            />
            Previous {rangeLabel}
          </span>
        </div>
      </div>
      <div
        className="flex-1"
        style={{ minHeight: 208, marginTop: "var(--space-xs)", outlineOffset: 2 }}
        tabIndex={0}
        role="img"
        aria-label={summary}
        onKeyDown={onChartKeyDown}
        onBlur={() => setActiveIdx(null)}
      >
        <ResponsiveContainer width="100%" height={208}>
          <ComposedChart data={series} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => fmtBucket(String(v), range)}
              tick={eyebrowTick}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis allowDecimals={false} tick={eyebrowTick} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
              content={({ active: hovered, payload, label }) => {
                if (!hovered || !payload?.length) return null;
                const point = payload.find((p) => p.dataKey === "current");
                if (!point) return null;
                return (
                  <div
                    className="flex items-center"
                    style={{
                      gap: "var(--space-2xs)",
                      background: "var(--bg-hover)",
                      borderRadius: "var(--radius-pill)",
                      padding: "6px 12px",
                    }}
                  >
                    <span className="sp-eyebrow">{fmtBucket(String(label), range)}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {metricPhrase(metric, Number(point.value))}
                    </span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="current"
              name="This period"
              stroke={accent}
              strokeWidth={2.5}
              fill={accent}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, fill: "var(--bg-card)", stroke: accent, strokeWidth: 2.5 }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name={`Previous ${rangeLabel}`}
              stroke="var(--viz-neutral-3)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
            />
            {active && (
              <ReferenceDot
                x={active.date}
                y={active.current}
                r={4}
                fill="var(--bg-card)"
                stroke={accent}
                strokeWidth={2.5}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {active ? `${fmtBucket(active.date, range)}, ${metricPhrase(metric, active.current)}` : ""}
      </span>
    </div>
  );
}
