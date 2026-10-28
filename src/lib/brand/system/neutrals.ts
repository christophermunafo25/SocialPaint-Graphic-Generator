// The neutral ramps the brand system falls back on (brand-system Phase 5),
// one per temperature, and the colour mixing they're built with. Alongside
// starters/neutrals.ts, the sanctioned home for these hexes.

import type { ColorRole } from "../../types";
import { parseHex, toHex } from "../../color";
import { ACCENT_FALLBACK } from "../../templates/starters/neutrals";

export type Temperature = "cool" | "mono" | "warm";

/** Each temperature's stand-ins for roles a palette leaves empty. The
 * accent is the starters' fallback, pre-verified on both grounds. */
export const RAMPS: Record<Temperature, Record<ColorRole, string>> = {
  mono: {
    ground: "#FFFFFF",
    soft: "#F2F2F2",
    card: "#FFFFFF",
    deep: "#161617",
    inkOnLight: "#111112",
    inkOnDark: "#FFFFFF",
    accent: ACCENT_FALLBACK,
    emphasis: ACCENT_FALLBACK,
  },
  cool: {
    ground: "#FFFFFF",
    soft: "#EEF1F5",
    card: "#FFFFFF",
    deep: "#141A22",
    inkOnLight: "#0F141A",
    inkOnDark: "#F7F9FC",
    accent: ACCENT_FALLBACK,
    emphasis: ACCENT_FALLBACK,
  },
  warm: {
    ground: "#FFFFFF",
    soft: "#F4F1EC",
    card: "#FFFFFF",
    deep: "#1C1814",
    inkOnLight: "#17130F",
    inkOnDark: "#FBF8F3",
    accent: ACCENT_FALLBACK,
    emphasis: ACCENT_FALLBACK,
  },
};

/** `a` moved `t` (0..1) of the way toward `b`, in sRGB. An unparsable input
 * returns the other. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca) return b.slice(0, 7).toUpperCase();
  if (!cb) return a.slice(0, 7).toUpperCase();
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return toHex({ r: m(ca.r, cb.r), g: m(ca.g, cb.g), b: m(ca.b, cb.b), a: 1 }).toUpperCase();
}
