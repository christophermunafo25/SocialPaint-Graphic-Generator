// Compose, the checking side: turns a propose_designs answer into designs
// the renderer can draw. Element looks named in `from` are copied from the
// stored reference rows and scaled to the canvas, colors resolve from brand
// keys to baked hex, fonts and type styles must be the brand's, the logo is
// picked or recolored for the ground under it, and text and the logo are held
// inside the margins and the story safe band, with contrast fixed in code.
// Overlapping text, text straight on a photo and a missing logo are errors
// that go back to the model for one retry.
//
// Warnings reach the member, so none carries an em dash; errors go back to
// the model for its retry.

import {
  alphaOf,
  averageHex,
  boxOf,
  canvasScale,
  clamp,
  contrastRatio,
  fillOf,
  maxRadius,
  mixHex,
  normalizeHex,
  numOf,
  oneOf,
  overlap,
  relativeLuminance,
  rgbOf,
  round1,
  round2,
  teamLogoVector,
  withAlpha,
  type BrandImage,
  type Box,
  type ComposeContext,
  type ComposedField,
  type EffectLike,
  type GradientLike,
  type RefElement,
  type RefRole,
  type RefTemplate,
  type Row,
  type ShadowEffect,
  type TypeStyleEntry,
} from "./compose.ts";
import { isRequiredField } from "./fieldRules.ts";
import {
  emDashesToSentences,
  replaceEmDashes,
  validateReplyAndTitle,
  type ImageFieldNeeded,
} from "./generateValidate.ts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidatedComposeDesign {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor?: string;
  backgroundGradient?: GradientLike;
  canvasEffects?: EffectLike[];
  fields: ComposedField[];
  /** Pre-filled member values for the editable text fields. */
  values: Record<string, string>;
  /** The caption with its {key} tags resolved: display copy. */
  caption: string;
  /** The caption as authored, tags intact, so a saved design is a real
   * template whose future fills merge their own values in. */
  captionTemplate: string;
  why: string;
  imageFieldsNeeded: ImageFieldNeeded[];
}

export interface ComposeValidation {
  designs: ValidatedComposeDesign[];
  /** Member-facing, no em dash. */
  warnings: string[];
  /** Model-facing, for the retry turn. Every design that has any is left
   * out of `designs`. */
  errors: string[];
  reply?: string;
  title?: string;
}

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const VALUE_CAP = 500;

