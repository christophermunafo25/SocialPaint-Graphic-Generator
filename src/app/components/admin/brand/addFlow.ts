// The setup strip's "navigate and start the add flow" handoff. A module
// variable rather than a URL param on purpose — the intent should not
// survive a refresh or a share (the seedHandoff precedent), only the one
// in-app navigation that carries it.

import type { BrandCategory } from "../../../router";

let pending: BrandCategory | null = null;

export function requestAddFlow(category: BrandCategory): void {
  pending = category;
}

/** True exactly once after requestAddFlow(category) — the detail page
 * calls this on mount and opens its add flow when it gets true. */
export function consumeAddFlow(category: BrandCategory): boolean {
  if (pending !== category) return false;
  pending = null;
  return true;
}
