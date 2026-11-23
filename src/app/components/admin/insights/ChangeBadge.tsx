import React from "react";
import type { InsightChange } from "@/lib/insights/buildInsights";
import { Badge } from "../../primitives";

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

/** Each family's Badge tone (6095:1053): green reads status/positive,
 * the others their deep colour with its accent (purple on its tint). */
const TONE: Record<KpiFamily, "positive" | "blue" | "purple" | "pink"> = {
  green: "positive",
  blue: "blue",
  purple: "purple",
  pink: "pink",
};

/** A headline number's change: a Badge in the card's family colour, the
 * arrow and words carrying the direction, read out in words. */
export function ChangeBadge({ change, family }: { change: InsightChange; family: KpiFamily }) {
  return (
    <Badge tone={TONE[family]}>
      <span aria-hidden>{chipText(change)}</span>
      <span className="sr-only">{changeCopy(change)}</span>
    </Badge>
  );
}
