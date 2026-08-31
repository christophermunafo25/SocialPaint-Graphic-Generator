// Frame decomposition, extracted PURE from figma-layers/index.ts so vitest
// can cover it. Walks a Figma frame's children in paint order and reduces
// them to paintable units, EXCLUDING the nodes the admin turned into
// editable fields.
//
// Subtleties this owns:
//
//  - Image-fill crops. A cropped image fill arrives as scaleMode STRETCH
//    with an `imageTransform` affine mapping layer space onto normalized
//    image space. The transform rides along on the unit so the client can
//    draw the exact crop instead of approximating with a center cover.
//
//  - Paint order versus the lifted fields. The recomposed background is ONE
//    layer that sits UNDER every field, so any unit that paints AFTER an
//    excluded node it overlaps (e.g. a fade gradient over a lifted photo)
//    cannot go into the background — it would drop beneath the field and
//    change the image. Such units are marked `afterExcluded: k` (they paint
//    directly above the k-th excluded node they overlap) and the client
//    lifts them into static fields at the right z instead of baking them.
//
//  - Masks and clipping. A mask node emits no unit of its own; the siblings
//    painted above it are clipped to the mask's bounding box (a rectangular
//    approximation of a true alpha mask). Containers with clipsContent clip
//    the units their descent produces the same way.

import { cornerRadiusOf, isRasterLeaf, transformOf, type ImportWarning } from "./extract.ts";

export type { ImportWarning };
export { warningStrings } from "./extract.ts";

export interface Paint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
  gradientStops?: Array<{
    position: number;
    color: { r: number; g: number; b: number; a?: number };
  }>;
  gradientHandlePositions?: Array<{ x: number; y: number }>;
  imageRef?: string;
  scaleMode?: string;
  /** 2×3 affine (rows [a, c, tx] / [b, d, ty]) mapping the layer's unit
   * square onto normalized image coordinates — present on cropped fills. */
  imageTransform?: number[][];
}

export interface LayerNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  /** The box the node actually PAINTS into — effects included. Figma's
   * image renders cover THIS box, not the layout box: a drop shadow makes
   * the PNG larger than absoluteBoundingBox, so a node unit must place at
   * render bounds or the artwork lands squeezed and shifted. */
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null;
  /** Rotation lives here (fetched with geometry=paths); `size` is the true
   * unrotated size — the AABB of a rotated node is the wrong box. */
  relativeTransform?: number[][];
  size?: { x: number; y: number };
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  clipsContent?: boolean;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  strokeAlign?: string;
  strokeDashes?: number[];
  effects?: Array<{ type: string; visible?: boolean }>;
  isMask?: boolean;
  /** Vector fill paths (geometry=paths); pruned trees carry presence only. */
  fillGeometry?: Array<{ path?: string; windingRule?: string }>;
  hasFillGeometry?: boolean;
  children?: LayerNode[];
}

export interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

export interface Unit {
  kind: "node" | "solid" | "gradient" | "imageFill" | "stroke";
  /** Source layer name — becomes the field label if this unit is lifted. */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeId?: string; // pending render
  url?: string;
  color?: string;
  opacity?: number;
  stops?: Array<{ position: number; color: string }>;
  handles?: Array<{ x: number; y: number }>;
  /** Which gradient primitive to build ("linear" when absent — every unit
   * saved before this field existed is linear). Diamond gradients never get
   * here; they fall back to a flat color with a warning. */
  gradientType?: "linear" | "radial" | "angular";
  /** Crop transform for imageFill units (see Paint.imageTransform). */
  transform?: number[][];
  /** Degrees about the unit's center (CSS convention) — fills of a rotated
   * node. Node-render units never carry this: Figma bakes the rotation into
   * the PNG. */
  rotation?: number;
  /** Rounded corners for solid/gradient/stroke rect units and image fills. */
  cornerRadius?: CornerRadii;
  /** Frame-relative clip rect: the unit draws only inside it (mask or
   * clipsContent ancestor). */
  clip?: { x: number; y: number; width: number; height: number };
  /** Stroke units: line width in px (the rect is the stroked path). */
  strokeWeight?: number;
  /** VECTOR nodes: SVG path data recorded for a future vector-native pass —
   * the unit still ships as a raster render today. */
  pathData?: string;
  /** Set when this unit paints ABOVE the k-th excluded node (1-based, in
   * encounter order) and overlaps it. Anchored at the LAST excluded node it
   * overlaps, so interleaved stacks keep their z. Absent → safe to bake
   * into the background. */
  afterExcluded?: number;
}

