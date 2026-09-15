import React from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { SizeSlice } from "@/lib/insights/buildInsights";

/** Slice fills, largest first: the leader is the exports series colour
 * (D6); the rest step down the neutral ramp. */
const SLICE_FILLS = [
  "var(--viz-series-1)",
  "var(--viz-neutral-2)",
  "var(--viz-neutral-3)",
  "var(--viz-neutral-4)",
];

const SIZE = 148;

/** Exports by size (Figma 106:2): a donut with its legend beside it. The
 * legend is the accessible content — the ring is decoration over the same
 * numbers, so it stays aria-hidden. Labels come from the catalogue's
 * orientation and ratio helpers, never hand-written. */
export function SizeCard({
  sizes,
  error,
}: {
  sizes: SizeSlice[];
  /** The templates load failed — sizes cannot be grouped without it. */
  error?: { retry: () => void };
}) {
  const total = sizes.reduce((n, s) => n + s.exports, 0);
  return (
    <div className="sp-card sp-card--content flex flex-col" style={{ minWidth: 0 }}>
      <div className="flex items-baseline justify-between" style={{ gap: "var(--space-xs)" }}>
        <h2 className="sp-section-title">Exports by size</h2>
        <span className="sp-eyebrow flex-shrink-0">{total} total</span>
      </div>
      {error ? (
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ gap: "var(--space-2xs)", minHeight: SIZE }}
        >
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
            We couldn't load this.
          </p>
          <button className="sp-btn sp-btn-ghost" onClick={error.retry}>
            Try again
          </button>
        </div>
      ) : sizes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: SIZE }}>
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
            No exports in this range
          </p>
        </div>
      ) : (
        <div
          className="flex-1 flex items-center"
          style={{ gap: "var(--space-md)", marginTop: "var(--space-sm)" }}
        >
          <span aria-hidden style={{ flexShrink: 0 }}>
            <PieChart width={SIZE} height={SIZE}>
              <Pie
                data={sizes}
                dataKey="exports"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={SIZE / 2}
                innerRadius={Math.round(SIZE * 0.33)}
                paddingAngle={3}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                {sizes.map((s, i) => (
                  <Cell key={s.label} fill={SLICE_FILLS[i % SLICE_FILLS.length]} />
                ))}
              </Pie>
            </PieChart>
          </span>
          <ul className="flex-1 flex flex-col" style={{ gap: "var(--space-sm)", minWidth: 0 }}>
            {sizes.map((s, i) => (
              <li key={s.label} className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--radius-pill)",
                    background: SLICE_FILLS[i % SLICE_FILLS.length],
                    flexShrink: 0,
                  }}
                />
                <span
                  className="truncate flex-1"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 400,
                    fontSize: "var(--type-label-size)",
                    letterSpacing: "var(--type-label-track)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-primary)",
                  }}
                >
                  {s.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
