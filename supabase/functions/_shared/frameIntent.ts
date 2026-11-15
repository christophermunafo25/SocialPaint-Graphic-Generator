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
