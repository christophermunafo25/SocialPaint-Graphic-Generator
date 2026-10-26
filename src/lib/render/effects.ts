// Depth effects (brand-system Phase 1): reading them from stored rows, and
// the CSS each one paints with. Pure: SchemaRenderer owns the DOM.
//
// Effects never change layout. Shadows and glows paint around the box,
// blur and noise paint over it, and stacks still space by the box.

import type React from "react";
import type { CornerRadius, FieldEffect, StrokeAlign, TemplateField } from "../types";

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

/** `filter` for any field: drop shadows (glows included) follow the
 * element's painted alpha, then the layer blur. Every shadow paints as a
 * filter, never as `box-shadow`: WebKit misplaces box-shadow when
 * html-to-image rasterizes through an SVG foreignObject, while filters
 * export the same in every engine. A filter has no spread, so a drop
 * shadow's spread is not painted. Inner shadows paint as frames
 * (innerShadowFrames). With `withShadows` false only the blur is returned. */
export function filterCss(effects: readonly FieldEffect[], withShadows = true): string | undefined {
  const parts: string[] = [];
  if (withShadows) {
    for (const e of effects) {
      if (e.type !== "dropShadow") continue;
      // drop-shadow takes the same blur radius as box-shadow.
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

/** One inner shadow as a frame: a ring of the shadow's color around a hole
 * the size of the box, shrunk by the spread and moved by the offset, then
 * blurred. Drawn inside the box's clip, the ring's blurred inner edge is
 * the inner shadow. The ring reaches blur + 4 px past the shadow's
 * extent, so its outer edge lightens the shadow by about 1% at most. Corner radii are the box's own, so the hole's corners match.
 * Styles are relative to the box; frames are drawn bottom to top. */
export function innerShadowFrames(
  effects: readonly FieldEffect[],
  radius?: CornerRadius,
): React.CSSProperties[] {
  return effects
    .filter((e): e is Shadow => e.type === "innerShadow")
    .map((e) => {
      const spread = Math.max(0, e.spread ?? 0);
      const ring = Math.ceil(e.blur + Math.abs(e.x) + Math.abs(e.y) + spread + 4);
      const outer = ring - spread;
      const corner = (r: number) => px(Math.max(0, r - spread) + ring);
      return {
        position: "absolute",
        left: px(e.x - outer),
        top: px(e.y - outer),
        width: `calc(100% + ${px(outer * 2)})`,
        height: `calc(100% + ${px(outer * 2)})`,
        boxSizing: "border-box",
        border: `${px(ring)} solid ${e.color}`,
        borderRadius: radius
          ? `${corner(radius.tl)} ${corner(radius.tr)} ${corner(radius.br)} ${corner(radius.bl)}`
          : px(ring),
        ...(e.blur > 0 ? { filter: `blur(${px(e.blur / 2)})` } : {}),
      };
    });
}

/** The noise effects on an element, bottom to top. */
export function noiseEffects(effects: readonly FieldEffect[]): Noise[] {
  return effects.filter((e): e is Noise => e.type === "noise");
}

/** Effects scaled for a canvas resize by the uniform factor `u`, like
 * every other px length on a field (src/lib/templates/rescale.ts). Colors,
 * density and seeds don't scale. Reads the stored list defensively, the way
 * the renderer does: a malformed entry is dropped rather than saved back. */
export function scaleEffects(raw: unknown, u: number): FieldEffect[] {
  const r = (v: number) => Math.round(v * u * 100) / 100;
  return readEffects(raw).map((e) => {
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

/** True when a field paints beyond its own box: a drop shadow or glow, a
 * layer blur's spill, or a shape's center or outside stroke. The builder's
 * edit canvas clips every other field to its box. */
export function paintsBeyondBox(
  field: Pick<TemplateField, "effects" | "strokeColor" | "strokeAlign" | "type">,
): boolean {
  if (readEffects(field.effects).some((e) => e.type === "dropShadow" || e.type === "layerBlur")) {
    return true;
  }
  return (
    field.type === "shape" &&
    Boolean(field.strokeColor) &&
    readStrokeAlign(field.strokeAlign) !== "inside"
  );
}

/** What spills past a field's box: a drop shadow, a glow, a stroke or a
 * blur. */
export type Spill = "shadow" | "glow" | "stroke" | "blur";

/** The first thing a field paints beyond the canvas edge, or null. Only a
 * field whose own box sits inside the canvas is judged: one that already
 * bleeds off the edge is cropped on purpose. A shadow reaches its blur
 * radius past its offset box; a stroke its outer width; a blur its
 * radius. Rotation isn't modelled. */
export function cutOffAtCanvas(
  field: Pick<TemplateField, "effects" | "strokeColor" | "strokeAlign" | "strokeWidthPx" | "type">,
  box: { x: number; y: number; width: number; height: number },
  canvas: { width: number; height: number },
): Spill | null {
  const inside =
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= canvas.width &&
    box.y + box.height <= canvas.height;
  if (!inside) return null;
  const crosses = (left: number, top: number, right: number, bottom: number) =>
    left < -0.5 || top < -0.5 || right > canvas.width + 0.5 || bottom > canvas.height + 0.5;
  for (const e of readEffects(field.effects)) {
    if (e.type === "dropShadow") {
      const left = box.x + e.x - e.blur;
      const top = box.y + e.y - e.blur;
      const right = box.x + box.width + e.x + e.blur;
      const bottom = box.y + box.height + e.y + e.blur;
      if (crosses(left, top, right, bottom)) return e.x === 0 && e.y === 0 ? "glow" : "shadow";
    }
    if (e.type === "layerBlur") {
      const r = e.radius;
      if (crosses(box.x - r, box.y - r, box.x + box.width + r, box.y + box.height + r))
        return "blur";
    }
  }
  const align = readStrokeAlign(field.strokeAlign);
  if (field.type === "shape" && field.strokeColor && align !== "inside") {
    const w = Math.max(1, field.strokeWidthPx ?? 1) * (align === "center" ? 0.5 : 1);
    if (crosses(box.x - w, box.y - w, box.x + box.width + w, box.y + box.height + w))
      return "stroke";
  }
  return null;
}
