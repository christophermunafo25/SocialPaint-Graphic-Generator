// Compose: brand-new designs for the Generate page, built from the team's own
// work. Pure functions (no I/O, no Deno globals beyond Web Crypto), so the
// same code runs in the Edge Function and under vitest.
//
// Generate makes new posts; filling a template as it stands belongs to the
// template chat. What keeps a new post on brand is what it is built from:
//
//   * Brand Studio: the palette (with roles), the type styles, the fonts, the
//     logo for each ground, the brand images and the written guidelines.
//   * The team's published templates, read two ways. The house style is a
//     deterministic read-out across all of them (margins, logo corner and
//     size, the headline to body ratio, grounds, corner radii, effects), and
//     the references are the templates most relevant to the brief, element
//     by element. The model names a reference element in `from` and the
//     validator copies that element's whole look from the stored row, so the
//     team's exact type, fills, radii, strokes, plates, effects, icons and
//     artwork carry over without being retyped.
//
// The model chooses and writes: a lead reference, element boxes, copy, and
// which looks to reuse. Code places and checks (brand-system RULES rule 8):
// every color must be a key from the brand's color list and leaves as baked
// hex, fonts come from the brand, the logo is chosen for the ground under it,
// text and the logo are kept inside the margins and the story safe band, text
// that would not read on its ground is recolored, and overlapping text, text
// straight on a photo or a missing logo go back to the model once.
//
// Three files share the work. This one reads Brand Studio and the templates
// into a ComposeContext (the brand, the house style, the references and the
// member's current drafts). composePrompt.ts turns that context into the
// message and the tool the model answers with, and composeValidate.ts checks
// the answer and builds the designs.

import { HttpError } from "./http.ts";
import {
  fontAssetFamily,
  parseStorageRef,
  refInCompany,
  refKey,
  refWithImpliedBucket,
  type PublicBucket,
} from "./publicLink.ts";

export type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** #RGB, #RRGGBB or #RRGGBBAA as lower-case #rrggbb (alpha dropped), or
 * undefined for anything else. */
export function normalizeHex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = HEX_RE.exec(v.trim());
  if (!m) return undefined;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return `#${h.slice(0, 6)}`;
}

/** The alpha of #RRGGBBAA, 1 for anything else. */
export function alphaOf(color: string): number {
  const m = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(color.trim());
  return m ? parseInt(m[1], 16) / 255 : 1;
}

