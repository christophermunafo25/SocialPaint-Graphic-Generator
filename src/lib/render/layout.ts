// The layout pass: schema + resolved member values in, absolute rects out.
//
// This is the whole groups feature. It is PURE — the only I/O is the injected
// LineMeasurer (canvas-backed in the app, a fake in tests), so the same
// function runs identically under the builder canvas, the member preview, the
// PNG export, and vitest. The renderer never positions from fields directly
// anymore: every surface asks this pass for rects, grouped or not, so there
// is exactly one positioning path.
//
// Coordinate conventions:
//  - Output rects are always TOP-LEFT canvas-pixel space. A field authored
//    with anchor="center" is normalized here (x - w/2), and the renderer
//    positions from the rect without any anchor transform.
//  - Rotation is a visual transform about the box center, applied by the
//    renderer AFTER placement. Stacks place the unrotated extents.
//  - Fractional values are kept — rounding inside the stack math would let
//    error accumulate into the gaps this feature exists to hold fixed.

import type { BrandKit, FieldValues, LayoutGroup, TemplateField, TemplateSchema } from "../types";
import { parseGroupChildRef } from "../types";
import { resolveFieldStyle, type ResolvedFieldStyle } from "../brand/resolveStyle";
import {
  canvasFontShorthand,
  fittedFontSize,
  fixedWidthFontSizeWith,
  type LineMeasurer,
} from "./autoFit";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupRect extends Rect {
  /** Any edge outside the canvas — the builder warns, nothing clips. */
  overflows: boolean;
}

export interface LayoutResult {
  /** Every field's display rect (top-left space) by field id, grouped or not. */
  fieldRects: Map<string, Rect>;
  /** Computed group frames by group id — builder chrome and warnings ONLY.
   * Never rendered in the member preview or the export. */
  groupRects: Map<string, GroupRect>;
  /** The font size every text-ish field renders at, by field id. For
   * ungrouped fields this is exactly what the renderer computed before this
   * feature existed; grouped children also reflect shrinkToFit. */
  fontSizes: Map<string, number>;
  warnings: string[];
}

/** The text a field actually renders — the single source shared with
 * TextFieldBox, so measurement can never diverge from painting. */
export function renderedText(field: TemplateField, value: string | undefined): string {
  const effective = field.static ? field.staticValue : value;
  return effective || (field.static ? field.label : field.placeholder || field.label);
}

const isTextual = (f: TemplateField): boolean =>
  f.type === "text" || f.type === "multiline" || f.type === "select";

const lineHeightOf = (style: ResolvedFieldStyle): number => style.lineHeight ?? 1.1;

/** The font size a text field renders at — the exact decision TextFieldBox
 * made inline before the layout pass owned it. */
export function resolvedFontSize(
  field: TemplateField,
  style: ResolvedFieldStyle,
  text: string,
  measure: LineMeasurer,
): number {
  const singleLine = field.type !== "multiline";
  return field.fixedWidth && singleLine
    ? fixedWidthFontSizeWith(measure, { width: field.width, ...style }, text)
    : fittedFontSize({ width: field.width, ...style }, text);
}

/** One line's painted width: glyphs plus the per-gap letter spacing. Matches
 * the (len - 1) gap convention fixedWidthFontSize already uses. */
function lineWidth(
  line: string,
  style: ResolvedFieldStyle,
  fontSizePx: number,
  measure: LineMeasurer,
): number {
  if (!line) return 0;
  const font = canvasFontShorthand({ ...style, fontSizePx });
  const spacing = (style.letterSpacingPx ?? 0) * Math.max(0, line.length - 1);
  return measure(line, font) + spacing;
}

/** Greedy word wrap mirroring the multiline renderer (white-space: pre-wrap;
 * word-break: break-word): explicit newlines are hard breaks, words wrap at
 * the box width, and a single word wider than the box breaks mid-word. The
 * uppercase transform applies BEFORE measuring, exactly as it paints. */
