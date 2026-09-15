// The editing card's contrast readout (Phase 6): a color's ratio against
// the deep ink and against white, the two glyph colours templates put on
// tenant fills. The literals mirror tokens — #0b0b0c IS
// --text-on-brand-deep and #ffffff is the white glyph — and live in this
// .ts module so no hex reaches the TSX.

import { contrastRatio, parseHex } from "@/lib/color";

const INK = parseHex("#0b0b0c")!;
const WHITE = parseHex("#ffffff")!;

/** WCAG AA for normal text. */
export const CONTRAST_PASS = 4.5;

export interface ContrastReadout {
  ink: number;
  white: number;
}

/** Ratios rounded to one decimal, or null for an unparseable hex. */
export function contrastReadout(hex: string): ContrastReadout | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { ink: round(contrastRatio(rgb, INK)), white: round(contrastRatio(rgb, WHITE)) };
}
