import type { FieldVector, VectorPath } from "../types";

/** One element of a Lucide icon, as each icon module's `__iconNode` lists
 * them: a 24-unit line drawing made of these SVG elements. */
export type LucideElement = [tag: string, attrs: Record<string, string>];

/** Lucide draws on a 24 viewBox with a 2-unit line. */
export const LUCIDE_VIEWBOX = 24;
export const DEFAULT_ICON_WEIGHT = 2;
export const MIN_ICON_WEIGHT = 0.5;
export const MAX_ICON_WEIGHT = 4;

const n = (v: string | undefined, fallback = 0) => {
  const x = Number.parseFloat(v ?? "");
  return Number.isFinite(x) ? x : fallback;
};
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  // Two half arcs: an SVG arc can't draw a full turn in one command.
  return (
    `M${fmt(cx - rx)} ${fmt(cy)}` +
    `a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(rx * 2)} 0` +
    `a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-rx * 2)} 0z`
  );
}

function rectPath(x: number, y: number, w: number, h: number, rxIn: number, ryIn: number): string {
  const rx = Math.min(rxIn, w / 2);
  const ry = Math.min(ryIn, h / 2);
  if (rx <= 0 || ry <= 0) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
  const arc = (dx: number, dy: number) => `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(dx)} ${fmt(dy)}`;
  return (
    `M${fmt(x + rx)} ${fmt(y)}h${fmt(w - rx * 2)}${arc(rx, ry)}` +
    `v${fmt(h - ry * 2)}${arc(-rx, ry)}` +
    `h${fmt(-(w - rx * 2))}${arc(-rx, -ry)}` +
    `v${fmt(-(h - ry * 2))}${arc(rx, -ry)}z`
  );
}

function pointsPath(points: string, close: boolean): string | null {
  const nums = points
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((v) => Number.isFinite(v));
  if (nums.length < 4) return null;
  let d = `M${fmt(nums[0])} ${fmt(nums[1])}`;
  for (let i = 2; i + 1 < nums.length; i += 2) d += `L${fmt(nums[i])} ${fmt(nums[i + 1])}`;
  return close ? `${d}z` : d;
}

/** One Lucide element as path data, or null for an element it can't read. */
export function elementToPath([tag, a]: LucideElement): string | null {
  switch (tag) {
    case "path":
      return a.d?.trim() || null;
    case "circle":
      return ellipsePath(n(a.cx), n(a.cy), n(a.r), n(a.r));
    case "ellipse":
      return ellipsePath(n(a.cx), n(a.cy), n(a.rx), n(a.ry));
    case "rect": {
      const rx = n(a.rx, n(a.ry));
      return rectPath(n(a.x), n(a.y), n(a.width), n(a.height), rx, n(a.ry, rx));
    }
    case "line":
      return `M${fmt(n(a.x1))} ${fmt(n(a.y1))}L${fmt(n(a.x2))} ${fmt(n(a.y2))}`;
    case "polyline":
      return pointsPath(a.points ?? "", false);
    case "polygon":
      return pointsPath(a.points ?? "", true);
    default:
      return null;
  }
}

/** A Lucide icon as an icon field's vector: every element becomes a line
 * path, with round caps and joins as Lucide draws them. An element Lucide
 * fills as well (a solid dot) also gets a fill path. */
export function iconNodeToVector(
  name: string,
  node: readonly LucideElement[],
  weight = DEFAULT_ICON_WEIGHT,
): FieldVector {
  const paths: VectorPath[] = [];
  for (const el of node) {
    const d = elementToPath(el);
    if (!d) continue;
    if (el[1].fill && el[1].fill !== "none") paths.push({ d });
    paths.push({ d, paint: "stroke" });
  }
  return {
    viewBox: [0, 0, LUCIDE_VIEWBOX, LUCIDE_VIEWBOX],
    paths,
    stroke: { width: clampWeight(weight), cap: "round", join: "round" },
    source: { set: "lucide", name },
  };
}

export const clampWeight = (w: number): number =>
  Math.min(MAX_ICON_WEIGHT, Math.max(MIN_ICON_WEIGHT, Number.isFinite(w) ? w : 2));

/** The vector with a new line weight. */
export const withWeight = (vector: FieldVector, weight: number): FieldVector => ({
  ...vector,
  stroke: { ...(vector.stroke ?? {}), width: clampWeight(weight) },
});

/** "arrow-up-right" reads as "Arrow up right". */
export const iconTitle = (name: string): string => {
  const words = name.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Names matching a search, best first: the exact name, names that start
 * with the query, names with a word that does, then any part. */
export function searchIconNames(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  if (!q) return [...names];
  const exact: string[] = [];
  const starts: string[] = [];
  const word: string[] = [];
  const part: string[] = [];
  for (const name of names) {
    if (name === q) exact.push(name);
    else if (name.startsWith(q)) starts.push(name);
    else if (name.includes(`-${q}`)) word.push(name);
    else if (name.includes(q)) part.push(name);
  }
  return [...exact, ...starts, ...word, ...part];
}
