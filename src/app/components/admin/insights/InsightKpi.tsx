import React from "react";
import type { InsightChange, TrendPoint } from "@/lib/insights/buildInsights";
import { useCountUp } from "@/lib/useCountUp";

/** "Up 18%", "Down 4%", "Up 5" (members carry an absolute delta), "No
 * change", "New this period". The arrow glyph rides beside the words —
 * direction always carries words, never colour or the arrow alone. */
export function changeCopy(change: InsightChange): string {
  switch (change.direction) {
    case "flat":
      return "No change";
    case "new":
      return "New this period";
    case "up":
      return change.delta !== undefined ? `Up ${change.delta}` : `Up ${change.percent ?? 0}%`;
    case "down":
      return change.delta !== undefined ? `Down ${change.delta}` : `Down ${change.percent ?? 0}%`;
  }
}

const changeArrow = (change: InsightChange): string =>
  change.direction === "up" ? " ↗" : change.direction === "down" ? " ↘" : "";

/** 72 × 22 line of the current window — decoration beside the number, so
 * aria-hidden; the card's label carries the real sentence. */
function Sparkline({ series, accent }: { series: TrendPoint[]; accent: string }) {
  const w = 72;
  const h = 22;
  const pad = 1.5; // half the stroke, so the line never clips at the edges
  const max = Math.max(1, ...series.map((p) => p.current));
  const step = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const points = series
    .map((p, i) => {
      const x = pad + i * step;
      const y = pad + (1 - p.current / max) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={accent}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One Insights KPI card (Figma 106:2): accent dot + label, the headline
 * number counting up on load, and a sparkline over the change line. Its
 * own component by D8 — Kpi.tsx keeps serving Settings → Usage untouched. */
export function InsightKpi({
  label,
  value,
  accent,
  change,
  series,
  rangeLabel,
}: {
  label: string;
  value: number;
  /** A --viz-series-* token — series identity, never state. */
  accent: string;
  change: InsightChange;
  series: TrendPoint[];
  /** "30 days" — names the comparison window in the accessible sentence. */
  rangeLabel: string;
}) {
  const counted = useCountUp(value);
  const sentence = `${label} ${value.toLocaleString()}, ${changeCopy(change).toLowerCase()} on the previous ${rangeLabel}.`;
  return (
    <div className="sp-card sp-card--content" role="group" aria-label={sentence}>
      <div aria-hidden>
        <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "var(--radius-pill)",
              background: accent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--type-label-size)",
              letterSpacing: "var(--type-label-track)",
              color: "var(--text-secondary)",
            }}
          >
            {label}
          </span>
        </div>
        <div
          className="flex items-end justify-between"
          style={{ gap: "var(--space-xs)", marginTop: "var(--space-3xs)" }}
        >
          <span
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--type-h3-size)",
              lineHeight: "var(--type-h3-lh)" as React.CSSProperties["lineHeight"],
              letterSpacing: "var(--type-h3-track)",
              color: "var(--text-primary)",
            }}
          >
            {counted.toLocaleString()}
          </span>
          <span className="flex flex-col items-end" style={{ gap: 4, minWidth: 0 }}>
            <Sparkline series={series} accent={accent} />
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--type-caption-size)",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {changeCopy(change)}
              {changeArrow(change)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