export function rgbOf(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const toHexByte = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0");

/** WCAG 2.1 relative luminance of a #rrggbb color. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio of two #rrggbb colors, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `top` painted at `alpha` over `bottom`. */
export function mixHex(top: string, bottom: string, alpha: number): string {
  const t = rgbOf(top);
  const b = rgbOf(bottom);
  return `#${t.map((c, i) => toHexByte(c * alpha + b[i] * (1 - alpha))).join("")}`;
}

export function averageHex(colors: string[]): string {
  const rgbs = colors.map(rgbOf);
  const avg = [0, 1, 2].map((i) => rgbs.reduce((sum, c) => sum + c[i], 0) / rgbs.length);
  return `#${avg.map(toHexByte).join("")}`;
}

export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${toHexByte(alpha * 255)}`;
}

// ---------------------------------------------------------------------------
// The field shape a design is made of
// ---------------------------------------------------------------------------

export interface GradientLike {
  angle: number;
  stops: Array<{ position: number; color: string }>;
  kind?: "linear" | "radial";
  center?: { x: number; y: number };
  radius?: { x: number; y: number };
}

export interface ShadowEffect {
  type: "dropShadow" | "innerShadow";
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
}
export interface BlurEffect {
  type: "layerBlur";
  radius: number;
}
export interface NoiseEffect {
  type: "noise";
  color: string;
  size: number;
  density: number;
  seed?: number;
}
export type EffectLike = ShadowEffect | BlurEffect | NoiseEffect;

export interface CornersLike {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

export interface VectorLike {
  viewBox: [number, number, number, number];
  paths: Array<{
    d: string;
    paint?: "fill" | "stroke";
    fillRule?: "nonzero" | "evenodd";
    colorHex?: string;
  }>;
  stroke?: { width: number; cap?: "butt" | "round" | "square"; join?: "miter" | "round" | "bevel" };
  source?: { set: string; name: string };
}

type FieldKind = "text" | "multiline" | "select" | "image" | "shape" | "icon";

/** Structural subset of the app's TemplateField (src/lib/types.ts), which the
 * Deno bundle cannot import. Every property here exists there with the same
 * meaning, so the client renders a design's fields as they are. */
export interface ComposedField {
  id: string;
  label: string;
  fieldKey: string;
  type: FieldKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  zIndex?: number;
  static?: boolean;
  staticValue?: string;
  placeholder?: string;
  optional?: boolean;
  options?: string[];
  typeStyleKey?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  fontStretch?: string;
  fontSizePx?: number;
  minFontScale?: number;
  colorHex?: string;
  textGradient?: GradientLike;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  maxLength?: number;
  textSizing?: "free" | "shrink" | "fill";
  objectFit?: "cover" | "contain";
  cornerRadius?: CornersLike;
  opacity?: number;
  shape?: "rect" | "ellipse" | "triangle" | "star";
  strokeColor?: string;
  strokeWidthPx?: number;
  strokeAlign?: "inside" | "center" | "outside";
  effects?: EffectLike[];
  vector?: VectorLike;
  plateColor?: string;
  platePaddingX?: number;
  platePaddingY?: number;
  maskUrl?: string;
}

// ---------------------------------------------------------------------------
// Sanitizers, shared by stored rows and the member's current drafts
// ---------------------------------------------------------------------------

export const numOf = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const strOf = (v: unknown, max = 4000): string | undefined =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined;
const boolOf = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const round2 = (v: number) => Math.round(v * 100) / 100;

export function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** A stored or member-sent color with its alpha kept: #rrggbb or #rrggbbaa. */
function colorWithAlpha(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const hex = normalizeHex(v);
  if (!hex) return undefined;
  const a = alphaOf(v);
  return a < 1 ? withAlpha(hex, a) : hex;
}

export function sanitizeGradient(v: unknown): GradientLike | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const g = v as Row;
  if (!Array.isArray(g.stops)) return undefined;
  const stops = g.stops
    .slice(0, 8)
    .map((s) => {
      const stop = (s ?? {}) as Row;
      const color = normalizeHex(stop.color);
      const position = numOf(stop.position);
      return color && position !== undefined ? { position: clamp(position, 0, 1), color } : null;
    })
    .filter((s): s is { position: number; color: string } => s !== null)
    .sort((a, b) => a.position - b.position);
  if (stops.length < 2) return undefined;
  const kind = oneOf(g.kind, ["linear", "radial"] as const);
  const out: GradientLike = { angle: round1(numOf(g.angle) ?? 180), stops };
  if (kind === "radial") {
    out.kind = "radial";
    const c = (g.center ?? {}) as Row;
    const r = (g.radius ?? {}) as Row;
    if (numOf(c.x) !== undefined && numOf(c.y) !== undefined) {
      out.center = { x: clamp(numOf(c.x)!, -1, 2), y: clamp(numOf(c.y)!, -1, 2) };
    }
    if (numOf(r.x) !== undefined && numOf(r.y) !== undefined) {
      out.radius = { x: clamp(numOf(r.x)!, 0.01, 4), y: clamp(numOf(r.y)!, 0.01, 4) };
    }
  } else if (kind === "linear") {
    out.kind = "linear";
  }
  return out;
}

export function sanitizeEffects(v: unknown): EffectLike[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: EffectLike[] = [];
  for (const raw of v.slice(0, 6)) {
    const e = (raw ?? {}) as Row;
    if (e.type === "dropShadow" || e.type === "innerShadow") {
      const color = colorWithAlpha(e.color);
      if (!color) continue;
      const fx: ShadowEffect = {
        type: e.type,
        x: clamp(numOf(e.x) ?? 0, -2000, 2000),
        y: clamp(numOf(e.y) ?? 0, -2000, 2000),
        blur: clamp(numOf(e.blur) ?? 0, 0, 2000),
        color,
      };
      const spread = numOf(e.spread);
      if (spread !== undefined) fx.spread = clamp(spread, -2000, 2000);
      out.push(fx);
    } else if (e.type === "layerBlur") {
      out.push({ type: "layerBlur", radius: clamp(numOf(e.radius) ?? 0, 0, 2000) });
    } else if (e.type === "noise") {
      const color = colorWithAlpha(e.color);
      if (!color) continue;
      const fx: NoiseEffect = {
        type: "noise",
        color,
        size: clamp(numOf(e.size) ?? 1, 0.5, 64),
        density: clamp(numOf(e.density) ?? 0.5, 0, 1),
      };
      const seed = numOf(e.seed);
      if (seed !== undefined) fx.seed = Math.round(seed);
      out.push(fx);
    }
  }
  return out.length > 0 ? out : undefined;
}

function sanitizeCorners(v: unknown): CornersLike | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const c = v as Row;
  const vals = [c.tl, c.tr, c.br, c.bl].map((x) => numOf(x));
  if (vals.some((x) => x === undefined)) return undefined;
  const [tl, tr, br, bl] = vals.map((x) => clamp(x!, 0, 5000));
  return tl + tr + br + bl > 0 ? { tl, tr, br, bl } : undefined;
}

const PATH_D_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/;

export function sanitizeVector(v: unknown): VectorLike | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const vec = v as Row;
  if (!Array.isArray(vec.viewBox) || vec.viewBox.length !== 4) return undefined;
  const box = vec.viewBox.map((x) => numOf(x));
  if (box.some((x) => x === undefined) || box[2]! <= 0 || box[3]! <= 0) return undefined;
  if (!Array.isArray(vec.paths)) return undefined;
  const paths = vec.paths
    .slice(0, 40)
    .map((raw) => {
      const p = (raw ?? {}) as Row;
      if (typeof p.d !== "string" || !p.d || p.d.length > 20_000 || !PATH_D_RE.test(p.d)) {
        return null;
      }
      const path: VectorLike["paths"][number] = { d: p.d };
      const paint = oneOf(p.paint, ["fill", "stroke"] as const);
      if (paint) path.paint = paint;
      const rule = oneOf(p.fillRule, ["nonzero", "evenodd"] as const);
      if (rule) path.fillRule = rule;
      const color = normalizeHex(p.colorHex);
      if (color) path.colorHex = color;
      return path;
    })
    .filter((p): p is VectorLike["paths"][number] => p !== null);
  if (paths.length === 0) return undefined;
  const out: VectorLike = { viewBox: box as [number, number, number, number], paths };
  const stroke = (vec.stroke ?? null) as Row | null;
  if (stroke && numOf(stroke.width) !== undefined) {
    out.stroke = { width: clamp(numOf(stroke.width)!, 0, 1000) };
    const cap = oneOf(stroke.cap, ["butt", "round", "square"] as const);
    if (cap) out.stroke.cap = cap;
    const join = oneOf(stroke.join, ["miter", "round", "bevel"] as const);
    if (join) out.stroke.join = join;
  }
  const source = (vec.source ?? null) as Row | null;
  if (source && typeof source.set === "string" && typeof source.name === "string") {
    out.source = { set: source.set.slice(0, 40), name: source.name.slice(0, 80) };
  }
  return out;
}

const FIELD_KINDS = ["text", "multiline", "select", "image", "shape", "icon"] as const;

/** One field from its stored shape, in either spelling: a template_fields
 * row (snake_case, as Postgres returns it) or a field as the client holds it
 * (camelCase). Unknown properties are dropped, every value is checked, and a
 * center-anchored box comes back as its top-left box. Null when the field
 * has no usable type or box. */
export function fieldFromStored(r: Row): ComposedField | null {
  const pick = (snake: string, camel: string): unknown => (snake in r ? r[snake] : r[camel]);
  const type = oneOf(r.type, FIELD_KINDS);
  const w = numOf(r.width);
  const h = numOf(r.height);
  let x = numOf(r.x);
  let y = numOf(r.y);
  if (!type || x === undefined || y === undefined || w === undefined || h === undefined) {
    return null;
  }
  if (w <= 0 || h <= 0) return null;
  if (pick("anchor", "anchor") === "center") {
    x -= w / 2;
    y -= h / 2;
  }
  const f: ComposedField = {
    id: strOf(r.id, 80) ?? "",
    label: strOf(r.label, 80) ?? "",
    fieldKey: strOf(pick("field_key", "fieldKey"), 60) ?? "",
    type,
    x,
    y,
    width: w,
    height: h,
  };
  const set = <K extends keyof ComposedField>(key: K, value: ComposedField[K] | undefined) => {
    if (value !== undefined) f[key] = value;
  };
  set("rotation", numOf(r.rotation));
  set("flipX", boolOf(pick("flip_x", "flipX")));
  set("flipY", boolOf(pick("flip_y", "flipY")));
  set("zIndex", numOf(pick("z_index", "zIndex")));
  set("static", boolOf(pick("is_static", "static")));
  set("staticValue", strOf(pick("static_value", "staticValue"), 2000));
  set("placeholder", strOf(r.placeholder, 500));
  set("optional", pick("is_optional", "optional") === true ? true : undefined);
  const options = pick("options", "options");
  if (Array.isArray(options)) {
    set("options", options.filter((o): o is string => typeof o === "string").slice(0, 30));
  }
  set("typeStyleKey", strOf(pick("type_style_key", "typeStyleKey"), 60));
  set("fontFamily", strOf(pick("font_family", "fontFamily"), 120));
  set("fontWeight", numOf(pick("font_weight", "fontWeight")));
  set("fontStyle", oneOf(pick("font_style", "fontStyle"), ["normal", "italic"] as const));
  set("fontStretch", strOf(pick("font_stretch", "fontStretch"), 40));
  set("fontSizePx", numOf(pick("font_size_px", "fontSizePx")));
  set("minFontScale", numOf(pick("min_font_scale", "minFontScale")));
  set("colorHex", normalizeHex(pick("color_hex", "colorHex")));
  set("textGradient", sanitizeGradient(pick("text_gradient", "textGradient")));
  set("align", oneOf(r.align, ["left", "center", "right"] as const));
  set(
    "verticalAlign",
    oneOf(pick("vertical_align", "verticalAlign"), ["top", "middle", "bottom"] as const),
  );
  set("uppercase", boolOf(r.uppercase));
  set("letterSpacingPx", numOf(pick("letter_spacing_px", "letterSpacingPx")));
  set("lineHeight", numOf(pick("line_height", "lineHeight")));
  set("maxLength", numOf(pick("max_length", "maxLength")));
  set("textSizing", oneOf(pick("text_sizing", "textSizing"), ["free", "shrink", "fill"] as const));
  set("objectFit", oneOf(pick("object_fit", "objectFit"), ["cover", "contain"] as const));
  set("cornerRadius", sanitizeCorners(pick("corner_radius", "cornerRadius")));
  set("opacity", numOf(r.opacity));
  set("shape", oneOf(r.shape, ["rect", "ellipse", "triangle", "star"] as const));
  set("strokeColor", normalizeHex(pick("stroke_color", "strokeColor")));
  set("strokeWidthPx", numOf(pick("stroke_width_px", "strokeWidthPx")));
  set(
    "strokeAlign",
    oneOf(pick("stroke_align", "strokeAlign"), ["inside", "center", "outside"] as const),
  );
  set("effects", sanitizeEffects(r.effects));
  set("vector", sanitizeVector(r.vector));
  set("plateColor", normalizeHex(pick("plate_color", "plateColor")));
  set("platePaddingX", numOf(pick("plate_padding_x", "platePaddingX")));
  set("platePaddingY", numOf(pick("plate_padding_y", "platePaddingY")));
  set("maskUrl", strOf(pick("mask_url", "maskUrl"), 2000));
  return f;
}

// ---------------------------------------------------------------------------
// The brand: Brand Studio plus the colors the team actually uses
// ---------------------------------------------------------------------------

export interface ColorEntry {
  key: string;
  name: string;
  hex: string;
  role?: string;
  /** "palette" for Brand Studio colors; "house" for colors the team's
   * templates use that the palette lacks; "neutral" for the plain white or
   * ink a legible design needs when neither has one. */
  source: "palette" | "house" | "neutral";
  /** How the team uses it, for the model. */
  usage?: string;
}

export interface TypeStyleEntry {
  key: string;
  name: string;
  family?: string;
  weight?: number;
  italic?: boolean;
  stretch?: string;
  sizePx?: number;
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  colorKey?: string;
  useFor?: "heading" | "body";
}

export interface BrandImage {
  id: string;
  name: string;
  source: string;
  aspect?: number;
}

export interface ComposeBrand {
  colors: ColorEntry[];
  typeStyles: TypeStyleEntry[];
  /** Families a design may name in `font`, in display spelling. */
  fonts: string[];
  /** Image sources for the logo on each ground. */
  logos: { light?: string; dark?: string };
  images: BrandImage[];
  guidelines: string[];
  allowOffPalette: boolean;
  allowStyleOverride: boolean;
}

export interface KitRowLike {
  colors?: unknown;
  type_styles?: unknown;
  guidelines?: unknown;
  primary_logo_asset_id?: unknown;
  primary_logo_dark_asset_id?: unknown;
  primary_logo_light_asset_id?: unknown;
  allow_off_palette?: unknown;
  allow_style_override?: unknown;
}

export interface AssetRowLike {
  id: string;
  kind: string;
  name: string;
  storage_path: string;
  metadata?: unknown;
}

/** A brand asset's image source: its storage reference ("brand-assets/…"),
 * or an external URL as stored. Mirrors toImageSource in
 * src/lib/stores/storageRef.ts for the brand-assets column. */
export function brandAssetSource(storagePath: string): string {
  const ref = parseStorageRef(storagePath);
  if (ref) return refKey(ref);
  if (/^(https?|data|blob):/.test(storagePath)) return storagePath;
  return `brand-assets/${storagePath}`;
}

function typeStylesFromKit(raw: unknown): TypeStyleEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TypeStyleEntry[] = [];
  for (const item of raw) {
    const s = (item ?? {}) as Row;
    const key = strOf(s.key, 60);
    if (!key) continue;
    const font = (s.font ?? null) as Row | null;
    const entry: TypeStyleEntry = { key, name: strOf(s.name, 80) ?? key };
    const family = font ? strOf(font.family, 120) : undefined;
    if (family) entry.family = family;
    const weight = numOf(s.weight);
    if (weight !== undefined) entry.weight = weight;
    if (s.fontStyle === "italic") entry.italic = true;
    const stretch = strOf(s.fontStretch, 40);
    if (stretch && stretch !== "normal") entry.stretch = stretch;
    const size = numOf(s.fontSizePx);
    if (size !== undefined) entry.sizePx = size;
    if (s.uppercase === true) entry.uppercase = true;
    const ls = numOf(s.letterSpacingPx);
    if (ls !== undefined) entry.letterSpacingPx = ls;
    const lh = numOf(s.lineHeight);
    if (lh !== undefined) entry.lineHeight = lh;
    const colorKey = strOf(s.colorKey, 60);
    if (colorKey) entry.colorKey = colorKey;
    const useFor = oneOf(s.useFor, ["heading", "body"] as const);
    if (useFor) entry.useFor = useFor;
    out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// References: the team's templates, element by element
// ---------------------------------------------------------------------------

export type RefRole = "text" | "shape" | "photo" | "artwork" | "logo" | "icon";

export interface RefElement {
  /** "R2.4": the reference's id, then the element's place in paint order. */
  id: string;
  role: RefRole;
  field: ComposedField;
}

export interface RefTemplate {
  /** "R1" for a published template, "D1" for one of the member's drafts. */
  id: string;
  templateId: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  canvasWidth: number;
  canvasHeight: number;
  background: {
    color?: string;
    gradient?: GradientLike;
    effects?: EffectLike[];
    hasImage: boolean;
  };
  elements: RefElement[];
  captionTemplate: string;
  /** Member values, for the member's drafts only. */
  values?: Record<string, string>;
}

export interface TemplateRowLike {
  id: string;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  canvas_width?: unknown;
  canvas_height?: unknown;
  background_color?: unknown;
  background_gradient?: unknown;
  background_storage_path?: unknown;
  canvas_effects?: unknown;
  caption_template?: unknown;
}

const LOGO_NAME_RE = /\b(logo|logos|wordmark|lockup|logomark|brandmark)\b/i;

function roleOf(f: ComposedField, logoSources: Set<string>): RefRole {
  if (f.type === "shape") return "shape";
  if (f.type === "icon") {
    // A logo drawn as vector art (an imported lockup) is still the logo.
    return LOGO_NAME_RE.test(`${f.label} ${f.fieldKey}`.replace(/[_-]+/g, " ")) ? "logo" : "icon";
  }
  if (f.type === "image") {
    if (!f.static) return "photo";
    const words = `${f.label} ${f.fieldKey}`.replace(/[_-]+/g, " ");
    const src = f.staticValue;
    if (
      (src && (logoSources.has(src) || logoSources.has(brandAssetSource(src)))) ||
      LOGO_NAME_RE.test(words)
    ) {
      return "logo";
    }
    return "artwork";
  }
  return "text";
}

/** Elements a template shows as a reference, at most this many. */
const REF_ELEMENT_CAP = 24;

/** The elements a reference keeps when it has more than `cap`: every one
 * that carries copy or the brand (text, the logo, photos, icons), then the
 * largest shapes and artwork, so a template with many small decorative
 * layers still shows its headline and logo. When copy alone would fill the
 * cap, its topmost elements stay and the four largest shapes keep their
 * places, so the grounds and panels still show. Paint order is kept. */
function keepWithin<T extends { f: ComposedField; role: RefRole }>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const area = (x: T) => Math.abs(x.f.width * x.f.height);
  const core = items.filter((x) => x.role !== "shape" && x.role !== "artwork");
  const rest = items
    .filter((x) => x.role === "shape" || x.role === "artwork")
    .sort((a, b) => area(b) - area(a));
  const shapes =
    core.length >= cap ? Math.min(4, rest.length) : Math.min(rest.length, cap - core.length);
  const kept = new Set([...core.slice(core.length - (cap - shapes)), ...rest.slice(0, shapes)]);
  return items.filter((x) => kept.has(x));
}

/** A published template (or a member's draft) as a reference. Elements are
 * ordered by paint order (zIndex, then list order), invisible ones are left
 * out, at most `cap` are kept (keepWithin), and each gets its id. */
export function refFromStored(
  id: string,
  template: TemplateRowLike,
  fieldRows: Row[],
  logoSources: Set<string>,
  cap = REF_ELEMENT_CAP,
): RefTemplate | null {
  const W = numOf(template.canvas_width);
  const H = numOf(template.canvas_height);
  if (!W || !H) return null;
  const painted = fieldRows
    .map((r, i) => ({ f: fieldFromStored(r), i }))
    .filter((x): x is { f: ComposedField; i: number } => x.f !== null)
    .filter(({ f }) => (f.opacity ?? 100) > 0)
    .sort((a, b) => (a.f.zIndex ?? 0) - (b.f.zIndex ?? 0) || a.i - b.i)
    .map(({ f }) => ({ f, role: roleOf(f, logoSources) }));
  const kept = keepWithin(painted, cap);
  const tags = Array.isArray(template.tags)
    ? template.tags.filter((t): t is string => typeof t === "string").slice(0, 12)
    : [];
  return {
    id,
    templateId: template.id,
    name: strOf(template.name, 120) ?? "Untitled",
    category: strOf(template.category, 80) ?? "",
    description: strOf(template.description, 400) ?? "",
    tags,
    canvasWidth: W,
    canvasHeight: H,
    background: {
      color: normalizeHex(template.background_color),
      gradient: sanitizeGradient(template.background_gradient),
      effects: sanitizeEffects(template.canvas_effects),
      hasImage:
        typeof template.background_storage_path === "string" &&
        template.background_storage_path.length > 0,
    },
    elements: kept.map(({ f, role }, i) => ({ id: `${id}.${i + 1}`, role, field: f })),
    captionTemplate: strOf(template.caption_template, 600) ?? "",
  };
}

const STOPWORDS = new Set(
  (
    "the and for with our your you are was were this that from have has will can into about " +
    "make made post posts graphic graphics design new please want need like just also more " +
    "its it's their them they what when where who how all any but not one two get got let"
  ).split(" "),
);

/** Lower-case word stems of a text, for overlap scoring. */
export function wordStems(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    out.add(raw.replace(/(ing|ed|es|s)$/, "") || raw);
  }
  return out;
}

export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/** How well a reference suits a brief on a canvas. Purpose counts most:
 * words the brief shares with the template's name, category and tags, then
 * with its labels, fixed copy, samples and caption. The same canvas size or
 * orientation counts less (a re-flow is cheap, the wrong kind of post is
 * not), then how much of the design is live layers the model can reuse,
 * and a logo to learn placement from. A flat import, its look baked into a
 * background image, lends little but its type. Recency breaks ties (the
 * list arrives newest first). */
export function referenceScore(
  ref: RefTemplate,
  briefStems: Set<string>,
  canvas: { width: number; height: number },
): number {
  const head = wordStems(`${ref.name} ${ref.category} ${ref.tags.join(" ")}`);
  const body = wordStems(
    [
      ref.description,
      ref.captionTemplate.replace(/\{[a-z0-9_]+\}/g, " "),
      ...ref.elements.map((e) =>
        e.role === "text"
          ? `${e.field.label} ${e.field.static ? (e.field.staticValue ?? "") : (e.field.placeholder ?? "")}`
          : e.field.label,
      ),
    ].join(" "),
  );
  let score = 4 * overlap(briefStems, head) + 1.5 * overlap(briefStems, body);
  const sameSize = ref.canvasWidth === canvas.width && ref.canvasHeight === canvas.height;
  const ratio = (w: number, h: number) => (Math.abs(w / h - 1) < 0.01 ? 0 : w > h ? 1 : -1);
  if (sameSize) score += 2.5;
  else if (ratio(ref.canvasWidth, ref.canvasHeight) === ratio(canvas.width, canvas.height)) {
    score += 1;
  }
  score += Math.min(ref.elements.length, 12) / 12;
  if (ref.elements.some((e) => e.role === "logo")) score += 0.5;
  if (ref.background.hasImage && ref.elements.filter((e) => e.role !== "text").length < 2) {
    score -= 3;
  }
  return score;
}

/** The references the model sees: the most relevant `cap` of them. */
export function selectReferences(
  refs: RefTemplate[],
  brief: string,
  canvas: { width: number; height: number },
  cap = 8,
): RefTemplate[] {
  const stems = wordStems(brief);
  return refs
    .map((ref, i) => ({ ref, score: referenceScore(ref, stems, canvas) - i * 0.001 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map(({ ref }, i) => renumber(ref, `R${i + 1}`));
}

function renumber(ref: RefTemplate, id: string): RefTemplate {
  return {
    ...ref,
    id,
    elements: ref.elements.map((e, i) => ({ ...e, id: `${id}.${i + 1}` })),
  };
}

// ---------------------------------------------------------------------------
// The house style: what the team's templates do, measured
// ---------------------------------------------------------------------------

/** A style length scale between two canvases: the square root of their area
 * ratio, held between their width and height ratios, so a portrait's 88px
 * headline lands near 79px on a square and near 63px on a landscape link
 * image rather than shrinking with the short side alone. */
export function canvasScale(
  from: { width: number; height: number },
  to: { width: number; height: number },
): number {
  const sw = to.width / from.width;
  const sh = to.height / from.height;
  return clamp(Math.sqrt(sw * sh), Math.min(sw, sh), Math.max(sw, sh));
}

export const median = (xs: number[]): number | undefined => {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function countBy<T>(xs: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

const topEntries = <T>(m: Map<T, number>, n: number) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export interface HouseStyle {
  templateCount: number;
  sizes: Array<{ size: string; count: number }>;
  /** Every length below is in this canvas's pixels, each template's own
   * value scaled to it: margins and the logo by the short side (a story
   * keeps a portrait's 80px sides), type, radii and effects by canvasScale
   * (a landscape link image's 52px headline reads as about 72px here). */
  margin?: { side: number; top: number; bottom: number };
  logo?: {
    count: number;
    corner: string;
    width: number;
    /** Logo width over height. */
    aspect: number;
  };
  type?: {
    headline: number;
    headlineRange: [number, number];
    body?: number;
    ratio?: number;
    headlineStyle?: string;
    bodyStyle?: string;
    align?: string;
    families: string[];
  };
  grounds: {
    light: number;
    dark: number;
    image: number;
    keys: Array<{ hex: string; count: number }>;
  };
  textColors: Array<{ hex: string; count: number }>;
  accentColors: Array<{ hex: string; count: number }>;
  gradients: number;
  grain: number;
  radii: Array<{ radius: number; count: number }>;
  pills: number;
  plates: number;
  strokes: number;
  shadows: number;
  shadow?: { y: number; blur: number; alpha: number };
  glows: number;
  blurs: number;
  photos: number;
  photoRadius?: number;
  icons: number;
  artwork: number;
  elements: { median: number; max: number };
  fixedCopy: string[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const boxOf = (f: { x: number; y: number; width: number; height: number }): Box => ({
  x: f.x,
  y: f.y,
  w: f.width,
  h: f.height,
});

/** The size a text field renders at before any shrink: its own size, or its
 * bound style's when that style fixes one. */
function setSize(f: ComposedField, styles: Map<string, TypeStyleEntry>): number | undefined {
  const style = f.typeStyleKey ? styles.get(f.typeStyleKey) : undefined;
  return style?.sizePx ?? f.fontSizePx;
}

export function maxRadius(c: CornersLike | undefined): number {
  return c ? Math.max(c.tl, c.tr, c.br, c.bl) : 0;
}

/** The fill a shape paints, as one color (a gradient's average). */
export function fillOf(f: ComposedField): string | undefined {
  if (f.textGradient) return averageHex(f.textGradient.stops.map((s) => s.color));
  return f.colorHex;
}

function groundOfTemplate(ref: RefTemplate): string | "image" {
  const W = ref.canvasWidth;
  const H = ref.canvasHeight;
  const full = ref.elements.find(
    (e) =>
      e.role === "shape" &&
      e.field.width * e.field.height >= 0.6 * W * H &&
      (e.field.opacity ?? 100) >= 90,
  );
  if (full) {
    const fill = fillOf(full.field);
    if (fill) return fill;
  }
  if (ref.background.gradient) return averageHex(ref.background.gradient.stops.map((s) => s.color));
  if (ref.background.color) return ref.background.color;
  if (ref.background.hasImage) return "image";
  return "#ffffff";
}

function cornerOf(b: Box, W: number, H: number): string {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const v = cy < H / 3 ? "top" : cy > (2 * H) / 3 ? "bottom" : "middle";
  const h = cx < W / 3 ? "left" : cx > (2 * W) / 3 ? "right" : "center";
  return v === "middle" && h === "center" ? "center" : `${v} ${h}`;
}

/** The color a text field renders in: its bound style's palette color when
 * the style fixes one, else its own. Gradient text reads as its average. */
function renderedTextColor(
  f: ComposedField,
  styles: Map<string, TypeStyleEntry>,
  colors: Map<string, string>,
): string | undefined {
  const style = f.typeStyleKey ? styles.get(f.typeStyleKey) : undefined;
  const styleHex = style?.colorKey ? colors.get(style.colorKey) : undefined;
  if (styleHex) return styleHex;
  if (f.textGradient) return averageHex(f.textGradient.stops.map((s) => s.color));
  return f.colorHex;
}

/** A label: small, spaced, uppercase text such as an eyebrow or a "Date"
 * caption. It is never a template's body copy. */
const isLabel = (f: ComposedField, styles: Map<string, TypeStyleEntry>): boolean =>
  (f.typeStyleKey ? styles.get(f.typeStyleKey)?.uppercase : undefined) === true ||
  f.uppercase === true;

/** The house style across `refs` (all of the team's published templates),
 * measured for `canvas`. */
export function houseStyle(
  refs: RefTemplate[],
  brand: ComposeBrand,
  canvas: { width: number; height: number } = { width: 1080, height: 1350 },
): HouseStyle {
  const styles = new Map(brand.typeStyles.map((s) => [s.key, s]));
  const colors = new Map(brand.colors.map((c) => [c.key, c.hex]));
  const sides: number[] = [];
  const tops: number[] = [];
  const bottoms: number[] = [];
  const logoCorners: string[] = [];
  const logoWidths: number[] = [];
  const logoAspects: number[] = [];
  const heads: number[] = [];
  const bodies: number[] = [];
  const ratios: number[] = [];
  const headStyles: string[] = [];
  const bodyStyles: string[] = [];
  const aligns: string[] = [];
  const families: string[] = [];
  const groundKinds: string[] = [];
  const groundHexes: string[] = [];
  const textHexes: string[] = [];
  const accentHexes: string[] = [];
  const radii: number[] = [];
  const shadowYs: number[] = [];
  const shadowBlurs: number[] = [];
  const shadowAlphas: number[] = [];
  const photoRadii: number[] = [];
  const counts: number[] = [];
  const fixedCopy = new Set<string>();
  let logoCount = 0;
  let gradients = 0;
  let grain = 0;
  let pills = 0;
  let plates = 0;
  let strokes = 0;
  let shadows = 0;
  let glows = 0;
  let blurs = 0;
  let photos = 0;
  let icons = 0;
  let artwork = 0;

  for (const ref of refs) {
    const W = ref.canvasWidth;
    const H = ref.canvasHeight;
    const s = canvasScale({ width: W, height: H }, canvas);
    // Margins and the logo follow the short side: a 1080 wide story keeps
    // a 1080 wide portrait's 80px sides.
    const sm = Math.min(canvas.width, canvas.height) / Math.min(W, H);
    counts.push(ref.elements.length);
    // Margins: how far everything that sits inside the canvas keeps from
    // its edges. Anything that touches an edge bleeds on purpose.
    const inset = ref.elements.filter(
      (e) =>
        e.field.x >= 1 &&
        e.field.y >= 1 &&
        e.field.x + e.field.width <= W - 1 &&
        e.field.y + e.field.height <= H - 1,
    );
    if (inset.length > 0) {
      sides.push(
        sm * Math.min(...inset.map((e) => Math.min(e.field.x, W - e.field.x - e.field.width))),
      );
      tops.push(sm * Math.min(...inset.map((e) => e.field.y)));
      bottoms.push(sm * Math.min(...inset.map((e) => H - e.field.y - e.field.height)));
    }

    const logo = ref.elements.find((e) => e.role === "logo");
    if (logo) {
      logoCount++;
      logoCorners.push(cornerOf(boxOf(logo.field), W, H));
      logoWidths.push(sm * logo.field.width);
      logoAspects.push(logo.field.width / logo.field.height);
    }

    const texts = ref.elements
      .filter((e) => e.role === "text")
      .map((e) => ({ e, size: setSize(e.field, styles) }))
      .filter((t): t is { e: RefElement; size: number } => t.size !== undefined);
    if (texts.length > 0) {
      const sorted = [...texts].sort((a, b) => b.size - a.size);
      const head = sorted[0];
      heads.push(s * head.size);
      if (head.e.field.typeStyleKey) headStyles.push(head.e.field.typeStyleKey);
      aligns.push(head.e.field.align ?? "left");
      // The body: the most used size among the copy that is not a label,
      // multiline copy first; with none, the largest label.
      const copy = sorted.slice(1).filter((t) => !isLabel(t.e.field, styles));
      const pool = copy.length > 0 ? copy : sorted.slice(1);
      if (pool.length > 0) {
        const multi = pool.filter((t) => t.e.field.type === "multiline");
        const ranked = topEntries(countBy((multi.length ? multi : pool).map((t) => t.size)), 1)[0];
        const body = ranked[0];
        bodies.push(s * body);
        ratios.push(head.size / body);
        const bodyEl = pool.find((t) => t.size === body);
        if (bodyEl?.e.field.typeStyleKey) bodyStyles.push(bodyEl.e.field.typeStyleKey);
      }
    }
    for (const e of ref.elements) {
      const f = e.field;
      if (e.role === "text") {
        const style = f.typeStyleKey ? styles.get(f.typeStyleKey) : undefined;
        const family = style?.family ?? f.fontFamily;
        if (family) families.push(family);
        const color = renderedTextColor(f, styles, colors);
        if (color) textHexes.push(color);
        const copy = f.static ? f.staticValue?.replace(/\s+/g, " ").trim() : undefined;
        if (copy && copy.length <= 40 && /[a-z].*[a-z]/i.test(copy)) fixedCopy.add(copy);
        if (f.plateColor) {
          plates++;
          accentHexes.push(f.plateColor);
          if (!f.cornerRadius || maxRadius(f.cornerRadius) >= f.height / 2) pills++;
        }
      }
      if (e.role === "shape") {
        const fill = fillOf(f);
        if (fill && f.width * f.height < 0.6 * W * H) accentHexes.push(fill);
        if (f.textGradient) gradients++;
        if (f.shape === "rect" || f.shape === undefined) {
          const r = maxRadius(f.cornerRadius);
          if (r > 0 && r < Math.min(f.width, f.height) / 2) radii.push(s * r);
        }
      }
      if (f.strokeColor && (f.strokeWidthPx ?? 0) > 0) strokes++;
      if (e.role === "photo") {
        photos++;
        const r = maxRadius(f.cornerRadius);
        if (r > 0) {
          photoRadii.push(s * r);
          if (r < Math.min(f.width, f.height) / 2) radii.push(s * r);
        }
      }
      if (e.role === "icon") icons++;
      if (e.role === "artwork") artwork++;
      for (const fx of f.effects ?? []) {
        if (fx.type === "dropShadow") {
          if (fx.x === 0 && fx.y === 0) glows++;
          else {
            shadows++;
            shadowYs.push(s * fx.y);
            shadowBlurs.push(s * fx.blur);
            shadowAlphas.push(alphaOf(fx.color));
          }
        } else if (fx.type === "layerBlur") blurs++;
        else if (fx.type === "noise") grain++;
      }
    }
    if (ref.background.gradient) gradients++;
    if (ref.background.effects?.some((fx) => fx.type === "noise")) grain++;
    const ground = groundOfTemplate(ref);
    if (ground === "image") groundKinds.push("image");
    else {
      groundKinds.push(relativeLuminance(ground) < 0.2 ? "dark" : "light");
      groundHexes.push(ground);
    }
  }

  const kinds = countBy(groundKinds);
  const out: HouseStyle = {
    templateCount: refs.length,
    sizes: topEntries(countBy(refs.map((r) => `${r.canvasWidth}x${r.canvasHeight}`)), 6).map(
      ([size, count]) => ({ size, count }),
    ),
    grounds: {
      light: kinds.get("light") ?? 0,
      dark: kinds.get("dark") ?? 0,
      image: kinds.get("image") ?? 0,
      keys: topEntries(countBy(groundHexes), 4).map(([hex, count]) => ({ hex, count })),
    },
    textColors: topEntries(countBy(textHexes), 4).map(([hex, count]) => ({ hex, count })),
    accentColors: topEntries(countBy(accentHexes), 4).map(([hex, count]) => ({ hex, count })),
    gradients,
    grain,
    radii: topEntries(countBy(radii.map((r) => Math.round(r))), 3).map(([radius, count]) => ({
      radius,
      count,
    })),
    pills,
    plates,
    strokes,
    shadows,
    glows,
    blurs,
    photos,
    icons,
    artwork,
    elements: { median: median(counts) ?? 0, max: counts.length ? Math.max(...counts) : 0 },
    fixedCopy: [...fixedCopy].slice(0, 8),
  };
  if (sides.length > 0) {
    out.margin = { side: median(sides)!, top: median(tops)!, bottom: median(bottoms)! };
  }
  if (logoCount > 0) {
    out.logo = {
      count: logoCount,
      corner: topEntries(countBy(logoCorners), 1)[0][0],
      width: median(logoWidths)!,
      aspect: median(logoAspects)!,
    };
  }
  if (heads.length > 0) {
    out.type = {
      headline: median(heads)!,
      headlineRange: [Math.min(...heads), Math.max(...heads)],
      families: topEntries(countBy(families), 3).map(([f]) => f),
    };
    if (bodies.length > 0) out.type.body = median(bodies)!;
    if (ratios.length > 0) out.type.ratio = median(ratios)!;
    const hs = topEntries(countBy(headStyles), 1)[0];
    if (hs) out.type.headlineStyle = hs[0];
    const bs = topEntries(countBy(bodyStyles), 1)[0];
    if (bs) out.type.bodyStyle = bs[0];
    out.type.align = topEntries(countBy(aligns), 1)[0]?.[0];
  }
  if (shadows > 0) {
    out.shadow = {
      y: median(shadowYs)!,
      blur: median(shadowBlurs)!,
      alpha: median(shadowAlphas)!,
    };
  }
  if (photoRadii.length > 0) out.photoRadius = median(photoRadii);
  return out;
}

// ---------------------------------------------------------------------------
// The brand, assembled
// ---------------------------------------------------------------------------

/** Brand Studio plus the team's colors. Palette colors come first with
 * their roles. When the brand allows off-palette color, colors the team's
 * templates use that the palette lacks follow (at most eight, most used
 * first), then a plain white and ink if nothing light or dark is there yet,
 * so a design can always put readable text on its ground. */
export function buildBrand(input: {
  kit: KitRowLike | null;
  assets: AssetRowLike[];
  refs: RefTemplate[];
}): ComposeBrand {
  const kit = input.kit ?? {};
  const allowOffPalette = kit.allow_off_palette !== false;
  const colors: ColorEntry[] = [];
  const keys = new Set<string>();
  const hexes = new Set<string>();
  for (const raw of Array.isArray(kit.colors) ? kit.colors : []) {
    const c = (raw ?? {}) as Row;
    const key = strOf(c.key, 60);
    const hex = normalizeHex(c.hex);
    if (!key || !hex || keys.has(key)) continue;
    keys.add(key);
    hexes.add(hex);
    const entry: ColorEntry = { key, name: strOf(c.name, 80) ?? key, hex, source: "palette" };
    const role = oneOf(c.role, ["primary", "secondary", "accent"] as const);
    if (role) entry.role = role;
    colors.push(entry);
  }

  const uniqueKey = (base: string) => {
    let key = base;
    let n = 2;
    while (keys.has(key)) key = `${base}_${n++}`;
    keys.add(key);
    return key;
  };

  if (allowOffPalette) {
    // Every color the team paints with, by where it is used.
    const used = new Map<string, Map<string, number>>();
    const note = (hex: string | undefined, how: string) => {
      if (!hex || hexes.has(hex)) return;
      const m = used.get(hex) ?? new Map<string, number>();
      m.set(how, (m.get(how) ?? 0) + 1);
      used.set(hex, m);
    };
    for (const ref of input.refs) {
      note(ref.background.color, "ground");
      for (const s of ref.background.gradient?.stops ?? []) note(s.color, "gradient");
      for (const e of ref.elements) {
        const f = e.field;
        if (e.role === "text") note(f.colorHex, "text");
        if (e.role === "shape") note(f.colorHex, "fill");
        if (e.role === "icon") note(f.colorHex, "icon");
        note(f.plateColor, "plate");
        note(f.strokeColor, "stroke");
        for (const s of f.textGradient?.stops ?? []) note(s.color, "gradient");
      }
    }
    const ranked = [...used.entries()]
      .map(([hex, hows]) => ({ hex, hows, total: [...hows.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    ranked.forEach(({ hex, hows }, i) => {
      const usage = topEntries(hows, 2)
        .map(([how, n]) => `${how} ${n}x`)
        .join(", ");
      colors.push({
        key: uniqueKey(`house_${i + 1}`),
        name: `Team color ${i + 1}`,
        hex,
        source: "house",
        usage,
      });
      hexes.add(hex);
    });
    const lum = colors.map((c) => relativeLuminance(c.hex));
    if (!lum.some((l) => l > 0.8)) {
      colors.push({ key: uniqueKey("white"), name: "White", hex: "#ffffff", source: "neutral" });
    }
    if (!lum.some((l) => l < 0.03)) {
      colors.push({ key: uniqueKey("ink"), name: "Ink", hex: "#111111", source: "neutral" });
    }
  }

  const typeStyles = typeStylesFromKit(kit.type_styles);

  // Fonts: the type styles', the uploaded families', and the ones the
  // team's templates set directly.
  const fonts = new Map<string, string>();
  const addFont = (f: string | undefined) => {
    if (f && !fonts.has(f.toLowerCase())) fonts.set(f.toLowerCase(), f);
  };
  for (const s of typeStyles) addFont(s.family);
  for (const a of input.assets) {
    if (a.kind === "font") {
      addFont(
        fontAssetFamily({ name: a.name, metadata: (a.metadata ?? null) as { family?: string } }),
      );
    }
  }
  for (const ref of input.refs) for (const e of ref.elements) addFont(e.field.fontFamily);

  // Logos: each ground's primary, else one tagged for it, else the legacy
  // primary, else any. With none in Brand Studio, the logo the team's own
  // templates place.
  const logoAssets = input.assets.filter((a) => a.kind === "logo");
  const byId = new Map(logoAssets.map((a) => [a.id, a]));
  const surfacesOf = (a: AssetRowLike): string[] => {
    const m = (a.metadata ?? {}) as Row;
    return Array.isArray(m.surfaces) && m.surfaces.length > 0
      ? m.surfaces.filter((s): s is string => typeof s === "string")
      : ["dark", "light"];
  };
  const pickLogo = (surface: "dark" | "light", primaryId: unknown): AssetRowLike | undefined =>
    (typeof primaryId === "string" ? byId.get(primaryId) : undefined) ??
    logoAssets.find((a) => surfacesOf(a).includes(surface)) ??
    (typeof kit.primary_logo_asset_id === "string"
      ? byId.get(kit.primary_logo_asset_id)
      : undefined) ??
    logoAssets[0];
  const logos: ComposeBrand["logos"] = {};
  const light = pickLogo("light", kit.primary_logo_light_asset_id);
  const dark = pickLogo("dark", kit.primary_logo_dark_asset_id);
  if (light) logos.light = brandAssetSource(light.storage_path);
  if (dark) logos.dark = brandAssetSource(dark.storage_path);
  if (!light && !dark) {
    const fromTemplate = input.refs
      .flatMap((r) => r.elements)
      .find((e) => e.role === "logo" && e.field.staticValue)?.field.staticValue;
    if (fromTemplate) logos.light = logos.dark = fromTemplate;
  }

  const images: BrandImage[] = input.assets
    .filter((a) => a.kind === "image")
    .slice(0, 12)
    .map((a, i) => {
      const m = (a.metadata ?? {}) as Row;
      const w = numOf(m.width);
      const h = numOf(m.height);
      const img: BrandImage = {
        id: `I${i + 1}`,
        name: a.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80),
        source: brandAssetSource(a.storage_path),
      };
      if (w && h) img.aspect = w / h;
      return img;
    });

  const guidelines = Array.isArray(kit.guidelines)
    ? kit.guidelines
        .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        .slice(0, 30)
        .map((g) => g.slice(0, 300))
    : [];

  return {
    colors,
    typeStyles,
    fonts: [...fonts.values()],
    logos,
    images,
    guidelines,
    allowOffPalette,
    allowStyleOverride: kit.allow_style_override === true,
  };
}

// ---------------------------------------------------------------------------
// The member's current drafts (a follow-up's context)
// ---------------------------------------------------------------------------

const CURRENT_DESIGNS_CAP = 3;
const CURRENT_FIELDS_CAP = 40;

/** The member's current drafts, sent with a follow-up so a message like
 * "make the date Friday" revises them instead of starting over. Request
 * input, parsed like the rest of the body: shape errors are a 400. Images
 * keep only references inside this company's own storage folder; any other
 * source is dropped with the element. */
export function parseCurrentDesigns(raw: unknown, companyId: string): RefTemplate[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.length > CURRENT_DESIGNS_CAP) {
    throw new HttpError(
      400,
      `currentDesigns must be an array of at most ${CURRENT_DESIGNS_CAP} entries.`,
    );
  }
  return raw.map((entry, i) => {
    const at = `currentDesigns[${i}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new HttpError(400, `${at} must be an object.`);
    }
    const d = entry as Row;
    const design = (d.design ?? null) as Row | null;
    if (!design || typeof design !== "object" || !Array.isArray(design.fields)) {
      throw new HttpError(400, `${at}.design must be an object with a fields array.`);
    }
    if (design.fields.length > CURRENT_FIELDS_CAP) {
      throw new HttpError(
        400,
        `${at}.design.fields must have at most ${CURRENT_FIELDS_CAP} entries.`,
      );
    }
    const W = numOf(design.canvasWidth);
    const H = numOf(design.canvasHeight);
    if (!W || !H || W > 10_000 || H > 10_000) {
      throw new HttpError(400, `${at}.design needs a canvasWidth and canvasHeight.`);
    }
    // A fixed image and a mask must sit in this company's own storage folder,
    // read the way the renderer reads them (a bare path implies its bucket).
    // The check runs on the parsed field, so either spelling of a property is
    // covered, and fixed text is only text.
    const ownSource = (v: string | undefined, bucket: PublicBucket): boolean => {
      if (!v) return true;
      const ref = refWithImpliedBucket(bucket, v);
      return ref !== null && refInCompany(ref, companyId);
    };
    const fieldRows = (design.fields as unknown[]).filter((f): f is Row => {
      if (!f || typeof f !== "object" || Array.isArray(f)) return false;
      const field = fieldFromStored(f as Row);
      return (
        field !== null &&
        (field.type !== "image" || ownSource(field.staticValue, "brand-assets")) &&
        ownSource(field.maskUrl, "template-backgrounds")
      );
    });
    const ref = refFromStored(
      `D${i + 1}`,
      {
        id: `D${i + 1}`,
        name: design.name,
        canvas_width: W,
        canvas_height: H,
        background_color: design.backgroundColor,
        background_gradient: design.backgroundGradient,
        canvas_effects: design.canvasEffects,
        caption_template: design.captionTemplate,
      },
      fieldRows,
      new Set(),
      CURRENT_FIELDS_CAP,
    );
    if (!ref) throw new HttpError(400, `${at}.design is not a usable design.`);
    const values: Record<string, string> = {};
    if (Array.isArray(d.values)) {
      for (const v of d.values.slice(0, 60)) {
        const e = (v ?? {}) as Row;
        if (typeof e.fieldKey === "string" && typeof e.value === "string") {
          if (!e.value.startsWith("data:"))
            values[e.fieldKey.slice(0, 60)] = e.value.slice(0, 4000);
        }
      }
    }
    // A logo the member's draft carries is a logo again here.
    for (const el of ref.elements) {
      if (
        el.role === "artwork" &&
        LOGO_NAME_RE.test(`${el.field.label} ${el.field.fieldKey}`.replace(/[_-]+/g, " "))
      ) {
        el.role = "logo";
      }
    }
    return { ...ref, values };
  });
}

