// Figma vector artwork as an icon field's vector (brand-system Phase 4).
// The walk lifts a pure vector subtree (a logo, an icon, a button made of
// shapes) as ONE object. Fetched with geometry=paths, every node in it
// carries its fill and stroke outlines as SVG path data in its own space, so
// the whole subtree can be rebuilt as recolorable paths instead of a raster
// render: each path moved into the artwork root's space, painted with its
// node's colour. Anything a path list can't hold exactly (masks, clipping,
// inner opacity, translucent or image paints, blend modes, more than one
// gradient) returns null, and the walk keeps today's raster lift.

import type { FigmaNode, FigmaPaint, ImportedGradient } from "./extract.ts";
import { gradientOf, toHex } from "./extract.ts";

/** The vector an icon field stores (mirrors FieldVector in src/lib/types.ts,
 * which Edge code can't import). */
export interface ImportedVector {
  viewBox: [number, number, number, number];
  paths: Array<{ d: string; fillRule?: "evenodd"; colorHex?: string }>;
}

export interface VectorArtwork {
  vector: ImportedVector;
  /** The artwork's one colour, when it has one: the field's colour, so a
   * colourway can recolour it. Multi-colour art carries colours per path. */
  colorHex?: string;
  /** The artwork's one gradient, painted across every path. */
  textGradient?: ImportedGradient;
}

/** Matches readVector's caps in src/lib/render/vector.ts: past them the
 * renderer would drop paths, so such art stays a raster. */
const MAX_TOTAL_CHARS = 500_000;
const MAX_PATHS = 500;

type Matrix = [number, number, number, number, number, number]; // a b c d e f
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Figma's relativeTransform rows [a, c, e] / [b, d, f] as a matrix. */
const matrixOf = (m: number[][] | undefined): Matrix =>
  m ? [m[0][0], m[1][0], m[0][1], m[1][1], m[0][2], m[1][2]] : IDENTITY;

const multiply = (p: Matrix, q: Matrix): Matrix => [
  p[0] * q[0] + p[2] * q[1],
  p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3],
  p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4],
  p[1] * q[4] + p[3] * q[5] + p[5],
];

const fmt = (v: number): string => {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
};

const COMMAND = /[MmLlHhVvCcQqZz]/;
const TOKEN = /[MmLlHhVvCcQqZzAaSsTt]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/** SVG path data moved by an affine matrix, every command written absolute.
 * Handles the commands Figma emits (M L H V C Q Z, absolute or relative);
 * anything else (arcs, smooth curves) returns null. */
export function transformPath(d: string, m: Matrix): string | null {
  const tokens = d.match(TOKEN);
  if (!tokens?.length) return null;
  const at = (x: number, y: number) =>
    `${fmt(m[0] * x + m[2] * y + m[4])} ${fmt(m[1] * x + m[3] * y + m[5])}`;
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const out: string[] = [];
  const num = (): number | null => {
    const t = tokens[i];
    if (t === undefined || COMMAND.test(t) || /[AaSsTt]/.test(t)) return null;
    i++;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[AaSsTt]/.test(t)) return null;
    if (COMMAND.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        out.push("Z");
        x = sx;
        y = sy;
        continue;
      }
    } else if (!cmd || cmd === "Z" || cmd === "z") {
      return null;
    }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M":
      case "L": {
        const px = num();
        const py = num();
        if (px === null || py === null) return null;
        x = ox + px;
        y = oy + py;
        if (cmd.toUpperCase() === "M") {
          sx = x;
          sy = y;
          out.push(`M${at(x, y)}`);
          // Further pairs after a moveto are linetos.
          cmd = rel ? "l" : "L";
        } else {
          out.push(`L${at(x, y)}`);
        }
        break;
      }
      case "H": {
        const px = num();
        if (px === null) return null;
        x = ox + px;
        out.push(`L${at(x, y)}`);
        break;
      }
      case "V": {
        const py = num();
        if (py === null) return null;
        y = oy + py;
        out.push(`L${at(x, y)}`);
        break;
      }
      case "C": {
        const v = [num(), num(), num(), num(), num(), num()];
        if (v.some((n) => n === null)) return null;
        const [x1, y1, x2, y2, x3, y3] = v as number[];
        out.push(`C${at(ox + x1, oy + y1)} ${at(ox + x2, oy + y2)} ${at(ox + x3, oy + y3)}`);
        x = ox + x3;
        y = oy + y3;
        break;
      }
      case "Q": {
        const v = [num(), num(), num(), num()];
        if (v.some((n) => n === null)) return null;
        const [x1, y1, x2, y2] = v as number[];
        out.push(`Q${at(ox + x1, oy + y1)} ${at(ox + x2, oy + y2)}`);
        x = ox + x2;
        y = oy + y2;
        break;
      }
      default:
        return null;
    }
  }
  return out.join("");
}

const visible = <T extends { visible?: boolean }>(xs: T[] | undefined): T[] =>
  (xs ?? []).filter((x) => x.visible !== false);

/** Blend modes a path list paints the same as Figma. */
const plainBlend = (p: { blendMode?: string }) =>
  !p.blendMode || p.blendMode === "NORMAL" || p.blendMode === "PASS_THROUGH";

type Paint =
  { kind: "solid"; hex: string } | { kind: "gradient"; paint: FigmaPaint; node: FigmaNode };

