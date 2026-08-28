// The handoff from the Generate results to the fill page. Module-scoped and
// single-shot on purpose: image data URLs and long strings do not belong in
// a query string, and taking the seed clears it — so a refresh of the fill
// page degrades to the ordinary empty form rather than to a crash or a
// stale draft reappearing.

import type { FieldValues } from "../types";

let seed: { templateId: string; values: FieldValues } | null = null;

export function stashSeed(templateId: string, values: FieldValues): void {
  seed = { templateId, values };
}

/** The stashed values for this template, exactly once; null for any other
 * template or any later ask. */
export function takeSeed(templateId: string): FieldValues | null {
  if (!seed || seed.templateId !== templateId) return null;
  const taken = seed.values;
  seed = null;
  return taken;
}
