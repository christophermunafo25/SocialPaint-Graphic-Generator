import React from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
} from "lucide-react";
import { SegmentedIconGroup } from "./InspectorControls";
import type { AlignEdge, Axis } from "./alignOps";

interface AlignControlsProps {
  /** What the boxes line up against — the wording of every tooltip follows
   * from this, because "align left" means two different things depending on
   * whether there is one element or several. */
  scope: "canvas" | "selection";
  onAlign(axis: Axis, edge: AlignEdge): void;
  /** Omitted for a single element: there is nothing to distribute. */
  onDistribute?(axis: Axis): void;
  /** Why alignment is unavailable, if it is. Shown as the tooltip — a greyed
   * control that says nothing is worse than no control. */
  alignDisabledReason?: string;
  distributeDisabledReason?: string;
}

/** The one align-and-distribute control. It serves the single-element case
 * in the inspector (lining a box up on the canvas) and the multi-selection
 * case (lining elements up on each other, plus distribution) — one control,
 * two reference frames, so the two can never drift apart. */
export function AlignControls({
  scope,
  onAlign,
  onDistribute,
  alignDisabledReason,
  distributeDisabledReason,
}: AlignControlsProps) {
  const against = scope === "canvas" ? "canvas" : "selection";
  const t = (label: string) => (alignDisabledReason ? alignDisabledReason : label);
  return (
    <>
      <SegmentedIconGroup
        ariaLabel={`Align horizontally on the ${against}`}
        disabled={Boolean(alignDisabledReason)}
        options={[
          {
            key: "start",
            Icon: AlignStartVertical,
            title: t(`Align left edge of ${against}`),
          },
          {
            key: "center",
            Icon: AlignCenterVertical,
            title: t(`Center horizontally on ${against}`),
          },
          {
            key: "end",
            Icon: AlignEndVertical,
            title: t(`Align right edge of ${against}`),
          },
        ]}
        onSelect={(k) => onAlign("h", k as AlignEdge)}
      />
      <SegmentedIconGroup
        ariaLabel={`Align vertically on the ${against}`}
        disabled={Boolean(alignDisabledReason)}
        options={[
          {
            key: "start",
            Icon: AlignStartHorizontal,
            title: t(`Align top edge of ${against}`),
          },
          {
            key: "center",
            Icon: AlignCenterHorizontal,
            title: t(`Center vertically on ${against}`),
          },
          {
            key: "end",
            Icon: AlignEndHorizontal,
            title: t(`Align bottom edge of ${against}`),
          },
        ]}
        onSelect={(k) => onAlign("v", k as AlignEdge)}
      />
      {onDistribute && (
        <SegmentedIconGroup
          ariaLabel="Distribute spacing"
          disabled={Boolean(distributeDisabledReason)}
          options={[
            {
              key: "h",
              Icon: AlignHorizontalSpaceAround,
              title: distributeDisabledReason ?? "Even horizontal spacing",
            },
            {
              key: "v",
              Icon: AlignVerticalSpaceAround,
              title: distributeDisabledReason ?? "Even vertical spacing",
            },
          ]}
          onSelect={(k) => onDistribute(k as Axis)}
        />
      )}
    </>
  );
}