/** One paint as a path colour, or null when a path can't carry it exactly. */
function paintOf(p: FigmaPaint & { blendMode?: string }, node: FigmaNode): Paint | null {
  if (!plainBlend(p) || (p.opacity ?? 1) < 1) return null;
  if (p.type === "SOLID" && p.color) {
    return (p.color.a ?? 1) < 1 ? null : { kind: "solid", hex: toHex(p.color) };
  }
  if (p.type === "GRADIENT_LINEAR" || p.type === "GRADIENT_RADIAL") {
    return { kind: "gradient", paint: p, node };
  }
  return null;
}

/** True when nothing under a clipping container paints past its box, so
 * dropping the clip changes nothing. */
function clipIsNoop(node: FigmaNode): boolean {
  const box = node.absoluteBoundingBox;
  if (!box) return false;
  const within = (n: FigmaNode): boolean => {
    if (n.visible === false) return true;
    const r =
      (n as { absoluteRenderBounds?: FigmaNode["absoluteBoundingBox"] | null })
        .absoluteRenderBounds ?? n.absoluteBoundingBox;
    if (
      r &&
      (r.x < box.x - 0.5 ||
        r.y < box.y - 0.5 ||
        r.x + r.width > box.x + box.width + 0.5 ||
        r.y + r.height > box.y + box.height + 0.5)
    ) {
      return false;
    }
    return (n.children ?? []).every(within);
  };
  return (node.children ?? []).every(within);
}

/** The artwork under `root` as one vector, or null when a path list can't
 * reproduce it exactly. The root's own opacity and effects stay with the
 * field; everything inside must paint plainly. */
export function vectorOf(root: FigmaNode): VectorArtwork | null {
  const width = root.size?.x ?? root.absoluteBoundingBox?.width;
  const height = root.size?.y ?? root.absoluteBoundingBox?.height;
  if (!width || !height) return null;

  const pieces: Array<{ d: string; fillRule?: "evenodd"; paint: Paint }> = [];
  let total = 0;

  const visit = (node: FigmaNode, m: Matrix, isRoot: boolean): boolean => {
    if (node.visible === false) return true;
    if (node.isMask) return false;
    if (node.type === "TEXT") return false;
    if (!isRoot) {
      if ((node.opacity ?? 1) < 1) return false;
      if (visible(node.effects).length) return false;
    }
    if (!plainBlend(node as { blendMode?: string })) return false;
    if (node.clipsContent && node.children?.length && !clipIsNoop(node)) return false;

    const fills = visible(node.fills);
    const strokes = visible(node.strokes);
    if (fills.length > 1 || strokes.length > 1) return false;
    const add = (
      geometry: Array<{ path?: string; windingRule?: string }> | undefined,
      paint: FigmaPaint | undefined,
    ): boolean => {
      if (!paint) return true;
      const p = paintOf(paint, node);
      if (!p) return false;
      if (!geometry?.length) return false;
      for (const g of geometry) {
        if (!g.path) continue;
        const d = transformPath(g.path, m);
        if (!d) return false;
        total += d.length;
        if (total > MAX_TOTAL_CHARS || pieces.length >= MAX_PATHS) return false;
        pieces.push({
          d,
          ...(g.windingRule === "EVENODD" ? { fillRule: "evenodd" } : {}),
          paint: p,
        });
      }
      return true;
    };
    const geo = node as FigmaNode & {
      strokeGeometry?: Array<{ path?: string; windingRule?: string }>;
    };
    if (!add(node.fillGeometry, fills[0])) return false;
    if (strokes.length && (node.strokeWeight ?? 1) > 0 && !add(geo.strokeGeometry, strokes[0])) {
      return false;
    }
    // A boolean operation's own geometry is its result; its children are
    // only operands.
    if (node.type === "BOOLEAN_OPERATION") return true;
    for (const child of node.children ?? []) {
      if (!visit(child, multiply(m, matrixOf(child.relativeTransform)), false)) return false;
    }
    return true;
  };

  if (!visit(root, IDENTITY, true) || !pieces.length) return null;

  const gradients = pieces.filter((p) => p.paint.kind === "gradient");
  const solids = new Set(pieces.flatMap((p) => (p.paint.kind === "solid" ? [p.paint.hex] : [])));
  const viewBox: [number, number, number, number] = [0, 0, width, height];
  const bare = pieces.map(({ d, fillRule }) => ({ d, ...(fillRule ? { fillRule } : {}) }));

  if (gradients.length) {
    // One gradient painted across the whole art: the root's own paint on
    // every gradient path, mapped onto the field's box. Anything mixed
    // stays raster.
    const paints = gradients.map((g) => g.paint as Extract<Paint, { kind: "gradient" }>);
    const first = paints[0];
    if (solids.size || first.node !== root || paints.some((p) => p.paint !== first.paint)) {
      return null;
    }
    const textGradient = gradientOf(first.paint, width, height, () => undefined);
    return textGradient ? { vector: { viewBox, paths: bare }, textGradient } : null;
  }
  if (solids.size === 1) {
    return { vector: { viewBox, paths: bare }, colorHex: [...solids][0] };
  }
  return {
    vector: {
      viewBox,
      paths: pieces.map(({ d, fillRule, paint }) => ({
        d,
        ...(fillRule ? { fillRule } : {}),
        colorHex: (paint as Extract<Paint, { kind: "solid" }>).hex,
      })),
    },
  };
}
