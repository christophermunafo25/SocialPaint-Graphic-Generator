// What a frame says about itself, applied to the fields the walk made from
// it (import intent, Phase 1): the keys a designer wrote into the layer
// names, mapped onto the faithful import before any model is asked
// anything. Pure, and run inside importFrame, so the offline replay and both
// Figma functions read a frame the same way.

import { slug, type FigmaNode, type ImportWarning, type SuggestedField } from "./extract.ts";
import {
  declaredIntentOf,
  parseLayerName,
  parseTree,
  roleLabel,
  type DeclaredIntent,
  type ParseReport,
} from "./recipe.ts";

/** One field's declared intent, for the model pass, the measured limits and
 * the import report. Keyed by the field's id, which the landing keeps. */
export interface FieldIntent {
  fieldId: string;
  sourceNodeId: string;
  /** The layer whose name was read (the photo inside a mask group, the
   * container of a fused pill). */
  layer: string;
  declared: DeclaredIntent;
  /** Keys that were read but can't apply to this field (`edit=member` on a
   * shape). */
  ignored?: string[];
}

export interface FrameIntent {
  intents: FieldIntent[];
  parse: ParseReport;
}

interface Indexed {
  node: FigmaNode;
  parent?: FigmaNode;
}

export function indexTree(root: FigmaNode): Map<string, Indexed> {
  const byId = new Map<string, Indexed>();
  const visit = (node: FigmaNode, parent?: FigmaNode) => {
    if (!byId.has(node.id)) byId.set(node.id, { node, parent });
    for (const child of node.children ?? []) visit(child, node);
  };
  visit(root);
  return byId;
}

const visibleKids = (node: FigmaNode): FigmaNode[] =>
  (node.children ?? []).filter((c) => c.visible !== false);

const hasImageFill = (node: FigmaNode): boolean =>
  (node.fills ?? []).some((f) => f.type === "IMAGE" && f.visible !== false);

/** Keys a fused pill takes from its text, not its container: the text is
 * what a member fills in. */
const TEXT_KEYS = ["edit", "max", "lines", "text", "align"];

/** The declared intent of the field the walk made from `node`, following
 * the two places the walk folds layers together. Undefined when no layer
 * involved is keyed. */
function declaredFor(
  field: SuggestedField,
  node: FigmaNode,
): { declared: DeclaredIntent; layer: string } | undefined {
  const own = parseLayerName(node.name);
  const kids = visibleKids(node);

  // A mask group's image field: the keys sit on the photo inside it.
  if (field.type === "image" && kids.some((c) => c.isMask)) {
    const photo = [...kids].reverse().find((c) => !c.isMask && hasImageFill(c));
    const inner = photo ? parseLayerName(photo.name) : null;
    if (!own && !inner) return undefined;
    const merged = declaredIntentOf({
      role: own?.role ?? inner!.role,
      kind: "image",
      keys: { ...(own?.keys ?? {}), ...(inner?.keys ?? {}) },
      knownKind: true,
      unknownKeys: [],
      stray: [],
    });
    return { declared: merged, layer: inner && photo ? photo.name : node.name };
  }

  // A fused pill: the role and the fill from the container, the member keys
  // from its text.
  if (field.plateColor && node.type !== "TEXT" && kids.length === 1 && kids[0].type === "TEXT") {
    const inner = parseLayerName(kids[0].name);
    if (!own && !inner) return undefined;
    const keys: Record<string, string> = {};
    for (const [k, v] of Object.entries(own?.keys ?? {})) {
      if (!TEXT_KEYS.includes(k)) keys[k] = v;
    }
    for (const k of TEXT_KEYS) {
      const v = inner?.keys[k];
      if (v !== undefined) keys[k] = v;
    }
    const merged = declaredIntentOf({
      role: own?.role ?? inner!.role,
      kind: own?.kind ?? "pill",
      keys,
      knownKind: true,
      unknownKeys: [],
      stray: [],
    });
    return { declared: merged, layer: node.name };
  }

  return own ? { declared: declaredIntentOf(own), layer: node.name } : undefined;
}

const isText = (f: SuggestedField) => f.type === "text" || f.type === "multiline";

/** Fixed off, by the rules the builder's own switch follows (fixedPatch in
 * src/app/components/builder/fieldOps.ts): text gives up its fixed copy,
 * keeps it as the placeholder and shrinks to stay in its box; an image
 * keeps its artwork as the sample a member replaces. */
export function makeMemberField(field: SuggestedField): void {
  field.static = undefined;
  if (isText(field)) {
    if (!field.placeholder && field.staticValue) {
      field.placeholder = field.staticValue.slice(0, 80);
    }
    field.staticValue = undefined;
    if (!field.textSizing) field.textSizing = "shrink";
  }
}

