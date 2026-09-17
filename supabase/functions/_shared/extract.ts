// Shared design extraction. Runs in Deno (Supabase Edge).
//
// Every import source (Figma today, Canva behind its flag) reduces to the
// same two questions: what does the frame look like (a background PNG), and
// what elements are on it (exact geometry + typography). ExtractionResult is
// that common shape; the auto-build engine consumes it without knowing which
// source produced it.

export interface FigmaPaint {
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
  imageTransform?: number[][];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  characters?: string;
  opacity?: number;
  /** Uniform corner radius, or per-corner [tl, tr, br, bl]. */
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  effects?: Array<{ type: string; visible?: boolean }>;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  /** 2×3 affine relative to the parent — the ONLY place rotation lives.
   * Present when the tree is fetched with geometry=paths. */
  relativeTransform?: number[][];
  /** The node's true (unrotated) size. absoluteBoundingBox on a rotated
   * node is the axis-aligned bounding box — larger and misplaced. */
  size?: { x: number; y: number };
  /** Vector fill paths (geometry=paths). Presence means the artwork is
   * reconstructible from properties; absence means raster-only. */
  fillGeometry?: Array<{ path?: string; windingRule?: string }>;
  isMask?: boolean;
  /** How a mask node clips: "VECTOR" (outline), "ALPHA", or "LUMINANCE". */
  maskType?: string;
  clipsContent?: boolean;
  pointCount?: number;
  arcData?: { startingAngle: number; endingAngle: number; innerRadius: number };
  /** Per-character style run table — any nonzero entry means mixed styling
   * a single field cannot represent. */
  characterStyleOverrides?: number[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: string;
  strokeDashes?: number[];
  style?: {
    fontFamily?: string;
    fontPostScriptName?: string;
    fontWeight?: number;
    fontSize?: number;
    italic?: boolean;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
    textCase?: string;
    textDecoration?: string;
    letterSpacing?: number;
    lineHeightPx?: number;
    lineHeightPercentFontSize?: number;
  };
  fills?: FigmaPaint[];
  children?: FigmaNode[];
}

export const toHex = (c: { r: number; g: number; b: number }): string =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();

/** CSS color for a Figma color: hex when opaque, rgba() when translucent. */
export const toCssColor = (c: { r: number; g: number; b: number; a?: number }): string =>
  (c.a ?? 1) >= 1
    ? toHex(c)
    : `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${(c.a ?? 1).toFixed(3)})`;

// ---------------------------------------------------------------------------
// Warnings — structured so the builder can point at the layer that degraded,
// with a joined-string form for the existing UI.
// ---------------------------------------------------------------------------

export interface ImportWarning {
  layer: string;
  nodeId: string;
  issue: string;
  severity: "info" | "degraded";
}

export const warningStrings = (warnings: ImportWarning[]): string[] =>
  warnings.map((w) => `"${w.layer}": ${w.issue}`);

export interface SuggestedField {
  id: string;
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image" | "shape";
  sourceNodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees about the box center, CSS convention (clockwise positive).
   * A rotated element lands with anchor "center": x/y are the box center —
   * exactly the rotation origin the renderer uses. */
  rotation?: number;
  anchor?: "topLeft" | "center";
  fontFamily?: string;
  /** Disambiguates the exact face ("Display SemiBold" vs a generic
   * SemiBold) when matching uploaded brand fonts. */
  fontPostScriptName?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  fontSizePx?: number;
  colorHex?: string;
  /** Linear-gradient fill (text or shape) — wins over colorHex when set. */
  textGradient?: { angle: number; stops: Array<{ position: number; color: string }> };
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  placeholder?: string;
  textSizing?: "free" | "shrink";
  objectFit?: "cover";
  /** Element opacity 0–100, only when the node is not fully opaque. */
  opacity?: number;
  /** Per-corner radius, matching TemplateField.cornerRadius. */
  cornerRadius?: { tl: number; tr: number; br: number; bl: number };
  /** Shape fields: which primitive to draw. */
  shape?: "rect" | "ellipse" | "triangle" | "star";
  /** Shape fields: inner stroke, matching TemplateField.strokeColor/-WidthPx. */
  strokeColor?: string;
  strokeWidthPx?: number;
  /** Text fields: plate behind the text (a fused pill), matching
   * TemplateField.plateColor / platePaddingX / platePaddingY. */
  plateColor?: string;
  platePaddingX?: number;
  platePaddingY?: number;
  /** Every imported element lands FIXED — the design stays exactly as
   * drawn, and the admin opts elements IN to being member fields. Text
   * carries its source copy as the fixed content; image staticValue is
   * filled by the caller after rendering the node. */
  static?: boolean;
  staticValue?: string;
  /** Import-internal: this image field's children were lifted as their own
   * fields, so its artwork must be the bare image FILL (resolved via
   * /v1/files/{key}/images), never a node render — a node render would bake
   * the lifted children into the pixels twice. Stripped before the response. */
  fillImageRef?: string;
}

/** A node's rounded corners in the field shape, or undefined when square. */
export function cornerRadiusOf(node: {
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
}): { tl: number; tr: number; br: number; bl: number } | undefined {
  const r = node.rectangleCornerRadii;
  if (r?.length === 4 && r.some((v) => v > 0)) {
    return { tl: r[0], tr: r[1], br: r[2], bl: r[3] };
  }
  if (node.cornerRadius && node.cornerRadius > 0) {
    const v = node.cornerRadius;
    return { tl: v, tr: v, br: v, bl: v };
  }
  return undefined;
}

/** Element opacity as the field stores it (0–100), or undefined at full. */
export const opacityOf = (node: FigmaNode): number | undefined =>
  node.opacity !== undefined && node.opacity < 1 ? Math.round(node.opacity * 100) : undefined;

/** Rotation (degrees, renderer convention) and true unrotated size, read
 * from the relativeTransform the REST API exposes with geometry=paths.
 * absoluteBoundingBox on a rotated node is the axis-aligned bounding box —
 * the wrong box — so rotated placement must come from here. */
export function transformOf(node: {
  relativeTransform?: number[][];
  size?: { x: number; y: number };
}): { rotation: number | undefined; size: { x: number; y: number } | undefined } {
  const m = node.relativeTransform;
  // Figma's matrix encodes its CCW-positive rotation (their own formula is
  // atan2(-m10, m00)); TemplateField.rotation is CSS/canvas CW-positive (the
  // Canva path already lands CW degrees), so the sign flips here: for a node
  // Figma shows tilted A° counter-clockwise, m10 = -sin(A) and this yields
  // -A — which CSS rotate() renders as A° counter-clockwise. Verified against
  // both conventions; do not "simplify" the sign away.
  const rotation = m ? Math.atan2(m[1][0], m[0][0]) * (180 / Math.PI) : 0;
  return {
    rotation: Math.abs(rotation) < 0.01 ? undefined : Math.round(rotation * 100) / 100,
    size: node.size,
  };
}

/** A node is a LEAF for import when its artwork can't be reconstructed from
 * properties — it must ship as a raster. Otherwise descend. Used by both
 * walks so the field extraction and the background decomposition agree on
 * where a subtree flattens. */
export function isRasterLeaf(node: {
  type: string;
  effects?: Array<{ type: string; visible?: boolean }>;
  fillGeometry?: unknown[];
  /** Pruned trees (shipped to the client and back) carry presence only. */
  hasFillGeometry?: boolean;
  children?: Array<{ isMask?: boolean }>;
}): boolean {
  if (node.type === "BOOLEAN_OPERATION") return true;
  if ((node.effects ?? []).some((e) => e.type === "BACKGROUND_BLUR" && e.visible !== false)) {
    return true;
  }
  if ((node.children ?? []).some((c) => c.isMask)) return true;
  if (node.type === "VECTOR" && !(node.hasFillGeometry ?? (node.fillGeometry?.length ?? 0) > 0)) {
    return true;
  }
  return false;
}

/** Structural node shape the shared walk/decompose predicates read —
 * satisfied by FigmaNode, figmaLayers' LayerNode, and pruned trees alike. */
export interface PredicateNode {
  type: string;
  visible?: boolean;
  isMask?: boolean;
  effects?: Array<{ type: string; visible?: boolean }>;
  fillGeometry?: unknown[];
  hasFillGeometry?: boolean;
  strokes?: Array<{ type: string; visible?: boolean }>;
  fills?: FigmaPaint[];
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  children?: PredicateNode[];
}

const VECTOR_LEAF_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "LINE",
  "ELLIPSE",
  "RECTANGLE",
  "REGULAR_POLYGON",
  "POLYGON",
]);
const VECTOR_CONTAINER_TYPES = new Set(["GROUP", "FRAME", "COMPONENT", "INSTANCE"]);

