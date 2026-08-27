// Group operations for the Template Builder: create a group from a selection
// (visually lossless), ungroup back to absolute positions (also lossless),
// and the bookkeeping that keeps LayoutGroup.children references valid as
// fields are renamed and deleted. Pure functions — the builder wires them to
// state; vitest covers them directly.

import type { BrandKit, GroupAxisPoint, LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, isFreeGroup, parseGroupChildRef } from "@/lib/types";
import type { LineMeasurer } from "@/lib/render/autoFit";
import {
  authoredRect,
  groupFieldKeys,
  measuredTextHeight,
  measuredTextWidth,
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

/** The VISUAL extents of a field as painted today, one per stack axis —
 * because the two stack directions place different rects. A vertical stack
 * writes {cross: the authored box's x/width, main: the hugged content
 * block's y/height}; a horizontal one places the painted glyph run itself
 * (align applied, measured width, line-box height). Grouping and conversion
 * anchor to what the admin SEES, which is what makes those moments
 * lossless. Multiline has no content-driven width, so its horizontal extent
 * is the authored box; images and shapes are their box on both axes. */
interface MemberExtents {
  /** Extent a VERTICAL stack reproduces. */
  v: Rect;
  /** Extent a HORIZONTAL stack reproduces. */
  h: Rect;
}

function memberExtents(
  f: TemplateField,
  kit: BrandKit | null,
  measure: LineMeasurer,
): MemberExtents {
  const box = authoredRect(f);
  if (f.type !== "text" && f.type !== "multiline" && f.type !== "select") return { v: box, h: box };
  const style = resolveFieldStyle(f, kit);
  // A multiline Shrink field IS its fixed box on both axes — the stack
  // reproduces the box, not a hugged block, so grouping stays lossless.
  if (f.type === "multiline" && style.textSizing === "shrink") return { v: box, h: box };
  const text = renderedText(f, undefined);
  const size = resolvedFontSize(f, style, text, measure);
  const contentH = measuredTextHeight(f, style, text, size, f.width, measure);
  const offsetY =
    f.verticalAlign === "top"
      ? 0
      : f.verticalAlign === "bottom"
        ? box.height - contentH
        : (box.height - contentH) / 2;
  const v: Rect = { x: box.x, y: box.y + offsetY, width: box.width, height: contentH };
  if (f.type === "multiline") return { v, h: box };
  const textW = measuredTextWidth(style, text, size, measure);
  const offsetX =
    f.align === "center" ? (box.width - textW) / 2 : f.align === "right" ? box.width - textW : 0;
  return { v, h: { x: box.x + offsetX, y: box.y + offsetY, width: textW, height: contentH } };
}

/** Cross-axis alignment inference: whichever of the children's start edges,
 * centers, or end edges varies least is what the admin lined up. For a
 * vertical stack the cross axis is x (left/center/right); for a horizontal
 * one it is y (top/middle/bottom). */
function inferAlign(extents: Rect[], vertical: boolean): GroupAxisPoint {
  const start = (e: Rect) => (vertical ? e.x : e.y);
  const size = (e: Rect) => (vertical ? e.width : e.height);
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  const starts = spread(extents.map(start));
  const centers = spread(extents.map((e) => start(e) + size(e) / 2));
  const ends = spread(extents.map((e) => start(e) + size(e)));
  const min = Math.min(starts, centers, ends);
  return min === starts ? "start" : min === centers ? "center" : "end";
}

/** Direction inference: elements that separate cleanly side by side read as
 * a row, top-to-bottom as a column. Count the adjacent pairs (sorted along
 * each axis) whose spans do not overlap; more clean breaks along x than y →
 * horizontal. Ties — including fully overlapping scatter — default to
 * vertical. */
function inferDirection(extents: Rect[]): LayoutGroup["direction"] {
  const breaks = (spans: Array<[number, number]>) => {
    const sorted = [...spans].sort((a, b) => a[0] - b[0]);
    let n = 0;
    let end = sorted[0]?.[1] ?? 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i][0] >= end - 0.01) n++;
      end = Math.max(end, sorted[i][1]);
    }
    return n;
  };
  const x = breaks(extents.map((e): [number, number] => [e.x, e.x + e.width]));
  const y = breaks(extents.map((e): [number, number] => [e.y, e.y + e.height]));
  return x > y ? "horizontal" : "vertical";
}