export function wrapLines(
  text: string,
  width: number,
  style: ResolvedFieldStyle,
  fontSizePx: number,
  measure: LineMeasurer,
): string[] {
  const sample = style.uppercase ? text.toUpperCase() : text;
  const fits = (s: string) => lineWidth(s, style, fontSizePx, measure) <= width;
  const lines: string[] = [];

  for (const paragraph of sample.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (fits(word) || word.length <= 1) {
        current = word;
        continue;
      }
      // break-word: chop the overlong word greedily, one chunk per line.
      let rest = word;
      while (rest.length > 1 && !fits(rest)) {
        let take = rest.length - 1;
        while (take > 1 && !fits(rest.slice(0, take))) take--;
        lines.push(rest.slice(0, take));
        rest = rest.slice(take);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

/** A text field's hugged content height at the given size: line boxes times
 * the CSS line height, the same arithmetic the browser applies to the <p>. */
export function measuredTextHeight(
  field: TemplateField,
  style: ResolvedFieldStyle,
  text: string,
  fontSizePx: number,
  width: number,
  measure: LineMeasurer,
): number {
  const lines =
    field.type === "multiline" ? wrapLines(text, width, style, fontSizePx, measure).length : 1;
  return lines * fontSizePx * lineHeightOf(style);
}

/** A single-line field's painted width (horizontal stacks hug on this). */
function measuredTextWidth(
  style: ResolvedFieldStyle,
  text: string,
  fontSizePx: number,
  measure: LineMeasurer,
): number {
  const sample = style.uppercase ? text.toUpperCase() : text;
  return lineWidth(sample, style, fontSizePx, measure);
}

/** Authored rect normalized to top-left space. */
export function authoredRect(f: TemplateField): Rect {
  return {
    x: f.anchor === "center" ? f.x - f.width / 2 : f.x,
    y: f.anchor === "center" ? f.y - f.height / 2 : f.y,
    width: f.width,
    height: f.height,
  };
}

// ---------------------------------------------------------------------------
// Group graph helpers (shared with the builder UI)
// ---------------------------------------------------------------------------

/** Groups that are not themselves a child of another group. */
export function topLevelGroups(groups: LayoutGroup[]): LayoutGroup[] {
  const nested = new Set<string>();
  for (const g of groups) {
    for (const ref of g.children) {
      const id = parseGroupChildRef(ref);
      if (id) nested.add(id);
    }
  }
  return groups.filter((g) => !nested.has(g.id));
}

/** The group directly containing a field, if any. */
export function groupOfField(
  fieldKey: string,
  groups: LayoutGroup[] | undefined,
): LayoutGroup | undefined {
  return groups?.find((g) => g.children.includes(fieldKey));
}

/** The group directly containing a nested group, if any. */
export function parentGroupOf(groupId: string, groups: LayoutGroup[]): LayoutGroup | undefined {
  const ref = `group:${groupId}`;
  return groups.find((g) => g.children.includes(ref));
}

/** The outermost group an element belongs to (what a first click selects). */
export function outermostGroupOf(
  fieldKey: string,
  groups: LayoutGroup[] | undefined,
): LayoutGroup | undefined {
  if (!groups) return undefined;
  let g = groupOfField(fieldKey, groups);
  while (g) {
    const parent = parentGroupOf(g.id, groups);
    if (!parent) return g;
    g = parent;
  }
  return undefined;
}

/** Every fieldKey inside a group, nested groups included. */
export function groupFieldKeys(group: LayoutGroup, groups: LayoutGroup[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>([group.id]);
  const visit = (g: LayoutGroup) => {
    for (const ref of g.children) {
      const nestedId = parseGroupChildRef(ref);
      if (nestedId === null) {
        keys.push(ref);
        continue;
      }
      const nested = groups.find((x) => x.id === nestedId);
      if (nested && !seen.has(nested.id)) {
        seen.add(nested.id);
        visit(nested);
      }
    }
  };
  visit(group);
  return keys;
}

// ---------------------------------------------------------------------------
// The layout pass
// ---------------------------------------------------------------------------

interface Ctx {
  fields: Map<string, TemplateField>; // by fieldKey
  groups: Map<string, LayoutGroup>; // by id
  values: FieldValues;
  kit: BrandKit | null;
  measure: LineMeasurer;
  canvasWidth: number;
  canvasHeight: number;
  result: LayoutResult;
  styles: Map<string, ResolvedFieldStyle>; // by field id, per-call
  /** fieldKeys placed by a group — first claim wins across the whole pass. */
  claimed: Set<string>;
  warned: Set<string>;
}

const styleOf = (ctx: Ctx, f: TemplateField): ResolvedFieldStyle => {
  let s = ctx.styles.get(f.id);
  if (!s) {
    s = resolveFieldStyle(f, ctx.kit);
    ctx.styles.set(f.id, s);
  }
  return s;
};

const warnOnce = (ctx: Ctx, message: string): void => {
  if (ctx.warned.has(message)) return;
  ctx.warned.add(message);
  ctx.result.warnings.push(message);
};

/** A resolved stack child. Extents are in the PARENT group's axes. */
type StackChild =
  | { kind: "field"; field: TemplateField; main: number; cross: number }
  | { kind: "group"; group: LayoutGroup; main: number; cross: number; nestedMain: number };

/** Resolve and size a group's children. Sizing pass only — claims nothing
 * permanent; `claim` is set by the placement pass so duplicate membership
 * across groups resolves to the first group that PLACES the field. */
function sizedChildren(
  ctx: Ctx,
  group: LayoutGroup,
  ancestors: Set<string>,
  claim: boolean,
): StackChild[] {
  const vertical = group.direction === "vertical";
  const out: StackChild[] = [];
  for (const ref of group.children) {
    const nestedId = parseGroupChildRef(ref);
    if (nestedId !== null) {
      const nested = ctx.groups.get(nestedId);
      if (!nested) {
        warnOnce(ctx, `Group "${group.name}": a nested group no longer exists — skipped.`);
        continue;
      }
      if (ancestors.has(nestedId) || nestedId === group.id) {
        warnOnce(ctx, `Group "${group.name}": circular nesting via "${nested.name}" — skipped.`);
        continue;
      }
      // Nested extents map into the parent's axes: same direction → its
      // computed main size runs along ours; orthogonal → its authored
      // crossSize does, and its computed size becomes our cross extent.
      const nestedMain = contentMainSize(ctx, nested, new Set(ancestors).add(group.id));
      const sameAxis = nested.direction === group.direction;
      out.push({
        kind: "group",
        group: nested,
        nestedMain,
        main: sameAxis ? nestedMain : nested.crossSize,
        cross: sameAxis ? nested.crossSize : nestedMain,
      });
      continue;
    }
    const f = ctx.fields.get(ref);
    if (!f) {
      warnOnce(ctx, `Group "${group.name}": field "${ref}" no longer exists — skipped.`);
      continue;
    }
    if (ctx.claimed.has(ref)) {
      warnOnce(
        ctx,
        `Group "${group.name}": field "${ref}" already belongs to another group — skipped.`,
      );
      continue;
    }
    if (claim) ctx.claimed.add(ref);

    // Text hugs the main axis — that is what keeps the gap constant. Images,
    // shapes, and multiline-in-a-horizontal-stack have no content-driven
    // extent and keep their authored size.
    if (!isTextual(f)) {
      out.push({
        kind: "field",
        field: f,
        main: vertical ? f.height : f.width,
        cross: vertical ? f.width : f.height,
      });
      continue;
    }
    const style = styleOf(ctx, f);
    const text = renderedText(f, ctx.values[f.fieldKey]);
    const size = ctx.result.fontSizes.get(f.id) ?? resolvedFontSize(f, style, text, ctx.measure);
    if (vertical) {
      out.push({
        kind: "field",
        field: f,
        main: measuredTextHeight(f, style, text, size, f.width, ctx.measure),
        cross: f.width,
      });
    } else {
      out.push({
        kind: "field",
        field: f,
        main: f.type === "multiline" ? f.width : measuredTextWidth(style, text, size, ctx.measure),
        cross: f.type === "multiline" ? f.height : size * lineHeightOf(style),
      });
    }
  }
  return out;
}

/** Content main-axis size (in the group's OWN axes): children plus gaps. */
function contentMainSize(ctx: Ctx, group: LayoutGroup, ancestors: Set<string>): number {
  const children = sizedChildren(ctx, group, ancestors, false);
  // A child of an orthogonal nested group contributes its extent along the
  // NESTED group's main axis — which sizedChildren already mapped into ours,
  // so summing `main` is correct in every combination.
  return (
    children.reduce((sum, c) => sum + c.main, 0) + group.gap * Math.max(0, children.length - 1)
  );
}

/** Place a group whose slot TOP-LEFT (absolute x/y) is fixed — the parent
 * owns the slot for nested groups; a top-level group derives it from its own
 * anchor first. Writes rects for every descendant. */
function placeGroup(
  ctx: Ctx,
  group: LayoutGroup,
  absX: number,
  absY: number,
  ancestors: Set<string>,
): void {
  const vertical = group.direction === "vertical";
  const children = sizedChildren(ctx, group, ancestors, true);
  const nextAncestors = new Set(ancestors).add(group.id);

  let cursor = vertical ? absY : absX;
  for (const c of children) {
    const crossOffset =
      group.align === "center"
        ? (group.crossSize - c.cross) / 2
        : group.align === "end"
          ? group.crossSize - c.cross
          : 0;
    const crossPos = (vertical ? absX : absY) + crossOffset;
    const childX = vertical ? crossPos : cursor;
    const childY = vertical ? cursor : crossPos;
    if (c.kind === "group") {
      placeGroup(ctx, c.group, childX, childY, nextAncestors);
      recordGroupRect(ctx, c.group, childX, childY, c.nestedMain);
    } else {
      ctx.result.fieldRects.set(c.field.id, {
        x: childX,
        y: childY,
        width: vertical ? c.cross : c.main,
        height: vertical ? c.main : c.cross,
      });
    }
    cursor += c.main + group.gap;
  }
}

function recordGroupRect(
  ctx: Ctx,
  group: LayoutGroup,
  absX: number,
  absY: number,
  mainSize: number,
): void {
  const vertical = group.direction === "vertical";
  const rect: Rect = {
    x: absX,
    y: absY,
    width: vertical ? group.crossSize : mainSize,
    height: vertical ? mainSize : group.crossSize,
  };
  ctx.result.groupRects.set(group.id, {
    ...rect,
    overflows:
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > ctx.canvasWidth ||
      rect.y + rect.height > ctx.canvasHeight,
  });
}

/** Place a TOP-LEVEL group from its own anchor: the anchor point holds still
 * and content grows away from it. */
function placeTopLevel(ctx: Ctx, group: LayoutGroup): void {
  const vertical = group.direction === "vertical";
  const anchorPos = vertical ? group.y : group.x;

  if (group.shrinkToFit) applyShrink(ctx, group, anchorPos, vertical);

  const contentMain = contentMainSize(ctx, group, new Set());
  const mainStart =
    group.anchor === "center"
      ? anchorPos - contentMain / 2
      : group.anchor === "end"
        ? anchorPos - contentMain
        : anchorPos;
  const absX = vertical ? group.x : mainStart;
  const absY = vertical ? mainStart : group.y;
  placeGroup(ctx, group, absX, absY, new Set());
  recordGroupRect(ctx, group, absX, absY, contentMain);
}

/** shrinkToFit: proportionally drive text descendants' font sizes down
 * (never below their autoFit floors) until the stack fits the canvas span
 * available from its anchor. Iterative because shrinking re-wraps multiline
 * text; sizes are monotonically decreasing and floored, so it terminates. */
function applyShrink(ctx: Ctx, group: LayoutGroup, anchorPos: number, vertical: boolean): void {
  const canvasMain = vertical ? ctx.canvasHeight : ctx.canvasWidth;
  const available =
    group.anchor === "start"
      ? canvasMain - anchorPos
      : group.anchor === "end"
        ? anchorPos
        : 2 * Math.min(anchorPos, canvasMain - anchorPos);
  if (available <= 0) return;

  const textFields = groupFieldKeys(group, [...ctx.groups.values()])
    .map((k) => ctx.fields.get(k))
    .filter((f): f is TemplateField => Boolean(f && isTextual(f)));

  for (let i = 0; i < 8; i++) {
    const contentMain = contentMainSize(ctx, group, new Set());
    if (contentMain <= available) return;
    const scale = available / contentMain;
    let changed = false;
    for (const f of textFields) {
      const style = styleOf(ctx, f);
      const text = renderedText(f, ctx.values[f.fieldKey]);
      const current =
        ctx.result.fontSizes.get(f.id) ?? resolvedFontSize(f, style, text, ctx.measure);
      const floor = style.minFontSizePx ?? 8;
      const next = Math.max(floor, Math.floor(current * scale));
      if (next < current) {
        ctx.result.fontSizes.set(f.id, next);
        changed = true;
      }
    }
    if (!changed) {
      warnOnce(ctx, `Group "${group.name}" cannot shrink to fit — text is at its minimum size.`);
      return;
    }
  }
}

/**
 * THE layout pass. Every field gets a rect: ungrouped fields resolve to their
 * authored rects (normalized to top-left space) and text sizes exactly as the
 * renderer computed them before groups existed; grouped children get stacked,
 * hugged, and anchored. Deterministic given the measurer.
 */
export function computeLayout(
  schema: Pick<TemplateSchema, "fields" | "layoutGroups" | "canvasWidth" | "canvasHeight">,
  values: FieldValues,
  kit: BrandKit | null,
  measure: LineMeasurer,
): LayoutResult {
  const result: LayoutResult = {
    fieldRects: new Map(),
    groupRects: new Map(),
    fontSizes: new Map(),
    warnings: [],
  };
  const ctx: Ctx = {
    fields: new Map(schema.fields.map((f) => [f.fieldKey, f])),
    groups: new Map((schema.layoutGroups ?? []).map((g) => [g.id, g])),
    values,
    kit,
    measure,
    canvasWidth: schema.canvasWidth,
    canvasHeight: schema.canvasHeight,
    result,
    styles: new Map(),
    claimed: new Set(),
    warned: new Set(),
  };

  // Baseline: every field at its authored rect and renderer-identical font
  // size. Groups then override their children's rects (and, under shrink,
  // sizes) — so a template with no groups is a pure passthrough.
  for (const f of schema.fields) {
    result.fieldRects.set(f.id, authoredRect(f));
    if (isTextual(f)) {
      const style = styleOf(ctx, f);
      const text = renderedText(f, values[f.fieldKey]);
      result.fontSizes.set(f.id, resolvedFontSize(f, style, text, measure));
    }
  }

  const groups = schema.layoutGroups ?? [];
  for (const g of topLevelGroups(groups)) placeTopLevel(ctx, g);

  // A group every other group claims as a child (a mutual cycle) is never
  // top-level, so the walk above never reaches it — its children safely keep
  // their authored rects, but say so rather than silently doing nothing.
  for (const g of groups) {
    if (!result.groupRects.has(g.id)) {
      warnOnce(ctx, `Group "${g.name}": circular nesting — not laid out.`);
    }
  }

  return result;
}