// ---------------------------------------------------------------------------
// The context a compose call is built from
// ---------------------------------------------------------------------------

export interface ComposeContext {
  canvasWidth: number;
  canvasHeight: number;
  brand: ComposeBrand;
  house: HouseStyle;
  references: RefTemplate[];
  drafts: RefTemplate[];
  /** Margin in canvas px that text, the logo and buttons keep. */
  margin: number;
  /** The story safe band: text and the logo stay between these. */
  safeTop: number;
  safeBottom: number;
  /** The team puts a logo on most posts, and there is one to place: Brand
   * Studio's files or the team's vector logo. */
  expectLogo: boolean;
  /** The logo the team's templates draw as vector art (an imported lockup),
   * from the most relevant template that has one. A logo element draws it
   * when Brand Studio has no logo file. */
  teamLogo?: ComposedField;
  hasPhoto: boolean;
  elementCap: number;
}

/** The first vector logo in these templates, in order. */
function vectorLogoIn(refs: RefTemplate[]): ComposedField | undefined {
  for (const ref of refs) {
    const el = ref.elements.find(
      (e) => e.role === "logo" && e.field.type === "icon" && e.field.vector,
    );
    if (el) return el.field;
  }
  return undefined;
}

/** The canvas a new design takes when the member names no platform: the
 * size of the draft being revised, else the size the team's published
 * templates use most (the newest on a tie), the way a filled template kept
 * its own size. Undefined when there is neither. */
