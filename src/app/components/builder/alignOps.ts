// Align and distribute, as pure geometry. Nothing here knows about fields,
// groups, or the draft — callers hand in boxes and get back a per-box delta
// on ONE axis, which they apply through the same patch path a move uses.
//
// Keeping it pure is the point: alignment is the kind of arithmetic that
// looks obviously right and is off by half a width, so it is tested directly.

export type Axis = "h" | "v";
/** Which edge of the reference bounds the boxes line up on. */
export type AlignEdge = "start" | "center" | "end";

export interface AlignBox {
  /** Caller's handle for this box — a field id, a group ref, anything. */
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Span {
  key: string;
  lo: number;
  size: number;
}

const spanOf = (b: AlignBox, axis: Axis): Span =>
  axis === "h" ? { key: b.key, lo: b.x, size: b.width } : { key: b.key, lo: b.y, size: b.height };

/** The bounding box of a set, or null when the set is empty. */
export function boundsOf(boxes: AlignBox[]): AlignBox | null {
  if (!boxes.length) return null;
  const l = Math.min(...boxes.map((b) => b.x));
  const t = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width));
  const bm = Math.max(...boxes.map((b) => b.y + b.height));
  return { key: "bounds", x: l, y: t, width: r - l, height: bm - t };
}

/** Deltas that line every box up on one edge of `bounds`. `bounds` is the
 * selection's own bounding box for a multi-selection and the canvas for a
 * single one — the arithmetic is identical either way, which is why there is
 * one function and not two. Boxes already in place get no entry. */
export function alignDeltas(
  boxes: AlignBox[],
  axis: Axis,
  edge: AlignEdge,
  bounds: { x: number; y: number; width: number; height: number },
): Map<string, number> {
  const boundLo = axis === "h" ? bounds.x : bounds.y;
  const boundSize = axis === "h" ? bounds.width : bounds.height;
  const out = new Map<string, number>();
  for (const b of boxes) {
    const s = spanOf(b, axis);
    const target =
      edge === "start"
        ? boundLo
        : edge === "center"
          ? boundLo + (boundSize - s.size) / 2
          : boundLo + boundSize - s.size;
    const delta = target - s.lo;
    if (delta !== 0) out.set(s.key, delta);
  }
  return out;
}

/** Deltas that put an EQUAL GAP between consecutive boxes along `axis`.
 * Spacing, not centres: three boxes of different widths end up evenly
 * spaced apart, which is what the eye reads as distributed. The outermost
 * two never move — they define the span everything else divides up.
 *
 * Fewer than three boxes has no meaning (there is only one gap, and it is
 * already equal to itself), so it returns nothing. */
export function distributeDeltas(boxes: AlignBox[], axis: Axis): Map<string, number> {
  const out = new Map<string, number>();
  if (boxes.length < 3) return out;
  const spans = boxes.map((b) => spanOf(b, axis)).sort((a, b) => a.lo - b.lo || a.size - b.size);
  const first = spans[0];
  const last = spans[spans.length - 1];
  const span = last.lo + last.size - first.lo;
  const used = spans.reduce((sum, s) => sum + s.size, 0);
  // A negative gap is legitimate: boxes that already overlap stay overlapped,
  // evenly. Clamping here would silently move the outer two.
  const gap = (span - used) / (spans.length - 1);
  let cursor = first.lo;
  for (const s of spans) {
    const delta = cursor - s.lo;
    if (delta !== 0) out.set(s.key, delta);
    cursor += s.size + gap;
  }
  return out;
}
