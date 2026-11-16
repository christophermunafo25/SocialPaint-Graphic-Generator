// The import intent eval's decisions (scripts/import-intent/eval.mjs;
// docs/import-intent/PHASE-1.md, Step 6): how a frame is renamed to what
// Figma would have called its layers, what the designer's keys say each
// field should be, and how many edits stand between what an import landed
// and that. Pure, so Vitest tests it here and the script only does the I/O.

import type { FigmaNode, SuggestedField } from "../../../supabase/functions/_shared/extract.ts";
import type { FieldIntent } from "../../../supabase/functions/_shared/frameIntent.ts";

/** Figma's name for a new layer of each type, before its number. */
const DEFAULT_NAME: Record<string, string> = {
  FRAME: "Frame",
  GROUP: "Group",
  SECTION: "Section",
  RECTANGLE: "Rectangle",
  ELLIPSE: "Ellipse",
  LINE: "Line",
  VECTOR: "Vector",
  STAR: "Star",
  REGULAR_POLYGON: "Polygon",
  BOOLEAN_OPERATION: "Union",
  INSTANCE: "Instance",
  COMPONENT: "Component",
};

function defaultName(node: FigmaNode, numbered: (base: string) => string): string {
  // A text layer is named after its own copy.
  if (node.type === "TEXT") {
    return (node.characters ?? "").replace(/\s+/g, " ").trim() || numbered("Text");
  }
  const kids = node.children ?? [];
  if (node.type === "GROUP" && kids.some((c) => c.isMask)) return "Mask group";
  // A placed picture arrives as "image 1".
  if (!kids.length && (node.fills ?? []).some((f) => f.type === "IMAGE")) return numbered("image");
  return numbered(DEFAULT_NAME[node.type] ?? "Layer");
}

/** A copy of the frame with every layer under it named as Figma names a
 * new layer, so nothing a designer wrote into a name is left to read. The
 * frame keeps its own name: that is the template's, not a layer's. */
export function renameToDefaults(root: FigmaNode): FigmaNode {
  const copy = structuredClone(root);
  const counts = new Map<string, number>();
  const numbered = (base: string) => {
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return `${base} ${n}`;
  };
  const visit = (node: FigmaNode) => {
    for (const child of node.children ?? []) {
      child.name = defaultName(child, numbered);
      visit(child);
    }
  };
  visit(copy);
  return copy;
}

/** What one field should be, by the layer the import made it from. */
export interface FieldTruth {
  sourceNodeId: string;
  /** The field's label when the truth was read, for the report. */
  label: string;
  member: boolean;
  /** The character limit the layer declares. */
  max?: number;
}

type LandedField = Pick<SuggestedField, "id" | "sourceNodeId" | "label" | "static" | "type">;

const fillable = (f: { type: string }) =>
  f.type === "text" || f.type === "multiline" || f.type === "image";

/** The answers a keyed frame already gives: every field whose layer states
 * `edit`, read from the keyed import, where those keys are applied. A layer
 * that states nothing has no answer to score against. */
export function truthFromKeys(
  fields: Array<LandedField & { maxLength?: number }>,
  intents: FieldIntent[],
): FieldTruth[] {
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const out: FieldTruth[] = [];
  for (const intent of intents) {
    const field = fieldById.get(intent.fieldId);
    if (!field || intent.declared.edit === undefined) continue;
    const member = !field.static;
    const max = member && field.type !== "image" ? intent.declared.max : undefined;
    out.push({
      sourceNodeId: field.sourceNodeId,
      label: field.label,
      member,
      ...(max !== undefined ? { max } : {}),
    });
  }
  return out;
}

/** A hand-written expectation for a frame with no keys: the listed layers
 * are what members fill in, and every other text or image the import lands
 * stays fixed. `unknown` names the listed layers that landed as neither, so
 * a list that has gone stale is caught instead of scored. */
export function truthFromList(
  fields: LandedField[],
  members: string[],
): { truth: FieldTruth[]; unknown: string[] } {
  const wanted = new Set(members);
  const truth = fields.filter(fillable).map((f) => ({
    sourceNodeId: f.sourceNodeId,
    label: f.label,
    member: wanted.has(f.sourceNodeId),
  }));
  const landed = new Set(truth.map((t) => t.sourceNodeId));
  return { truth, unknown: members.filter((id) => !landed.has(id)) };
}

export interface RouteScore {
  /** Fixed switched the wrong way round, one edit each. */
  fixed: number;
  /** Member fields still carrying their layer's default name. */
  labels: number;
  /** One when members exist and the import gave no caption. */
  caption: number;
  total: number;
  /** The fields behind `fixed`. */
  wrong: Array<{ label: string; landed: "member" | "fixed" }>;
  /** Fields the truth names that the import didn't land. */
  missing: string[];
}

/** The edits between what an import landed and the truth. Character limits
 * are left out: the browser measures them on every route, and this runs
 * without one. */
export function scoreRoute(opts: {
  truth: FieldTruth[];
  fields: LandedField[];
  /** Labels as layer names alone gave them, by source layer: what an
   * unkeyed frame lands with before anything renames a field. A member
   * field still carrying one needs a label. Empty for a keyed frame, whose
   * labels come from its roles. */
  defaultLabels?: Map<string, string>;
  caption?: string;
}): RouteScore {
  const landed = new Map(opts.fields.map((f) => [f.sourceNodeId, f]));
  const wrong: RouteScore["wrong"] = [];
  const missing: string[] = [];
  let labels = 0;
  for (const t of opts.truth) {
    const field = landed.get(t.sourceNodeId);
    if (!field) {
      missing.push(t.label);
      continue;
    }
    const isMember = !field.static;
    if (isMember !== t.member) {
      wrong.push({ label: field.label, landed: isMember ? "member" : "fixed" });
    }
    if (t.member && opts.defaultLabels?.get(t.sourceNodeId) === field.label) labels += 1;
  }
  const hasMembers = opts.truth.some((t) => t.member);
  const caption = hasMembers && !opts.caption?.trim() ? 1 : 0;
  return {
    fixed: wrong.length,
    labels,
    caption,
    total: wrong.length + labels + caption + missing.length,
    wrong,
    missing,
  };
}

/** The least an admin did before this phase, when every element landed
 * fixed under its layer's name: Fixed off, a label and (where the designer
 * set one) a limit for each member field, then a name and a caption. The
 * repairs to geometry (a pill's height, the edge it holds) came on top and
 * aren't counted, so this is a floor. */
export function editsBefore(truth: FieldTruth[]): number {
  const members = truth.filter((t) => t.member);
  const perField = members.reduce((n, t) => n + 2 + (t.max !== undefined ? 1 : 0), 0);
  return perField + 1 + (members.length ? 1 : 0);
}