/** Pure vector artwork: a subtree of shapes/vectors (containers included)
 * holding no text and no image fills. Such a subtree — a logo, an icon — is
 * one visual object to a designer, so the walk lifts it WHOLE as a single
 * static image (Figma's own render, masks and all) instead of leaving it
 * baked into the background plate. */
export function isVectorArtwork(node: PredicateNode): boolean {
  if (node.visible === false) return false;
  if ((node.fills ?? []).some((f) => f.type === "IMAGE" && f.visible !== false)) return false;
  if (VECTOR_LEAF_TYPES.has(node.type)) return true;
  if (!VECTOR_CONTAINER_TYPES.has(node.type)) return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  return kids.length > 0 && kids.every(isVectorArtwork);
}

/** At least one true vector under this node — pure-primitive subtrees stay
 * with the shape branch / the plate; only genuinely vector artwork (which
 * shape fields cannot reconstruct) earns the whole-object lift. */
export function subtreeHasVector(node: PredicateNode): boolean {
  if (node.visible === false) return false;
  if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") return true;
  return (node.children ?? []).some(subtreeHasVector);
}

/** The single representable fill of a container (FRAME/COMPONENT/INSTANCE)
 * whose own backdrop can lift as a SHAPE field — a pill, a card, a color
 * block — while its children keep lifting as their own fields. Undefined
 * when the container's paint needs more than a shape field can carry
 * (strokes, effects, multiple fills, image fills). */
