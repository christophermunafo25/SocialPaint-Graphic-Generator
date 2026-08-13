// Overlay units → static fields. A decomposed frame can contain layers that
// paint ABOVE the elements lifted into editable fields (a fade gradient over
// a photo, a badge across a headline). Those can't go into the background —
// it sits under every field — so they land as static (Fixed) fields instead,
// z-interleaved exactly where they painted in the source frame.

import type { FigmaLayerUnit, TemplateField, TextGradient } from "../types";
import { newId } from "../stores/local/db";
import { suggestFieldKey } from "../caption";

/** rgba(r, g, b, a) → { hex, alpha 0..1 }. Falls back to opaque black-ish
 * ink on anything unparsable, matching the renderer's default fill. */
export function parseRgba(color: string): { hex: string; alpha: number } {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!m) return { hex: "#111111", alpha: 1 };
  const hex =
    "#" +
    [m[1], m[2], m[3]]
      .map((v) => Math.min(255, parseInt(v, 10)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return { hex, alpha: m[4] === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(m[4]))) };
}

/** Figma gradient handles (normalized to the unit's box) → the CSS
 * linear-gradient angle convention (0deg points up, clockwise positive). */
export function gradientAngle(
  handles: Array<{ x: number; y: number }> | undefined,
  width: number,
  height: number,
): number {
  const [h0, h1] = handles ?? [];
  const dx = ((h1?.x ?? 1) - (h0?.x ?? 0)) * width;
  const dy = ((h1?.y ?? 1) - (h0?.y ?? 0)) * height;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

const unitGradient = (u: FigmaLayerUnit): TextGradient => ({
  angle: gradientAngle(u.handles, u.width, u.height),
  stops: (u.stops ?? []).map((s) => ({ position: s.position, color: s.color })),
});

/**
 * Merge static fields built from the units marked `afterExcluded` into the
 * draft's field list, z-placed directly above the imported field each unit
 * painted over. Returns the COMPLETE field array: originals in their array
 * (form) order with renumbered z-indexes, overlays appended.
 *
 * z-indexes are renumbered 0..n-1 over the interleaved paint order — the
 * z_index column is an integer, so slotting between two consecutive values
 * must renumber, exactly like setLayerOrder does. `imported` must be the
 * lifted fields in the exact order their node ids were sent to the
 * decomposer (walk order == paint order), since `afterExcluded` counts
 * excluded nodes in that order.
 */
export function mergeOverlayFields(
  units: FigmaLayerUnit[],
  imported: TemplateField[],
  existingFields: TemplateField[],
): TemplateField[] {
  const overlays: Array<{ anchorId: string; field: TemplateField }> = [];
  const taken = [...existingFields];
  for (const u of units) {
    if (!u.afterExcluded || u.afterExcluded <= 0) continue;
    const anchor = imported[Math.min(u.afterExcluded, imported.length) - 1];
    if (!anchor) continue;
    const label = u.name?.trim() || "Background detail";
    const base: TemplateField = {
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, taken),
      type: "shape",
      shape: "rect",
      static: true,
      x: u.x,
      y: u.y,
      width: u.width,
      height: u.height,
    };
    let field: TemplateField;
    if ((u.kind === "node" || u.kind === "imageFill") && u.url) {
      field = {
        ...base,
        type: "image",
        shape: undefined,
        staticValue: u.url,
        // The render is an exact capture of the unit's box, so cover === 1:1.
        objectFit: "cover",
        opacity: u.opacity !== undefined ? Math.round(u.opacity * 100) : undefined,
      };
    } else if (u.kind === "solid" && u.color) {
      const { hex, alpha } = parseRgba(u.color);
      field = { ...base, colorHex: hex, opacity: alpha < 1 ? Math.round(alpha * 100) : undefined };
    } else if (u.kind === "gradient" && u.stops?.length) {
      field = {
        ...base,
        textGradient: unitGradient(u),
        opacity:
          u.opacity !== undefined && u.opacity < 1 ? Math.round(u.opacity * 100) : undefined,
      };
    } else {
      continue;
    }
    overlays.push({ anchorId: anchor.id, field });
    taken.push(field);
  }
  if (!overlays.length) return existingFields;

  // Interleave into paint order (zIndex ascending, ties by array order —
  // the renderer's convention), then renumber every z to an integer.
  const painted = existingFields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.zIndex ?? 0) - (b.f.zIndex ?? 0) || a.i - b.i)
    .map((e) => e.f);
  const sequence: TemplateField[] = [];
  for (const f of painted) {
    sequence.push(f);
    for (const o of overlays) if (o.anchorId === f.id) sequence.push(o.field);
  }
  const z = new Map(sequence.map((f, i) => [f.id, i]));
  return [
    ...existingFields.map((f) => ({ ...f, zIndex: z.get(f.id) ?? 0 })),
    ...overlays.map((o) => ({ ...o.field, zIndex: z.get(o.field.id) ?? 0 })),
  ];
}
