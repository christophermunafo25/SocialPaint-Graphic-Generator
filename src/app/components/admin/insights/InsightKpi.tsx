import React from "react";
import type { InsightChange } from "@/lib/insights/buildInsights";

/** "Up 18%", "Down 4%", "Up 5" (members carry an absolute delta), "No
 * change", "New this period": the change in words, for assistive tech and
 * the trend's summary. Direction always has words, never colour alone. */
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

/** What the chip shows: "↗ 18%", "↘ 4%", "↗ 5", "New", "→ 0%" (flat
 * keeps the drawn chip's width, so the comparison stays on its line). */
export function chipText(change: InsightChange): string {
  switch (change.direction) {
    case "flat":
      return change.delta !== undefined ? "→ 0" : "→ 0%";
    case "new":
      return "New";
    case "up":
      return `↗ ${change.delta ?? `${change.percent ?? 0}%`}`;
    case "down":
      return `↘ ${change.delta ?? `${change.percent ?? 0}%`}`;
  }
}

/** A card's colour family: its identity, the same in every state (D7). */
export type KpiFamily = "green" | "blue" | "purple" | "pink";

/** The change chip (13:946): the card's family colour, the arrow and
 * words carrying the direction. */
export function ChangeChip({ change, family }: { change: InsightChange; family: KpiFamily }) {
  return (
    <span className="sp-in-chip" data-family={family}>
      <span className="t-label-xs" aria-hidden>
        {chipText(change)}
      </span>
      <span className="sr-only">{changeCopy(change)}</span>
    </span>
  );
}

/** One headline card (13:941): the label, the number, then the chip and
 * "vs previous {range}" (D8). No sparkline, dot or count-up (D10). */
export function InsightKpi({
  label,
  value,
  change,
  family,
  rangeLabel,
}: {
  label: string;
  value: number;
  change: InsightChange;
  family: KpiFamily;
  /** "30 days", from RANGE_LABEL. */
  rangeLabel: string;
}) {
  return (
    <section className="sp-in-card sp-in-kpi" aria-label={label}>
      <h2 className="t-label-l">{label}</h2>
      <p className="t-title-metric">{value.toLocaleString("en-US")}</p>
      <p className="sp-in-kpi__change">
        <ChangeChip change={change} family={family} />
        <span className="t-caption-m sp-in-muted">vs previous {rangeLabel}</span>
      </p>
    </section>
  );
}