const MAX_LENGTH_CEILING = 2000;

/** Apply one field's declared keys. Returns the keys that couldn't apply. */
function applyDeclared(field: SuggestedField, d: DeclaredIntent): string[] {
  const ignored: string[] = [];
  const memberCapable = isText(field) || field.type === "image";

  if (d.edit === "member") {
    if (memberCapable) makeMemberField(field);
    else ignored.push("edit=member");
  }
  // edit=fixed is how every field already lands.

  if (d.max !== undefined) {
    if (isText(field) && !field.static) {
      field.maxLength = Math.min(MAX_LENGTH_CEILING, d.max);
    } else ignored.push(`max=${d.max}`);
  }

  if (d.align) {
    // Single-line plated text hugs its copy, so its `align` is the edge the
    // plate holds as it grows. That comes from the layout around it, not
    // from how the text sits inside the pill.
    const hugsPlate = field.type === "text" && Boolean(field.plateColor);
    if (isText(field) && !hugsPlate) field.align = d.align;
    else if (!isText(field)) ignored.push(`align=${d.align}`);
  }

  if (d.fit) {
    if (field.type === "image") field.objectFit = d.fit;
    else ignored.push(`fit=${d.fit}`);
  }
  return ignored;
}

/** Labels from roles. A role used once reads as itself ("Headline"); a role
 * used several times is numbered in reading order, top to bottom then left
 * to right ("Item 1" to "Item 4"). */
function labelByRole(fields: SuggestedField[], declaredById: Map<string, DeclaredIntent>): void {
  const groups = new Map<string, SuggestedField[]>();
  for (const f of fields) {
    const d = declaredById.get(f.id);
    if (!d) continue;
    const label = roleLabel(d.role);
    groups.set(label, [...(groups.get(label) ?? []), f]);
  }
  for (const [label, group] of groups) {
    if (group.length === 1) {
      group[0].label = label;
      continue;
    }
    [...group]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .forEach((f, i) => {
        f.label = `${label} ${i + 1}`;
      });
  }
  // Keys follow the labels, unique across the frame. The keys of unkeyed
  // fields stand as the walk made them.
  const taken = new Set(fields.filter((f) => !declaredById.has(f.id)).map((f) => f.fieldKey));
  for (const f of fields) {
    if (declaredById.has(f.id)) f.fieldKey = slug(f.label, taken);
  }
}

// ---------------------------------------------------------------------------
// Layout intent: what the auto layout around a layer says about how it
// should behave once a member's copy replaces the designer's. Read into
// properties fields already have; nothing here builds a stack.
// ---------------------------------------------------------------------------

/** Children an auto layout parent actually lays out. */
const flowKids = (node: FigmaNode): FigmaNode[] =>
  visibleKids(node).filter((c) => c.layoutPositioning !== "ABSOLUTE");

const hugsWidth = (node: FigmaNode): boolean =>
  node.layoutSizingHorizontal
    ? node.layoutSizingHorizontal === "HUG"
    : node.layoutMode === "HORIZONTAL"
      ? node.primaryAxisSizingMode !== "FIXED"
      : node.layoutMode === "VERTICAL" && node.counterAxisSizingMode !== "FIXED";

/** The edge a hug-width child holds while its content grows, from the auto
 * layout parent that places it. Undefined when the parent has no auto
 * layout, so today's anchor stands. */
export function growthAnchorOf(
  child: FigmaNode,
  parent: FigmaNode | undefined,
): "left" | "center" | "right" | undefined {
  if (!parent?.layoutMode || parent.layoutMode === "NONE") return undefined;
  if (child.layoutPositioning === "ABSOLUTE") return undefined;
  if (parent.layoutMode === "VERTICAL") {
    const cross = parent.counterAxisAlignItems ?? "MIN";
    return cross === "CENTER" ? "center" : cross === "MAX" ? "right" : "left";
  }
  const main = parent.primaryAxisAlignItems ?? "MIN";
  if (main === "CENTER") return "center";
  if (main === "MAX") return "right";
  if (main === "SPACE_BETWEEN") {
    const kids = flowKids(parent);
    const i = kids.indexOf(child);
    if (kids.length < 2 || i === 0) return "left";
    return i === kids.length - 1 ? "right" : "center";
  }
  return "left";
}

/** A group or bare frame that only wraps one layer, like the "Group 8"
 * Figma leaves around a headline: it adds nothing of its own. */
const isWrapper = (node: FigmaNode): boolean =>
  (node.type === "GROUP" || (node.type === "FRAME" && !node.layoutMode)) &&
  visibleKids(node).length === 1 &&
  !(node.fills ?? []).some((f) => f.visible !== false) &&
  !(node.strokes ?? []).some((s) => s.visible !== false);

