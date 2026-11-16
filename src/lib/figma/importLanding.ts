import type { TemplateField } from "../types";
import { suggestFieldKey } from "../caption";

/** A field key the form and the caption can use as it stands. */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** The imported fields as they land in a draft: each keyed against the
 * fields already there and stacked above them in arrival order (walk order,
 * which is paint order). The result stays in paint order, which the
 * background recompose relies on to put each overlay layer back above the
 * right field. Shared by the builder's import and the fidelity harness's
 * offline replay, so both land an import the same way. */
export function stackImported(
  incoming: TemplateField[],
  existing: TemplateField[],
  keyFor: (field: TemplateField, existing: TemplateField[]) => string,
): TemplateField[] {
  const taken = [...existing];
  let z = taken.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);
  return incoming.map((f) => {
    const next: TemplateField = { ...f, fieldKey: keyFor(f, taken), zIndex: ++z };
    taken.push(next);
    return next;
  });
}

/** The same fields in the order the form reads them: the member fields
 * `formOrder` names first, in its order, then everything else as it came.
 * Only the array moves. Each field keeps the zIndex it paints at, so
 * nothing moves on the canvas. */
export function inFormOrder(fields: TemplateField[], formOrder?: string[]): TemplateField[] {
  if (!formOrder?.length) return fields;
  const rank = new Map(formOrder.map((id, i) => [id, i]));
  const named = fields
    .filter((f) => rank.has(f.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...named, ...fields.filter((f) => !rank.has(f.id))];
}

/** Fields keyed and stacked against an older copy of the draft, made safe
 * to append to `existing`: a key that now clashes is suggested afresh, and
 * the group moves up together so it still paints above everything there.
 * Pure, so it can run inside a state updater. */
export function landOnTop(incoming: TemplateField[], existing: TemplateField[]): TemplateField[] {
  if (!incoming.length) return incoming;
  const top = existing.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);
  const lowest = incoming.reduce((m, f) => Math.min(m, f.zIndex ?? 0), Infinity);
  const lift = Math.max(0, top + 1 - lowest);
  const taken = [...existing];
  return incoming.map((f) => {
    const clash = taken.some((t) => t.fieldKey === f.fieldKey);
    const next: TemplateField = {
      ...f,
      fieldKey: clash ? suggestFieldKey(f.label, taken) : f.fieldKey,
      zIndex: (f.zIndex ?? 0) + lift,
    };
    taken.push(next);
    return next;
  });
}