export function shapeContainerFill(node: PredicateNode): FigmaPaint | undefined {
  if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "INSTANCE") {
    return undefined;
  }
  if (isRasterLeaf(node)) return undefined;
  if ((node.strokes ?? []).some((s) => s.visible !== false)) return undefined;
  if ((node.effects ?? []).some((e) => e.visible !== false)) return undefined;
  const fills = (node.fills ?? []).filter((f) => f.visible !== false);
  if (fills.length !== 1) return undefined;
  const fill = fills[0];
  if (fill.type === "SOLID" && fill.color) return fill;
  if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops?.length) return fill;
  return undefined;
}

/** A pill: a container whose backdrop is one SOLID fill, whose radius is
 * uniform, and whose ONLY visible child is a single boxed TEXT node. The
 * walk fuses it into ONE plated text field — and liftDescends answers false
 * for it, because the text lives inside that field, not on the background.
 * The two MUST agree, or the text paints twice. Anything richer (two
 * children, icon + text, a gradient backdrop, per-corner radii) keeps the
 * shape-plus-text split. */
export function pillContainer(node: PredicateNode): boolean {
  const fill = shapeContainerFill(node);
  if (!(fill?.type === "SOLID" && fill.color)) return false;
  const r = cornerRadiusOf(node);
  if (r && !(r.tl === r.tr && r.tr === r.br && r.br === r.bl)) return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  return kids.length === 1 && kids[0].type === "TEXT" && Boolean(kids[0].absoluteBoundingBox);
}

/** Any visible image fill anywhere under this node — a photo about to
 * rasterize is the one thing an admin most needs to hear about, because a
 * baked photo can never become member-replaceable. */
export function subtreeHasImageFill(node: PredicateNode): boolean {
  if (node.visible === false) return false;
  if ((node.fills ?? []).some((f) => f.type === "IMAGE" && f.visible !== false)) return true;
  return (node.children ?? []).some(subtreeHasImageFill);
}

/** Whether a LIFTED container's children were walked into their own fields
 * (its own artwork being the bare image fill or a shape field) — versus the
 * whole subtree baking into one render. The field walk and the background
 * decomposition MUST answer this identically, mirroring the walk's branch
 * order: if the walk bakes the children but decompose still emits units for
 * them, every nested element paints twice. */
export function liftDescends(node: PredicateNode): boolean {
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (!kids.length) return false;
  if (isRasterLeaf(node)) return false;
  // Whole-object vector lift: children are inside the render.
  if (isVectorArtwork(node) && subtreeHasVector(node)) return false;
  // Image container whose artwork is the bare fill.
  if (
    (node.fills ?? []).some((f) => f.type === "IMAGE" && f.visible !== false && Boolean(f.imageRef))
  ) {
    return true;
  }
  // A fused pill: the container AND its text are one field — decompose must
  // not emit the child, or the text paints twice.
  if (pillContainer(node)) return false;
  // Container whose backdrop lifted as a shape field.
  return Boolean(shapeContainerFill(node));
}

/** Any visible TEXT anywhere under this node — used to tell the admin when a
 * flattened subtree swallows copy that will never become a field. */