const fixedHeight = (node: FigmaNode): boolean =>
  node.layoutSizingVertical
    ? node.layoutSizingVertical === "FIXED"
    : node.primaryAxisSizingMode === "FIXED";

/** The free room a fixed-height vertical auto layout leaves beside one of
 * its children, on the side that child would grow into: below the first
 * child of a top-packed or space-between column, above the last child of a
 * bottom-packed or space-between one. Zero anywhere else, where growing
 * would run into a sibling. */
export function bandRoomOf(
  child: FigmaNode,
  parent: FigmaNode | undefined,
): { extra: number; grows: "down" | "up" } | undefined {
  if (!parent || parent.layoutMode !== "VERTICAL" || !fixedHeight(parent)) return undefined;
  const kids = flowKids(parent);
  const i = kids.indexOf(child);
  const box = child.absoluteBoundingBox;
  const outer = parent.absoluteBoundingBox;
  if (i < 0 || !box || !outer) return undefined;
  const main = parent.primaryAxisAlignItems ?? "MIN";
  const gap = parent.itemSpacing ?? 0;
  const first = i === 0;
  const last = i === kids.length - 1;
  const down = (main === "MIN" && last) || (main === "SPACE_BETWEEN" && first && kids.length > 1);
  const up = (main === "MAX" && first) || (main === "SPACE_BETWEEN" && last && kids.length > 1);
  if (down) {
    const next = kids[i + 1]?.absoluteBoundingBox;
    const limit = next ? next.y - gap : outer.y + outer.height - (parent.paddingBottom ?? 0);
    return { extra: limit - (box.y + box.height), grows: "down" };
  }
  if (up) {
    const prev = kids[i - 1]?.absoluteBoundingBox;
    const limit = prev ? prev.y + prev.height + gap : outer.y + (parent.paddingTop ?? 0);
    return { extra: box.y - limit, grows: "up" };
  }
  return undefined;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Apply the layout around each field, in place.
 *
 * - A hug-width pill holds the edge its row holds, so a longer or shorter
 *   call to action never drifts off the headline's left edge.
 * - A member text box takes the room its fixed-height column leaves it, so
 *   shrink has the space the design gives the copy. */
export function applyLayoutIntent(
  fields: SuggestedField[],
  byId: Map<string, { node: FigmaNode; parent?: FigmaNode }>,
): void {
  for (const field of fields) {
    const entry = byId.get(field.sourceNodeId);
    if (!entry || field.rotation !== undefined) continue;
    const { node, parent } = entry;

    if (field.type === "text" && field.plateColor && node.type !== "TEXT") {
      if (!hugsWidth(node)) continue;
      const anchor = growthAnchorOf(node, parent);
      if (anchor) field.align = anchor;
      continue;
    }

    if (isText(field) && !field.static && !field.plateColor && node.type === "TEXT") {
      let child = node;
      let holder = parent;
      while (holder && isWrapper(holder)) {
        child = holder;
        holder = byId.get(holder.id)?.parent;
      }
      const room = bandRoomOf(child, holder);
      if (!room || room.extra < 1) continue;
      field.height = round2(field.height + room.extra);
      if (room.grows === "up") {
        field.y = round2(field.y - room.extra);
        field.verticalAlign = "bottom";
      } else {
        field.verticalAlign = "top";
      }
    }
  }
}

/** Read the frame's keys and apply them to the walk's fields, in place. */
export function applyFrameIntent(
  root: FigmaNode,
  fields: SuggestedField[],
  warnings: ImportWarning[],
): FrameIntent {
  const byId = indexTree(root);
  const intents: FieldIntent[] = [];
  const declaredById = new Map<string, DeclaredIntent>();

  for (const field of fields) {
    const node = byId.get(field.sourceNodeId)?.node;
    if (!node) continue;
    const found = declaredFor(field, node);
    if (!found) continue;
    const ignored = applyDeclared(field, found.declared);
    declaredById.set(field.id, found.declared);
    intents.push({
      fieldId: field.id,
      sourceNodeId: field.sourceNodeId,
      layer: found.layer,
      declared: found.declared,
      ...(ignored.length ? { ignored } : {}),
    });
  }
  labelByRole(fields, declaredById);
  applyLayoutIntent(fields, byId);

  const parse = parseTree(root);
  for (const entry of parse.unknownKeys) {
    const m = /^(\S+) \((.*)\)$/.exec(entry);
    if (!m) continue;
    warnings.push({
      layer: m[2],
      nodeId: "",
      issue: `key "${m[1]}" isn't one this import reads, so it was kept in the report only.`,
      severity: "info",
    });
  }
  return { intents, parse };
}
