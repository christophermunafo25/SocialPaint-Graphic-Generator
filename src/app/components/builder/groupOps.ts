// Group operations for the Template Builder: create a group from a selection
// (visually lossless), ungroup back to absolute positions (also lossless),
// and the bookkeeping that keeps LayoutGroup.children references valid as
// fields are renamed and deleted. Pure functions — the builder wires them to
// state; vitest covers them directly.

import type { BrandKit, LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, parseGroupChildRef } from "@/lib/types";
import type { LineMeasurer } from "@/lib/render/autoFit";
import {
  authoredRect,
  groupFieldKeys,
  measuredTextHeight,
  outermostGroupOf,
  renderedText,
  resolvedFontSize,
  type LayoutResult,
  type Rect,
} from "@/lib/render/layout";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { newId } from "@/lib/stores/local/db";

/** Selection entries are field ids OR "group:<id>" refs (the builder keeps
 * both in one selectedIds array). */
export const isGroupSelection = (id: string): boolean => parseGroupChildRef(id) !== null;
export const selectedGroupIds = (selection: string[]): string[] =>
  selection.map(parseGroupChildRef).filter((id): id is string => id !== null);
export const selectedFieldIds = (selection: string[]): string[] =>
  selection.filter((id) => parseGroupChildRef(id) === null);

/** The VISUAL extent of a field as painted today: for text, the hugged
 * content block inside the authored box (verticalAlign applied); for
 * everything else, the authored box. Grouping anchors to what the admin
 * SEES, which is what makes the moment of grouping lossless. */
function visualExtent(f: TemplateField, kit: BrandKit | null, measure: LineMeasurer): Rect {
  const box = authoredRect(f);
  if (f.type !== "text" && f.type !== "multiline" && f.type !== "select") return box;
  const style = resolveFieldStyle(f, kit);
  const text = renderedText(f, undefined);
  const size = resolvedFontSize(f, style, text, measure);
  const contentH = measuredTextHeight(f, style, text, size, f.width, measure);
  const offset =
    f.verticalAlign === "top"
      ? 0
      : f.verticalAlign === "bottom"
        ? box.height - contentH
        : (box.height - contentH) / 2;
  return { x: box.x, y: box.y + offset, width: box.width, height: contentH };
}

/** Cross-axis alignment inference: whichever of the children's left edges,
 * centers, or right edges varies least is what the admin lined up. */
function inferAlign(extents: Rect[]): LayoutGroup["align"] {
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  const lefts = spread(extents.map((e) => e.x));
  const centers = spread(extents.map((e) => e.x + e.width / 2));
  const rights = spread(extents.map((e) => e.x + e.width));
  const min = Math.min(lefts, centers, rights);
  return min === lefts ? "start" : min === centers ? "center" : "end";
}

export interface DeriveInput {
  fields: TemplateField[];
  groups: LayoutGroup[];
  /** Field ids and group ids from the selection. */
  fieldIds: string[];
  groupIds: string[];
  layout: LayoutResult;
  kit: BrandKit | null;
  measure: LineMeasurer;
}

/** Build a vertical group from the current selection so that NOTHING moves at
 * the moment of grouping: children order by visual top, gap = mean of the
 * current visual gaps, anchor at the first child's visual top, alignment
 * inferred from which edge the children already share. Selected groups nest
 * as children (their computed rects are their extents). Returns null when the
 * selection can't group (fewer than two eligible members, or a field already
 * grouped). */
export function deriveGroup(input: DeriveInput): LayoutGroup | null {
  const { fields, groups, fieldIds, groupIds, layout, kit, measure } = input;
  const selectedFields = fields.filter((f) => fieldIds.includes(f.id));
  // A field already inside a group can't join another — ungroup first.
  if (selectedFields.some((f) => outermostGroupOf(f.fieldKey, groups))) return null;
  const selectedGroups = groups.filter((g) => groupIds.includes(g.id));

  const members: Array<{ ref: string; extent: Rect }> = [
    ...selectedFields.map((f) => ({
      ref: f.fieldKey,
      extent: visualExtent(f, kit, measure),
    })),
    ...selectedGroups.map((g) => {
      const r = layout.groupRects.get(g.id);
      return {
        ref: groupChildRef(g.id),
        extent: r ?? { x: g.x, y: g.y, width: g.crossSize, height: 0 },
      };
    }),
  ];
  if (members.length < 2) return null;

  members.sort((a, b) => a.extent.y - b.extent.y);
  const extents = members.map((m) => m.extent);
  const gaps: number[] = [];
  for (let i = 1; i < extents.length; i++) {
    gaps.push(Math.max(0, extents[i].y - (extents[i - 1].y + extents[i - 1].height)));
  }
  const gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const left = Math.min(...extents.map((e) => e.x));
  const right = Math.max(...extents.map((e) => e.x + e.width));

  return {
    id: newId(),
    name: "Group",
    direction: "vertical",
    gap,
    anchor: "start",
    align: inferAlign(extents),
    x: left,
    y: extents[0].y,
    crossSize: Math.round(right - left),
    children: members.map((m) => m.ref),
  };
}

