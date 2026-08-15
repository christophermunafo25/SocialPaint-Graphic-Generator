// Color math for the fill picker: hex ⇄ RGBA ⇄ HSV, plus the string
// formats the picker's format select offers. Alpha rides inside the hex as
// an #RRGGBBAA byte — CSS, the canvas renderer, and the PNG export all
// accept 8-digit hex, so a translucent fill needs no schema change.

export interface RGBA {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

export interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

const HEX_RE = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;

export function parseHex(input: string): RGBA | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  const six = m[1];
  return {
    r: parseInt(six.slice(0, 2), 16),
    g: parseInt(six.slice(2, 4), 16),
    b: parseInt(six.slice(4, 6), 16),
    a: m[2] !== undefined ? parseInt(m[2], 16) / 255 : 1,
  };
}

const byte = (n: number): string =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

/** #RRGGBB, with an AA byte only when alpha is not fully opaque. */
export function toHex({ r, g, b, a }: RGBA): string {
  const base = `#${byte(r)}${byte(g)}${byte(b)}`;
  return a >= 1 ? base : `${base}${byte(a * 255)}`;
}

export function rgbToHsv({ r, g, b }: Pick<RGBA, "r" | "g" | "b">): HSV {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): Pick<RGBA, "r" | "g" | "b"> {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rn = 0,
    gn = 0,
    bn = 0;
  if (h < 60) [rn, gn, bn] = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];
  return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

export type ColorFormat = "hex" | "rgb" | "hsl";

/** The value-input string for a color in the chosen format (alpha lives in
 * its own input, so these render the opaque channels only). */
export function formatColor(rgba: RGBA, format: ColorFormat): string {
  if (format === "hex") return toHex({ ...rgba, a: 1 });
  const { r, g, b } = rgba;
  if (format === "rgb") return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
  // hsl
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
    if (h < 0) h += 360;
  }
  return `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

/** Parse the value-input string back in the chosen format. Returns opaque
 * channels; the caller re-applies its alpha. */
export function parseColor(input: string, format: ColorFormat): Pick<RGBA, "r" | "g" | "b"> | null {
  const t = input.trim();
  if (format === "hex") {
    const p = parseHex(t);
    return p ? { r: p.r, g: p.g, b: p.b } : null;
  }
  const nums = t
    .replace(/[^\d.,-]/g, "")
    .split(",")
    .map((s) => Number(s.trim()));
  if (nums.length < 3 || nums.some((n) => Number.isNaN(n))) return null;
  if (format === "rgb") {
    const [r, g, b] = nums;
    if ([r, g, b].some((n) => n < 0 || n > 255)) return null;
    return { r, g, b };
  }
  // hsl → rgb
  const [h, sPct, lPct] = nums;
  if (h < 0 || h > 360 || sPct < 0 || sPct > 100 || lPct < 0 || lPct > 100) return null;
  const s = sPct / 100,
    l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rn = 0,
    gn = 0,
    bn = 0;
  if (h < 60) [rn, gn, bn] = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];
  return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

/** Relative luminance (WCAG 2.x) of an opaque colour. */
export function luminance({ r, g, b }: Pick<RGBA, "r" | "g" | "b">): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast ratio between two opaque colours (1–21). */
export function contrastRatio(
  a: Pick<RGBA, "r" | "g" | "b">,
  b: Pick<RGBA, "r" | "g" | "b">,
): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** The legible glyph colour for an arbitrary background — whichever of
 * near-black or white contrasts better. Tenant brand colours are arbitrary
 * (a pale accent gets ink, a deep one gets white), so anywhere tenant colour
 * becomes a fill, the text on it must be CHOSEN, never hardcoded. */
export function readableOn(background: string): string {
  const bg = parseHex(background);
  if (!bg) return "#111111";
  return contrastRatio(bg, { r: 17, g: 17, b: 17 }) >= contrastRatio(bg, { r: 255, g: 255, b: 255 })
    ? "#111111"
    : "#FFFFFF";
}
