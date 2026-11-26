/**
 * Shelves or one grid (CJ, 2026-11-25, premium polish D11). Browsing, the
 * library shows a shelf per platform set and shape. When no shelf holds
 * more cards than one row fits at the current width, every row would show
 * all of its shelf and leave the rest of the row empty, so the library
 * shows one grid in shelf order instead, with no shelf headers. Shelves
 * return once any shelf overflows its row. Search and platform results
 * keep their own result groups.
 */

/** A shelf card's width, as drawn (2308:4). */
export const SHELF_CARD_WIDTH = 302;

export type LibraryLayout = "shelves" | "grid";

/** How many shelf cards a row shows in full in a body `width` wide, cards
 * `gap` apart, inside a `gutter` on each side (where the page bleeds to a
 * phone's edge). Zero until the width is known; at least one once it is. */
export function cardsPerRow(
  width: number,
  gap: number,
  gutter = 0,
  cardWidth = SHELF_CARD_WIDTH,
): number {
  if (!(width > 0)) return 0;
  const row = width - 2 * gutter;
  return Math.max(1, Math.floor((row + gap) / (cardWidth + gap)));
}

/** Shelves when any shelf holds more cards than one row fits, else one
 * grid. Before the width is known (`perRow` 0), and with no shelves at all
 * (loading, or nothing published), it keeps the shelves. */
export function libraryLayout(shelfSizes: readonly number[], perRow: number): LibraryLayout {
  if (perRow <= 0 || shelfSizes.length === 0) return "shelves";
  return shelfSizes.some((size) => size > perRow) ? "shelves" : "grid";
}