/** Stack geometry derived from where members currently sit, so that turning
 * these members into a stack moves nothing (where they already roughly form
 * one): direction inferred from the painted arrangement, order by main-axis
 * position, gap = mean of current gaps, anchor at the first member's start,
 * alignment inferred. Extents are direction-specific — chosen after the
 * direction is known, so the derivation reproduces exactly what the chosen
 * stack would place. */
function deriveStackProps(
  members: Array<{ ref: string; ext: MemberExtents }>,
): Pick<
  LayoutGroup,
  "direction" | "gap" | "anchor" | "align" | "x" | "y" | "crossSize" | "children"
> {
  const direction = inferDirection(members.map((m) => m.ext.h));
  const vertical = direction === "vertical";
  const picked = members.map((m) => ({ ref: m.ref, extent: vertical ? m.ext.v : m.ext.h }));
  const mainPos = (e: Rect) => (vertical ? e.y : e.x);
  const mainSize = (e: Rect) => (vertical ? e.height : e.width);
  const crossPos = (e: Rect) => (vertical ? e.x : e.y);
  const crossSpan = (e: Rect) => (vertical ? e.width : e.height);
  const sorted = [...picked].sort((a, b) => mainPos(a.extent) - mainPos(b.extent));
  const extents = sorted.map((m) => m.extent);
  const gaps: number[] = [];
  for (let i = 1; i < extents.length; i++) {
    gaps.push(
      Math.max(0, mainPos(extents[i]) - (mainPos(extents[i - 1]) + mainSize(extents[i - 1]))),
    );
  }
  const gap = Math.round(gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length));
  const crossStart = Math.min(...extents.map(crossPos));
  const crossEnd = Math.max(...extents.map((e) => crossPos(e) + crossSpan(e)));
  const main0 = mainPos(extents[0]);
  return {
    direction,
    gap,
    anchor: "start",
    align: inferAlign(extents, vertical),
    x: vertical ? crossStart : main0,
    y: vertical ? main0 : crossStart,
    crossSize: Math.round(crossEnd - crossStart),
    children: sorted.map((m) => m.ref),
  };
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

/** Eligible members of the current selection with their visual extents, or
 * null when the selection can't group (fewer than two eligible members, or a
 * field already grouped — ungroup first). Selected groups nest as children;
 * their computed rects are their extents. */
function selectionMembers(input: DeriveInput): Array<{ ref: string; ext: MemberExtents }> | null {
  const { fields, groups, fieldIds, groupIds, layout, kit, measure } = input;
  const selectedFields = fields.filter((f) => fieldIds.includes(f.id));
  // A field already inside a group can't join another — ungroup first.
  if (selectedFields.some((f) => outermostGroupOf(f.fieldKey, groups))) return null;
  const selectedGroups = groups.filter((g) => groupIds.includes(g.id));

  const members: Array<{ ref: string; ext: MemberExtents }> = [
    ...selectedFields.map((f) => ({
      ref: f.fieldKey,
      ext: memberExtents(f, kit, measure),
    })),
    ...selectedGroups.map((g) => {
      const r = layout.groupRects.get(g.id) ?? { x: g.x, y: g.y, width: g.crossSize, height: 0 };
      return { ref: groupChildRef(g.id), ext: { v: r, h: r } };
    }),
  ];
  return members.length < 2 ? null : members;
}

/** Build a PLAIN group from the current selection: pure membership, so it is
 * lossless by construction — nothing about the children changes. Children
 * order by visual position (top-to-bottom, then left-to-right) purely so the
 * field list reads sanely. The inert stack properties stay populated (the
 * type keeps one flat shape) and are re-derived if auto layout is turned on. */
