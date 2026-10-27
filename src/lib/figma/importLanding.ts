import type { TemplateField } from "../types";

/** The imported fields as they land in a draft: each keyed against the
 * fields already there and stacked above them in arrival order (walk order,
 * which is paint order). Shared by the builder's import and the fidelity
 * harness's offline replay, so both land an import the same way. */
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
