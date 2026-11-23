// A new design's last fit pass. A template's boxes are the admin's, so copy
// that overflows one is repaired (a shorter rewrite). A new design's boxes
// are the model's own guess at how long its copy runs, so before a design is
// dropped for overflowing, the text that runs over may shrink further: down
// to the type floor, and never under the next smaller text in the design, so
// a headline never ends up smaller than its body copy. Measured, never
// estimated: the caller measures again with the relaxed floors
// (measureProposal) and keeps the design only if it then fits.

import type { BrandKit, GeneratedDesign, TemplateSchema } from "../types";
import { resolveFieldStyle } from "../brand/resolveStyle";

/** The smallest text a generated design may shrink to: 16px on a 1080 wide
 * canvas, scaled with the canvas and never under 12px. The same floor the
 * server sets a new design's sizes and shrink floors by (composeValidate). */
export function designTypeFloor(canvasWidth: number): number {
  return Math.max(12, (16 * canvasWidth) / 1080);
}

/** The lowest shrink floor a relaxed field gets, as a fraction of its size. */
const MIN_SCALE = 0.3;

/** The schema with each overflowing field's shrink floor lowered to the
 * type floor, or null when nothing could be lowered (a field that does not
 * shrink, or one already at the floor). */
export function relaxDesignFit(
  schema: TemplateSchema,
  overflowing: readonly string[],
  kit: BrandKit | null,
): TemplateSchema | null {
  const typeFloor = designTypeFloor(schema.canvasWidth);
  const textSizes = schema.fields
    .filter((f) => f.type === "text" || f.type === "multiline")
    .map((f) => resolveFieldStyle(f, kit).fontSizePx)
    .filter((px): px is number => typeof px === "number" && px > 0);
  let changed = false;
  const fields = schema.fields.map((f) => {
    if (!overflowing.includes(f.fieldKey)) return f;
    const style = resolveFieldStyle(f, kit);
    if (style.textSizing !== "shrink" && style.textSizing !== "fill") return f;
    const size = style.fontSizePx;
    if (!size) return f;
    // Never under the type floor, and never under the next smaller text.
    const below = Math.max(0, ...textSizes.filter((px) => px < size));
    const floor = Math.max(typeFloor, below);
    const scale = Math.round(Math.min(1, Math.max(MIN_SCALE, floor / size)) * 100) / 100;
    if (f.minFontScale !== undefined && f.minFontScale <= scale) return f;
    changed = true;
    return { ...f, minFontScale: scale };
  });
  return changed ? { ...schema, fields } : null;
}

/** The design with its fields replaced by the relaxed schema's, so a chat
 * saved and reopened rebuilds the design (designToSchema) as it fit. */
export function withFields(design: GeneratedDesign, schema: TemplateSchema): GeneratedDesign {
  return { ...design, fields: schema.fields };
}