export interface UngroupResult {
  fields: TemplateField[];
  groups: LayoutGroup[];
}

/** Dissolve a group losslessly: every child field freezes at its currently
 * computed rect (text keeps its hugged height — the visual block does not
 * move), and nested child groups are promoted to top level re-anchored so
 * they hold their computed position. */
export function ungroup(
  group: LayoutGroup,
  fields: TemplateField[],
  groups: LayoutGroup[],
  layout: LayoutResult,
): UngroupResult {
  const updatedFields = fields.map((f) => {
    if (!group.children.includes(f.fieldKey)) return f;
    const rect = layout.fieldRects.get(f.id);
    if (!rect) return f;
    return {
      ...f,
      anchor: undefined,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });

  const promotedIds = group.children
    .map(parseGroupChildRef)
    .filter((id): id is string => id !== null);
  const updatedGroups = groups
    .filter((g) => g.id !== group.id)
    .map((g) => {
      if (!promotedIds.includes(g.id)) return g;
      const rect = layout.groupRects.get(g.id);
      if (!rect) return g;
      // Re-anchor at the computed frame so the promoted stack doesn't move:
      // its anchor point maps back onto the frame edge it tracks.
      const vertical = g.direction === "vertical";
      const mainStart = vertical ? rect.y : rect.x;
      const mainSize = vertical ? rect.height : rect.width;
      const anchorPos =
        g.anchor === "start"
          ? mainStart
          : g.anchor === "center"
            ? mainStart + mainSize / 2
            : mainStart + mainSize;
      return vertical ? { ...g, x: rect.x, y: anchorPos } : { ...g, x: anchorPos, y: rect.y };
    });

  return { fields: updatedFields, groups: updatedGroups };
}

/** Remove deleted fields from every group's children; a group left with
 * nothing dissolves. */
export function stripFieldsFromGroups(
  groups: LayoutGroup[] | undefined,
  deletedKeys: string[],
): LayoutGroup[] | undefined {
  if (!groups?.length) return groups;
  const deleted = new Set(deletedKeys);
  let empties: Set<string>;
  let next = groups.map((g) => ({
    ...g,
    children: g.children.filter((ref) => !deleted.has(ref)),
  }));
  // Dissolving an empty group can empty its parent — iterate to fixpoint.
  do {
    empties = new Set(next.filter((g) => g.children.length === 0).map((g) => g.id));
    next = next
      .filter((g) => !empties.has(g.id))
      .map((g) => ({
        ...g,
        children: g.children.filter((ref) => {
          const id = parseGroupChildRef(ref);
          return id === null || !empties.has(id);
        }),
      }));
  } while (empties.size > 0);
  return next.length ? next : undefined;
}

/** Follow a fieldKey rename through every group's children. */
export function renameKeyInGroups(
  groups: LayoutGroup[] | undefined,
  oldKey: string,
  newKey: string,
): LayoutGroup[] | undefined {
  if (!groups?.length || oldKey === newKey) return groups;
  return groups.map((g) =>
    g.children.includes(oldKey)
      ? { ...g, children: g.children.map((ref) => (ref === oldKey ? newKey : ref)) }
      : g,
  );
}

/** Every field id inside the given groups (for delete-group semantics). */
export function fieldIdsInGroups(
  groupIds: string[],
  fields: TemplateField[],
  groups: LayoutGroup[],
): string[] {
  const keys = new Set<string>();
  for (const id of groupIds) {
    const g = groups.find((x) => x.id === id);
    if (g) for (const k of groupFieldKeys(g, groups)) keys.add(k);
  }
  return fields.filter((f) => keys.has(f.fieldKey)).map((f) => f.id);
}

/** Group ids inside the given groups, themselves included (delete cascade). */
export function groupIdsWithin(groupIds: string[], groups: LayoutGroup[]): string[] {
  const out = new Set<string>();
  const visit = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    const g = groups.find((x) => x.id === id);
    if (!g) return;
    for (const ref of g.children) {
      const nested = parseGroupChildRef(ref);
      if (nested) visit(nested);
    }
  };
  for (const id of groupIds) visit(id);
  return [...out];
}
