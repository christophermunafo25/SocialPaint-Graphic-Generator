import React from "react";
import { Columns3, Group as GroupGlyph, Rows3, Trash2, Ungroup as UngroupIcon } from "lucide-react";
import type { GroupAxisPoint, LayoutGroup } from "@/lib/types";
import { isFreeGroup } from "@/lib/types";
import type { GroupRect } from "@/lib/render/layout";
import { Select } from "../primitives";
import { InspectorHeader } from "./InspectorHeader";
import {
  InspectorSection,
  NumericField,
  PropertyGrid,
  PropertyRow,
  SegmentedIconGroup,
  SwitchRow,
} from "./InspectorControls";

interface GroupInspectorProps {
  group: LayoutGroup;
  /** Computed frame from the layout pass (main-axis size is never authored;
   * a plain group's whole frame is computed from its children). */
  computedRect?: GroupRect;
  onChange(patch: Partial<LayoutGroup>, stream?: boolean): void;
  /** Toggle between a plain group ("free") and an auto-layout stack. */
  onModeChange(mode: "free" | "stack"): void;
  onUngroup(): void;
  onDelete(): void;
}

/** Anchor = the point that holds still as content grows. The words follow
 * the axis: a vertical stack anchors top/bottom, a horizontal one
 * left/right. */
const ANCHOR_LABELS: Record<"vertical" | "horizontal", Record<GroupAxisPoint, string>> = {
  vertical: {
    start: "Top, grows downward",
    center: "Center, grows both ways",
    end: "Bottom, grows upward",
  },
  horizontal: {
    start: "Left, grows rightward",
    center: "Center, grows both ways",
    end: "Right, grows leftward",
  },
};

/** Cross-axis alignment — x for a vertical stack, y for a horizontal one. */
const ALIGN_LABELS: Record<"vertical" | "horizontal", Record<GroupAxisPoint, string>> = {
  vertical: { start: "Left", center: "Center", end: "Right" },
  horizontal: { start: "Top", center: "Middle", end: "Bottom" },
};

/** Inspector panel for a selected group.
 *
 * A PLAIN group is a bounding box over children that keep their own
 * positions, so everything geometric here is read-only; the panel is the
 * name, the Auto layout toggle, and Ungroup/Delete.
 *
 * A STACK authors position and cross-axis size; the main-axis size is
 * computed and shown as such. The anchor choice is EXPLICIT (it decides
 * which edge holds still as content grows) — and switching anchor or
 * direction re-derives the authored coordinates from the current frame so
 * the stack doesn't move at the moment of choosing. */
