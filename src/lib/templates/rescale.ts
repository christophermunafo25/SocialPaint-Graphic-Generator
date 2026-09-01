import type { CornerRadius, LayoutGroup, NewTemplateInput, TemplateField } from "../types";

/** One field the rescale could not scale per-axis. The field still landed —
 * proportionally, via min(sx, sy) on both axes — but under a non-uniform
 * scale its box no longer fills the same fraction of the canvas, and the
 * admin should look at it. */
export interface RescaleWarning {
  fieldLabel: string;
  reason: "rotated" | "aspect-locked" | "shaped";
  message: string;
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

  // Positions and box sizes land on whole pixels; tracking keeps two
  // decimals because sub-pixel letter spacing is meaningful and a 0.5px
  // value rounded to an integer would double or vanish.
  const px = (v: number) => Math.round(v);
  const tracking = (v: number) => Math.round(v * 100) / 100;
  // An extreme downscale must not round a small font to zero.
  const font = (v: number) => Math.max(1, px(v * u));

  const corners = (c: CornerRadius): CornerRadius => ({
    tl: px(c.tl * u),
    tr: px(c.tr * u),
    br: px(c.br * u),
    bl: px(c.bl * u),
  });

  const uniformOnlyReason = (f: TemplateField): RescaleWarning["reason"] | null => {
    if (f.rotation) return "rotated";
    if (f.type === "image" && f.aspectRatio != null) return "aspect-locked";
    if (f.shape === "ellipse" || f.shape === "star") return "shaped";
    return null;
  };

  const fields = draft.fields.map((f): TemplateField => {
    const reason = uniformOnlyReason(f);
    // Only worth saying when the scale actually IS non-uniform.
    if (reason && sx !== sy) {
      warnings.push({
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
      x: px(f.x * sx),
      y: px(f.y * sy),
      width: px(f.width * fx),
      height: px(f.height * fy),
      ...(f.fontSizePx != null && { fontSizePx: font(f.fontSizePx) }),
      ...(f.minFontSizePx != null && { minFontSizePx: font(f.minFontSizePx) }),
      ...(f.letterSpacingPx != null && { letterSpacingPx: tracking(f.letterSpacingPx * u) }),
      ...(f.cornerRadius && { cornerRadius: corners(f.cornerRadius) }),
    };
  });

  // gap runs along the stack's main axis and crossSize across it, so each
  // takes the factor of the axis it actually measures.
  const layoutGroups = draft.layoutGroups?.map(
    (g): LayoutGroup => ({
      ...g,
      x: px(g.x * sx),
      y: px(g.y * sy),
      gap: px(g.gap * (g.direction === "vertical" ? sy : sx)),
      crossSize: px(g.crossSize * (g.direction === "vertical" ? sx : sy)),
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
