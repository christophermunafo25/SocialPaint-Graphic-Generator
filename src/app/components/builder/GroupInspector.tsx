import React from "react";
import { Ungroup as UngroupIcon } from "lucide-react";
import type { GroupAxisPoint, LayoutGroup } from "@/lib/types";
import { isFreeGroup } from "@/lib/types";
import type { GroupRect } from "@/lib/render/layout";
import { Switch } from "../Switch";
import { InlineEdit } from "../InlineEdit";
import {
  InspectorSection,
  NumericField,
  PropertyRow,
  SegmentedIconGroup,
  compactControlStyle,
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
    start: "Top — grows downward",
    center: "Center — grows both ways",
    end: "Bottom — grows upward",
  },
  horizontal: {
    start: "Left — grows rightward",
    center: "Center — grows both ways",
    end: "Right — grows leftward",
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

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 pb-2">
        {/* The name takes the row; the mode label beside it is fixed-width
            and never squeezes it. Without the min-width the flex row let the
            name shrink to its content-free minimum and even "Group" — the
            default — came out as "Gr…". */}
        <InlineEdit
          style={{ flex: "1 1 auto", minWidth: 0 }}
          value={group.name}
          onSave={(name) => onChange({ name: name.trim() || "Group" })}
          ariaLabel="Group name"
          inputAriaLabel="Group name"
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
          {free ? "Group" : vertical ? "Vertical stack" : "Horizontal stack"}
        </span>
      </div>

      <InspectorSection id="group-layout" title="Layout">
        <PropertyRow label="Auto layout">
          <Switch
            checked={!free}
            ariaLabel="Auto layout — place children in a stack with a fixed gap"
            onChange={(next) => onModeChange(next ? "stack" : "free")}
          />
        </PropertyRow>
        <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
          {free
            ? "Children keep the positions you gave them — the group just moves them together."
            : "Children are placed along one axis with a fixed gap; growing content pushes the rest."}
        </p>
        {!free && (
          <>
            <PropertyRow label="Direction">
              <SegmentedIconGroup
                stretch
                ariaLabel="Stack direction"
                value={group.direction}
                options={[
                  { key: "vertical", label: "Vertical", title: "Stack children top to bottom" },
                  {
                    key: "horizontal",
                    label: "Horizontal",
                    title: "Stack children left to right",
                  },
                ]}
                onSelect={changeDirection}
              />
            </PropertyRow>
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
                {(Object.keys(ANCHOR_LABELS[group.direction]) as GroupAxisPoint[]).map((k) => (
                  <option key={k} value={k}>
                    {ANCHOR_LABELS[group.direction][k]}
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
                {(Object.keys(ALIGN_LABELS[group.direction]) as GroupAxisPoint[]).map((k) => (
                  <option key={k} value={k}>
                    {ALIGN_LABELS[group.direction][k]}
                  </option>
                ))}
              </select>
            </PropertyRow>
          </>
        )}
      </InspectorSection>

      <InspectorSection id="group-position" title="Position">
        {free ? (
          // A plain group's frame is the children's bounding box — computed,
          // never authored. Move it on the canvas; resize its children.
          <PropertyRow label="Bounds">
            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {computedRect
                ? `X ${Math.round(computedRect.x)} · Y ${Math.round(computedRect.y)} · ${Math.round(
                    computedRect.width,
                  )} × ${Math.round(computedRect.height)} · from children`
                : "—"}
            </span>
          </PropertyRow>
        ) : (
          <>
            <PropertyRow label="Position">
              <NumericField
                label="X"
                ariaLabel={vertical ? "Group X position" : "Group anchor X position"}
                value={Math.round(group.x)}
                onCommit={(v) => onChange({ x: v ?? group.x })}
              />
              <NumericField
                label="Y"
                ariaLabel={vertical ? "Group anchor Y position" : "Group Y position"}
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
                {computedRect
                  ? Math.round(vertical ? computedRect.height : computedRect.width)
                  : "—"}{" "}
                · computed
              </span>
            </PropertyRow>
          </>
        )}
      </InspectorSection>

      <InspectorSection id="group-overflow" title="Overflow">
        {!free && (
          <>
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
          </>
        )}
        {computedRect?.overflows && (
          <p style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>
            This {free ? "group" : "stack"} currently extends beyond the canvas.
          </p>
        )}
        {free && !computedRect?.overflows && (
          <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            A group that outgrows the canvas is flagged here in the builder — members never see a
            warning.
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