export function subtreeHasText(node: {
  type: string;
  visible?: boolean;
  children?: Array<{ type: string; visible?: boolean; children?: unknown[] }>;
}): boolean {
  if (node.visible === false) return false;
  if (node.type === "TEXT") return true;
  return (node.children ?? []).some((c) =>
    subtreeHasText(c as Parameters<typeof subtreeHasText>[0]),
  );
}

export const ALIGN: Record<string, "left" | "center" | "right"> = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "left",
};

const VERTICAL_ALIGN: Record<string, "top" | "middle" | "bottom"> = {
  TOP: "top",
  CENTER: "middle",
  BOTTOM: "bottom",
};

/** Figma gradient handles (normalized to the box) → the CSS linear-gradient
 * angle convention (0deg points up, clockwise positive). Mirrors the client
 * math in src/lib/figma/overlayFields.ts. */
export function gradientAngleOf(
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

const linearGradientOf = (
  fill: FigmaPaint,
  width: number,
  height: number,
): { angle: number; stops: Array<{ position: number; color: string }> } => ({
  angle: gradientAngleOf(fill.gradientHandlePositions, width, height),
  stops: (fill.gradientStops ?? []).map((s) => ({
    position: s.position,
    color: toCssColor(s.color),
  })),
});

export function slug(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

/** Field placement from the node's geometry. Unrotated nodes keep the exact
 * behavior that shipped (rounded AABB, top-left anchored). A rotated node
 * lands center-anchored at the AABB center with its TRUE size — the AABB is
 * the axis-aligned box around the rotated artwork, wrong on both counts. */
function placementOf(
  node: FigmaNode,
  frame: { x: number; y: number },
): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  anchor?: "topLeft" | "center";
} | null {
  const box = node.absoluteBoundingBox;
  if (!box) return null;
  const { rotation, size } = transformOf(node);
  if (rotation !== undefined && size) {
    return {
      x: Math.round(box.x - frame.x + box.width / 2),
      y: Math.round(box.y - frame.y + box.height / 2),
      width: Math.round(size.x),
      height: Math.round(size.y),
      rotation,
      anchor: "center",
    };
  }
  return {
    x: Math.round(box.x - frame.x),
    y: Math.round(box.y - frame.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

const visibleFills = (node: FigmaNode): FigmaPaint[] =>
  (node.fills ?? []).filter((f) => f.visible !== false);

/** Opacity the field stores when the node, fill, and fill color alphas are
 * folded into one channel (shape fills — colorHex carries no alpha). */
function foldedOpacity(node: FigmaNode, fill?: FigmaPaint): number | undefined {
  const v = (node.opacity ?? 1) * (fill?.opacity ?? 1) * (fill?.color?.a ?? 1);
  return v < 1 ? Math.round(v * 100) : undefined;
}

/** Which shape primitive a node maps to, or undefined when the renderer has
 * no matching primitive (leave it in the plate — the node render is exact). */
function shapeKindOf(node: FigmaNode): "rect" | "ellipse" | "triangle" | "star" | undefined {
  switch (node.type) {
    case "RECTANGLE":
      return "rect";
    case "ELLIPSE": {
      const arc = node.arcData;
      const full =
        !arc ||
        (Math.abs(arc.endingAngle - arc.startingAngle) >= Math.PI * 2 - 0.01 &&
          arc.innerRadius <= 0);
      return full ? "ellipse" : undefined;
    }
    case "LINE":
      return "rect"; // a line is a thin rect (ShapeKind has no "line")
    case "REGULAR_POLYGON":
      return (node.pointCount ?? 3) === 3 ? "triangle" : undefined;
    case "STAR":
      return (node.pointCount ?? 5) === 5 ? "star" : undefined;
    default:
      return undefined;
  }
}

function textCaseContent(
  node: FigmaNode,
  warn: (issue: string, severity?: "info" | "degraded") => void,
): string | undefined {
  const chars = node.characters;
  if (chars === undefined) return undefined;
  switch (node.style?.textCase) {
    case "LOWER":
      return chars.toLowerCase();
    case "TITLE":
      return chars.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
    case "SMALL_CAPS":
    case "SMALL_CAPS_FORCED":
      warn("small caps aren't reproduced — imported as regular case.");
      return chars;
    default:
      return chars;
  }
}

export function walk(
  node: FigmaNode,
  frame: { x: number; y: number; width: number; height: number },
  out: SuggestedField[],
  warnings: ImportWarning[],
  taken: Set<string>,
  seenIds: Set<string>,
): void {
  if (node.visible === false) return;
  const warn = (issue: string, severity: "info" | "degraded" = "degraded") =>
    warnings.push({ layer: node.name, nodeId: node.id, issue, severity });
  if (seenIds.has(node.id)) {
    warn(`duplicate node id ${node.id} (component instance?) — skipped a copy.`, "info");
    return;
  }
  seenIds.add(node.id);
  const place = placementOf(node, frame);

  if (place && node.type === "TEXT") {
    const style = node.style ?? {};
    const box = node.absoluteBoundingBox!;
    const fontSize = style.fontSize ?? 16;
    const lineHeightPx =
      style.lineHeightPx ??
      (style.lineHeightPercentFontSize
        ? (style.lineHeightPercentFontSize / 100) * fontSize
        : fontSize * 1.2);
    // Rotated nodes: box is the axis-aligned bounding box and lies about height.
    // Use the true unrotated size from transformOf (already computed in placementOf's
    // path) when rotation is present.
    const contentHeight = place.rotation !== undefined && node.size ? node.size.y : box.height;
    const lineCount = Math.max(1, Math.round(contentHeight / lineHeightPx));
    const isMultiline = (node.characters ?? "").includes("\n") || lineCount >= 2;
    const fill = visibleFills(node)[0];
    let colorHex: string | undefined;
    let textGradient: SuggestedField["textGradient"];
    if (fill?.type === "SOLID" && fill.color) {
      colorHex = toHex(fill.color);
    } else if (fill?.type === "GRADIENT_LINEAR" && fill.gradientStops?.length) {
      textGradient = linearGradientOf(fill, place.width, place.height);
    } else if (fill?.type === "IMAGE") {
      warn("an image fill on text can't be reproduced — imported with a solid ink.");
    } else if (fill?.type?.startsWith("GRADIENT") && fill.gradientStops?.length) {
      textGradient = linearGradientOf(fill, place.width, place.height);
      warn(`${fill.type} on text approximated as a linear gradient.`, "info");
    }
    if ((node.characterStyleOverrides ?? []).some((v) => v !== 0)) {
      warn("mixed text styling inside this layer was flattened to its base style.");
    }
    if (style.textDecoration && style.textDecoration !== "NONE") {
      warn(`${style.textDecoration.toLowerCase()} text decoration isn't reproduced.`, "info");
    }
    const content = textCaseContent(node, warn);
    out.push({
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: isMultiline ? "multiline" : "text",
      sourceNodeId: node.id,
      ...place,
      fontFamily: style.fontFamily,
      fontPostScriptName: style.fontPostScriptName,
      fontWeight: style.fontWeight,
      fontStyle: style.italic ? "italic" : undefined,
      fontSizePx: style.fontSize,
      colorHex,
      textGradient,
      align: ALIGN[style.textAlignHorizontal ?? ""] ?? "left",
      verticalAlign: VERTICAL_ALIGN[style.textAlignVertical ?? ""],
      uppercase: style.textCase === "UPPER" || undefined,
      letterSpacingPx: style.letterSpacing || undefined,
      // Pixel-authored line height wins; the percent form is what Figma
      // sends only for percent-authored values (and omits on Auto).
      lineHeight:
        style.lineHeightPx && style.fontSize
          ? Math.round((style.lineHeightPx / style.fontSize) * 100) / 100
          : style.lineHeightPercentFontSize
            ? style.lineHeightPercentFontSize / 100
            : undefined,
      placeholder: content?.slice(0, 80),
      // The box and size come from Figma — the designed size IS the size.
      // Shrinking to fit is the admin's opt-in, not the importer's default.
      textSizing: "free",
      // colorHex carries no alpha, so a translucent ink folds its alpha (and
      // the paint's opacity) into the element opacity alongside the node's.
      opacity: fill?.type === "SOLID" ? foldedOpacity(node, fill) : opacityOf(node),
      static: true,
      staticValue: content,
    });
    return;
  }

  const imageFill = visibleFills(node).find((f) => f.type === "IMAGE");
  if (
    place &&
    imageFill &&
    (node.type === "RECTANGLE" || node.type === "FRAME" || node.type === "ELLIPSE")
  ) {
    const field: SuggestedField = {
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: "image",
      sourceNodeId: node.id,
      ...place,
      objectFit: "cover",
      opacity: opacityOf(node),
      cornerRadius: cornerRadiusOf(node),
      static: true,
    };
    out.push(field);
    if ((node.effects ?? []).some((e) => e.visible !== false)) {
      warn("shadows/effects on this image aren't reproduced — the field renders the image alone.");
    }
    // Descend into the container's children so nested content (a headline
    // inside a photo card) lifts as real fields instead of baking into the
    // image's pixels. The field's artwork must then be the bare image FILL —
    // a node render would include the lifted children twice. liftDescends is
    // the shared predicate: decompose skips an excluded container's children
    // exactly when this walk baked them.
    if (liftDescends(node)) {
      // The ref-bearing fill, which may not be the first image fill —
      // liftDescends guarantees one exists.
      field.fillImageRef = visibleFills(node).find(
        (f) => f.type === "IMAGE" && f.imageRef,
      )?.imageRef;
      if (imageFill.scaleMode && imageFill.scaleMode !== "FILL") {
        warn("the image's crop is approximated as a centered cover fit.", "info");
      }
      for (const child of node.children ?? []) walk(child, frame, out, warnings, taken, seenIds);
    }
    return;
  }

  const shape = shapeKindOf(node);
  if (place && shape && !imageFill) {
    const strokes = (node.strokes ?? []).filter((s) => s.visible !== false);
    const effects = (node.effects ?? []).filter((e) => e.visible !== false);
    const base = {
      id: crypto.randomUUID(),
      label: node.name,
      sourceNodeId: node.id,
      static: true as const,
    };
    if (node.type === "LINE") {
      // A LINE's box has zero height; the stroke paints it, centered.
      const stroke = strokes[0];
      if (stroke?.type === "SOLID" && stroke.color && !effects.length) {
        const weight = Math.max(1, Math.round(node.strokeWeight ?? 1));
        out.push({
          ...base,
          fieldKey: slug(node.name, taken),
          type: "shape",
          shape: "rect",
          ...place,
          y: place.anchor === "center" ? place.y : place.y - Math.round(weight / 2),
          height: weight,
          colorHex: toHex(stroke.color),
          opacity: foldedOpacity(node, stroke),
        });
        return;
      }
    } else {
      const fills = visibleFills(node);
      const fill = fills[0];
      // Exactly one visible SOLID stroke lifts WITH the shape as an inner
      // stroke. Figma INSIDE alignment maps directly; CENTER/OUTSIDE grow
      // the box so the painted extent is preserved while the stored stroke
      // stays inside.
      const solidStroke =
        strokes.length === 1 && strokes[0].type === "SOLID" && strokes[0].color
          ? strokes[0]
          : undefined;
      if (
        fills.length === 1 &&
        (!strokes.length || solidStroke) &&
        !effects.length &&
        !isRasterLeaf(node)
      ) {
        let placed = place;
        let strokeProps: { strokeColor?: string; strokeWidthPx?: number } = {};
        if (solidStroke) {
          const weight = Math.max(1, Math.round(node.strokeWeight ?? 1));
          const align = node.strokeAlign ?? "INSIDE";
          const grow =
            align === "OUTSIDE" ? weight : align === "CENTER" ? Math.round(weight / 2) : 0;
          if (grow > 0) {
            placed = {
              ...place,
              // Center-anchored (rotated) boxes grow about their center.
              x: place.anchor === "center" ? place.x : place.x - grow,
              y: place.anchor === "center" ? place.y : place.y - grow,
              width: place.width + grow * 2,
              height: place.height + grow * 2,
            };
            warn(
              `${align.toLowerCase()}-aligned stroke imported as an inside stroke on a box grown ${grow}px per side.`,
              "info",
            );
          }
          if ((solidStroke.color!.a ?? 1) < 1 || (solidStroke.opacity ?? 1) < 1) {
            warn("a translucent stroke imported fully opaque.", "info");
          }
          strokeProps = { strokeColor: toHex(solidStroke.color!), strokeWidthPx: weight };
        }
        if (fill.type === "SOLID" && fill.color) {
          out.push({
            ...base,
            fieldKey: slug(node.name, taken),
            type: "shape",
            shape,
            ...placed,
            colorHex: toHex(fill.color),
            cornerRadius: cornerRadiusOf(node),
            opacity: foldedOpacity(node, fill),
            ...strokeProps,
          });
          return;
        }
        if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops?.length) {
          out.push({
            ...base,
            fieldKey: slug(node.name, taken),
            type: "shape",
            shape,
            ...placed,
            textGradient: linearGradientOf(fill, placed.width, placed.height),
            cornerRadius: cornerRadiusOf(node),
            opacity: foldedOpacity(node, fill),
            ...strokeProps,
          });
          return;
        }
      }
    }
    // Strokes, effects, or exotic fills the field can't represent — leave
    // the node in the plate, where its own render is exact.
  }

  // Pure vector artwork — a logo, an icon group, a decorative mark — is one
  // visual object to a designer. Lift the WHOLE subtree as a single static
  // image (Figma's own render, masks and effects included) so it can be
  // moved, scaled, and layered instead of freezing into the plate.
  if (place && !imageFill && isVectorArtwork(node) && subtreeHasVector(node)) {
    out.push({
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: "image",
      sourceNodeId: node.id,
      ...place,
      objectFit: "cover",
      opacity: opacityOf(node),
      static: true,
    });
    return;
  }

  // A container whose own backdrop is one representable fill — a pill, a
  // card, a color block. The backdrop lifts as a SHAPE field (recolorable,
  // movable) and the children keep lifting as their own fields on top.
  const containerFill = !imageFill && place ? shapeContainerFill(node) : undefined;
  // A pill — solid rounded container holding exactly one text — is ONE
  // object to a designer, so it fuses into ONE plated text field: the text
  // branch's own output wearing the container's box, fill (as the plate),
  // radius, and insets (as the paddings). liftDescends answers false for
  // this pattern, so the background never paints the text a second time.
  if (place && containerFill && pillContainer(node)) {
    const child = (node.children ?? []).filter((c) => c.visible !== false)[0];
    const inner: SuggestedField[] = [];
    walk(child, frame, inner, warnings, taken, seenIds);
    const t = inner[0];
    if (t && (t.type === "text" || t.type === "multiline")) {
      const box = node.absoluteBoundingBox!;
      const childBox = child.absoluteBoundingBox!;
      if (
        (containerFill.color!.a ?? 1) < 1 ||
        (containerFill.opacity ?? 1) < 1 ||
        (node.opacity ?? 1) < 1
      ) {
        warn("a translucent pill background imported fully opaque.", "info");
      }
      out.push({
        ...t,
        label: node.name,
        sourceNodeId: node.id,
        x: place.x,
        y: place.y,
        width: place.width,
        height: place.height,
        rotation: place.rotation,
        anchor: place.anchor,
        // The plate shrink-wraps the text and the box places the plate: the
        // container's own centering is what these reproduce.
        align: "center",
        verticalAlign: undefined,
        plateColor: toHex(containerFill.color!),
        platePaddingX: Math.max(0, Math.round(childBox.x - box.x)),
        platePaddingY: Math.max(0, Math.round(childBox.y - box.y)),
        // An UNSET radius on a plated field renders the pill default, so a
        // square container must store explicit zeros to stay square.
        cornerRadius: cornerRadiusOf(node) ?? { tl: 0, tr: 0, br: 0, bl: 0 },
      });
      return;
    }
    // pillContainer guarantees the text branch produced a field; nothing to
    // do here but fall through defensively (the child is already consumed).
  }
  if (place && containerFill) {
    const common = {
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: "shape" as const,
      shape: "rect" as const,
      sourceNodeId: node.id,
      ...place,
      cornerRadius: cornerRadiusOf(node),
      static: true as const,
    };
    if (containerFill.type === "SOLID" && containerFill.color) {
      out.push({
        ...common,
        colorHex: toHex(containerFill.color),
        opacity: foldedOpacity(node, containerFill),
      });
    } else {
      out.push({
        ...common,
        textGradient: linearGradientOf(containerFill, place.width, place.height),
        opacity: foldedOpacity(node, containerFill),
      });
    }
    for (const child of node.children ?? []) walk(child, frame, out, warnings, taken, seenIds);
    return;
  }

  // The classic photo-in-a-shape pattern: a GROUP/FRAME whose first visible
  // child is the mask and the rest carry the photo(s), no text anywhere.
  // When the mask is a plain/rounded RECTANGLE whose OUTLINE does the
  // clipping, ONE image field reproduces it exactly — geometry and radius
  // from the mask, artwork from the group's own render (masks applied, so
  // the crop is exact; liftDescends is false via isRasterLeaf, so decompose
  // skips the whole subtree and nothing paints twice). An alpha-image mask
  // or a custom path can't be faked with a radius: it keeps today's bake,
  // and the degraded warning below names it.
  if (place && (node.type === "GROUP" || node.type === "FRAME")) {
    const kids = (node.children ?? []).filter((c) => c.visible !== false);
    const mask = kids[0];
    const rest = kids.slice(1);
    if (
      mask?.isMask &&
      rest.length > 0 &&
      !subtreeHasText(node) &&
      rest.every((c) => visibleFills(c).some((f) => f.type === "IMAGE"))
    ) {
      // Absent maskType, an image-filled mask is treated as ALPHA (the fill's
      // alpha is what such a layer masks with) and anything else as the
      // OUTLINE default.
      const maskType =
        mask.maskType ?? (visibleFills(mask).some((f) => f.type === "IMAGE") ? "ALPHA" : "VECTOR");
      if (mask.type === "RECTANGLE" && maskType !== "ALPHA" && maskType !== "LUMINANCE") {
        const maskPlace = placementOf(mask, frame);
        if (maskPlace) {
          out.push({
            id: crypto.randomUUID(),
            label: node.name,
            fieldKey: slug(node.name, taken),
            type: "image",
            sourceNodeId: node.id,
            ...maskPlace,
            objectFit: "cover",
            cornerRadius: cornerRadiusOf(mask),
            opacity: opacityOf(node),
            static: true,
          });
          return;
        }
      }
    }
  }

  // A raster leaf's artwork can't be reconstructed from properties — its
  // whole subtree ships as one render in the plate, so nothing inside it
  // may lift (a lifted child would paint twice). Text swallowed this way
  // silently disappearing from the field list reads as a broken import, so
  // say where it went — and a swallowed PHOTO is worse: baked, it can never
  // become member-replaceable, so that bake is never silent.
  if (isRasterLeaf(node)) {
    if (subtreeHasText(node)) {
      warn("text inside this flattened group ships as artwork — it can't become a field.", "info");
    }
    if (subtreeHasImageFill(node)) {
      warn(
        (node.children ?? []).some((c) => c.isMask)
          ? "this masked image is baked into the background; members can't replace it."
          : "an image inside this flattened layer is baked into the background; members can't replace it.",
      );
    }
    return;
  }
  // An image fill the walk could not lift (an exotic node type — the
  // rect/frame/ellipse branch above catches the liftable ones) bakes into
  // the plate. Never silently: a baked photo can't become a member field.
  if (imageFill) {
    warn("an image fill on this layer is baked into the background; members can't replace it.");
  }
  for (const child of node.children ?? []) walk(child, frame, out, warnings, taken, seenIds);
}

// ---------------------------------------------------------------------------
// Common extractor output — every source produces this shape.
// ---------------------------------------------------------------------------

export interface ExtractedElement {
  sourceId: string; // Figma node id or Canva locator_id
  kind: "text" | "image" | "shape";
  /** Source layer name — the label a synthesized Fixed field lands with. */
  label?: string;
  /** Shape elements: which primitive, plus the styling a shape field needs
   * to reconstruct the artwork exactly (Figma path only — Canva shapes stay
   * baked in the flat export). */
  shape?: "rect" | "ellipse" | "triangle" | "star";
  cornerRadius?: { tl: number; tr: number; br: number; bl: number };
  textGradient?: { angle: number; stops: Array<{ position: number; color: string }> };
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** Rotated elements are center-anchored (x/y are the box center — the
   * rotation origin); dropping this renders them offset by half their size. */
  anchor?: "topLeft" | "center";
  opacity?: number;
  text?: string; // source content, for Claude's context
  fontFamily?: string; // Figma only — Canva has no family name
  fontWeight?: number;
  fontSizePx?: number;
  colorHex?: string;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  /** Source-declared intent. Canva sets these from `locked` and `replaceable`;
   *  Figma leaves them undefined. */
  sourceLocked?: boolean;
  sourceReplaceable?: boolean;
}

export interface ExtractionResult {
  backgroundUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: ExtractedElement[];
  sourceUrl?: string; // enables the layered recompose
  warnings: string[];
}

/** Map the Figma walk's SuggestedField[] onto the common element shape. The
 * suggested field IS the extraction on this path — geometry and typography
 * come straight from the node tree, and `placeholder` carries the source
 * text the model needs for judgment. */
export function figmaFieldsToElements(fields: SuggestedField[]): ExtractedElement[] {
  return fields.map((f) => ({
    sourceId: f.sourceNodeId,
    kind:
      f.type === "image"
        ? ("image" as const)
        : f.type === "shape"
          ? ("shape" as const)
          : ("text" as const),
    label: f.label,
    shape: f.shape,
    cornerRadius: f.cornerRadius,
    textGradient: f.textGradient,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    rotation: f.rotation,
    anchor: f.anchor,
    opacity: f.opacity,
    text: f.placeholder,
    fontFamily: f.fontFamily,
    fontWeight: f.fontWeight,
    fontSizePx: f.fontSizePx,
    colorHex: f.colorHex,
    align: f.align,
    uppercase: f.uppercase,
    letterSpacingPx: f.letterSpacingPx,
    lineHeight: f.lineHeight,
  }));
}
