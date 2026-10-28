// Contrast and tone helpers shared by the starter materializer and the brand
// system's scheme resolver (brand-system Phase 5). WCAG 2.1 contrast through
// the shared luminance math in color.ts.

import { contrastRatio, luminance, parseHex } from "../../color";

/** Contrast between two hexes, 0 when either doesn't parse. */
export const ratio = (a: string, b: string): number => {
  const [ca, cb] = [parseHex(a), parseHex(b)];
  if (!ca || !cb) return 0;
  return contrastRatio(ca, cb);
};

/** hex → HSL (h 0-360, s/l 0-100). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const byte = (v: number) =>
    Math.round(Math.max(0, Math.min(255, (v + m) * 255)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${byte(rgb[0])}${byte(rgb[1])}${byte(rgb[2])}`;
}

export const isLightSurface = (surface: string): boolean => {
  const rgb = parseHex(surface);
  if (!rgb) return true;
  return luminance(rgb) >= 0.5;
};

/** Walk a color toward legibility on the given surface: HSL lightness in
 * steps of 4 (darker on a light surface, lighter on a dark one), capped at
 * 20 steps. Null when no step clears `min`, so the caller picks its own
 * fallback. */
export function walkTone(hex: string, surface: string, min: number): string | null {
  if (ratio(hex, surface) >= min) return hex;
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const step = isLightSurface(surface) ? -4 : 4;
  let { l } = hsl;
  for (let i = 0; i < 20; i += 1) {
    l += step;
    const candidate = hslToHex(hsl.h, hsl.s, l);
    if (ratio(candidate, surface) >= min) return candidate;
  }
  return null;
}
