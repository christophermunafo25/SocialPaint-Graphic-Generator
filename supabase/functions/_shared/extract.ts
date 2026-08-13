// Shared design extraction. Runs in Deno (Supabase Edge).
//
// Every import source (Figma today, Canva behind its flag) reduces to the
// same two questions: what does the frame look like (a background PNG), and
// what elements are on it (exact geometry + typography). ExtractionResult is
// that common shape; the auto-build engine consumes it without knowing which
// source produced it.
//
// The FigmaNode walk below is moved VERBATIM from figma-import/index.ts —
// behavior must stay byte-for-byte identical for the plain import path.

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
  style?: {
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    textAlignHorizontal?: string;
    textCase?: string;
    letterSpacing?: number;
    lineHeightPercentFontSize?: number;
  };
  fills?: Array<{
    type: string;
    visible?: boolean;
    color?: { r: number; g: number; b: number; a?: number };
  }>;
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

export interface SuggestedField {
  id: string;
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image";
  sourceNodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontWeight?: number;
  fontSizePx?: number;
  colorHex?: string;
  align?: "left" | "center" | "right";
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
}

/** A node's rounded corners in the field shape, or undefined when square. */
export function cornerRadiusOf(
  node: FigmaNode,
): { tl: number; tr: number; br: number; bl: number } | undefined {
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
  node.opacity !== undefined && node.opacity < 1
    ? Math.round(node.opacity * 100)
    : undefined;

export const ALIGN: Record<string, "left" | "center" | "right"> = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "left",
};

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

export function walk(
  node: FigmaNode,
  frame: { x: number; y: number; width: number; height: number },
  out: SuggestedField[],
  warnings: string[],
  taken: Set<string>,
  seenIds: Set<string>,
): void {
  if (node.visible === false) return;
  if (seenIds.has(node.id)) {
    warnings.push(`Duplicate node id ${node.id} (component instance?) — skipped a copy.`);
    return;
  }
  seenIds.add(node.id);
  const box = node.absoluteBoundingBox;

  if (box && node.type === "TEXT") {
    const isMultiline =
      (node.characters ?? "").includes("\n") || box.height > (node.style?.fontSize ?? 16) * 2.2;
    const solidFill = node.fills?.find((f) => f.type === "SOLID" && f.visible !== false && f.color);
    out.push({
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: isMultiline ? "multiline" : "text",
      sourceNodeId: node.id,
      x: Math.round(box.x - frame.x),
      y: Math.round(box.y - frame.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      fontFamily: node.style?.fontFamily,
      fontWeight: node.style?.fontWeight,
      fontSizePx: node.style?.fontSize,
      colorHex: solidFill?.color ? toHex(solidFill.color) : undefined,
      align: ALIGN[node.style?.textAlignHorizontal ?? ""] ?? "left",
      uppercase: node.style?.textCase === "UPPER" || undefined,
      letterSpacingPx: node.style?.letterSpacing || undefined,
      lineHeight: node.style?.lineHeightPercentFontSize
        ? node.style.lineHeightPercentFontSize / 100
        : undefined,
      placeholder: node.characters?.slice(0, 80),
      textSizing: "shrink",
      opacity: opacityOf(node),
    });
    return;
  }

  const hasImageFill = node.fills?.some((f) => f.type === "IMAGE" && f.visible !== false) ?? false;
  if (
    box &&
    hasImageFill &&
    (node.type === "RECTANGLE" || node.type === "FRAME" || node.type === "ELLIPSE")
  ) {
    out.push({
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: "image",
      sourceNodeId: node.id,
      x: Math.round(box.x - frame.x),
      y: Math.round(box.y - frame.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      objectFit: "cover",
      opacity: opacityOf(node),
      cornerRadius: cornerRadiusOf(node),
    });
    if ((node.effects ?? []).some((e) => e.visible !== false)) {
      warnings.push(
        `"${node.name}": shadows/effects on this image aren't reproduced — the field renders the image alone.`,
      );
    }
    return;
  }

  for (const child of node.children ?? []) walk(child, frame, out, warnings, taken, seenIds);
}

// ---------------------------------------------------------------------------
// Common extractor output — every source produces this shape.
// ---------------------------------------------------------------------------

export interface ExtractedElement {
  sourceId: string; // Figma node id or Canva locator_id
  kind: "text" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
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
    kind: f.type === "image" ? ("image" as const) : ("text" as const),
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
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
