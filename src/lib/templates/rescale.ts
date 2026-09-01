import type { CornerRadius, LayoutGroup, NewTemplateInput, TemplateField } from "../types";

/** One field the rescale could not scale per-axis. The field still landed —
 * proportionally, via min(sx, sy) on both axes — but under a non-uniform
 * scale its box no longer fills the same fraction of the canvas, and the
 * admin should look at it. `fieldId` lets a review surface select it. */
export interface RescaleWarning {
  fieldId: string;
  fieldLabel: string;
  reason: "rotated" | "aspect-locked" | "shaped";
  message: string;
}

/** Rounding shared by rescale and reflow. Positions and box sizes land on
 * whole pixels; tracking keeps two decimals because sub-pixel letter spacing
 * is meaningful and a 0.5px value rounded to an integer would double or
 * vanish; an extreme downscale must not round a small font to zero. */
export const roundPx = (v: number): number => Math.round(v);
export const roundTracking = (v: number): number => Math.round(v * 100) / 100;
export const roundFont = (v: number): number => Math.max(1, Math.round(v));

/** The typography-and-radius patch both transforms apply: everything that
 * scales by the uniform factor `u`, so the two can never drift apart on
 * which properties count. `lineHeight` is a unitless multiplier and is
 * deliberately absent. */
export function scaleFieldType(f: TemplateField, u: number): Partial<TemplateField> {
  return {
    ...(f.fontSizePx != null && { fontSizePx: roundFont(f.fontSizePx * u) }),
    ...(f.minFontSizePx != null && { minFontSizePx: roundFont(f.minFontSizePx * u) }),
    ...(f.letterSpacingPx != null && { letterSpacingPx: roundTracking(f.letterSpacingPx * u) }),
    ...(f.cornerRadius && {
      cornerRadius: {
        tl: roundPx(f.cornerRadius.tl * u),
        tr: roundPx(f.cornerRadius.tr * u),
        br: roundPx(f.cornerRadius.br * u),
        bl: roundPx(f.cornerRadius.bl * u),
      } satisfies CornerRadius,
    }),
  };
}

/** Which fields cannot take a non-uniform scale (rescale) — and, for the
 * same reasons, deserve a placement check after an aspect-changing reflow. */
export function uniformOnlyReason(f: TemplateField): RescaleWarning["reason"] | null {
  if (f.rotation) return "rotated";
  if (f.type === "image" && f.aspectRatio != null) return "aspect-locked";
  if (f.shape === "ellipse" || f.shape === "star") return "shaped";
  return null;
}

/** True when scaling from one canvas to the other is uniform within a 0.5%
 * tolerance — the gate for resizing in place. */
export function sameAspect(
  from: { width: number; height: number },
  to: { width: number; height: number },
): boolean {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return Math.abs(sx - sy) <= 0.005 * Math.min(sx, sy);
}

/** Pure canvas rescale: every geometric property multiplied by the axis
 * factors, exactly once, rounded exactly once at the end.
 *
 * Type metrics (font sizes, tracking, corner radii) scale by min(sx, sy)
 * rather than by sx, so a canvas that grows in one axis and shrinks in the
 * other never pushes text past a box that got narrower. Three field shapes
 * cannot take a non-uniform scale at all and use min(sx, sy) on both axes,
 * with a warning naming the field: rotated boxes (a non-uniform scale of a
 * rotated box is a shear the box model cannot represent), image fields with
 * an aspect-ratio guardrail (a promise to the member), and ellipse/star
 * shapes (whose identity is their proportion).
 *
 * `lineHeight` is a unitless multiplier and is deliberately untouched. */
export function rescaleTemplate(
  draft: NewTemplateInput,
  next: { width: number; height: number },
): { draft: NewTemplateInput; warnings: RescaleWarning[] } {
  const sx = next.width / draft.canvasWidth;
  const sy = next.height / draft.canvasHeight;
  const u = Math.min(sx, sy);
  const warnings: RescaleWarning[] = [];

  const fields = draft.fields.map((f): TemplateField => {
    const reason = uniformOnlyReason(f);
    // Only worth saying when the scale actually IS non-uniform.
    if (reason && sx !== sy) {
      warnings.push({
        fieldId: f.id,
        fieldLabel: f.label,
        reason,
        message:
          reason === "rotated"
            ? `"${f.label}" is rotated, so it scaled proportionally instead of stretching — check its placement.`
            : reason === "aspect-locked"
              ? `"${f.label}" locks its image aspect ratio, so it scaled proportionally — check its placement.`
              : `"${f.label}" is a ${f.shape}, so it scaled proportionally to keep its shape — check its placement.`,
      });
    }
    const fx = reason ? u : sx;
    const fy = reason ? u : sy;
    return {
      ...f,
      x: roundPx(f.x * sx),
      y: roundPx(f.y * sy),
      width: roundPx(f.width * fx),
      height: roundPx(f.height * fy),
      ...scaleFieldType(f, u),
    };
  });

  // gap runs along the stack's main axis and crossSize across it, so each
  // takes the factor of the axis it actually measures.
  const layoutGroups = draft.layoutGroups?.map(
    (g): LayoutGroup => ({
      ...g,
      x: roundPx(g.x * sx),
      y: roundPx(g.y * sy),
      gap: roundPx(g.gap * (g.direction === "vertical" ? sy : sx)),
      crossSize: roundPx(g.crossSize * (g.direction === "vertical" ? sx : sy)),
    }),
  );

  return {
    draft: {
      ...draft,
      canvasWidth: next.width,
      canvasHeight: next.height,
      fields,
      ...(layoutGroups && { layoutGroups }),
    },
    warnings,
  };
}