export const rgba = (c: { r: number; g: number; b: number; a?: number }, opacity = 1): string =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${((c.a ?? 1) * opacity).toFixed(3)})`;

export function subtreeHasExcluded(node: LayerNode, excluded: Set<string>): boolean {
  if (excluded.has(node.id)) return true;
  return (node.children ?? []).some((c) => subtreeHasExcluded(c, excluded));
}

/** Frosted-glass panels blur whatever sits BEHIND them — rendered in
 * isolation there is nothing to blur, so the pane comes back flat. The
 * approximation ships (the translucent fill still reads), but the admin
 * should hear about it. */
function subtreeHasBackgroundBlur(node: LayerNode): boolean {
  if ((node.effects ?? []).some((e) => e.type === "BACKGROUND_BLUR" && e.visible !== false)) {
    return true;
  }
  return (node.children ?? []).some(subtreeHasBackgroundBlur);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const intersect = (a: Box | undefined, b: Box): Box => {
  if (!a) return b;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
};

/** Walk state threaded through one decomposition. */
export interface DecomposeCtx {
  frame: { x: number; y: number };
  excluded: Set<string>;
  units: Unit[];
  warnings: ImportWarning[];
  /** Frame-relative boxes of excluded nodes already passed in paint order. */
  passedExcluded: Box[];
}

const relBox = (box: Box, frame: { x: number; y: number }): Box => ({
  x: Math.round(box.x - frame.x),
  y: Math.round(box.y - frame.y),
  width: Math.round(box.width),
  height: Math.round(box.height),
});

const warn = (
  ctx: DecomposeCtx,
  node: LayerNode,
  issue: string,
  severity: "info" | "degraded" = "degraded",
): void => {
  ctx.warnings.push({ layer: node.name, nodeId: node.id, issue, severity });
};

/** Mark a unit that must stay above already-passed excluded nodes. Anchors
 * at the LAST excluded node the unit overlaps — anchoring at the most
 * recent excluded node regardless of overlap misplaces overlays once three
 * or more lifted elements interleave. */
function stampOrder(ctx: DecomposeCtx, unit: Unit): Unit {
  for (let i = ctx.passedExcluded.length - 1; i >= 0; i--) {
    if (overlaps(ctx.passedExcluded[i], unit)) {
      unit.afterExcluded = i + 1;
      break;
    }
  }
  return unit;
}

/** Geometry a fill or stroke unit draws with: rotated nodes place at their
 * true (unrotated) size around the AABB center with the rotation on the
 * unit; unrotated nodes keep the exact rounded-AABB behavior that shipped. */
function unitGeometry(
  node: LayerNode,
  ctx: DecomposeCtx,
): { x: number; y: number; width: number; height: number; rotation?: number } {
  const box = node.absoluteBoundingBox!;
  const { rotation, size } = transformOf(node);
  if (rotation !== undefined && size) {
    const cx = box.x - ctx.frame.x + box.width / 2;
    const cy = box.y - ctx.frame.y + box.height / 2;
    return {
      x: Math.round(cx - size.x / 2),
      y: Math.round(cy - size.y / 2),
      width: Math.round(size.x),
      height: Math.round(size.y),
      rotation,
    };
  }
  return relBox(box, ctx.frame);
}

export function fillUnits(node: LayerNode, ctx: DecomposeCtx, clip?: Box): Unit[] {
  const box = node.absoluteBoundingBox;
  if (!box) return [];
  const base = unitGeometry(node, ctx);
  const cornerRadius = cornerRadiusOf(node);
  const nodeOpacity = node.opacity ?? 1;
  const units: Unit[] = [];
  for (const fill of node.fills ?? []) {
    if (fill.visible === false) continue;
    if (fill.type === "SOLID" && fill.color) {
      units.push({
        kind: "solid",
        name: node.name,
        ...base,
        cornerRadius,
        color: rgba(fill.color, (fill.opacity ?? 1) * nodeOpacity),
      });
    } else if (
      (fill.type === "GRADIENT_LINEAR" ||
        fill.type === "GRADIENT_RADIAL" ||
        fill.type === "GRADIENT_ANGULAR") &&
      fill.gradientStops
    ) {
      units.push({
        kind: "gradient",
        name: node.name,
        ...base,
        cornerRadius,
        gradientType:
          fill.type === "GRADIENT_RADIAL"
            ? "radial"
            : fill.type === "GRADIENT_ANGULAR"
              ? "angular"
              : "linear",
        opacity:
          fill.opacity !== undefined || nodeOpacity < 1
            ? (fill.opacity ?? 1) * nodeOpacity
            : undefined,
        stops: fill.gradientStops.map((s) => ({ position: s.position, color: rgba(s.color) })),
        handles: fill.gradientHandlePositions,
      });
    } else if (fill.type === "IMAGE" && fill.imageRef) {
      units.push({
        kind: "imageFill",
        name: node.name,
        ...base,
        cornerRadius,
        url: `imageref:${fill.imageRef}`,
        opacity:
          fill.opacity !== undefined || nodeOpacity < 1
            ? (fill.opacity ?? 1) * nodeOpacity
            : undefined,
        transform: fill.imageTransform,
      });
      // STRETCH carries the exact crop in imageTransform; FILL is the cover
      // behavior the client draws by default. Anything else is approximate.
      if (fill.scaleMode && fill.scaleMode !== "FILL" && fill.scaleMode !== "STRETCH") {
        warn(ctx, node, `image fill uses ${fill.scaleMode} — approximated as cover.`);
      }
    } else if (fill.type?.startsWith("GRADIENT")) {
      if (fill.gradientStops?.length) {
        units.push({
          kind: "solid",
          name: node.name,
          ...base,
          cornerRadius,
          color: rgba(fill.gradientStops[0].color, (fill.opacity ?? 1) * nodeOpacity),
        });
      }
      warn(ctx, node, `${fill.type} approximated with a flat color.`);
    }
  }
  // Uniform solid strokes survive the plate as real outline units instead of
  // vanishing (or warning) — anything fancier still warns.
  const weight = node.strokeWeight ?? 0;
  for (const stroke of node.strokes ?? []) {
    if (stroke.visible === false) continue;
    if (stroke.type === "SOLID" && stroke.color && weight > 0) {
      // Canvas strokes paint centered on the path; move the path so INSIDE /
      // OUTSIDE alignments land where Figma drew them.
      const shift =
        node.strokeAlign === "INSIDE"
          ? weight / 2
          : node.strokeAlign === "OUTSIDE"
            ? -weight / 2
            : 0;
      units.push({
        kind: "stroke",
        name: node.name,
        x: Math.round(base.x + shift),
        y: Math.round(base.y + shift),
        width: Math.round(base.width - shift * 2),
        height: Math.round(base.height - shift * 2),
        rotation: base.rotation,
        cornerRadius,
        strokeWeight: weight,
        color: rgba(stroke.color, (stroke.opacity ?? 1) * nodeOpacity),
      });
      if (node.strokeDashes?.length) {
        warn(ctx, node, "dashed border approximated as solid.", "info");
      }
    } else {
      warn(ctx, node, "this border style can't be reproduced exactly.");
    }
  }
  if (clip) for (const u of units) u.clip = clip;
  return units.map((u) => stampOrder(ctx, u));
}

export function decompose(node: LayerNode, ctx: DecomposeCtx, clip?: Box): void {
  if (node.visible === false) return;
  const box = node.absoluteBoundingBox;
  if (ctx.excluded.has(node.id)) {
    // Lifted off the background entirely — but remember where it painted:
    // anything after this point that overlaps it must stay above it. If the
    // lifted node is a container whose children the field extraction ALSO
    // descended (its artwork is the bare fill), classify those children too
    // instead of swallowing them — nested lifts and leftover decoration both
    // live inside.
    if (box) ctx.passedExcluded.push(relBox(box, ctx.frame));
    if (!isRasterLeaf(node)) descendChildren(node, ctx, clip);
    return;
  }
  if (!box) return;

  if (!subtreeHasExcluded(node, ctx.excluded)) {
    // Figma's PNG covers the RENDER bounds (effects included) — place the
    // unit there, or a drop shadow squeezes the artwork into the smaller
    // layout box and shifts everything by the shadow margin.
    const paintBox = node.absoluteRenderBounds ?? box;
    const unit: Unit = {
      kind: "node",
      name: node.name,
      nodeId: node.id,
      ...relBox(paintBox, ctx.frame),
    };
    if (clip) unit.clip = clip;
    if (node.type === "VECTOR") {
      const paths = (node.fillGeometry ?? [])
        .map((g) => g.path)
        .filter((p): p is string => Boolean(p));
      if (paths.length) unit.pathData = paths.join(" ");
    }
    ctx.units.push(stampOrder(ctx, unit));
    if (subtreeHasBackgroundBlur(node)) {
      warn(
        ctx,
        node,
        "frosted-glass blur can't be reproduced — the panel renders with its tint only.",
        "info",
      );
    }
    return;
  }

  // Container holding an excluded node: paint its own fills, then recurse.
  const childClip = node.clipsContent ? intersect(clip, relBox(box, ctx.frame)) : clip;
  ctx.units.push(...fillUnits(node, ctx, clip));
  if ((node.effects ?? []).some((e) => e.visible !== false)) {
    warn(ctx, node, "effects on this container can't be reproduced exactly.");
  }
  descendChildren(node, ctx, childClip);
}

/** Children in paint order, honoring masks: a mask node emits no unit, and
 * the siblings painted above it clip to its bounding box (rectangular
 * approximation of a true alpha mask). */
function descendChildren(node: LayerNode, ctx: DecomposeCtx, clip?: Box): void {
  let activeClip = clip;
  for (const child of node.children ?? []) {
    if (child.isMask) {
      if (child.visible === false || !child.absoluteBoundingBox) continue;
      activeClip = intersect(clip, relBox(child.absoluteBoundingBox, ctx.frame));
      if (child.type !== "RECTANGLE") {
        warn(ctx, child, "non-rectangular mask approximated with a rectangular clip.");
      }
      continue;
    }
    decompose(child, ctx, activeClip);
  }
}

/** Decompose a full frame: the frame's own background fills first (always
 * background — nothing has painted yet), then children in paint order. */
export function decomposeFrame(
  root: LayerNode,
  excludeNodeIds: string[],
): { units: Unit[]; warnings: ImportWarning[] } {
  const frame = root.absoluteBoundingBox!;
  const ctx: DecomposeCtx = {
    frame,
    excluded: new Set(excludeNodeIds),
    units: [],
    warnings: [],
    passedExcluded: [],
  };
  ctx.units.push(...fillUnits(root, ctx));
  descendChildren(root, ctx, undefined);
  return { units: ctx.units, warnings: ctx.warnings };
}

/** Strip a fetched node tree down to what decomposition reads, so the tree
 * can ride along in the import response (one Figma fetch, one tree, shared
 * by both walks) without shipping megabytes of vector path data. Geometry
 * presence survives as `hasFillGeometry` — isRasterLeaf needs it. */
export function pruneTree(node: LayerNode): LayerNode {
  const out: LayerNode = {
    id: node.id,
    name: node.name,
    type: node.type,
  };
  if (node.visible !== undefined) out.visible = node.visible;
  if (node.opacity !== undefined) out.opacity = node.opacity;
  if (node.absoluteBoundingBox) out.absoluteBoundingBox = node.absoluteBoundingBox;
  if (node.absoluteRenderBounds !== undefined) out.absoluteRenderBounds = node.absoluteRenderBounds;
  if (node.relativeTransform) out.relativeTransform = node.relativeTransform;
  if (node.size) out.size = node.size;
  if (node.cornerRadius !== undefined) out.cornerRadius = node.cornerRadius;
  if (node.rectangleCornerRadii) out.rectangleCornerRadii = node.rectangleCornerRadii;
  if (node.clipsContent !== undefined) out.clipsContent = node.clipsContent;
  if (node.fills) out.fills = node.fills;
  if (node.strokes) out.strokes = node.strokes;
  if (node.strokeWeight !== undefined) out.strokeWeight = node.strokeWeight;
  if (node.strokeAlign !== undefined) out.strokeAlign = node.strokeAlign;
  if (node.strokeDashes) out.strokeDashes = node.strokeDashes;
  if (node.effects) out.effects = node.effects;
  if (node.isMask !== undefined) out.isMask = node.isMask;
  if (node.fillGeometry?.length || node.hasFillGeometry) out.hasFillGeometry = true;
  if (node.children) out.children = node.children.map(pruneTree);
  return out;
}
