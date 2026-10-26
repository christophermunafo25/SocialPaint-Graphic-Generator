// Size families (docs/design/line-breaks-and-size-families, Phase 2): a set
// of templates in one workspace, each at a different canvas size, sharing a
// familyId. Every member stays an ordinary template; nothing here renders.
// These helpers name a family's sizes, carry a member's values and look to
// another size, and decide when a new version joins its source's family.
//
// Pure: no store, no DOM.

import type { FieldValues, TemplateField, TemplateSchema } from "../types";
import { platformLabelFor } from "../generate/draftView";
import { renameTies } from "../generate/linkedFields";
import { aspectRatioOf } from "./platforms";

type Sized = Pick<TemplateSchema, "canvasWidth" | "canvasHeight">;

/** One label per member, in order: "Instagram · 4:5", or "1200 × 900" for
 * a size no platform claims. Two sizes that read the same are renamed the
 * way the editor's size switch renames them (sizeNames): "Instagram 1",
 * "Instagram 2". */
export function familySizeLabels(templates: Sized[]): string[] {
  const platform = (t: Sized) => platformLabelFor({ width: t.canvasWidth, height: t.canvasHeight });
  const full = (t: Sized) => {
    const p = platform(t);
    return p
      ? `${p} · ${aspectRatioOf(t.canvasWidth, t.canvasHeight)}`
      : `${t.canvasWidth} × ${t.canvasHeight}`;
  };
  const short = (t: Sized) => platform(t) ?? `${t.canvasWidth} × ${t.canvasHeight}`;
  let labels = templates.map(full);
  labels = renameTies(labels, (_l, i, n) => `${short(templates[i])} ${n}`);
  return renameTies(labels, (l, _i, n) => `${l} ${n}`);
}

const memberFields = (t: Pick<TemplateSchema, "fields">): TemplateField[] =>
  t.fields.filter((f) => !f.static);

/** Does a value typed for `from` mean the same thing in `to`? A key `to`
 * doesn't have is fine (the renderer ignores it); a field whose type
 * changed, or a select whose options no longer offer the value, is not. */
const isText = (f: TemplateField): boolean => f.type === "text" || f.type === "multiline";

function carries(value: string, from?: TemplateField, to?: TemplateField): boolean {
  if (!to) return true;
  // Text reads the same in a single-line or a multiline field.
  if (from && from.type !== to.type && !(isText(from) && isText(to))) return false;
  if (to.type === "select") return (to.options ?? []).includes(value);
  return true;
}

/** A member's values as the `to` size takes them, by fieldKey. Every value
 * stays, so a field the next size lacks comes back on the way back; only a
 * value the `to` field can't take is left out. A field only `to` has
 * starts empty. */
export function carryValues(
  values: FieldValues,
  from: Pick<TemplateSchema, "fields">,
  to: Pick<TemplateSchema, "fields">,
): FieldValues {
  const fromByKey = new Map(from.fields.map((f) => [f.fieldKey, f]));
  const toByKey = new Map(to.fields.map((f) => [f.fieldKey, f]));
  const out: FieldValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (carries(value, fromByKey.get(key), toByKey.get(key))) out[key] = value;
  }
  return out;
}

/** The look in `to` matching `variantId` in `from`: the same id (versions
 * keep their ids), then the same name, else null (the default look). */
export function carryLook(
  variantId: string | null,
  from: Pick<TemplateSchema, "variants">,
  to: Pick<TemplateSchema, "variants">,
): string | null {
  if (!variantId) return null;
  const target = to.variants ?? [];
  if (target.some((v) => v.id === variantId)) return variantId;
  const name = from.variants?.find((v) => v.id === variantId)?.name;
  return target.find((v) => v.name === name)?.id ?? null;
}

export interface MemberFieldDiff {
  /** Member fields only `a` has. */
  onlyInA: TemplateField[];
  /** Member fields only `b` has. */
  onlyInB: TemplateField[];
  /** Fields both have whose type or options differ, as `b` has them. */
  changed: Array<{ field: TemplateField; reason: "type" | "options" }>;
}

/** What a member filling one size would find different in another. */
export function memberFieldDiff(
  a: Pick<TemplateSchema, "fields">,
  b: Pick<TemplateSchema, "fields">,
): MemberFieldDiff {
  const aFields = memberFields(a);
  const bFields = memberFields(b);
  const aByKey = new Map(aFields.map((f) => [f.fieldKey, f]));
  const bKeys = new Set(bFields.map((f) => f.fieldKey));
  const changed: MemberFieldDiff["changed"] = [];
  for (const f of bFields) {
    const other = aByKey.get(f.fieldKey);
    if (!other) continue;
    if (other.type !== f.type) changed.push({ field: f, reason: "type" });
    else if (
      f.type === "select" &&
      (other.options ?? []).join("\n") !== (f.options ?? []).join("\n")
    ) {
      changed.push({ field: f, reason: "options" });
    }
  }
  return {
    onlyInA: aFields.filter((f) => !bKeys.has(f.fieldKey)),
    onlyInB: bFields.filter((f) => !aByKey.has(f.fieldKey)),
    changed,
  };
}

/** Two templates are the same size. */
export const sameSize = (a: Sized, b: Sized): boolean =>
  a.canvasWidth === b.canvasWidth && a.canvasHeight === b.canvasHeight;

/** When a version saved from `source` joins the family: once it sits at a
 * size the family doesn't have yet. `family` is the source's family as it
 * stands (empty when it has none). Returns the one setFamily call to make,
 * or null to leave the version standalone. A source with no family gets a
 * new id, minted by `mint`, and joins in the same call. */
export function joinPlanFor(
  source: Pick<TemplateSchema, "id" | "familyId" | "canvasWidth" | "canvasHeight">,
  family: Array<Pick<TemplateSchema, "id" | "canvasWidth" | "canvasHeight">>,
  saved: Pick<TemplateSchema, "id" | "familyId" | "canvasWidth" | "canvasHeight">,
  mint: () => string,
): { templateIds: string[]; familyId: string } | null {
  if (saved.familyId || saved.id === source.id) return null;
  if (sameSize(saved, source)) return null;
  if (family.some((m) => m.id !== saved.id && sameSize(m, saved))) return null;
  return source.familyId
    ? { templateIds: [saved.id], familyId: source.familyId }
    : { templateIds: [source.id, saved.id], familyId: mint() };
}