export function unhintedCanvas(
  published: RefTemplate[],
  drafts: RefTemplate[] = [],
): { width: number; height: number } | undefined {
  if (drafts[0]) return { width: drafts[0].canvasWidth, height: drafts[0].canvasHeight };
  const counts = new Map<string, { width: number; height: number; n: number }>();
  for (const r of published) {
    const key = `${r.canvasWidth}x${r.canvasHeight}`;
    const hit = counts.get(key);
    if (hit) hit.n++;
    else counts.set(key, { width: r.canvasWidth, height: r.canvasHeight, n: 1 });
  }
  let best: { width: number; height: number; n: number } | undefined;
  // Newest first, so a strict comparison keeps the newest on a tie.
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? { width: best.width, height: best.height } : undefined;
}

/** Story and reel canvases: the platform's own controls cover the top 250px
 * and the bottom 450px at 1080x1920 (Knowledge Base, section 5). */
function isStory(w: number, h: number): boolean {
  return h / w >= 1.7;
}

export function composeContext(input: {
  canvas: { width: number; height: number };
  brand: ComposeBrand;
  /** Every published template, newest first. */
  published: RefTemplate[];
  brief: string;
  drafts?: RefTemplate[];
  hasPhoto: boolean;
  referenceCap?: number;
}): ComposeContext {
  const W = input.canvas.width;
  const H = input.canvas.height;
  const house = houseStyle(input.published, input.brand, input.canvas);
  const short = Math.min(W, H);
  const fromHouse = house.margin ? house.margin.side : 0.07 * short;
  const margin = Math.round(clamp(fromHouse, 0.04 * short, 0.12 * short));
  const story = isStory(W, H);
  const references = selectReferences(
    input.published,
    input.brief,
    input.canvas,
    input.referenceCap,
  );
  const maxRef = Math.max(0, ...references.map((r) => r.elements.length), house.elements.max);
  // Every published template, not only the references, so the logo the
  // prompt promises and the one the validator places are the same.
  const teamLogo = vectorLogoIn([...references, ...input.published]);
  return {
    canvasWidth: W,
    canvasHeight: H,
    brand: input.brand,
    house,
    references,
    drafts: input.drafts ?? [],
    margin,
    safeTop: story ? Math.max(margin, Math.round((250 * H) / 1920)) : margin,
    safeBottom: story ? Math.max(margin, Math.round((450 * H) / 1920)) : margin,
    expectLogo:
      (Boolean(input.brand.logos.light || input.brand.logos.dark) || teamLogo !== undefined) &&
      house.logo !== undefined &&
      house.logo.count >= Math.max(1, Math.ceil(house.templateCount / 2)),
    ...(teamLogo ? { teamLogo } : {}),
    hasPhoto: input.hasPhoto,
    elementCap: clamp(maxRef + 4, 12, 30),
  };
}
