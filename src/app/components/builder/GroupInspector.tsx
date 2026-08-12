import React from "react";
import { Ungroup as UngroupIcon } from "lucide-react";
import type { GroupAxisPoint, LayoutGroup } from "@/lib/types";
import type { GroupRect } from "@/lib/render/layout";
import { Switch } from "../Switch";
import { InlineEdit } from "../InlineEdit";
import {
  InspectorSection,
  NumericField,
  PropertyRow,
  compactControlStyle,
} from "./InspectorControls";

interface GroupInspectorProps {
  group: LayoutGroup;
  /** Computed frame from the layout pass (main-axis size is never authored). */
  computedRect?: GroupRect;
  onChange(patch: Partial<LayoutGroup>, stream?: boolean): void;
  onUngroup(): void;
  onDelete(): void;
}

const ANCHOR_LABELS: Record<GroupAxisPoint, string> = {
  start: "Top — grows downward",
  center: "Center — grows both ways",
  end: "Bottom — grows upward",
};

const ALIGN_LABELS: Record<GroupAxisPoint, string> = {
  start: "Left",
  center: "Center",
  end: "Right",
};

/** Inspector panel for a selected auto-layout group. Position and cross-axis
 * size are authored; the main-axis size is computed and shown as such. The
 * anchor choice is EXPLICIT (it decides which edge holds still as content
 * grows) — and switching it re-derives the anchor coordinate from the
 * current frame so the stack doesn't move at the moment of choosing. */
export function GroupInspector({
  group,
  computedRect,
  onChange,
  onUngroup,
  onDelete,
}: GroupInspectorProps) {
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

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 pb-2">
        <InlineEdit
          value={group.name}
          onSave={(name) => onChange({ name: name.trim() || "Group" })}
          ariaLabel="Group name"
          inputAriaLabel="Group name"
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
          {vertical ? "Vertical stack" : "Horizontal stack"}
        </span>
      </div>

      <InspectorSection id="group-layout" title="Stack">
        <PropertyRow label="Gap">
          <NumericField
            ariaLabel="Gap between children in canvas pixels"
            suffix="px"
            min={0}
            value={group.gap}
            onCommit={(v) => onChange({ gap: v ?? group.gap })}
          />
        </PropertyRow>
        <PropertyRow label="Anchor">
          <select
            className="sp-input"
            style={compactControlStyle}
            aria-label="Anchor — the point that holds still as content grows"
            value={group.anchor}
            onChange={(e) => changeAnchor(e.target.value as GroupAxisPoint)}
          >
            {(Object.keys(ANCHOR_LABELS) as GroupAxisPoint[]).map((k) => (
              <option key={k} value={k}>
                {ANCHOR_LABELS[k]}
              </option>
            ))}
          </select>
        </PropertyRow>
        <PropertyRow label="Align">
          <select
            className="sp-input"
            style={compactControlStyle}
            aria-label="Cross-axis alignment of children"
            value={group.align}
            onChange={(e) => onChange({ align: e.target.value as GroupAxisPoint })}
          >
            {(Object.keys(ALIGN_LABELS) as GroupAxisPoint[]).map((k) => (
              <option key={k} value={k}>
                {ALIGN_LABELS[k]}
              </option>
            ))}
          </select>
        </PropertyRow>
      </InspectorSection>

      <InspectorSection id="group-position" title="Position">
        <PropertyRow label="Position">
          <NumericField
            label="X"
            ariaLabel="Group X position"
            value={Math.round(group.x)}
            onCommit={(v) => onChange({ x: v ?? group.x })}
          />
          <NumericField
            label="Y"
            ariaLabel="Group anchor Y position"
            value={Math.round(group.y)}
            onCommit={(v) => onChange({ y: v ?? group.y })}
          />
        </PropertyRow>
        <PropertyRow label="Size">
          <NumericField
            label={vertical ? "W" : "H"}
            ariaLabel="Group cross-axis size"
            min={16}
            value={Math.round(group.crossSize)}
            onCommit={(v) => onChange({ crossSize: v ?? group.crossSize })}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {vertical ? "H" : "W"}{" "}
            {computedRect ? Math.round(vertical ? computedRect.height : computedRect.width) : "—"} ·
            computed
          </span>
        </PropertyRow>
      </InspectorSection>

      <InspectorSection id="group-overflow" title="Overflow">
        <PropertyRow label="Shrink to fit">
          <Switch
            checked={Boolean(group.shrinkToFit)}
            ariaLabel="Shrink text to keep the stack inside the canvas"
            onChange={(next) => onChange({ shrinkToFit: next || undefined })}
          />
        </PropertyRow>
        <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
          {group.shrinkToFit
            ? "Text in this stack shrinks (never below its minimum size) so the stack stays inside the canvas."
            : "Content that outgrows the canvas stays visible and is flagged here in the builder — members never see a warning."}
        </p>
        {computedRect?.overflows && (
          <p style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>
            This stack currently extends beyond the canvas.
          </p>
        )}
      </InspectorSection>

      <div className="flex gap-2 pt-2">
        <button className="sp-btn sp-btn-ghost flex-1" onClick={onUngroup}>
          <UngroupIcon className="w-3.5 h-3.5" />
          Ungroup
        </button>
        <button
          className="sp-btn sp-btn-ghost flex-1"
          style={{ color: "var(--destructive)" }}
          onClick={onDelete}
        >
          Delete group
        </button>
      </div>
    </div>
  );
}
