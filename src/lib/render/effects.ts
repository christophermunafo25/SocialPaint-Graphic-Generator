// Depth effects (brand-system Phase 1): reading them from stored rows, and
// the CSS each one paints with. Pure: SchemaRenderer owns the DOM.
//
// Effects never change layout. Shadows and glows paint around the box,
// blur and noise paint over it, and stacks still space by the box.

import type { FieldEffect, StrokeAlign } from "../types";

type Shadow = Extract<FieldEffect, { type: "dropShadow" | "innerShadow" }>;
type Noise = Extract<FieldEffect, { type: "noise" }>;

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nonNegative = (v: unknown): v is number => finite(v) && v >= 0;

/** One stored effect, or null when it isn't one this renderer can paint.
 * Stored JSON is read, never trusted: an unknown type, a missing length or
 * a color that isn't #RRGGBB(AA) drops that effect and keeps the rest. */
function readEffect(raw: unknown): FieldEffect | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  switch (e.type) {
    case "dropShadow":
    case "innerShadow": {
      if (!finite(e.x) || !finite(e.y) || !nonNegative(e.blur)) return null;
      if (typeof e.color !== "string" || !HEX.test(e.color)) return null;
      if (e.spread !== undefined && !finite(e.spread)) return null;
      return {
        type: e.type,
        x: e.x,
        y: e.y,
        blur: e.blur,
        ...(e.spread !== undefined && { spread: e.spread as number }),
        color: e.color,
      };
    }
    case "layerBlur":
      return nonNegative(e.radius) ? { type: "layerBlur", radius: e.radius } : null;
    case "noise": {
      if (typeof e.color !== "string" || !HEX.test(e.color)) return null;
      if (!finite(e.size) || e.size <= 0) return null;
      if (!finite(e.density) || e.density < 0 || e.density > 1) return null;
      if (e.seed !== undefined && !finite(e.seed)) return null;
      return {
        type: "noise",
        color: e.color,
        size: e.size,
        density: e.density,
        ...(e.seed !== undefined && { seed: e.seed as number }),
      };
    }
    default:
      return null;
  }
}

/** The effects worth painting, in order. Empty when there are none, so a
 * field without effects takes exactly today's path. */
export function readEffects(raw: unknown): FieldEffect[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldEffect[] = [];
  for (const item of raw) {
    const effect = readEffect(item);
    if (effect) out.push(effect);
  }
  return out;
}

/** A stroke alignment the renderer knows, else inside (today's stroke). */
export function readStrokeAlign(raw: unknown): StrokeAlign {
  return raw === "center" || raw === "outside" ? raw : "inside";
}

const px = (v: number) => `${Math.round(v * 100) / 100}px`;

function shadowPart(s: Shadow): string {
  const inset = s.type === "innerShadow" ? "inset " : "";
  return `${inset}${px(s.x)} ${px(s.y)} ${px(s.blur)} ${px(s.spread ?? 0)} ${s.color}`;
}

/** `box-shadow` for a box-shaped element (rect shapes, the image box, the
 * canvas): every drop and inner shadow. Figma lists effects bottom to top
 * and CSS paints the first shadow on top, so the list is reversed.
 * Undefined when there is nothing to paint. */
export function boxShadowCss(effects: readonly FieldEffect[]): string | undefined {
  const parts = effects
    .filter((e): e is Shadow => e.type === "dropShadow" || e.type === "innerShadow")
    .map(shadowPart)
    .reverse();
  return parts.length ? parts.join(", ") : undefined;
}

/** `filter` for an element whose painted alpha isn't its box (text, SVG
 * shapes, a masked image): drop shadows follow the glyphs or the shape,
 * then the layer blur. Inner shadows can't be expressed here and are
 * skipped; validation keeps them to rects and images. With `withShadows`
 * false only the blur is returned, for elements whose shadows already
 * paint as box-shadow. */
export function filterCss(effects: readonly FieldEffect[], withShadows = true): string | undefined {
  const parts: string[] = [];
  if (withShadows) {
    for (const e of effects) {
      if (e.type !== "dropShadow") continue;
      // drop-shadow takes the same blur radius as box-shadow, and has no
      // spread: a spread shadow on a non-box element paints without it.
      parts.push(`drop-shadow(${px(e.x)} ${px(e.y)} ${px(e.blur)} ${e.color})`);
    }
  }
  // blur() takes a standard deviation, half a blur radius (Figma's own CSS
  // export halves its layer blur the same way).
  for (const e of effects) {
    if (e.type === "layerBlur" && e.radius > 0) parts.push(`blur(${px(e.radius / 2)})`);
  }
  return parts.length ? parts.join(" ") : undefined;
}

/** The noise effects on an element, bottom to top. */
export function noiseEffects(effects: readonly FieldEffect[]): Noise[] {
  return effects.filter((e): e is Noise => e.type === "noise");
}

/** Effects scaled for a canvas resize by the uniform factor `u`, like
 * every other px length on a field (src/lib/templates/rescale.ts). Colors,
 * density and seeds don't scale. */
export function scaleEffects(effects: readonly FieldEffect[], u: number): FieldEffect[] {
  const r = (v: number) => Math.round(v * u * 100) / 100;
  return effects.map((e) => {
    switch (e.type) {
      case "dropShadow":
      case "innerShadow":
        return {
          ...e,
          x: r(e.x),
          y: r(e.y),
          blur: r(e.blur),
          ...(e.spread !== undefined && { spread: r(e.spread) }),
        };
      case "layerBlur":
        return { ...e, radius: r(e.radius) };
      case "noise":
        return { ...e, size: r(e.size) };
    }
  });
}
