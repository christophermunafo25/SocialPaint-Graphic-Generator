// Text fitting: ONE measurement path and ONE wrapping implementation for
// every surface (builder canvas, member preview, PNG export). Sizing is
// always MEASURED against real glyphs via a canvas context — the old
// character-count estimate (`width * 2 / (len * 0.58)`) is gone.
//
// Three modes, named for what the member sees happen:
//  - "free":   the font size is fixed; the box grows taller as lines wrap.
//  - "shrink": the box is fixed; the font size decreases until content fits.
//    The set size is a CEILING — text never grows, so a short entry leaves
//    the rest of the box empty. Both axes constrain: a line that fits the
//    width but not the height still shrinks.
//  - "fill":   the box is fixed and the text is sized to FILL it — growing
//    as well as shrinking, so the block is as large as both axes allow.
//    The set size is ignored (the box decides); minFontSizePx still floors
//    it, and the result is reported back to the inspector as computed.

export type TextSizingMode = "free" | "shrink" | "fill";

/** Ceiling for "fill": text can never need to be taller than the box it is
 * filling, and this keeps the search bounded when a box is enormous. */
const FILL_MAX_FONT_SIZE = 800;

/** Style subset measurement needs. Structural — ResolvedFieldStyle
 * satisfies it, so callers can spread a resolved style straight in. */
export interface MeasuredTextStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  fontStretch?: string;
  letterSpacingPx?: number;
  uppercase?: boolean;
  lineHeight?: number;
}

/** Legacy default max, from the reference generator's clamp ceiling. */
export const DEFAULT_FONT_SIZE = 45;
/** The one shrink floor default — the value the inspector advertises. */
export const DEFAULT_MIN_FONT_SIZE = 18;
export const DEFAULT_LINE_HEIGHT = 1.1;

/** Compose the canvas `font` shorthand.
 *
 * Two things silently break the WHOLE shorthand, which reverts measurement to
 * the default face and throws off every fit calculation:
 *
 *  - a font-stretch PERCENTAGE. `italic 700 125% 45px X` is rejected outright
 *    and the context keeps its previous font. Only keywords are legal here,
 *    which is why the app stores keywords rather than the percentages css2
 *    hands back in its @font-face descriptors.
 *  - anything appearing after the size. Style, weight and stretch are an
 *    order-independent set in the CSS grammar, but all of them must precede
 *    the size, and the family comes last.
 *
 * Reading `ctx.font` back is not a check: canvas accepts the stretch keyword
 * and measures with it, but drops it from the serialized value. Only a width
 * measurement proves it took. */
export function canvasFontShorthand(input: {
  fontStyle?: string;
  fontWeight?: number;
  fontStretch?: string;
  fontSizePx: number;
  fontFamily?: string;
}): string {
  const family = input.fontFamily ? `"${input.fontFamily}", sans-serif` : "sans-serif";
  return [
    input.fontStyle === "italic" ? "italic" : "",
    input.fontWeight ?? 400,
    // "normal" is the default and adds nothing; a percentage would poison it.
    isStretchKeyword(input.fontStretch) && input.fontStretch !== "normal" ? input.fontStretch : "",
    `${input.fontSizePx}px`,
    family,
  ]
    .filter((part) => part !== "")
    .join(" ");
}

const STRETCH_KEYWORDS = new Set([
  "ultra-condensed",
  "extra-condensed",
  "condensed",
  "semi-condensed",
  "normal",
  "semi-expanded",
  "expanded",
  "extra-expanded",
  "ultra-expanded",
]);

const isStretchKeyword = (v: string | undefined): v is string =>
  v !== undefined && STRETCH_KEYWORDS.has(v);

/** Width in px of one line of glyphs drawn with the given canvas font
 * shorthand — letter-spacing excluded, callers add it per gap. Injectable so
 * the layout engine stays pure and unit-testable without a DOM. */
