import type { TemplateField } from "../types";

/** A field key the form and the caption can use as it stands. */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** The imported fields as they land in a draft: each keyed against the
 * fields already there and stacked above them in arrival order (walk order,
 * which is paint order). Shared by the builder's import and the fidelity
 * harness's offline replay, so both land an import the same way.
 *
 * `formOrder` (member field ids, as the form should read) then reorders the
 * array, which is the form's order and nothing else: paint order is the
 * zIndex each field was just given, so no element moves on the canvas. */
export function stackImported(
  incoming: TemplateField[],
  existing: TemplateField[],
  keyFor: (field: TemplateField, existing: TemplateField[]) => string,
  formOrder?: string[],
): TemplateField[] {
  const taken = [...existing];
  let z = taken.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);
  const stacked = incoming.map((f) => {
    const next: TemplateField = { ...f, fieldKey: keyFor(f, taken), zIndex: ++z };
    taken.push(next);
    return next;
  });
  if (!formOrder?.length) return stacked;
  const rank = new Map(formOrder.map((id, i) => [id, i]));
  const first = stacked
    .filter((f) => rank.has(f.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...first, ...stacked.filter((f) => !rank.has(f.id))];
}
