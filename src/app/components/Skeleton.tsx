import React from "react";

/** Skeleton primitives — the TemplateShelfSkeleton precedent, generalised
 * (2026-09-15): every loading surface stands in with the geometry of the
 * thing that is coming, so nothing jumps when the data lands, and a pulse
 * says "working" without a spinner. Pulse and colours live on
 * .sp-skeleton__block; bones are decoration (aria-hidden) and each
 * composite announces itself ONCE via aria-busy + a label, never per bone. */

/** One pulsing bone. Width/height in px or any CSS length; radius defaults
 * to the control radius from .sp-skeleton__line. */
export function Bone({
  w,
  h = 13,
  r,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="sp-skeleton__line sp-skeleton__block"
      style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : {}), ...style }}
    />
  );
}

/** A short stack of text-shaped lines — settings blocks, form wells. Widths
 * stagger so the stack reads as prose, not a barcode. */
export function SkeletonLines({
  lines = 3,
  label = "Loading",
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col" style={{ gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} w={`${[62, 44, 54, 36][i % 4]}%`} h={12} />
      ))}
    </div>
  );
}

/** People-style list rows on the real 56px row height: a round mark and two
 * lines, hairline-separated like the rows they stand in for. */
export function SkeletonRows({
  rows = 3,
  inset = "var(--space-xs) var(--space-md)",
  label = "Loading",
}: {
  rows?: number;
  inset?: string;
  label?: string;
}) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3"
          style={{
            padding: inset,
            minHeight: 56,
            ...(i > 0 ? { borderTop: "1px solid var(--border)" } : {}),
          }}
        >
          <Bone w={26} h={26} r="var(--radius-pill)" />
          <div className="flex-1 min-w-0">
            <Bone w={i % 2 ? "34%" : "42%"} h={12} />
            <Bone w={i % 2 ? "22%" : "28%"} h={10} style={{ marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A stat tile's shape — the Kpi card with its 38px chip and headline
 * number. Shared by Insights and Settings → Usage, like the tile itself. */
export function SkeletonKpi() {
  return (
    <div className="sp-card sp-card--content flex items-center gap-4" aria-hidden>
      <Bone w={38} h={38} r="var(--radius-control)" />
      <span className="min-w-0 flex flex-col" style={{ gap: 7 }}>
        <Bone w={64} h={22} />
        <Bone w={88} h={9} />
      </span>
    </div>
  );
}
