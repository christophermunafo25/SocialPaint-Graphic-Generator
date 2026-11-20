import React from "react";

/** Public links' track (6095:1179): 8 tall and round, its fill on text/primary,
 * the leader full width (D6). Decoration: the number beside it carries the
 * value. */
export function BarTrack({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <span className="sp-in-track" aria-hidden>
      <span style={{ width: `${width}%` }} />
    </span>
  );
}
