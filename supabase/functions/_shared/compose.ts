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
// which looks to reuse. This module places and checks (brand-system RULES
// rule 8): every color must be a key from the brand's color list and leaves
// as baked hex, fonts come from the brand, the logo is chosen for the ground
// under it, text and the logo are kept inside the margins and the story safe
// band, text that would not read on its ground is recolored, and overlapping
// text, text straight on a photo or a missing logo go back to the model once.
//
// Warnings reach the member, so none carries an em dash; errors go back to
// the model for its retry.

import {
  emDashesToSentences,
  replaceEmDashes,
  validateReplyAndTitle,
  type ImageFieldNeeded,
} from "./generateValidate.ts";
import { isRequiredField } from "./fieldRules.ts";
import { HttpError } from "./http.ts";
import { fontAssetFamily, parseStorageRef, refInCompany, refKey } from "./publicLink.ts";

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
function alphaOf(color: string): number {
  const m = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(color.trim());
  return m ? parseInt(m[1], 16) / 255 : 1;
}

function rgbOf(hex: string): [number, number, number] {
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
function mixHex(top: string, bottom: string, alpha: number): string {
  const t = rgbOf(top);
  const b = rgbOf(bottom);
  return `#${t.map((c, i) => toHexByte(c * alpha + b[i] * (1 - alpha))).join("")}`;
}

function averageHex(colors: string[]): string {
  const rgbs = colors.map(rgbOf);
  const avg = [0, 1, 2].map((i) => rgbs.reduce((sum, c) => sum + c[i], 0) / rgbs.length);
  return `#${avg.map(toHexByte).join("")}`;
}

function withAlpha(hex: string, alpha: number): string {
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

const numOf = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const strOf = (v: unknown, max = 4000): string | undefined =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined;
const boolOf = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
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

/** Elements a reference shows, at most this many, in paint order. */
const REF_ELEMENT_CAP = 24;

/** A published template (or a member's draft) as a reference. Elements are
 * ordered by paint order (zIndex, then list order), invisible ones are left
 * out, and each gets its id. */
export function refFromStored(
  id: string,
  template: TemplateRowLike,
  fieldRows: Row[],
  logoSources: Set<string>,
): RefTemplate | null {
  const W = numOf(template.canvas_width);
  const H = numOf(template.canvas_height);
  if (!W || !H) return null;
  const fields = fieldRows
    .map((r, i) => ({ f: fieldFromStored(r), i }))
    .filter((x): x is { f: ComposedField; i: number } => x.f !== null)
    .filter(({ f }) => (f.opacity ?? 100) > 0)
    .sort((a, b) => (a.f.zIndex ?? 0) - (b.f.zIndex ?? 0) || a.i - b.i)
    .slice(0, REF_ELEMENT_CAP)
    .map(({ f }) => f);
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
    elements: fields.map((f, i) => ({
      id: `${id}.${i + 1}`,
      role: roleOf(f, logoSources),
      field: f,
    })),
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

function overlap(a: Set<string>, b: Set<string>): number {
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

const median = (xs: number[]): number | undefined => {
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (f: { x: number; y: number; width: number; height: number }): Box => ({
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

function maxRadius(c: CornersLike | undefined): number {
  return c ? Math.max(c.tl, c.tr, c.br, c.bl) : 0;
}

/** The fill a shape paints, as one color (a gradient's average). */
function fillOf(f: ComposedField): string | undefined {
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
    const ownSource = (v: string | undefined): boolean => {
      if (!v) return true;
      const ref = parseStorageRef(v);
      return ref !== null && refInCompany(ref, companyId);
    };
    const fieldRows = (design.fields as unknown[]).filter((f): f is Row => {
      if (!f || typeof f !== "object" || Array.isArray(f)) return false;
      const row = f as Row;
      return (
        ownSource(typeof row.staticValue === "string" ? row.staticValue : undefined) &&
        ownSource(typeof row.maskUrl === "string" ? row.maskUrl : undefined)
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
  /** The team puts a logo on most posts and Brand Studio has one. */
  expectLogo: boolean;
  hasPhoto: boolean;
  elementCap: number;
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
      (Boolean(input.brand.logos.light || input.brand.logos.dark) ||
        input.published.some((r) => r.elements.some((e) => e.role === "logo" && e.field.vector))) &&
      house.logo !== undefined &&
      house.logo.count >= Math.max(1, Math.ceil(house.templateCount / 2)),
    hasPhoto: input.hasPhoto,
    elementCap: clamp(maxRef + 4, 12, 30),
  };
}

// ---------------------------------------------------------------------------
// What the model reads
// ---------------------------------------------------------------------------

function colorLabel(hex: string, brand: ComposeBrand): string {
  const hit = brand.colors.find((c) => c.hex === hex);
  return hit ? hit.key : hex;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const px = (n: number) => `${Math.round(n)}`;
/** A string as the model reads it: quoted, whitespace collapsed, and cut at
 * a word boundary past `max` with how long the whole was, since a sample's
 * length is what tells the model how much copy a box was drawn for. */
const quote = (s: string, max: number) => {
  const text = s.replace(/\s+/g, " ").trim();
  if (text.length <= max) return JSON.stringify(text);
  const cut = text.slice(0, max);
  const word = cut
    .slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max / 2)))
    .replace(/[\s.,;:]+$/, "");
  return `${JSON.stringify(`${word}...`)} (${text.length} chars)`;
};

function gradientText(g: GradientLike, brand: ComposeBrand): string {
  const stops = g.stops
    .map((s) => `${colorLabel(s.color, brand)} ${round2(s.position)}`)
    .join(", ");
  return g.kind === "radial"
    ? `radial gradient [${stops}]`
    : `linear gradient ${Math.round(g.angle)}deg [${stops}]`;
}

function effectsText(effects: EffectLike[] | undefined, brand: ComposeBrand): string[] {
  const out: string[] = [];
  for (const fx of effects ?? []) {
    if (fx.type === "dropShadow") {
      const color = `${colorLabel(normalizeHex(fx.color) ?? fx.color, brand)} ${pct(alphaOf(fx.color))}`;
      out.push(
        fx.x === 0 && fx.y === 0
          ? `glow ${px(fx.blur)} ${color}`
          : `shadow ${px(fx.x)},${px(fx.y)} blur ${px(fx.blur)} ${color}`,
      );
    } else if (fx.type === "innerShadow") {
      out.push(`inner shadow ${px(fx.x)},${px(fx.y)} blur ${px(fx.blur)}`);
    } else if (fx.type === "layerBlur") {
      out.push(`blur ${px(fx.radius)}`);
    } else {
      out.push(`grain ${pct(alphaOf(fx.color))}`);
    }
  }
  return out;
}

function radiusText(c: CornersLike | undefined): string | undefined {
  if (!c) return undefined;
  return c.tl === c.tr && c.tr === c.br && c.br === c.bl
    ? `radius ${px(c.tl)}`
    : `radius ${px(c.tl)},${px(c.tr)},${px(c.br)},${px(c.bl)}`;
}

/** One element as a line the model reads. */
export function describeElement(e: RefElement, brand: ComposeBrand, value?: string): string {
  const f = e.field;
  const parts: string[] = [e.id];
  const box = `[${px(f.x)},${px(f.y)},${px(f.width)},${px(f.height)}]`;
  if (e.role === "text") {
    parts.push(f.type === "multiline" ? "multiline" : "text");
    if (f.static) parts.push(`fixed ${quote(f.staticValue ?? "", 60)}`);
    else {
      parts.push(`member ${quote(f.label || f.fieldKey, 40)}`);
      if (value) parts.push(`value ${quote(value, 80)}`);
    }
    parts.push(box);
    if (f.typeStyleKey) parts.push(`style ${f.typeStyleKey}`);
    if (f.fontSizePx) parts.push(`${px(f.fontSizePx)}px`);
    if (f.fontFamily) parts.push(`${f.fontFamily}${f.fontWeight ? ` ${f.fontWeight}` : ""}`);
    else if (f.fontWeight) parts.push(`weight ${f.fontWeight}`);
    // The color it renders in: a style's fixed color wins over the field's.
    const styleColor = f.typeStyleKey
      ? brand.typeStyles.find((st) => st.key === f.typeStyleKey)?.colorKey
      : undefined;
    if (styleColor && brand.colors.some((c) => c.key === styleColor)) parts.push(styleColor);
    else if (f.textGradient) parts.push(gradientText(f.textGradient, brand));
    else if (f.colorHex) parts.push(colorLabel(f.colorHex, brand));
    if (f.uppercase) parts.push("upper");
    if (f.letterSpacingPx) parts.push(`tracking ${round1(f.letterSpacingPx)}`);
    if (f.lineHeight) parts.push(`leading ${round2(f.lineHeight)}`);
    parts.push(f.align ?? "left");
    if (f.plateColor) {
      const r = radiusText(f.cornerRadius);
      parts.push(
        `plate ${colorLabel(f.plateColor, brand)} pad ${px(f.platePaddingX ?? 0)}x${px(f.platePaddingY ?? 0)} ${r ?? "fully round"}`,
      );
    }
    if (!f.static && f.maxLength) parts.push(`max ${f.maxLength}`);
    if (!f.static && f.placeholder && !value) parts.push(`sample ${quote(f.placeholder, 48)}`);
  } else if (e.role === "shape") {
    parts.push(`shape ${f.shape ?? "rect"}`, box);
    if (f.textGradient) parts.push(gradientText(f.textGradient, brand));
    else if (f.colorHex) parts.push(`fill ${colorLabel(f.colorHex, brand)}`);
    const r = radiusText(f.cornerRadius);
    if (r) parts.push(r);
    if (f.strokeColor && f.strokeWidthPx) {
      parts.push(
        `stroke ${colorLabel(f.strokeColor, brand)} ${px(f.strokeWidthPx)}px${f.strokeAlign && f.strokeAlign !== "inside" ? ` ${f.strokeAlign}` : ""}`,
      );
    }
  } else if (e.role === "photo") {
    parts.push(`photo member ${quote(f.label || "Photo", 40)}`, box);
    const r = radiusText(f.cornerRadius);
    if (r) parts.push(r);
    if (f.maskUrl) parts.push("shaped mask");
  } else if (e.role === "logo") {
    parts.push("logo", box);
  } else if (e.role === "icon") {
    parts.push(`icon ${quote(f.vector?.source?.name ?? f.label ?? "icon", 40)}`, box);
    if (f.colorHex) parts.push(colorLabel(f.colorHex, brand));
  } else {
    parts.push(`artwork ${quote(f.label || "Artwork", 40)}`, box);
    const r = radiusText(f.cornerRadius);
    if (r) parts.push(r);
  }
  if ((f.opacity ?? 100) < 100) parts.push(`opacity ${Math.round(f.opacity!)}`);
  if (f.rotation) parts.push(`rotated ${Math.round(f.rotation)}`);
  parts.push(...effectsText(f.effects, brand));
  return parts.join(" ");
}

function backgroundText(ref: RefTemplate, brand: ComposeBrand): string {
  const parts: string[] = [];
  if (ref.background.gradient) parts.push(`ground ${gradientText(ref.background.gradient, brand)}`);
  else if (ref.background.color) parts.push(`ground ${colorLabel(ref.background.color, brand)}`);
  else if (!ref.background.hasImage) parts.push("ground white");
  if (ref.background.hasImage) parts.push("a flat background image (not reusable)");
  parts.push(...effectsText(ref.background.effects, brand));
  return parts.join(", ");
}

function referenceText(ref: RefTemplate, brand: ComposeBrand, canvas: ComposeContext): string {
  const same = ref.canvasWidth === canvas.canvasWidth && ref.canvasHeight === canvas.canvasHeight;
  const head = [
    `${ref.id} ${quote(ref.name, 60)}`,
    ref.category ? `category ${quote(ref.category, 40)}` : "",
    `${ref.canvasWidth}x${ref.canvasHeight}${same ? " (this canvas)" : ""}`,
    backgroundText(ref, brand),
  ]
    .filter(Boolean)
    .join(" · ");
  const lines = [head];
  for (const e of ref.elements)
    lines.push(`  ${describeElement(e, brand, ref.values?.[e.field.fieldKey])}`);
  if (ref.captionTemplate) lines.push(`  caption ${quote(ref.captionTemplate, 160)}`);
  return lines.join("\n");
}

function houseText(h: HouseStyle, ctx: ComposeContext): string {
  const brand = ctx.brand;
  const lines: string[] = [];
  const n = h.templateCount;
  lines.push(
    `House style, measured from the team's ${n} published template${n === 1 ? "" : "s"} (pixel values scaled to this canvas):`,
  );
  if (h.sizes.length) {
    lines.push(`- Sizes: ${h.sizes.map((s) => `${s.size} (${s.count})`).join(", ")}`);
  }
  if (h.margin) {
    lines.push(
      `- Margins: everything not bleeding off the edge keeps about ${px(h.margin.side)}px from the sides, ${px(h.margin.top)}px from the top and ${px(h.margin.bottom)}px from the bottom`,
    );
  }
  if (h.logo) {
    lines.push(
      `- Logo: on ${h.logo.count} of ${n}, usually ${h.logo.corner}, about ${px(h.logo.width)}px wide`,
    );
  } else if (n > 0) {
    lines.push("- Logo: the templates carry none");
  }
  if (h.type) {
    const t = h.type;
    const parts = [
      `headline about ${px(t.headline)}px (${px(t.headlineRange[0])} to ${px(t.headlineRange[1])})${t.headlineStyle ? `, style ${t.headlineStyle}` : ""}, ${t.align ?? "left"} aligned`,
    ];
    if (t.body !== undefined) {
      parts.push(`body about ${px(t.body)}px${t.bodyStyle ? `, style ${t.bodyStyle}` : ""}`);
    }
    if (t.ratio !== undefined) parts.push(`headline about ${round1(t.ratio)}x the body`);
    if (t.families.length) parts.push(`fonts ${t.families.join(", ")}`);
    lines.push(`- Type: ${parts.join("; ")}`);
  }
  const g = h.grounds;
  const groundParts = [`light on ${g.light}`, `dark on ${g.dark}`];
  if (g.image) groundParts.push(`photo or image on ${g.image}`);
  if (g.keys.length) {
    groundParts.push(
      `most used ${g.keys.map((k) => `${colorLabel(k.hex, brand)} (${k.count})`).join(", ")}`,
    );
  }
  lines.push(`- Grounds: ${groundParts.join("; ")}`);
  if (h.textColors.length) {
    lines.push(
      `- Text colors: ${h.textColors.map((c) => `${colorLabel(c.hex, brand)} (${c.count})`).join(", ")}`,
    );
  }
  if (h.accentColors.length) {
    lines.push(
      `- Accents on panels, pills and shapes: ${h.accentColors.map((c) => `${colorLabel(c.hex, brand)} (${c.count})`).join(", ")}`,
    );
  }
  const shape: string[] = [];
  if (h.radii.length) {
    shape.push(`corner radius ${h.radii.map((r) => `${px(r.radius)}px (${r.count})`).join(", ")}`);
  } else if (n > 0) {
    shape.push("square corners");
  }
  if (h.pills) shape.push(`${h.pills} pill${h.pills === 1 ? "" : "s"}`);
  if (h.plates > h.pills)
    shape.push(`${h.plates - h.pills} squared plate${h.plates - h.pills === 1 ? "" : "s"}`);
  if (h.strokes) shape.push(`${h.strokes} outlined shape${h.strokes === 1 ? "" : "s"}`);
  if (shape.length) lines.push(`- Shapes: ${shape.join("; ")}`);
  const fx: string[] = [];
  if (h.shadows && h.shadow) {
    fx.push(
      `${h.shadows} drop shadow${h.shadows === 1 ? "" : "s"} (about y ${px(h.shadow.y)}, blur ${px(h.shadow.blur)}, ${pct(h.shadow.alpha)})`,
    );
  }
  if (h.glows) fx.push(`${h.glows} glow${h.glows === 1 ? "" : "s"}`);
  if (h.blurs) fx.push(`${h.blurs} blur${h.blurs === 1 ? "" : "s"}`);
  if (h.gradients) fx.push(`${h.gradients} gradient${h.gradients === 1 ? "" : "s"}`);
  if (h.grain) fx.push(`grain on ${h.grain}`);
  lines.push(`- Effects: ${fx.length ? fx.join("; ") : "none, the team's work is flat"}`);
  const media: string[] = [];
  if (h.photos) {
    media.push(
      `${h.photos} member photo slot${h.photos === 1 ? "" : "s"}${h.photoRadius ? ` at radius ${px(h.photoRadius)}px` : ""}`,
    );
  }
  if (h.icons) media.push(`${h.icons} icon${h.icons === 1 ? "" : "s"}`);
  if (h.artwork) media.push(`${h.artwork} fixed artwork`);
  if (media.length) lines.push(`- Media: ${media.join("; ")}`);
  if (n > 0) {
    lines.push(
      `- Density: about ${Math.round(h.elements.median)} elements a post, at most ${h.elements.max}`,
    );
  }
  if (h.fixedCopy.length) {
    lines.push(`- Fixed copy the team writes: ${h.fixedCopy.map((c) => quote(c, 40)).join(", ")}`);
  }
  return lines.join("\n");
}

function brandText(ctx: ComposeContext): string {
  const b = ctx.brand;
  const lines: string[] = [];
  lines.push("Colors (use these keys and nothing else):");
  for (const c of b.colors) {
    const tags = [
      c.role,
      c.source === "house"
        ? `used by the team: ${c.usage}`
        : c.source === "neutral"
          ? "plain neutral"
          : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`- ${c.key} ${c.hex} ${quote(c.name, 40)}${tags ? ` (${tags})` : ""}`);
  }
  if (b.typeStyles.length) {
    lines.push("", 'Type styles (bind text with "style"):');
    for (const s of b.typeStyles) {
      const parts: string[] = [];
      if (s.family)
        parts.push(
          `${s.family}${s.weight ? ` ${s.weight}` : ""}${s.italic ? " italic" : ""}${s.stretch ? ` ${s.stretch}` : ""}`,
        );
      else if (s.weight) parts.push(`weight ${s.weight}`);
      if (s.sizePx) parts.push(`fixed at ${px(s.sizePx)}px`);
      if (s.uppercase) parts.push("uppercase");
      if (s.letterSpacingPx) parts.push(`tracking ${round1(s.letterSpacingPx)}`);
      if (s.lineHeight) parts.push(`leading ${round2(s.lineHeight)}`);
      if (s.colorKey) parts.push(`always ${s.colorKey}`);
      if (s.useFor) parts.push(`for ${s.useFor === "heading" ? "headings" : "body copy"}`);
      lines.push(`- ${s.key} ${quote(s.name, 40)}${parts.length ? `: ${parts.join(", ")}` : ""}`);
    }
  }
  if (b.fonts.length) lines.push("", `Fonts you may name in "font": ${b.fonts.join(", ")}`);
  lines.push("");
  if (b.logos.light || b.logos.dark) {
    lines.push(
      'Logo: place it with a "logo" element. The version that reads on the ground under it (light or dark) is used for you.',
    );
  } else if (teamLogoVector(ctx)) {
    lines.push(
      'Logo: place it with a "logo" element. The team\'s own logo art is used, colored to read on the ground under it.',
    );
  } else {
    lines.push("Logo: Brand Studio has none, so leave the logo out.");
  }
  if (b.images.length) {
    lines.push(
      "",
      'Brand images (place with "brandImage" and the id, only when the name clearly suits the post; never in place of the member\'s photo):',
    );
    for (const img of b.images) {
      lines.push(
        `- ${img.id} ${quote(img.name, 60)}${img.aspect ? ` ${round2(img.aspect)}:1` : ""}`,
      );
    }
  }
  if (b.guidelines.length) {
    lines.push("", `Brand guidelines: ${JSON.stringify(b.guidelines)}`);
  }
  return lines.join("\n");
}

function canvasText(ctx: ComposeContext): string {
  const W = ctx.canvasWidth;
  const H = ctx.canvasHeight;
  const lines = [
    `Canvas: ${W}x${H} px. Keep text, the logo and buttons at least ${ctx.margin}px inside the left and right edges${
      ctx.safeTop === ctx.margin && ctx.safeBottom === ctx.margin
        ? " and the top and bottom"
        : `, below y ${ctx.safeTop} and above y ${H - ctx.safeBottom} (the platform's own controls cover the rest)`
    }. Shapes, panels and photos may bleed off the edge.`,
  ];
  if (ctx.expectLogo)
    lines.push("The team puts its logo on most posts, so every design carries it.");
  lines.push(`Use at most ${ctx.elementCap} elements in a design.`);
  return lines.join(" ");
}

/** The model's user text for a compose call. The sections the caller builds
 * from shared helpers (facts, documents) arrive ready to insert. */
export function composeUserText(
  ctx: ComposeContext,
  request: {
    brief: string;
    count: number;
    platform?: string;
    photoAspect?: number | null;
    extraSections?: string[];
  },
): string {
  const parts: string[] = [];
  parts.push(`Brief: ${request.brief}`);
  for (const s of request.extraSections ?? []) parts.push(s);
  if (request.platform) parts.push(`The member is posting on: ${request.platform}.`);
  if (request.photoAspect !== undefined) {
    parts.push(
      `The member has supplied a photo${
        request.photoAspect !== null
          ? ` (width over height about ${request.photoAspect.toFixed(2)})`
          : ""
      }. Give each design one member photo slot (type "image") framed the way the team frames photos.`,
    );
  } else {
    parts.push("The member has not supplied a photo, so the designs have no member photo slot.");
  }
  if (ctx.drafts.length) {
    parts.push(
      [
        'The member\'s current drafts, which their message is about (name any element id, such as D1.3, in "from"):',
        ...ctx.drafts.map((d) => referenceText(d, ctx.brand, ctx)),
      ].join("\n"),
    );
  }
  parts.push(canvasText(ctx));
  parts.push(brandText(ctx));
  if (ctx.house.templateCount > 0) parts.push(houseText(ctx.house, ctx));
  parts.push(
    ctx.references.length
      ? [
          'The team\'s templates, most relevant to this brief first. Name any element id (R1.4) in "from" to reuse its exact look, and a template id (R1) in background "from" to reuse its ground:',
          ...ctx.references.map((r) => referenceText(r, ctx.brand, ctx)),
        ].join("\n")
      : "The team has no published templates yet. Design cleanly from the colors and type styles: one clear hierarchy, generous space, no decoration.",
  );
  parts.push(
    `Return exactly ${request.count} design${request.count === 1 ? "" : "s"}${
      request.count > 1
        ? ", each a genuinely different composition, led by a different template where more than one suits the brief"
        : ""
    }.`,
  );
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// The tool
// ---------------------------------------------------------------------------

const COLOR_KEY = { type: "string", description: "A key from the color list." };

const GRADIENT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["linear", "radial"] },
    angle: {
      type: "number",
      description: "Linear only. Degrees, CSS convention: 180 runs top to bottom.",
    },
    center: {
      type: "array",
      items: { type: "number" },
      description: "Radial only. [x, y] as fractions of the box; [0.5, 0.5] is the middle.",
    },
    radius: {
      type: "array",
      items: { type: "number" },
      description: "Radial only. [x, y] radii as fractions of the box.",
    },
    stops: {
      type: "array",
      items: {
        type: "object",
        properties: { color: COLOR_KEY, at: { type: "number", description: "0 to 1." } },
        required: ["color", "at"],
      },
    },
  },
  required: ["stops"],
};

const EFFECT_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["dropShadow", "innerShadow", "layerBlur", "noise"] },
    x: { type: "number" },
    y: { type: "number" },
    blur: { type: "number" },
    spread: { type: "number" },
    radius: { type: "number", description: "layerBlur only." },
    color: COLOR_KEY,
    alpha: { type: "number", description: "0 to 1." },
    size: { type: "number", description: "noise only: grain size in px." },
    density: { type: "number", description: "noise only: 0 to 1." },
  },
  required: ["type"],
};

const ELEMENT_SCHEMA = {
  type: "object",
  properties: {
    key: { type: "string", description: "snake_case, unique in the design. Caption tags use it." },
    type: {
      type: "string",
      enum: ["text", "multiline", "image", "shape", "logo", "icon", "artwork", "brandImage"],
    },
    label: {
      type: "string",
      description: "Member fields: the fact it holds, such as Headline or Date.",
    },
    from: {
      type: "string",
      description:
        "A reference element id (R2.4, or D1.3 in a follow-up) whose whole look this element reuses. Position and content come from you.",
    },
    box: {
      type: "array",
      items: { type: "number" },
      description: "[x, y, width, height] in canvas pixels from the top left.",
    },
    static: {
      type: "boolean",
      description: "Text only: true for fixed copy that belongs to the design.",
    },
    value: { type: "string", description: "Text only: the copy." },
    style: { type: "string", description: "Text only: a type style key." },
    font: {
      type: "object",
      properties: { family: { type: "string" }, weight: { type: "number" } },
      description: "Text only: a family from the font list, when no type style fits.",
    },
    size: { type: "number", description: "Text only: font size in px." },
    color: COLOR_KEY,
    align: { type: "string", enum: ["left", "center", "right"] },
    valign: { type: "string", enum: ["top", "middle", "bottom"] },
    uppercase: { type: "boolean" },
    tracking: { type: "number", description: "Letter spacing in px." },
    leading: { type: "number", description: "Line height as a multiple of the size." },
    shape: { type: "string", enum: ["rect", "ellipse", "triangle", "star"] },
    radius: {
      description:
        "Corner radius in px: one number, or [topLeft, topRight, bottomRight, bottomLeft].",
      anyOf: [{ type: "number" }, { type: "array", items: { type: "number" } }],
    },
    fill: { ...GRADIENT_SCHEMA, description: "A gradient fill for a shape or text." },
    stroke: {
      type: "object",
      properties: {
        color: COLOR_KEY,
        width: { type: "number" },
        align: { type: "string", enum: ["inside", "center", "outside"] },
      },
      required: ["color", "width"],
    },
    plate: {
      type: "object",
      properties: { color: COLOR_KEY, padX: { type: "number" }, padY: { type: "number" } },
      required: ["color"],
      description: "Text only: a plate behind the text. With no radius it is a pill.",
    },
    opacity: { type: "number", description: "0 to 100." },
    rotation: { type: "number" },
    effects: { type: "array", items: EFFECT_SCHEMA },
    surface: {
      type: "string",
      enum: ["light", "dark"],
      description: "Logo only: force a version.",
    },
    asset: { type: "string", description: "brandImage only: a brand image id such as I1." },
  },
  required: ["key", "type", "box"],
};

export const COMPOSE_TOOL = {
  name: "propose_designs",
  description:
    "Propose new on-brand designs: for each, the template it follows, its ground, its elements in paint order, a caption, and one sentence on the design.",
  input_schema: {
    type: "object",
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          required: ["name", "elements", "caption", "why"],
          properties: {
            name: { type: "string", description: "Two to four words naming the layout." },
            lead: {
              type: "string",
              description: "The reference id this design follows, such as R2, or none.",
            },
            background: {
              type: "object",
              properties: {
                from: { type: "string", description: "A reference id whose ground to reuse." },
                color: COLOR_KEY,
                fill: GRADIENT_SCHEMA,
                grain: {
                  type: "object",
                  properties: {
                    color: COLOR_KEY,
                    alpha: { type: "number" },
                    size: { type: "number" },
                    density: { type: "number" },
                  },
                  required: ["color"],
                },
              },
            },
            elements: { type: "array", items: ELEMENT_SCHEMA },
            caption: {
              type: "string",
              description:
                "One or two sentences the member would post, with {key} tags for member fields.",
            },
            why: { type: "string", description: "One sentence to the member on the design." },
          },
        },
      },
      reply: {
        type: "string",
        description:
          "One or two sentences to the member about the post. If a fact the post needs is missing, name it. Never ask a question, no exclamation marks, never an em dash.",
      },
      title: {
        type: "string",
        description:
          "Two to five words naming the post, in sentence case, with no closing punctuation.",
      },
    },
  },
};

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

/** The logo the team's templates draw as vector art, most relevant template
 * first, when there is one. */
function teamLogoVector(ctx: ComposeContext): ComposedField | undefined {
  for (const ref of ctx.references) {
    const el = ref.elements.find(
      (e) => e.role === "logo" && e.field.type === "icon" && e.field.vector,
    );
    if (el) return el.field;
  }
  return undefined;
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