export function GroupInspector({
  group,
  computedRect,
  onChange,
  onModeChange,
  onUngroup,
  onDelete,
}: GroupInspectorProps) {
  const free = isFreeGroup(group);
  const vertical = group.direction === "vertical";

  const changeAnchor = (next: GroupAxisPoint) => {
    if (next === group.anchor) return;
    if (!computedRect) {
      onChange({ anchor: next });
      return;
    }
    // Hold the stack still: the new anchor coordinate is wherever that point
    // of the CURRENT frame already sits.
    const mainStart = vertical ? computedRect.y : computedRect.x;
    const mainSize = vertical ? computedRect.height : computedRect.width;
    const pos =
      next === "start"
        ? mainStart
        : next === "center"
          ? mainStart + mainSize / 2
          : mainStart + mainSize;
    onChange(
      vertical ? { anchor: next, y: Math.round(pos) } : { anchor: next, x: Math.round(pos) },
    );
  };

  const changeDirection = (next: LayoutGroup["direction"]) => {
    if (next === group.direction) return;
    if (!computedRect) {
      onChange({ direction: next });
      return;
    }
    // The meaning of x/y and crossSize swaps axes with the direction.
    // Re-author all three from the current frame so the stack's frame holds
    // its corner while the children re-flow along the new axis.
    const nextVertical = next === "vertical";
    const mainStart = nextVertical ? computedRect.y : computedRect.x;
    const mainSize = nextVertical ? computedRect.height : computedRect.width;
    const pos =
      group.anchor === "start"
        ? mainStart
        : group.anchor === "center"
          ? mainStart + mainSize / 2
          : mainStart + mainSize;
    onChange(
      nextVertical
        ? {
            direction: next,
            x: Math.round(computedRect.x),
            y: Math.round(pos),
            crossSize: Math.round(computedRect.width),
          }
        : {
            direction: next,
            x: Math.round(pos),
            y: Math.round(computedRect.y),
            crossSize: Math.round(computedRect.height),
          },
    );
  };

  const stackName = vertical ? "Vertical stack" : "Horizontal stack";
  const mainSize = computedRect
    ? Math.round(vertical ? computedRect.height : computedRect.width)
    : undefined;

  return (
    <div className="sp-insp">
      <InspectorHeader
        key={group.id}
        icon={free ? GroupGlyph : vertical ? Rows3 : Columns3}
        name={group.name}
        onRename={(name) => onChange({ name: name.trim() || "Group" })}
        actions={[
          { items: [{ label: "Ungroup", icon: UngroupIcon, onSelect: onUngroup }] },
          {
            items: [{ label: "Delete group", icon: Trash2, destructive: true, onSelect: onDelete }],
          },
        ]}
      />
      <div className="sp-insp-panel">
        <InspectorSection id="group-layout" title="Layout">
          <SwitchRow
            label="Auto layout"
            checked={!free}
            onChange={(next) => onModeChange(next ? "stack" : "free")}
          />
          {!free && (
            <>
              <PropertyRow label="Direction">
                <SegmentedIconGroup
                  stretch
                  ariaLabel={`Direction of the ${stackName.toLowerCase()}`}
                  value={group.direction}
                  options={[
                    { key: "vertical", label: "Vertical" },
                    { key: "horizontal", label: "Horizontal" },
                  ]}
                  onSelect={changeDirection}
                />
              </PropertyRow>
              <PropertyGrid>
                <PropertyRow label="Gap">
                  <NumericField
                    ariaLabel="Gap"
                    suffix="px"
                    min={0}
                    value={group.gap}
                    onCommit={(v) => onChange({ gap: v ?? group.gap })}
                  />
                </PropertyRow>
                <PropertyRow label="Align">
                  <Select
                    ariaLabel="Align"
                    value={group.align}
                    options={(Object.keys(ALIGN_LABELS[group.direction]) as GroupAxisPoint[]).map(
                      (k) => ({ value: k, label: ALIGN_LABELS[group.direction][k] }),
                    )}
                    onSelect={(v) => onChange({ align: v })}
                  />
                </PropertyRow>
              </PropertyGrid>
              <PropertyRow label="Anchor">
                <Select
                  ariaLabel="Anchor"
                  value={group.anchor}
                  options={(Object.keys(ANCHOR_LABELS[group.direction]) as GroupAxisPoint[]).map(
                    (k) => ({ value: k, label: ANCHOR_LABELS[group.direction][k] }),
                  )}
                  onSelect={changeAnchor}
                />
              </PropertyRow>
            </>
          )}
        </InspectorSection>

        <InspectorSection id="group-position" title="Position">
          {free ? (
            <p className="t-body-s sp-insp-note">
              {computedRect
                ? `X ${Math.round(computedRect.x)}, Y ${Math.round(computedRect.y)}, ${Math.round(
                    computedRect.width,
                  )} × ${Math.round(computedRect.height)}, from what it holds.`
                : "From what it holds."}
            </p>
          ) : (
            <>
              <PropertyRow label="Position">
                <NumericField
                  label="X"
                  ariaLabel="X position"
                  value={Math.round(group.x)}
                  onCommit={(v) => onChange({ x: v ?? group.x })}
                />
                <NumericField
                  label="Y"
                  ariaLabel="Y position"
                  value={Math.round(group.y)}
                  onCommit={(v) => onChange({ y: v ?? group.y })}
                />
              </PropertyRow>
              <PropertyRow label="Size">
                <NumericField
                  label={vertical ? "W" : "H"}
                  ariaLabel={vertical ? "Width" : "Height"}
                  min={16}
                  value={Math.round(group.crossSize)}
                  onCommit={(v) => onChange({ crossSize: v ?? group.crossSize })}
                />
                <span className="t-body-s sp-insp-computed">
                  {vertical ? "H" : "W"} {mainSize ?? "unknown"}, from what it holds
                </span>
              </PropertyRow>
            </>
          )}
        </InspectorSection>

        {(!free || computedRect?.overflows) && (
          <InspectorSection id="group-overflow" title="Overflow">
            {!free && (
              <SwitchRow
                label="Shrink text to fit the canvas"
                checked={Boolean(group.shrinkToFit)}
                onChange={(next) => onChange({ shrinkToFit: next || undefined })}
              />
            )}
            {computedRect?.overflows && (
              <p className="t-body-s sp-insp-note">
                This {free ? "group" : "stack"} runs past the canvas.
              </p>
            )}
          </InspectorSection>
        )}
      </div>
    </div>
  );
}
