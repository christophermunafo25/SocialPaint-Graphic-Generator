import React from "react";
import type { WeekdayInsight } from "@/lib/insights/buildInsights";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const BAR_MAX = 92;

/** Exports by weekday (Figma 106:2). Neutral except the one Slime mark on
 * the busiest bar (D6) — and that bar is ALSO named by text, so the colour
 * never carries the finding alone. */
export function WeekdayCard({ weekday }: { weekday: WeekdayInsight }) {
  const { totals, busiest, weekdayAvg, weekendAvg } = weekday;
  const max = Math.max(...totals);
  const hasExports = max > 0;
  const summaryLabel = totals.map((n, i) => `${DAY_NAMES[i]} ${n}`).join(", ");

  // Rounded, exact, no adjectives.
  const weekendShare =
    weekdayAvg > 0 && weekendAvg < 0.75 * weekdayAvg
      ? Math.round((weekendAvg / weekdayAvg) * 100)
      : null;

  return (
    <div className="sp-card sp-card--content flex flex-col" style={{ minWidth: 0 }}>
      <div className="flex items-baseline justify-between" style={{ gap: "var(--space-xs)" }}>
        <h2 className="sp-section-title">When your team makes graphics</h2>
        <span className="sp-eyebrow flex-shrink-0">Exports by weekday</span>
      </div>
      <div
        className="flex-1 flex items-end justify-between"
        style={{ gap: "var(--space-2xs)", marginTop: "var(--space-xs)" }}
        role="img"
        aria-label={`Exports by weekday: ${summaryLabel}.`}
      >
        {totals.map((n, i) => {
          const lead = hasExports && i === busiest;
          return (
            <span key={DAY_LABELS[i]} className="flex flex-col items-center" style={{ gap: 6 }}>
              <span
                className="sp-eyebrow"
                style={{ lineHeight: 1, ...(lead ? { color: "var(--text-primary)" } : {}) }}
              >
                {n}
              </span>
              <span
                style={{
                  width: 32,
                  height: hasExports ? Math.max(n > 0 ? 2 : 0, (n / max) * BAR_MAX) : 0,
                  borderRadius: "var(--radius-control-lg)",
                  background: lead ? "var(--viz-series-1)" : "var(--viz-neutral)",
                }}
              />
              <span
                className="sp-eyebrow"
                style={{ lineHeight: 1, ...(lead ? { color: "var(--text-primary)" } : {}) }}
              >
                {DAY_LABELS[i]}
              </span>
            </span>
          );
        })}
      </div>
      <p
        style={{
          fontSize: "var(--type-caption-size)",
          color: "var(--text-secondary)",
          marginTop: "var(--space-xs)",
        }}
      >
        {hasExports
          ? `${DAY_NAMES[busiest]}s are busiest.${
              weekendShare !== null ? ` Weekends run at ${weekendShare}% of the weekday pace.` : ""
            }`
          : "No exports in this range."}
      </p>
    </div>
  );
}
