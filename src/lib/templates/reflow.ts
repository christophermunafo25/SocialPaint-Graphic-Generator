import type { GroupAxisPoint, LayoutGroup, NewTemplateInput, TemplateField } from "../types";
import { isFreeGroup, parseGroupChildRef } from "../types";
import { classifySize } from "./platforms";
import {
  rescaleTemplate,
  roundPx,
  sameAspect,
  scaleFieldType,
  uniformOnlyReason,
  type RescaleWarning,
} from "./rescale";

/** Which third of the source canvas a coordinate fraction falls in — the
 * inferred intent of where a field sits. */
const bucketOf = (fraction: number): GroupAxisPoint =>
  fraction < 1 / 3 ? "start" : fraction <= 2 / 3 ? "center" : "end";

/** Place one axis of a uniformly-scaled box in the target canvas: keep the
 * scaled distance from the anchored edge, or the center fraction for a
 * center-anchored box. Returns the new leading coordinate (left/top). */
function placeAxis(
  anchor: GroupAxisPoint,
  lead: number, // source left/top
  size: number, // source extent on this axis
  src: number, // source canvas extent
  dst: number, // target canvas extent
  u: number, // the uniform scale factor
): number {
  const newSize = size * u;
  if (anchor === "start") return lead * u;
  if (anchor === "end") return dst - (src - (lead + size)) * u - newSize;
  return ((lead + size / 2) / src) * dst - newSize / 2;
}

/** Anchor-inferred reflow for an aspect-ratio change — the transform behind
 * "Create a version for another platform". Uniform scaling across a changed
 * aspect leaves everything clustered in one corner; instead each field's
 * intent is inferred from where it sits (thirds of the source canvas, per
 * axis) and reproduced against the same anchor in the target.
 *
 * Sizes always scale by min(sx, sy) — uniform, so nothing distorts. Stack
 * groups use their DECLARED anchor on the main axis (the admin already said
 * what they meant) and the existing stack layout places their children.
 * Rotated, aspect-locked, and ellipse/star fields land safely but earn a
 * placement warning: an automatic reflow is a starting point, not a
 * finished layout.
 *
 * A same-aspect target degrades to exactly `rescaleTemplate` — one code
 * path for the case where they agree. */
export function reflowTemplate(
  draft: NewTemplateInput,
  next: { width: number; height: number },
): { draft: NewTemplateInput; warnings: RescaleWarning[] } {
  const src = { width: draft.canvasWidth, height: draft.canvasHeight };
  if (sameAspect(src, next)) return rescaleTemplate(draft, next);

  const sx = next.width / draft.canvasWidth;
  const sy = next.height / draft.canvasHeight;
  const u = Math.min(sx, sy);
  const warnings: RescaleWarning[] = [];

  // Children of STACK groups are positioned by the layout engine, not by
  // their stored x/y — the group frame is what gets reflowed. Free groups
  // are the opposite: their frame is computed from children, so children
  // reflow individually like ungrouped fields.
  const stackChildKeys = new Set(
    (draft.layoutGroups ?? [])
      .filter((g) => !isFreeGroup(g))
      .flatMap((g) => g.children.filter((c) => parseGroupChildRef(c) === null)),
  );

  const fields = draft.fields.map((f): TemplateField => {
    const reason = uniformOnlyReason(f);
    if (reason) {
      warnings.push({
        fieldId: f.id,
        fieldLabel: f.label,
        reason,
        message:
          reason === "rotated"
            ? `"${f.label}" is rotated — check where it landed in the new shape.`
            : reason === "aspect-locked"
              ? `"${f.label}" locks its image aspect ratio — check where it landed in the new shape.`
              : `"${f.label}" is a ${f.shape} — check where it landed in the new shape.`,
      });
    }
    const newW = f.width * u;
    const newH = f.height * u;
    if (stackChildKeys.has(f.fieldKey)) {
      // Position comes from the stack; only the size (and type) matter.
      return {
        ...f,
        x: roundPx(f.x * u),
        y: roundPx(f.y * u),
        width: roundPx(newW),
        height: roundPx(newH),
        ...scaleFieldType(f, u),
      };
    }
    // The box in left/top space, whatever the field's anchor mode.
    const left = f.anchor === "center" ? f.x - f.width / 2 : f.x;
    const top = f.anchor === "center" ? f.y - f.height / 2 : f.y;
    const newLeft = placeAxis(
      bucketOf((left + f.width / 2) / draft.canvasWidth),
      left,
      f.width,
      draft.canvasWidth,
      next.width,
      u,
    );
    const newTop = placeAxis(
      bucketOf((top + f.height / 2) / draft.canvasHeight),
      top,
      f.height,
      draft.canvasHeight,
      next.height,
      u,
    );
    return {
      ...f,
      x: roundPx(f.anchor === "center" ? newLeft + newW / 2 : newLeft),
      y: roundPx(f.anchor === "center" ? newTop + newH / 2 : newTop),
      width: roundPx(newW),
      height: roundPx(newH),
      ...scaleFieldType(f, u),
    };
  });

  const layoutGroups = draft.layoutGroups?.map((g): LayoutGroup => {
    if (isFreeGroup(g)) {
      // Frame computed from children; these stored values are ignored but
      // kept consistent with the uniform scale.
      return {
        ...g,
        x: roundPx(g.x * u),
        y: roundPx(g.y * u),
        gap: roundPx(g.gap * u),
        crossSize: roundPx(g.crossSize * u),
      };
    }
    // Stack frame. Main axis: the stored coordinate IS the declared anchor
    // point (top edge / center / bottom edge for vertical), so place it by
    // that declaration. Cross axis: the leading edge plus crossSize is a
    // plain box axis — infer its bucket like a field's.
    const vertical = g.direction === "vertical";
    const [mainSrc, mainDst] = vertical
      ? [draft.canvasHeight, next.height]
      : [draft.canvasWidth, next.width];
    const [crossSrc, crossDst] = vertical
      ? [draft.canvasWidth, next.width]
      : [draft.canvasHeight, next.height];
    const main = vertical ? g.y : g.x;
    const cross = vertical ? g.x : g.y;
    // The anchor point has no extent of its own — place it as a zero-size
    // box so start keeps its scaled edge distance, end its distance from
    // the far edge, center its fraction.
    const newMain = placeAxis(g.anchor, main, 0, mainSrc, mainDst, u);
    const newCross = placeAxis(
      bucketOf((cross + g.crossSize / 2) / crossSrc),
      cross,
      g.crossSize,
      crossSrc,
      crossDst,
      u,
    );
    return {
      ...g,
      x: roundPx(vertical ? newCross : newMain),
      y: roundPx(vertical ? newMain : newCross),
      gap: roundPx(g.gap * u),
      crossSize: roundPx(g.crossSize * u),
    };
  });

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

/** "Hiring announcement — Story", never "Hiring announcement copy": the
 * version is named from what the target size MEANS. A size the catalogue
 * doesn't know falls back to its dimensions. */
export function versionName(baseName: string, target: { width: number; height: number }): string {
  const meaning = classifySize(target.width, target.height);
  const label =
    meaning.assetType === "Custom size"
      ? `${target.width}×${target.height}`
      : // The first segment of a compound asset type ("Story · Reel ·
        // Vertical video" → "Story") keeps the name a name.
        meaning.assetType.split(" · ")[0];
  return `${baseName} — ${label}`;
}