export function deriveFreeGroup(input: DeriveInput): LayoutGroup | null {
  const members = selectionMembers(input);
  if (!members) return null;
  const boxes = members.map((m) => ({ ref: m.ref, extent: m.ext.v }));
  const sorted = [...boxes].sort((a, b) => a.extent.y - b.extent.y || a.extent.x - b.extent.x);
  const left = Math.min(...boxes.map((m) => m.extent.x));
  const right = Math.max(...boxes.map((m) => m.extent.x + m.extent.width));
  return {
    id: newId(),
    name: "Group",
    mode: "free",
    direction: "vertical",
    gap: 0,
    anchor: "start",
    align: "start",
    x: left,
    y: Math.min(...boxes.map((m) => m.extent.y)),
    crossSize: Math.round(right - left),
    children: sorted.map((m) => m.ref),
  };
}

/** Build an auto-layout stack from the current selection so that NOTHING
 * moves at the moment of grouping: direction inferred from the arrangement,
 * order by main-axis position, gap = mean of the current visual gaps, anchor
 * at the first child's start, alignment inferred from which edge the
 * children already share. Refuses a selected plain group as a member — a
 * plain group can't sit inside a stack. */
export function deriveGroup(input: DeriveInput): LayoutGroup | null {
  if (input.groups.some((g) => input.groupIds.includes(g.id) && isFreeGroup(g))) return null;
  const members = selectionMembers(input);
  if (!members) return null;
  return { id: newId(), name: "Group", mode: "stack", ...deriveStackProps(members) };
}

export interface UngroupResult {
  fields: TemplateField[];
  groups: LayoutGroup[];
}

/** Freeze a group's DIRECT child fields at their currently computed rects
 * (text keeps its hugged height — the visual block does not move). Fields
 * under nested groups stay untouched: their own group keeps placing them. */
