// Per-variation contrast check for the builder. Each variation resolves
// different foreground/background pairs, and the reference corpus already
// contains the failure this catches: a white wordmark on a #F9F9F8 field,
// 1.03:1, invisible. Builder-only and non-blocking — it warns, in the
// admin's terms, and never refuses a save.
//
// Pure: no React, no DOM. Runs on the same merged field the renderer paints
// (applyVariant → resolveFieldStyle), so what it measures is what ships.

import type { BrandKit, TemplateField, TemplateSchema, TextGradient } from "../types";
import { resolveFieldStyle } from "../brand/resolveStyle";
import { contrastRatio, parseHex, type RGBA } from "../color";
import { applyVariant, resolveVariantBackground } from "./variants";

/** WCAG AA: 4.5:1 for text under 24px, 3:1 at 24px and over. */
export const AA_SMALL = 4.5;
export const AA_LARGE = 3;
export const LARGE_TEXT_PX = 24;

/** The renderer's own fallback size when a field sets none (the inspector
 * shows the same number). */
const DEFAULT_FONT_PX = 45;

export interface ContrastWarning {
  variantId: string;
  variantName: string;
  fieldKey: string;
  label: string;
  /** The worst ratio found (a gradient is checked stop by stop). */
  ratio: number;
  required: number;
  /** A sentence for the canvas footer. */
  message: string;
}

/** Foreground over a backdrop, alpha composited. Null when the hex cannot
 * be parsed. */
function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** The solid colours a fill can land on: one for a solid, every stop for a
 * gradient. Empty when nothing parses. */
function fillColors(solid: string | undefined, gradient: TextGradient | undefined): RGBA[] {
  if (gradient?.stops.length) {
    return gradient.stops.map((s) => parseHex(s.color)).filter((c): c is RGBA => Boolean(c));
  }
  const c = solid ? parseHex(solid) : null;
  return c ? [c] : [];
}

const isTextField = (f: TemplateField) =>
  f.type === "text" || f.type === "multiline" || f.type === "select";

/** The worst-case ratio of a field's fill over a backdrop set. */
function worstRatio(fg: RGBA[], bg: RGBA[]): number {
  let worst = Infinity;
  for (const b of bg) {
    for (const f of fg) worst = Math.min(worst, contrastRatio(over(f, b), b));
  }
  return worst;
}

/** Contrast warnings across every variation of a template. A template
 * without variations gets none — this check exists because variations
 * multiply the pairs, and the single-variant path stays exactly as it was.
 *
 * The backdrop is the variation's canvas background: its solid colour, or
 * every stop of its gradient. A template painted on an image has no
 * knowable backdrop and is skipped rather than guessed at. Element-on-
 * element pairs (a headline over a rect) are out of scope here. */
export function variantContrastWarnings(
  schema: Pick<
    TemplateSchema,
    "fields" | "variants" | "backgroundColor" | "backgroundGradient" | "backgroundUrl"
  >,
  kit: BrandKit | null,
): ContrastWarning[] {
  const out: ContrastWarning[] = [];
  for (const variant of schema.variants ?? []) {
    const bg = resolveVariantBackground(schema, variant);
    if (bg.url) continue;
    const backdrop = fillColors(bg.color ?? "#ffffff", bg.gradient);
    if (!backdrop.length) continue;

    for (const base of schema.fields) {
      if (!isTextField(base)) continue;
      if (variant.overrides?.[base.fieldKey]?.hidden) continue;
      const field = applyVariant(base, variant);
      const style = resolveFieldStyle(field, kit);
      const solid = style.colorKey
        ? (kit?.colors.find((c) => c.key === style.colorKey)?.hex ?? style.colorHex)
        : style.colorHex;
      const fg = fillColors(solid ?? "#111111", style.textGradient);
      if (!fg.length) continue;
      const opacity =
        field.opacity === undefined ? 1 : Math.max(0, Math.min(100, field.opacity)) / 100;
      const ratio = worstRatio(
        fg.map((c) => ({ ...c, a: c.a * opacity })),
        backdrop,
      );
      const size = style.fontSizePx ?? field.fontSizePx ?? DEFAULT_FONT_PX;
      const required = size >= LARGE_TEXT_PX ? AA_LARGE : AA_SMALL;
      if (ratio >= required) continue;
      out.push({
        variantId: variant.id,
        variantName: variant.name,
        fieldKey: base.fieldKey,
        label: base.label,
        ratio,
        required,
        message:
          `"${base.label}" in ${variant.name} is ${ratio.toFixed(2)}:1 against the background; ` +
          `${required}:1 is the floor for ${size >= LARGE_TEXT_PX ? "large" : "small"} text.`,
      });
    }
  }
  return out;
}
