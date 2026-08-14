// Frame decomposition, extracted PURE from figma-layers/index.ts so vitest
// can cover it. Walks a Figma frame's children in paint order and reduces
// them to paintable units, EXCLUDING the nodes the admin turned into
// editable fields.
//
// Two subtleties this owns:
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
//    directly above the k-th excluded node encountered) and the client
//    lifts them into static fields at the right z instead of baking them.

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
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  /** The box the node actually PAINTS into — effects included. Figma's
   * image renders cover THIS box, not the layout box: a drop shadow makes
   * the PNG larger than absoluteBoundingBox, so a node unit must place at
   * render bounds or the artwork lands squeezed and shifted. */
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null;
  fills?: Paint[];
  strokes?: Paint[];
  effects?: Array<{ type: string; visible?: boolean }>;
  isMask?: boolean;
  children?: LayerNode[];
}

export interface Unit {
  kind: "node" | "solid" | "gradient" | "imageFill";
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
  /** Crop transform for imageFill units (see Paint.imageTransform). */
  transform?: number[][];
  /** Set when this unit paints ABOVE the k-th excluded node (1-based, in
   * encounter order) and overlaps at least one excluded node painted before
   * it. Absent → safe to bake into the background. */
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

/** Walk state threaded through one decomposition. */
export interface DecomposeCtx {
  frame: { x: number; y: number };
  excluded: Set<string>;
  units: Unit[];
  warnings: string[];
  /** Frame-relative boxes of excluded nodes already passed in paint order. */
  passedExcluded: Box[];
}

const relBox = (box: Box, frame: { x: number; y: number }): Box => ({
  x: Math.round(box.x - frame.x),
  y: Math.round(box.y - frame.y),
  width: Math.round(box.width),
  height: Math.round(box.height),
});

/** Mark a unit that must stay above already-passed excluded nodes. */
function stampOrder(ctx: DecomposeCtx, unit: Unit): Unit {
  if (ctx.passedExcluded.length && ctx.passedExcluded.some((b) => overlaps(b, unit))) {
    unit.afterExcluded = ctx.passedExcluded.length;
  }
  return unit;
}

export function fillUnits(node: LayerNode, ctx: DecomposeCtx): Unit[] {
  const box = node.absoluteBoundingBox;
  if (!box) return [];
  const base = relBox(box, ctx.frame);
  const units: Unit[] = [];
  for (const fill of node.fills ?? []) {
    if (fill.visible === false) continue;
    if (fill.type === "SOLID" && fill.color) {
      units.push({
        kind: "solid",
        name: node.name,
        ...base,
        color: rgba(fill.color, fill.opacity ?? 1),
      });
    } else if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops) {
      units.push({
        kind: "gradient",
        name: node.name,
        ...base,
        opacity: fill.opacity,
        stops: fill.gradientStops.map((s) => ({ position: s.position, color: rgba(s.color) })),
        handles: fill.gradientHandlePositions,
      });
    } else if (fill.type === "IMAGE" && fill.imageRef) {
      units.push({
        kind: "imageFill",
        name: node.name,
        ...base,
        url: `imageref:${fill.imageRef}`,
        opacity: fill.opacity,
        transform: fill.imageTransform,
      });
      // STRETCH carries the exact crop in imageTransform; FILL is the cover
      // behavior the client draws by default. Anything else is approximate.
      if (fill.scaleMode && fill.scaleMode !== "FILL" && fill.scaleMode !== "STRETCH") {
        ctx.warnings.push(
          `"${node.name}": image fill uses ${fill.scaleMode} — approximated as cover.`,
        );
      }
    } else if (fill.type?.startsWith("GRADIENT")) {
      if (fill.gradientStops?.length) {
        units.push({
          kind: "solid",
          name: node.name,
          ...base,
          color: rgba(fill.gradientStops[0].color, fill.opacity ?? 1),
        });
      }
      ctx.warnings.push(`"${node.name}": ${fill.type} approximated with a flat color.`);
    }
  }
  return units.map((u) => stampOrder(ctx, u));
}

export function decompose(node: LayerNode, ctx: DecomposeCtx): void {
  if (node.visible === false) return;
  const box = node.absoluteBoundingBox;
  if (ctx.excluded.has(node.id)) {
    // Lifted off the background entirely — but remember where it painted:
    // anything after this point that overlaps it must stay above it.
    if (box) ctx.passedExcluded.push(relBox(box, ctx.frame));
    return;
  }
  if (!box) return;

  if (!subtreeHasExcluded(node, ctx.excluded)) {
    // Figma's PNG covers the RENDER bounds (effects included) — place the
    // unit there, or a drop shadow squeezes the artwork into the smaller
    // layout box and shifts everything by the shadow margin.
    const paintBox = node.absoluteRenderBounds ?? box;
    ctx.units.push(
      stampOrder(ctx, {
        kind: "node",
        name: node.name,
        nodeId: node.id,
        ...relBox(paintBox, ctx.frame),
      }),
    );
    if (subtreeHasBackgroundBlur(node)) {
      ctx.warnings.push(
        `"${node.name}": frosted-glass blur can't be reproduced — the panel renders with its tint only.`,
      );
    }
    return;
  }

  // Container holding an excluded node: paint its own fills, then recurse.
  ctx.units.push(...fillUnits(node, ctx));
  if (node.isMask || (node.effects ?? []).some((e) => e.visible !== false)) {
    ctx.warnings.push(`"${node.name}": masks/effects on this container can't be reproduced exactly.`);
  }
  if ((node.strokes ?? []).some((s) => s.visible !== false)) {
    ctx.warnings.push(`"${node.name}": this container's border can't be reproduced exactly.`);
  }
  for (const child of node.children ?? []) decompose(child, ctx);
}

/** Decompose a full frame: the frame's own background fills first (always
 * background — nothing has painted yet), then children in paint order. */
export function decomposeFrame(
  root: LayerNode,
  excludeNodeIds: string[],
): { units: Unit[]; warnings: string[] } {
  const frame = root.absoluteBoundingBox!;
  const ctx: DecomposeCtx = {
    frame,
    excluded: new Set(excludeNodeIds),
    units: [],
    warnings: [],
    passedExcluded: [],
  };
  ctx.units.push(...fillUnits(root, ctx));
  for (const child of root.children ?? []) decompose(child, ctx);
  return { units: ctx.units, warnings: ctx.warnings };
}