function freezeChildFields(
  group: LayoutGroup,
  fields: TemplateField[],
  layout: LayoutResult,
): TemplateField[] {
  return fields.map((f) => {
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
}

/** Re-author a group's position so it self-places exactly where the layout
 * pass currently shows it: a stack's anchor coordinate maps back onto the
 * frame edge it tracks; a free group just syncs its (unused) origin. */
function reanchorAt(g: LayoutGroup, layout: LayoutResult): LayoutGroup {
  const rect = layout.groupRects.get(g.id);
  if (!rect) return g;
  if (isFreeGroup(g)) return { ...g, x: rect.x, y: rect.y };
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
}

const childGroupIds = (group: LayoutGroup): string[] =>
  group.children.map(parseGroupChildRef).filter((id): id is string => id !== null);

/** Dissolve a group losslessly: direct child fields freeze at their computed
 * rects, and nested child groups are promoted to top level re-anchored so
 * they hold their computed position. */
export function ungroup(
  group: LayoutGroup,
  fields: TemplateField[],
  groups: LayoutGroup[],
  layout: LayoutResult,
): UngroupResult {
  const promoted = childGroupIds(group);
  return {
    fields: freezeChildFields(group, fields, layout),
    groups: groups
      .filter((g) => g.id !== group.id)
      .map((g) => (promoted.includes(g.id) ? reanchorAt(g, layout) : g)),
  };
}

/** Convert a stack to a PLAIN group: the same freeze as ungroup — direct
 * child fields take their computed rects as authored values, nested stacks
 * re-anchor to hold still — but membership survives and the group becomes
 * mode "free". Always lossless. */
export function toFreeGroup(
  group: LayoutGroup,
  fields: TemplateField[],
  groups: LayoutGroup[],
  layout: LayoutResult,
): UngroupResult {
  const nested = childGroupIds(group);
  return {
    fields: freezeChildFields(group, fields, layout),
    groups: groups.map((g) => {
      if (g.id === group.id) return reanchorAt({ ...g, mode: "free" }, layout);
      return nested.includes(g.id) ? reanchorAt(g, layout) : g;
    }),
  };
}

/** Convert a PLAIN group to a stack: direction, order, gap, anchor, and
 * alignment derive from where the children currently sit (the same
 * derivation as grouping a selection), so an arrangement that already
 * roughly forms a stack converts near-losslessly. The caller decides
 * whether to warn first, from an exact simulation via conversionShift. */
export function toStackGroup(
  group: LayoutGroup,
  fields: TemplateField[],
  groups: LayoutGroup[],
  layout: LayoutResult,
  kit: BrandKit | null,
  measure: LineMeasurer,
): LayoutGroup {
  const members: Array<{ ref: string; ext: MemberExtents }> = [];
  for (const ref of group.children) {
    const nestedId = parseGroupChildRef(ref);
    if (nestedId !== null) {
      const nested = groups.find((g) => g.id === nestedId);
      if (!nested) continue;
      const r = layout.groupRects.get(nestedId) ?? {
        x: nested.x,
        y: nested.y,
        width: nested.crossSize,
        height: 0,
      };
      members.push({ ref, ext: { v: r, h: r } });
      continue;
    }
    const f = fields.find((x) => x.fieldKey === ref);
    if (!f) continue;
    members.push({ ref, ext: memberExtents(f, kit, measure) });
  }
  if (members.length < 2) return { ...group, mode: "stack" };
  const derived = deriveStackProps(members);
  // Dangling refs (skipped above) stay members — other cleanup owns them.
  const kept = new Set(derived.children);
  derived.children = [...derived.children, ...group.children.filter((r) => !kept.has(r))];
  return { ...group, mode: "stack", ...derived };
}

/** The exact displacement turning on auto layout would cause: max shift of
 * any direct child's visual block from where it paints today to where the
 * CONVERTED stack (whose direction picks the comparable extent) would place
 * it. Text compares painted content blocks — a stack hugs text, so box
 * rects are incomparable; nested groups compare frames, and their
 * descendants travel with them. */
export function conversionShift(
  converted: LayoutGroup,
  fields: TemplateField[],
  before: LayoutResult,
  after: LayoutResult,
  kit: BrandKit | null,
  measure: LineMeasurer,
): number {
  const vertical = converted.direction === "vertical";
  let max = 0;
  const bump = (a: Rect | undefined, b: Rect | undefined) => {
    if (a && b) max = Math.max(max, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  };
  for (const ref of converted.children) {
    const nestedId = parseGroupChildRef(ref);
    if (nestedId !== null) {
      bump(before.groupRects.get(nestedId), after.groupRects.get(nestedId));
      continue;
    }
    const f = fields.find((x) => x.fieldKey === ref);
    if (!f) continue;
    const isText = f.type === "text" || f.type === "multiline" || f.type === "select";
    const ext = memberExtents(f, kit, measure);
    const b = isText ? (vertical ? ext.v : ext.h) : before.fieldRects.get(f.id);
    bump(b, after.fieldRects.get(f.id));
  }
  return max;
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
/** What moving a whole group touches. The frames that travel with it, and
 * the fieldKeys inside it that carry their own coordinates — a plain group's
 * children self-place, so a delta writes through to each of them, while a
 * STACK re-places its children from its anchor, so only its frame is listed.
 *
 * One definition, two callers: a selection drag and an alignment both have to
 * answer this identically or the two would move a group differently. */
export function groupMoveTargets(
  groupIds: string[],
  groups: LayoutGroup[],
): { frameIds: Set<string>; fieldKeys: Set<string> } {
  const frameIds = new Set<string>();
  const fieldKeys = new Set<string>();
  const visit = (grp: LayoutGroup) => {
    if (frameIds.has(grp.id)) return;
    frameIds.add(grp.id);
    for (const ref of grp.children) {
      const nested = parseGroupChildRef(ref);
      if (nested !== null) {
        const child = groups.find((x) => x.id === nested);
        if (child) visit(child);
      } else if (isFreeGroup(grp)) {
        fieldKeys.add(ref);
      }
    }
  };
  for (const id of groupIds) {
    const g = groups.find((x) => x.id === id);
    if (!g) continue;
    if (isFreeGroup(g)) visit(g);
    else frameIds.add(g.id);
  }
  return { frameIds, fieldKeys };
}

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
