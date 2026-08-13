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
 * Build static fields from the units marked `afterExcluded`, z-placed
 * directly above the imported field they painted over. `imported` must be
 * the lifted fields in the exact order their node ids were sent to the
 * decomposer (walk order == paint order), since `afterExcluded` counts
 * excluded nodes in that order.
 */
export function overlayUnitsToFields(
  units: FigmaLayerUnit[],
  imported: TemplateField[],
  existingFields: TemplateField[],
): TemplateField[] {
  const overlays = units.filter((u) => u.afterExcluded && u.afterExcluded > 0);
  const out: TemplateField[] = [];
  const taken = [...existingFields];
  // Several overlays above the same field keep their relative order via
  // fractional z between that field and the next imported one.
  const perAnchor = new Map<number, number>();
  for (const u of overlays) {
    const k = Math.min(u.afterExcluded!, imported.length);
    const anchor = imported[k - 1];
    if (!anchor) continue;
    const seq = (perAnchor.get(k) ?? 0) + 1;
    perAnchor.set(k, seq);
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
      zIndex: (anchor.zIndex ?? 0) + seq / 100,
    };
    if ((u.kind === "node" || u.kind === "imageFill") && u.url) {
      out.push({
        ...base,
        type: "image",
        shape: undefined,
        staticValue: u.url,
        // The render is an exact capture of the unit's box, so cover === 1:1.
        objectFit: "cover",
        opacity: u.opacity !== undefined ? Math.round(u.opacity * 100) : undefined,
      });
    } else if (u.kind === "solid" && u.color) {
      const { hex, alpha } = parseRgba(u.color);
      out.push({
        ...base,
        colorHex: hex,
        opacity: alpha < 1 ? Math.round(alpha * 100) : undefined,
      });
    } else if (u.kind === "gradient" && u.stops?.length) {
      out.push({
        ...base,
        textGradient: unitGradient(u),
        opacity:
          u.opacity !== undefined && u.opacity < 1 ? Math.round(u.opacity * 100) : undefined,
      });
    } else {
      continue;
    }
    taken.push(out[out.length - 1]);
  }
  return out;
}
