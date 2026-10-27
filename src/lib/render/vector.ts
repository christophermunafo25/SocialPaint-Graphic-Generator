import type { FieldVector, VectorPath } from "../types";

/** The SVG path grammar's alphabet: commands, numbers, separators. Anything
 * else (a quote, an angle bracket, a url) never reaches the DOM. */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;
/** Generous for a logo, small enough that a bad row can't stall a render. */
const MAX_PATH_CHARS = 200_000;
const MAX_PATHS = 500;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readPath(raw: unknown): VectorPath | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.d !== "string") return null;
  const d = p.d.trim();
  if (!d || d.length > MAX_PATH_CHARS || !PATH_DATA.test(d)) return null;
  const out: VectorPath = { d };
  if (p.paint === "fill" || p.paint === "stroke") out.paint = p.paint;
  if (p.fillRule === "nonzero" || p.fillRule === "evenodd") out.fillRule = p.fillRule;
  if (typeof p.colorHex === "string" && HEX6.test(p.colorHex)) out.colorHex = p.colorHex;
  return out;
}

/** An icon field's vector as the renderer may draw it, or null when there is
 * nothing drawable. Read defensively, like effects: a malformed path is
 * skipped, and path data outside the path grammar is never drawn. */
export function readVector(raw: unknown): FieldVector | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const box = v.viewBox;
  if (!Array.isArray(box) || box.length !== 4 || !box.every(finite)) return null;
  const [minX, minY, w, h] = box as number[];
  if (w <= 0 || h <= 0) return null;
  if (!Array.isArray(v.paths)) return null;
  const paths: VectorPath[] = [];
  for (const item of v.paths.slice(0, MAX_PATHS)) {
    const path = readPath(item);
    if (path) paths.push(path);
  }
  if (!paths.length) return null;
  const out: FieldVector = { viewBox: [minX, minY, w, h], paths };
  const s = v.stroke as Record<string, unknown> | undefined;
  if (s && typeof s === "object" && finite(s.width) && s.width > 0) {
    out.stroke = { width: s.width };
    if (s.cap === "butt" || s.cap === "round" || s.cap === "square") out.stroke.cap = s.cap;
    if (s.join === "miter" || s.join === "round" || s.join === "bevel") out.stroke.join = s.join;
  }
  const src = v.source as Record<string, unknown> | undefined;
  if (src && src.set === "lucide" && typeof src.name === "string") {
    out.source = { set: "lucide", name: src.name };
  }
  return out;
}

/** True when any path is drawn as a line, so the icon has a weight. */
export const hasStrokePaths = (vector: FieldVector): boolean =>
  vector.paths.some((p) => p.paint === "stroke");
