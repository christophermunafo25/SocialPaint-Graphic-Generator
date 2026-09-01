import React from "react";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export interface KpiProps {
  label: string;
  /** A number counts up on load; a string ("—", "42%") renders as-is. */
  value: string | number;
  Icon: LucideIcon;
  chip: string; // background token for the icon chip
  /** Icon color on the chip. Brand fills (Volt/Aqua) take ink in both themes;
   * neutral chips (--bg-hover) need the theme-following text color instead —
   * ink on a dark-mode --bg-hover chip disappears. */
  chipFg?: string;
  /** A quiet second line under the number. Used for the public-link share,
   * which is a SUBSET of the headline figure rather than a separate total —
   * a second tile would read as something to add on. */
  sub?: string;
}

/** Stat tile — a headline number needs no chart. Values are data → mono.
 * Numeric values count up once on load (useCountUp); strings render as-is.
 * Shared by Insights and Settings → Usage, so the two pages cannot drift. */
export function Kpi({ label, value, Icon, chip, chipFg = "var(--text-on-accent)", sub }: KpiProps) {
  const numeric = typeof value === "number" ? value : 0;
  const counted = useCountUp(numeric);
  const shown = typeof value === "number" ? counted : value;
  return (
    <div className="sp-card sp-card--content flex items-center gap-4">
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 38, height: 38, borderRadius: "var(--radius-control)", background: chip }}
      >
        <Icon style={{ width: 16, height: 16, color: chipFg }} />
      </span>
      <span className="min-w-0">
        <span
          className="block truncate"
          style={{ ...mono, fontSize: 24, lineHeight: 1.1, color: "var(--text-primary)" }}
        >
          {shown}
        </span>
        <span className="sp-eyebrow block" style={{ marginTop: 3 }}>
          {label}
        </span>
        {sub && (
          // Wraps rather than truncating: on a phone the tile is half the
          // screen and "80 via public links" clipped to "80 via pu…" tells
          // the reader nothing. The headline number above it is the thing
          // that must stay on one line, and it does.
          <span
            className="block"
            style={{
              fontSize: "var(--type-caption-size)",
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