function uniqueFieldKey(raw: unknown, fallback: string, taken: Set<string>): string {
  const wanted = typeof raw === "string" && KEY_RE.test(raw) && !taken.has(raw) ? raw : undefined;
  if (wanted) {
    taken.add(wanted);
    return wanted;
  }
  const base =
    String(typeof raw === "string" && raw ? raw : fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "element";
  const rooted = /^[a-z]/.test(base) ? base : `f_${base}`;
  let key = rooted;
  let n = 2;
  while (taken.has(key)) key = `${rooted}_${n++}`;
  taken.add(key);
  return key;
}

const humanize = (key: string) => {
  const s = key.replace(/_+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** The look an element takes from its source, scaled from the source's
 * canvas to this one by `s` (lengths only; colors and ratios as they are). */
function copyLook(src: ComposedField, s: number): Partial<ComposedField> {
  const scaled = (v: number | undefined) => (v === undefined ? undefined : round1(v * s));
  const look: Partial<ComposedField> = {};
  const keep = <K extends keyof ComposedField>(key: K, value: ComposedField[K] | undefined) => {
    if (value !== undefined) look[key] = value;
  };
  keep("typeStyleKey", src.typeStyleKey);
  keep("fontFamily", src.fontFamily);
  keep("fontWeight", src.fontWeight);
  keep("fontStyle", src.fontStyle);
  keep("fontStretch", src.fontStretch);
  keep("fontSizePx", scaled(src.fontSizePx));
  keep("letterSpacingPx", scaled(src.letterSpacingPx));
  keep("lineHeight", src.lineHeight);
  keep("uppercase", src.uppercase);
  keep("align", src.align);
  keep("verticalAlign", src.verticalAlign);
  keep("colorHex", src.colorHex);
  keep("textGradient", src.textGradient ? structuredClone(src.textGradient) : undefined);
  keep(
    "cornerRadius",
    src.cornerRadius
      ? {
          tl: round1(src.cornerRadius.tl * s),
          tr: round1(src.cornerRadius.tr * s),
          br: round1(src.cornerRadius.br * s),
          bl: round1(src.cornerRadius.bl * s),
        }
      : undefined,
  );
  keep("opacity", src.opacity);
  keep("shape", src.shape);
  keep("strokeColor", src.strokeColor);
  keep("strokeWidthPx", scaled(src.strokeWidthPx));
  keep("strokeAlign", src.strokeAlign);
  keep(
    "effects",
    src.effects?.map((fx): EffectLike => {
      if (fx.type === "layerBlur") return { type: "layerBlur", radius: round1(fx.radius * s) };
      if (fx.type === "noise") return { ...fx, size: round1(Math.max(0.5, fx.size * s)) };
      const out: ShadowEffect = {
        ...fx,
        x: round1(fx.x * s),
        y: round1(fx.y * s),
        blur: round1(fx.blur * s),
      };
      if (fx.spread !== undefined) out.spread = round1(fx.spread * s);
      return out;
    }),
  );
  keep("vector", src.vector ? structuredClone(src.vector) : undefined);
  keep("plateColor", src.plateColor);
  keep("platePaddingX", scaled(src.platePaddingX));
  keep("platePaddingY", scaled(src.platePaddingY));
  keep("objectFit", src.objectFit);
  keep("maskUrl", src.maskUrl);
  keep("flipX", src.flipX);
  keep("flipY", src.flipY);
  return look;
}

/** Which looks an element type may take from which source role. */
const LOOK_SOURCES: Record<string, RefRole[]> = {
  text: ["text"],
  multiline: ["text"],
  shape: ["shape"],
  image: ["photo", "artwork"],
  artwork: ["artwork"],
  brandImage: ["photo", "artwork"],
  logo: ["logo"],
  icon: ["icon"],
};

/** The properties each element type keeps from a copied look; the rest of
 * the source's look (a photo's artwork, a text's plate on a shape) is not
 * the element's to carry. */
const TEXT_LOOK: Array<keyof ComposedField> = [
  "typeStyleKey",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "fontStretch",
  "fontSizePx",
  "letterSpacingPx",
  "lineHeight",
  "uppercase",
  "align",
  "verticalAlign",
  "colorHex",
  "textGradient",
  "cornerRadius",
  "opacity",
  "effects",
  "plateColor",
  "platePaddingX",
  "platePaddingY",
];
const SHAPE_LOOK: Array<keyof ComposedField> = [
  "shape",
  "colorHex",
  "textGradient",
  "cornerRadius",
  "opacity",
  "strokeColor",
  "strokeWidthPx",
  "strokeAlign",
  "effects",
  "flipX",
  "flipY",
];
const FRAME_LOOK: Array<keyof ComposedField> = [
  "cornerRadius",
  "opacity",
  "effects",
  "objectFit",
  "maskUrl",
];
const ARTWORK_LOOK: Array<keyof ComposedField> = [...FRAME_LOOK, "flipX", "flipY"];
const LOGO_LOOK: Array<keyof ComposedField> = ["opacity", "effects"];
const ICON_LOOK: Array<keyof ComposedField> = [
  "vector",
  "colorHex",
  "textGradient",
  "opacity",
  "effects",
  "flipX",
  "flipY",
];

const LOOK_KEYS: Record<string, Array<keyof ComposedField>> = {
  text: TEXT_LOOK,
  multiline: TEXT_LOOK,
  shape: SHAPE_LOOK,
  image: FRAME_LOOK,
  artwork: ARTWORK_LOOK,
  brandImage: FRAME_LOOK,
  logo: LOGO_LOOK,
  icon: ICON_LOOK,
};

function pickLook(
  look: Partial<ComposedField>,
  keys: Array<keyof ComposedField>,
): Partial<ComposedField> {
  const out: Partial<ComposedField> = {};
  for (const k of keys) {
    if (look[k] !== undefined) (out as Row)[k] = look[k];
  }
  return out;
}

interface Lookups {
  colorByKey: Map<string, string>;
  styleByKey: Map<string, TypeStyleEntry>;
  fontByLower: Map<string, string>;
  elementById: Map<string, { el: RefElement; ref: RefTemplate }>;
  refById: Map<string, RefTemplate>;
  imageById: Map<string, BrandImage>;
}

function lookupsFor(ctx: ComposeContext): Lookups {
  const elementById = new Map<string, { el: RefElement; ref: RefTemplate }>();
  const refById = new Map<string, RefTemplate>();
  for (const ref of [...ctx.references, ...ctx.drafts]) {
    refById.set(ref.id, ref);
    for (const el of ref.elements) elementById.set(el.id, { el, ref });
  }
  return {
    colorByKey: new Map(ctx.brand.colors.map((c) => [c.key, c.hex])),
    styleByKey: new Map(ctx.brand.typeStyles.map((s) => [s.key, s])),
    fontByLower: new Map(ctx.brand.fonts.map((f) => [f.toLowerCase(), f])),
    elementById,
    refById,
    imageById: new Map(ctx.brand.images.map((i) => [i.id, i])),
  };
}

function readBox(raw: unknown): Box | undefined {
  if (Array.isArray(raw) && raw.length === 4) {
    const [x, y, w, h] = raw.map((v) => numOf(v));
    if ([x, y, w, h].every((v) => v !== undefined)) return { x: x!, y: y!, w: w!, h: h! };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const b = raw as Row;
    const x = numOf(b.x);
    const y = numOf(b.y);
    const w = numOf(b.width);
    const h = numOf(b.height);
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined)
      return { x, y, w, h };
  }
  return undefined;
}

function readGradient(
  raw: unknown,
  colors: Map<string, string>,
  note: (m: string) => void,
): GradientLike | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const g = raw as Row;
  if (!Array.isArray(g.stops)) return undefined;
  const stops: GradientLike["stops"] = [];
  for (const s of g.stops.slice(0, 6)) {
    const stop = (s ?? {}) as Row;
    const hex = typeof stop.color === "string" ? colors.get(stop.color) : undefined;
    if (!hex) {
      note(`gradient stop "${String(stop.color)}" is not a color key`);
      continue;
    }
    stops.push({ position: clamp(numOf(stop.at) ?? numOf(stop.position) ?? 0, 0, 1), color: hex });
  }
  if (stops.length < 2) return undefined;
  stops.sort((a, b) => a.position - b.position);
  const out: GradientLike = { angle: round1(numOf(g.angle) ?? 180), stops };
  if (g.kind === "radial") {
    out.kind = "radial";
    const c = Array.isArray(g.center) ? g.center.map((v) => numOf(v)) : [];
    if (c.length === 2 && c.every((v) => v !== undefined)) {
      out.center = { x: clamp(c[0]!, -1, 2), y: clamp(c[1]!, -1, 2) };
    }
    const r = Array.isArray(g.radius) ? g.radius.map((v) => numOf(v)) : [];
    if (r.length === 2 && r.every((v) => v !== undefined)) {
      out.radius = { x: clamp(r[0]!, 0.05, 3), y: clamp(r[1]!, 0.05, 3) };
    }
  }
  return out;
}

function readEffects(
  raw: unknown,
  colors: Map<string, string>,
  s: number,
  allowBlur: boolean,
  note: (m: string) => void,
): EffectLike[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: EffectLike[] = [];
  for (const item of raw.slice(0, 3)) {
    const e = (item ?? {}) as Row;
    const alpha = clamp(numOf(e.alpha) ?? 0.15, 0, 1);
    if (e.type === "dropShadow" || e.type === "innerShadow") {
      const hex = typeof e.color === "string" ? colors.get(e.color) : undefined;
      if (!hex) {
        note(`a ${e.type} names "${String(e.color)}", which is not a color key`);
        continue;
      }
      const fx: ShadowEffect = {
        type: e.type,
        x: round1(clamp(numOf(e.x) ?? 0, -80 * s, 80 * s)),
        y: round1(clamp(numOf(e.y) ?? 0, -80 * s, 80 * s)),
        blur: round1(clamp(numOf(e.blur) ?? 0, 0, 240 * s)),
        color: withAlpha(hex, Math.min(alpha, 0.7)),
      };
      const spread = numOf(e.spread);
      if (spread !== undefined) fx.spread = round1(clamp(spread, -60 * s, 60 * s));
      out.push(fx);
    } else if (e.type === "layerBlur") {
      if (!allowBlur) {
        note("a blur only goes on shapes and images");
        continue;
      }
      out.push({ type: "layerBlur", radius: round1(clamp(numOf(e.radius) ?? 0, 0, 160 * s)) });
    } else if (e.type === "noise") {
      const hex = typeof e.color === "string" ? colors.get(e.color) : undefined;
      if (!hex) {
        note(`grain names "${String(e.color)}", which is not a color key`);
        continue;
      }
      out.push({
        type: "noise",
        color: withAlpha(hex, clamp(numOf(e.alpha) ?? 0.08, 0.02, 0.4)),
        size: round1(clamp(numOf(e.size) ?? 1.5 * s, 0.5, 8 * s)),
        density: round2(clamp(numOf(e.density) ?? 0.5, 0.05, 1)),
        seed: 7,
      });
    }
  }
  return out.length ? out : undefined;
}

/** The ground under a box: the topmost element painted below it that covers
 * most of it, else the canvas. A translucent fill is mixed with what is
 * below it. "photo" for an image, which can be any color. */
type Ground = { kind: "solid"; hex: string } | { kind: "photo" };

function coverage(outer: Box, inner: Box): number {
  const ix = Math.max(
    0,
    Math.min(outer.x + outer.w, inner.x + inner.w) - Math.max(outer.x, inner.x),
  );
  const iy = Math.max(
    0,
    Math.min(outer.y + outer.h, inner.y + inner.h) - Math.max(outer.y, inner.y),
  );
  return (ix * iy) / Math.max(1, inner.w * inner.h);
}

function canvasGround(design: {
  backgroundColor?: string;
  backgroundGradient?: GradientLike;
}): string {
  if (design.backgroundGradient)
    return averageHex(design.backgroundGradient.stops.map((s) => s.color));
  return design.backgroundColor ?? "#ffffff";
}

function groundUnder(
  box: Box,
  below: ComposedField[],
  canvas: { backgroundColor?: string; backgroundGradient?: GradientLike },
): Ground {
  for (let j = below.length - 1; j >= 0; j--) {
    const f = below[j];
    if (coverage(boxOf(f), box) < 0.5) continue;
    if (f.type === "image") return { kind: "photo" };
    let hex: string | undefined;
    if (f.type === "shape") hex = fillOf(f);
    else if ((f.type === "text" || f.type === "multiline") && f.plateColor) hex = f.plateColor;
    if (!hex) continue;
    const opacity = (f.opacity ?? 100) / 100;
    if (opacity >= 0.95) return { kind: "solid", hex };
    const under = groundUnder(box, below.slice(0, j), canvas);
    if (under.kind === "photo") {
      // A scrim: at half strength or more it carries the text, judged
      // against a photo's middle tone; fainter, the photo shows through.
      return opacity >= 0.5 ? { kind: "solid", hex: mixHex(hex, "#808080", opacity) } : under;
    }
    return { kind: "solid", hex: mixHex(hex, under.hex, opacity) };
  }
  return { kind: "solid", hex: canvasGround(canvas) };
}

/** The color a text field renders in: a bound style's color when it locks
 * one (and the kit does not let fields override it), else its own. */
function textColorOf(
  f: ComposedField,
  styles: Map<string, TypeStyleEntry>,
  colors: Map<string, string>,
  allowOverride: boolean,
): { hex: string; locked: boolean } {
  const style = f.typeStyleKey ? styles.get(f.typeStyleKey) : undefined;
  const styleHex = style?.colorKey ? colors.get(style.colorKey) : undefined;
  const own = f.textGradient ? averageHex(f.textGradient.stops.map((s) => s.color)) : f.colorHex;
  if (styleHex && !(allowOverride && own)) return { hex: styleHex, locked: true };
  return { hex: own ?? "#111111", locked: false };
}

/** The type floor: the smallest text a post may carry, scaled from 16px at
 * 1080 wide (the starters' smallest label). */
const floorPx = (W: number) => Math.max(12, (16 * W) / 1080);

/** Large text by WCAG's measure, scaled for a graphic viewed at about a
 * third of its size: 3:1 is enough from here up, 4.5:1 below. */
const largePx = (W: number) => (54 * W) / 1080;

/** The palette color nearest a hex, by distance in RGB (the renderer's
 * clampToPalette rule). */
function nearestHex(hex: string, palette: string[]): string {
  const base = normalizeHex(hex);
  if (!base || palette.includes(base)) return base ?? hex;
  const [r, g, b] = rgbOf(base);
  let best = palette[0];
  let bestDist = Infinity;
  for (const p of palette) {
    const [pr, pg, pb] = rgbOf(p);
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function snapEffect(fx: EffectLike, palette: string[]): EffectLike {
  if (fx.type === "layerBlur") return fx;
  const a = alphaOf(fx.color);
  const hex = nearestHex(fx.color, palette);
  return { ...fx, color: a < 1 ? withAlpha(hex, a) : hex };
}

function snapFieldColors(f: ComposedField, palette: string[]): void {
  if (f.colorHex) f.colorHex = nearestHex(f.colorHex, palette);
  if (f.plateColor) f.plateColor = nearestHex(f.plateColor, palette);
  if (f.strokeColor) f.strokeColor = nearestHex(f.strokeColor, palette);
  if (f.textGradient) {
    f.textGradient.stops = f.textGradient.stops.map((st) => ({
      ...st,
      color: nearestHex(st.color, palette),
    }));
  }
  if (f.effects) f.effects = f.effects.map((fx) => snapEffect(fx, palette));
  if (f.vector) {
    for (const path of f.vector.paths)
      if (path.colorHex) path.colorHex = nearestHex(path.colorHex, palette);
  }
}

export function validateCompose(
  output: unknown,
  ctx: ComposeContext,
  count: number,
): ComposeValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  const designs: ValidatedComposeDesign[] = [];
  const look = lookupsFor(ctx);
  const W = ctx.canvasWidth;
  const H = ctx.canvasHeight;
  const sCanvas = W / 1080;

  const out = (output ?? {}) as Row;
  let list = Array.isArray(out.proposals) ? out.proposals : [];
  if (list.length > count) {
    warnings.push(`The model returned ${list.length} designs. Keeping the first ${count}.`);
    list = list.slice(0, count);
  }

  list.forEach((rawDesign, di) => {
    const label = `Design ${di + 1}`;
    const p = (rawDesign ?? {}) as Row;
    const designErrors: string[] = [];
    const taken = new Set<string>();
    const fields: ComposedField[] = [];
    const values: Record<string, string> = {};
    const logoSlots: Array<{ field: ComposedField; surface?: "light" | "dark" }> = [];
    /** Every logo element, image or vector. */
    const logoFields: ComposedField[] = [];

    // The ground first: text contrast and the logo's version read it.
    const bg = (p.background ?? {}) as Row;
    let backgroundColor: string | undefined;
    let backgroundGradient: GradientLike | undefined;
    let canvasEffects: EffectLike[] | undefined;
    if (typeof bg.from === "string") {
      const ref = look.refById.get(bg.from);
      if (ref) {
        const s = canvasScale(
          { width: ref.canvasWidth, height: ref.canvasHeight },
          { width: W, height: H },
        );
        backgroundColor = ref.background.color;
        backgroundGradient = ref.background.gradient
          ? structuredClone(ref.background.gradient)
          : undefined;
        canvasEffects = ref.background.effects?.map((fx) =>
          fx.type === "noise" ? { ...fx, size: round1(Math.max(0.5, fx.size * s)) } : fx,
        );
      } else {
        warnings.push(
          `${label}: the ground names "${bg.from}", which is not one of the references.`,
        );
      }
    }
    if (typeof bg.color === "string") {
      const hex = look.colorByKey.get(bg.color);
      if (hex) {
        backgroundColor = hex;
        backgroundGradient = undefined;
      } else warnings.push(`${label}: the ground names "${bg.color}", which is not a brand color.`);
    }
    if (bg.fill !== undefined) {
      const g = readGradient(bg.fill, look.colorByKey, (m) =>
        warnings.push(`${label}: the ground's ${m}.`),
      );
      if (g) backgroundGradient = g;
    }
    if (bg.grain && typeof bg.grain === "object") {
      const fx = readEffects(
        [{ ...(bg.grain as Row), type: "noise" }],
        look.colorByKey,
        sCanvas,
        false,
        (m) => warnings.push(`${label}: the ground's ${m}.`),
      );
      if (fx) canvasEffects = [...(canvasEffects ?? []).filter((e) => e.type !== "noise"), ...fx];
    }
    const canvasFill: { backgroundColor?: string; backgroundGradient?: GradientLike } = {
      backgroundColor,
      backgroundGradient,
    };

    let elements = Array.isArray(p.elements) ? p.elements : [];
    if (elements.length > ctx.elementCap) {
      warnings.push(`${label}: ${elements.length} elements. Keeping the first ${ctx.elementCap}.`);
      elements = elements.slice(0, ctx.elementCap);
    }

    for (const rawEl of elements) {
      const e = (rawEl ?? {}) as Row;
      const type = typeof e.type === "string" ? e.type : "";
      const keyHint =
        typeof e.key === "string" ? e.key : typeof e.label === "string" ? e.label : type;
      const name = (
        typeof e.label === "string" && e.label.trim()
          ? e.label.trim()
          : humanize(String(keyHint || "element"))
      ).slice(0, 60);
      if (!(type in LOOK_KEYS)) {
        warnings.push(`${label}: dropped "${name}", unknown type "${type}".`);
        continue;
      }
      const raw = readBox(e.box);
      if (!raw) {
        warnings.push(`${label}: dropped "${name}", no usable box.`);
        continue;
      }
      // Geometry is clamped: shapes, panels and pictures may bleed off the
      // canvas, text and the logo may not leave it.
      const bleeds =
        type === "shape" || type === "image" || type === "artwork" || type === "brandImage";
      let x = Math.round(raw.x);
      let y = Math.round(raw.y);
      let width = Math.round(raw.w);
      let height = Math.round(raw.h);
      if (bleeds) {
        x = clamp(x, -W, W);
        y = clamp(y, -H, H);
        width = Math.min(width, 3 * W);
        height = Math.min(height, 3 * H);
        if (x + width <= 0 || y + height <= 0 || x >= W || y >= H) {
          warnings.push(`${label}: dropped "${name}", it lies off the canvas.`);
          continue;
        }
      } else {
        x = clamp(x, 0, W);
        y = clamp(y, 0, H);
        width = Math.min(width, W - x);
        height = Math.min(height, H - y);
      }
      // A line is a thin rect (a hairline rule is 1px tall), so a shape
      // needs only one side of 8px; anything else needs both.
      const tooSmall =
        type === "shape"
          ? width < 1 || height < 1 || (width < 8 && height < 8)
          : width < 8 || height < 8;
      if (tooSmall) {
        warnings.push(`${label}: dropped "${name}", box under 8px after clamping.`);
        continue;
      }
      if (!bleeds && type !== "shape" && width * height > 0.9 * W * H) {
        warnings.push(`${label}: dropped "${name}", box covers over 90% of the canvas.`);
        continue;
      }

      const note = (m: string) => warnings.push(`${label}: "${name}": ${m}.`);
      let field: ComposedField = {
        id: crypto.randomUUID(),
        label: name,
        fieldKey: uniqueFieldKey(e.key, name, taken),
        type:
          type === "multiline"
            ? "multiline"
            : type === "text"
              ? "text"
              : type === "shape"
                ? "shape"
                : type === "icon"
                  ? "icon"
                  : "image",
        x,
        y,
        width,
        height,
        zIndex: fields.length,
      };

      // The look a reference element lends.
      let source: { el: RefElement; ref: RefTemplate } | undefined;
      if (typeof e.from === "string") {
        source = look.elementById.get(e.from);
        if (!source) note(`"from" names ${e.from}, which is not a reference element`);
        else if (!LOOK_SOURCES[type].includes(source.el.role)) {
          note(`${e.from} is a ${source.el.role}, so its look was not reused`);
          source = undefined;
        } else {
          const s = canvasScale(
            { width: source.ref.canvasWidth, height: source.ref.canvasHeight },
            { width: W, height: H },
          );
          field = { ...field, ...pickLook(copyLook(source.el.field, s), LOOK_KEYS[type]) };
          if (
            (type === "text" || type === "multiline") &&
            !source.el.field.static &&
            source.el.field.maxLength
          ) {
            field.maxLength = source.el.field.maxLength;
          }
        }
      }

      // Overrides, each checked against the brand.
      const allowBlur =
        type === "shape" || type === "image" || type === "artwork" || type === "brandImage";
      if (typeof e.color === "string") {
        const hex = look.colorByKey.get(e.color);
        if (hex) {
          field.colorHex = hex;
          field.textGradient = undefined;
        } else note(`"${e.color}" is not a brand color`);
      }
      if (e.fill !== undefined) {
        const g = readGradient(e.fill, look.colorByKey, note);
        if (g) field.textGradient = g;
      }
      if (e.opacity !== undefined && numOf(e.opacity) !== undefined) {
        field.opacity = Math.round(clamp(numOf(e.opacity)!, 5, 100));
        if (field.opacity === 100) delete field.opacity;
      }
      if (numOf(e.rotation) !== undefined && numOf(e.rotation) !== 0) {
        field.rotation = round1(clamp(numOf(e.rotation)!, -180, 180));
      }
      if (e.effects !== undefined) {
        const fx = readEffects(e.effects, look.colorByKey, sCanvas, allowBlur, note);
        if (fx) field.effects = fx;
        else delete field.effects;
      }
      if (e.radius !== undefined) {
        const half = Math.min(width, height) / 2;
        if (Array.isArray(e.radius) && e.radius.length === 4) {
          const [tl, tr, br, bl] = e.radius.map((v) => clamp(numOf(v) ?? 0, 0, half));
          field.cornerRadius = { tl, tr, br, bl };
        } else if (numOf(e.radius) !== undefined) {
          const r = clamp(numOf(e.radius)!, 0, half);
          field.cornerRadius = { tl: r, tr: r, br: r, bl: r };
        }
        if (field.cornerRadius && maxRadius(field.cornerRadius) === 0) delete field.cornerRadius;
      }

      if (type === "text" || type === "multiline") {
        if (typeof e.style === "string") {
          if (look.styleByKey.has(e.style)) field.typeStyleKey = e.style;
          else note(`type style "${e.style}" is not in the brand`);
        }
        if (field.typeStyleKey && !look.styleByKey.has(field.typeStyleKey))
          delete field.typeStyleKey;
        if (e.font && typeof e.font === "object") {
          const font = e.font as Row;
          const family =
            typeof font.family === "string"
              ? look.fontByLower.get(font.family.toLowerCase())
              : undefined;
          if (family) field.fontFamily = family;
          else if (font.family !== undefined)
            note(`font "${String(font.family)}" is not one of the brand's`);
          const weight = numOf(font.weight);
          if (weight !== undefined) field.fontWeight = Math.round(clamp(weight, 100, 1000));
        }
        if (numOf(e.size) !== undefined)
          field.fontSizePx = round1(clamp(numOf(e.size)!, floorPx(W), 400 * sCanvas));
        const align = oneOf(e.align, ["left", "center", "right"] as const);
        if (align) field.align = align;
        const valign = oneOf(e.valign, ["top", "middle", "bottom"] as const);
        if (valign) field.verticalAlign = valign;
        if (typeof e.uppercase === "boolean") field.uppercase = e.uppercase || undefined;
        if (!field.uppercase) delete field.uppercase;
        if (numOf(e.leading) !== undefined)
          field.lineHeight = round2(clamp(numOf(e.leading)!, 0.8, 2));
        if (e.plate && typeof e.plate === "object") {
          const plate = e.plate as Row;
          const hex =
            typeof plate.color === "string" ? look.colorByKey.get(plate.color) : undefined;
          if (hex) {
            field.plateColor = hex;
            field.platePaddingX = round1(clamp(numOf(plate.padX) ?? 24 * sCanvas, 0, 96 * sCanvas));
            field.platePaddingY = round1(clamp(numOf(plate.padY) ?? 12 * sCanvas, 0, 64 * sCanvas));
          } else note(`the plate color "${String(plate.color)}" is not a brand color`);
        }

        // Size: the model's, the copied look's, the style's, or one read
        // from the box. Text is fitted by measurement on the client, shrinking
        // from here to a floor that never goes under the type floor.
        const style = field.typeStyleKey ? look.styleByKey.get(field.typeStyleKey) : undefined;
        const size =
          style?.sizePx ??
          field.fontSizePx ??
          (type === "text" ? height * 0.72 : Math.min(height * 0.3, 44 * sCanvas));
        field.fontSizePx = round1(clamp(size, floorPx(W), 400 * sCanvas));
        if (numOf(e.tracking) !== undefined) {
          field.letterSpacingPx = round1(
            clamp(numOf(e.tracking)!, -0.12 * field.fontSizePx, 0.4 * field.fontSizePx),
          );
        }
        const baseScale = field.fontSizePx >= 48 * sCanvas ? 0.6 : 0.75;
        field.minFontScale = round2(
          clamp(Math.max(baseScale, floorPx(W) / field.fontSizePx), 0.3, 1),
        );
        field.textSizing = "shrink";

        const value =
          typeof e.value === "string"
            ? e.value.replace(/\s+\n/g, "\n").trim().slice(0, VALUE_CAP)
            : "";
        if (e.static === true) {
          if (!value) {
            warnings.push(`${label}: dropped fixed text "${name}", no content.`);
            continue;
          }
          field.static = true;
          field.staticValue = value;
          delete field.maxLength;
        } else {
          field.placeholder = value || name;
          if (value) values[field.fieldKey] = value;
          else warnings.push(`${label}: editable "${name}" has no value, left for the member.`);
        }
      } else if (type === "shape") {
        const kind = oneOf(e.shape, ["rect", "ellipse", "triangle", "star"] as const);
        if (kind) field.shape = kind;
        field.shape = field.shape ?? "rect";
        if (e.stroke && typeof e.stroke === "object") {
          const st = e.stroke as Row;
          const hex = typeof st.color === "string" ? look.colorByKey.get(st.color) : undefined;
          if (hex) {
            field.strokeColor = hex;
            field.strokeWidthPx = round1(clamp(numOf(st.width) ?? 2 * sCanvas, 1, 24 * sCanvas));
            const align = oneOf(st.align, ["inside", "center", "outside"] as const);
            if (align && align !== "inside") field.strokeAlign = align;
          } else note(`the stroke color "${String(st.color)}" is not a brand color`);
        }
        if (field.shape !== "rect") delete field.cornerRadius;
        if (!field.colorHex && !field.textGradient && !field.strokeColor) {
          warnings.push(`${label}: dropped shape "${name}". Shapes need a brand color.`);
          continue;
        }
        field.static = true;
      } else if (type === "image") {
        // A member photo slot: never artwork of the model's.
        delete field.staticValue;
        field.objectFit = "cover";
        if (field.label === humanize(field.fieldKey) && !e.label) field.label = "Photo";
      } else if (type === "artwork") {
        if (!source?.el.field.staticValue) {
          warnings.push(
            `${label}: dropped artwork "${name}". Artwork can only be reused from a template.`,
          );
          continue;
        }
        field.static = true;
        field.staticValue = source.el.field.staticValue;
        field.objectFit = field.objectFit ?? "cover";
      } else if (type === "brandImage") {
        const img = typeof e.asset === "string" ? look.imageById.get(e.asset) : undefined;
        if (!img) {
          warnings.push(`${label}: dropped "${name}". "${String(e.asset)}" is not a brand image.`);
          continue;
        }
        field.static = true;
        field.staticValue = img.source;
        field.objectFit = field.objectFit ?? "cover";
      } else if (type === "icon") {
        if (!field.vector) {
          warnings.push(
            `${label}: dropped icon "${name}". Icons can only be reused from a template.`,
          );
          continue;
        }
        field.static = true;
        if (!field.colorHex && !field.textGradient) field.colorHex = "#111111";
      } else if (type === "logo") {
        field.static = true;
        field.label = "Logo";
        // The team's own vector logo, when the model names one or Brand
        // Studio has no logo file: it is recolored for its ground below.
        const brandFile = Boolean(ctx.brand.logos.light || ctx.brand.logos.dark);
        const vector =
          source?.el.field.type === "icon"
            ? source.el.field
            : !brandFile
              ? teamLogoVector(ctx)
              : undefined;
        if (vector?.vector) {
          field.type = "icon";
          field.vector = structuredClone(vector.vector);
          if (vector.colorHex) field.colorHex = vector.colorHex;
          if (vector.textGradient) field.textGradient = structuredClone(vector.textGradient);
          if (!field.colorHex && !field.textGradient) field.colorHex = "#111111";
          logoFields.push(field);
        } else if (brandFile) {
          field.objectFit = "contain";
          const surface = oneOf(e.surface, ["light", "dark"] as const);
          logoSlots.push({ field, surface });
          logoFields.push(field);
        } else {
          warnings.push(`${label}: left out the logo. Add one in Brand Studio to place it.`);
          continue;
        }
      }
      fields.push(field);
    }

    // A brand that forbids off-palette color gets none: every color a reused
    // look carried in snaps to the nearest palette color, as the renderer
    // snaps text (resolveStyle.clampToPalette) and here shapes, plates,
    // strokes, effects and the ground too.
    if (!ctx.brand.allowOffPalette) {
      const palette = ctx.brand.colors.filter((c) => c.source === "palette").map((c) => c.hex);
      if (palette.length > 0) {
        for (const f of fields) snapFieldColors(f, palette);
        if (canvasFill.backgroundColor)
          canvasFill.backgroundColor = nearestHex(canvasFill.backgroundColor, palette);
        if (canvasFill.backgroundGradient) {
          canvasFill.backgroundGradient.stops = canvasFill.backgroundGradient.stops.map((st) => ({
            ...st,
            color: nearestHex(st.color, palette),
          }));
        }
        canvasEffects = canvasEffects?.map((fx) => snapEffect(fx, palette));
      }
    }

    // Margins and the story safe band, for text and the logo.
    for (const f of fields) {
      const isText = f.type === "text" || f.type === "multiline";
      const isLogo = logoFields.includes(f);
      if (!isText && !isLogo) continue;
      const minX = ctx.margin;
      const maxX = W - ctx.margin;
      const minY = ctx.safeTop;
      const maxY = H - ctx.safeBottom;
      if (f.width > maxX - minX) f.width = maxX - minX;
      if (f.height > maxY - minY) f.height = maxY - minY;
      const nx = clamp(f.x, minX, maxX - f.width);
      const ny = clamp(f.y, minY, maxY - f.height);
      if (nx !== f.x || ny !== f.y) {
        f.x = Math.round(nx);
        f.y = Math.round(ny);
      }
    }

    // The logo: the version that reads on the ground under it.
    for (const slot of logoSlots) {
      const below = fields.slice(0, fields.indexOf(slot.field));
      const ground = groundUnder(boxOf(slot.field), below, canvasFill);
      const surface =
        slot.surface ??
        (ground.kind === "solid" && relativeLuminance(ground.hex) < 0.35 ? "dark" : "light");
      slot.field.staticValue =
        (surface === "dark" ? ctx.brand.logos.dark : ctx.brand.logos.light) ??
        ctx.brand.logos.light ??
        ctx.brand.logos.dark;
    }

    // A one-color vector logo reads on its ground at 3:1, or is recolored.
    for (const f of logoFields) {
      if (f.type !== "icon" || !f.vector || f.vector.paths.some((path) => path.colorHex)) continue;
      const ground = groundUnder(boxOf(f), fields.slice(0, fields.indexOf(f)), canvasFill);
      if (ground.kind !== "solid") continue;
      const own = f.textGradient
        ? averageHex(f.textGradient.stops.map((st) => st.color))
        : f.colorHex;
      if (own && contrastRatio(own, ground.hex) >= 3) continue;
      const pick = ctx.brand.colors
        .map((c) => ({ c, ratio: contrastRatio(c.hex, ground.hex) }))
        .sort((a, b) => b.ratio - a.ratio)[0];
      if (!pick) continue;
      f.colorHex = pick.c.hex;
      delete f.textGradient;
    }

    // Text reads on its ground, or is recolored until it does.
    const textFields = fields.filter((f) => f.type === "text" || f.type === "multiline");
    for (const f of textFields) {
      const below = fields.slice(0, fields.indexOf(f));
      const ground: Ground = f.plateColor
        ? { kind: "solid", hex: f.plateColor }
        : groundUnder(boxOf(f), below, canvasFill);
      if (ground.kind === "photo") {
        designErrors.push(
          `${label}: text "${f.label}" sits straight on a photo. Put a plate behind it, or a panel between the photo and the text.`,
        );
        continue;
      }
      const need = (f.fontSizePx ?? 0) >= largePx(W) ? 3 : 4.5;
      const { hex, locked } = textColorOf(
        f,
        look.styleByKey,
        look.colorByKey,
        ctx.brand.allowStyleOverride,
      );
      if (contrastRatio(hex, ground.hex) >= need) continue;
      const ranked = ctx.brand.colors
        .map((c) => ({ c, ratio: contrastRatio(c.hex, ground.hex) }))
        .sort((a, b) => b.ratio - a.ratio);
      const textUse = new Set(ctx.house.textColors.map((t) => t.hex));
      const pick =
        ranked.find((r) => r.ratio >= need && textUse.has(r.c.hex)) ??
        ranked.find((r) => r.ratio >= need) ??
        ranked[0];
      if (!pick) continue;
      if (locked && f.typeStyleKey) {
        // A sibling style that reads here keeps the live channel: the same
        // role or face, in a color that passes.
        const current = look.styleByKey.get(f.typeStyleKey)!;
        const sibling = ctx.brand.typeStyles.find((s) => {
          if (s.key === current.key || !s.colorKey) return false;
          const sh = look.colorByKey.get(s.colorKey);
          if (!sh || contrastRatio(sh, ground.hex) < need) return false;
          return (
            (s.useFor && s.useFor === current.useFor) ||
            (s.family === current.family && s.weight === current.weight)
          );
        });
        if (sibling) {
          f.typeStyleKey = sibling.key;
          continue;
        }
        // Otherwise the field keeps the style's face as baked values and
        // takes a color that reads.
        if (current.family) f.fontFamily = current.family;
        if (current.weight !== undefined) f.fontWeight = current.weight;
        if (current.italic) f.fontStyle = "italic";
        if (current.stretch) f.fontStretch = current.stretch;
        if (current.sizePx !== undefined) f.fontSizePx = current.sizePx;
        if (current.uppercase !== undefined) f.uppercase = current.uppercase || undefined;
        if (current.letterSpacingPx !== undefined) f.letterSpacingPx = current.letterSpacingPx;
        if (current.lineHeight !== undefined) f.lineHeight = current.lineHeight;
        delete f.typeStyleKey;
      }
      f.colorHex = pick.c.hex;
      delete f.textGradient;
      warnings.push(
        `${label}: "${f.label}" now uses ${pick.c.name} so it reads on its background.`,
      );
    }

    // Text never overlaps text or the logo.
    const solid = [...textFields, ...logoFields];
    for (let a = 0; a < solid.length; a++) {
      for (let b = a + 1; b < solid.length; b++) {
        const A = boxOf(solid[a]);
        const B = boxOf(solid[b]);
        const smaller = A.w * A.h <= B.w * B.h ? A : B;
        const larger = smaller === A ? B : A;
        if (coverage(larger, smaller) > 0.15) {
          designErrors.push(
            `${label}: "${solid[a].label}" and "${solid[b].label}" overlap. Give each its own space.`,
          );
        }
      }
    }

    if (ctx.expectLogo && logoFields.length === 0) {
      designErrors.push(
        `${label}: the logo is missing. The team carries it on most posts${ctx.house.logo ? `, usually ${ctx.house.logo.corner}` : ""}; add a "logo" element.`,
      );
    }

    const editableText = fields.filter(
      (f) => !f.static && (f.type === "text" || f.type === "multiline"),
    );
    if (fields.length < 2 || editableText.length < 1) {
      designErrors.push(
        `${label}: too little survived validation (${fields.length} elements, ${editableText.length} editable text) — propose a fuller design.`,
      );
    }

    if (designErrors.length > 0) {
      errors.push(...designErrors);
      return;
    }

    // The caption is a template: {key} tags naming member fields survive,
    // anything else is stripped. The resolved form is what the card shows.
    const editableKeys = new Set(fields.filter((f) => !f.static).map((f) => f.fieldKey));
    const captionTemplate = (typeof p.caption === "string" ? p.caption.trim().slice(0, 600) : "")
      .replace(/\{([a-z][a-z0-9_]*)\}/g, (tag, key: string) => {
        if (editableKeys.has(key)) return tag;
        warnings.push(`${label}: caption tag {${key}} doesn't match any field, so it was removed.`);
        return "";
      })
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    const caption = captionTemplate
      .replace(/\{([a-z][a-z0-9_]*)\}/g, (_tag, key: string) => values[key] ?? "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    const design: ValidatedComposeDesign = {
      name: (typeof p.name === "string" && p.name.trim() ? p.name.trim() : "New design").slice(
        0,
        80,
      ),
      canvasWidth: W,
      canvasHeight: H,
      fields,
      values,
      caption,
      captionTemplate,
      why: typeof p.why === "string" ? p.why.trim().slice(0, 200) : "",
      imageFieldsNeeded: fields
        .filter((f) => !f.static && f.type === "image")
        .map((f) => ({ fieldKey: f.fieldKey, label: f.label, required: isRequiredField(f) })),
    };
    if (canvasFill.backgroundColor) design.backgroundColor = canvasFill.backgroundColor;
    if (canvasFill.backgroundGradient) design.backgroundGradient = canvasFill.backgroundGradient;
    if (canvasEffects?.length) design.canvasEffects = canvasEffects;
    designs.push(design);
  });

  if (designs.length === 0 && errors.length === 0) {
    errors.push("No usable designs survived validation.");
  }
  return {
    designs,
    warnings: warnings.map(replaceEmDashes),
    errors,
    ...validateReplyAndTitle(out),
  };
}

/** The errors of a final validation, as the member reads them under the
 * drafts that survived. */
export function errorsAsWarnings(errors: string[]): string[] {
  return errors.map(emDashesToSentences).map(replaceEmDashes);
}