export type LineMeasurer = (text: string, font: string) => number;

let measureCtx: CanvasRenderingContext2D | null = null;

/** The real measurer: a shared offscreen canvas context, with a memo — the
 * live preview re-measures on every keystroke, and identical (font, text)
 * pairs dominate. The cache is capped and reset wholesale (cheap; entries are
 * numbers), and MUST be discarded when webfonts finish loading, since the
 * same shorthand then measures different glyphs — hence the generation-keyed
 * factory rather than a module singleton. */
export function createCanvasMeasurer(): LineMeasurer {
  const cache = new Map<string, number>();
  return (text, font) => {
    const key = `${font} ${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    measureCtx ??= document.createElement("canvas").getContext("2d");
    if (!measureCtx) return text.length * 0.58 * (parseFloat(font) || 16);
    measureCtx.font = font;
    const w = measureCtx.measureText(text).width;
    if (cache.size > 4000) cache.clear();
    cache.set(key, w);
    return w;
  };
}

/** One line's painted width: glyphs plus the per-gap letter spacing —
 * letter-spacing is a constant per gap that does NOT scale with font size. */
export function lineWidth(
  line: string,
  style: MeasuredTextStyle,
  fontSizePx: number,
  measure: LineMeasurer,
): number {
  if (!line) return 0;
  const font = canvasFontShorthand({ ...style, fontSizePx });
  const spacing = (style.letterSpacingPx ?? 0) * Math.max(0, line.length - 1);
  return measure(line, font) + spacing;
}

/** Greedy word wrap mirroring the multiline renderer (white-space: pre-wrap;
 * word-break: break-word): explicit newlines are hard breaks, words wrap at
 * the box width, and a single word wider than the box breaks mid-word. The
 * uppercase transform applies BEFORE measuring, exactly as it paints. */
export function wrapLines(
  text: string,
  width: number,
  style: MeasuredTextStyle,
  fontSizePx: number,
  measure: LineMeasurer,
): string[] {
  const sample = style.uppercase ? text.toUpperCase() : text;
  const fits = (s: string) => lineWidth(s, style, fontSizePx, measure) <= width;
  const lines: string[] = [];

  for (const paragraph of sample.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (fits(word) || word.length <= 1) {
        current = word;
        continue;
      }
      // break-word: chop the overlong word greedily, one chunk per line.
      let rest = word;
      while (rest.length > 1 && !fits(rest)) {
        let take = rest.length - 1;
        while (take > 1 && !fits(rest.slice(0, take))) take--;
        lines.push(rest.slice(0, take));
        rest = rest.slice(take);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

/** A text field's hugged content height at the given size: line boxes times
 * the CSS line height, the same arithmetic the browser applies to the <p>. */
export function measuredTextHeight(
  multiline: boolean,
  style: MeasuredTextStyle,
  text: string,
  fontSizePx: number,
  width: number,
  measure: LineMeasurer,
): number {
  const lines = multiline ? wrapLines(text, width, style, fontSizePx, measure).length : 1;
  return lines * fontSizePx * (style.lineHeight ?? DEFAULT_LINE_HEIGHT);
}

/** A single-line field's painted width (horizontal stacks hug on this). */
export function measuredTextWidth(
  style: MeasuredTextStyle,
  text: string,
  fontSizePx: number,
  measure: LineMeasurer,
): number {
  const sample = style.uppercase ? text.toUpperCase() : text;
  return lineWidth(sample, style, fontSizePx, measure);
}

// ---------------------------------------------------------------------------
// The fit
// ---------------------------------------------------------------------------

export interface TextFitInput extends MeasuredTextStyle {
  /** Multiline wraps at the box width and is height-constrained under
   * shrink; single-line is width-constrained. */
  multiline: boolean;
  width: number;
  height: number;
  fontSizePx?: number;
  minFontSizePx?: number;
  textSizing?: TextSizingMode;
}

export interface TextFit {
  fontSizePx: number;
  /** Shrink bottomed out at the minimum size and the content still does not
   * fit — it will paint past the box. Surfaces warn; nothing clips. */
  overflows: boolean;
}

/** The font size a text field renders at, with the measurement injected.
 * Free returns the set size untouched; shrink searches downward from it. */
export function fitTextWith(measure: LineMeasurer, input: TextFitInput, text: string): TextFit {
  const base = input.fontSizePx ?? DEFAULT_FONT_SIZE;
  const mode = input.textSizing ?? "free";
  if (mode === "free" || !text) return { fontSizePx: base, overflows: false };
  if (mode === "fill") {
    // The box decides, not the set size: search the whole range upward.
    const min = input.minFontSizePx ?? DEFAULT_MIN_FONT_SIZE;
    return largestFittingSize(measure, input, text, min, FILL_MAX_FONT_SIZE);
  }
  const min = Math.min(input.minFontSizePx ?? DEFAULT_MIN_FONT_SIZE, base);
  return largestFittingSize(measure, input, text, min, base);
}

/** Single-line shrink: the box width is the constraint. Glyph width scales
 * linearly with font size (letter-spacing does not), so one measurement at
 * the base size gives the exact fit in one step — no search needed. */
/** Does `size` fit the box on BOTH axes?
 *
 * Single-line: the painted run (glyphs plus per-gap letter spacing) must fit
 * the width, and its line box must fit the height — the height half is what
 * "the box stays exactly as drawn" always promised and never delivered.
 * Multiline: no word may be wider than the box (an unbreakable word would
 * spill however small the rest gets), and the wrapped block must fit the
 * height. */
function fitsAtSize(
  measure: LineMeasurer,
  input: TextFitInput,
  text: string,
  size: number,
): boolean {
  const lineH = input.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const sample = input.uppercase ? text.toUpperCase() : text;
  const font = canvasFontShorthand({ ...input, fontSizePx: size });
  const perGap = input.letterSpacingPx ?? 0;
  if (!input.multiline) {
    const width = measure(sample, font) + perGap * Math.max(0, sample.length - 1);
    return width <= input.width && size * lineH <= input.height;
  }
  const words = sample.split(/[\s\n]+/).filter(Boolean);
  const widest = words.every(
    (w) => measure(w, font) + perGap * Math.max(0, w.length - 1) <= input.width,
  );
  if (!widest) return false;
  const lines = wrapLines(text, input.width, input, size, measure).length;
  return lines * size * lineH <= input.height;
}

/** The largest whole-pixel size in [min, max] that fits, by binary search.
 * `overflows` means even `min` doesn't fit — the caller warns, and the text
 * is rendered at min rather than disappearing. */
function largestFittingSize(
  measure: LineMeasurer,
  input: TextFitInput,
  text: string,
  min: number,
  max: number,
): TextFit {
  let lo = Math.ceil(Math.max(1, min));
  let hi = Math.floor(max);
  if (hi < lo) return { fontSizePx: Math.max(1, Math.floor(max)), overflows: true };
  if (fitsAtSize(measure, input, text, hi)) return { fontSizePx: hi, overflows: false };
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fitsAtSize(measure, input, text, mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best !== -1) return { fontSizePx: best, overflows: false };
  return { fontSizePx: Math.ceil(Math.max(1, min)), overflows: true };
}

/** fitTextWith bound to the shared canvas context — for hosts without a
 * layout pass (the builder's inline static-text editor and the renderer's
 * fallback path). Behavior is IDENTICAL to fitTextWith given the canvas
 * measurer. */
export function fitText(input: TextFitInput, text: string): TextFit {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  const measure: LineMeasurer = ctx
    ? (t, font) => {
        ctx.font = font;
        return ctx.measureText(t).width;
      }
    : (t, font) => t.length * 0.58 * (parseFloat(font) || 16);
  return fitTextWith(measure, input, text);
}
