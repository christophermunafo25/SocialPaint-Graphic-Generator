// The starter materializer: one blueprint plus one tenant's brand context
// in, one NewTemplateInput out. Pure — no I/O, no store imports; the seeder
// (seed.ts) owns every side effect.
//
// Color model: neutrals are the fixed Appendix B constants (neutrals.ts).
// The tenant contributes exactly one color — the accent — picked by the
// role ladder and contrast-walked per surface. The base schema carries the
// LIGHT values; the Dark variant overrides, per field, only the keys that
// differ (colorHex, and the plate/stroke override keys approved for this
// feature).
//
// Drift, on purpose: colors are baked at seed time. A tenant who later
// changes their palette keeps these baked values until they delete a
// starter and use "Restore starter templates" to re-seed it. There is no
// live palette binding here — template_fields.color_key stays retired.

import type {
  BrandColor,
  BrandKit,
  NewTemplateInput,
  TemplateField,
  TemplateVariant,
  VariantFieldOverride,
} from "../../types";
import { contrastRatio, luminance, parseHex } from "../../color";
import { STARTER_VERSION } from "./index";
import type { SlotColor, SlotFont, StarterBlueprint, StarterField } from "./types";
import {
  ACCENT_FALLBACK,
  BODY_FONT_FALLBACK,
  DISPLAY_FONT_FALLBACK,
  LABEL_FONT_FAMILY,
  NEUTRALS_DARK,
  NEUTRALS_LIGHT,
  ON_ACCENT_DARK,
  ON_ACCENT_LIGHT,
} from "./neutrals";

export interface MaterializeContext {
  company: { id: string; name: string; website?: string };
  kit: BrandKit;
  /** Storage reference for the tenant's uploaded logo (BrandAsset.url,
   * "brand-assets/{path}"). Absent = no logo: logo fields are dropped,
   * except the partnership slot, which stays member-editable. */
  logoAssetRef?: string;
  /** Injected for deterministic tests; defaults to now. */
  seededAt?: string;
}

// ---------------------------------------------------------------------------
// Accent ladder
// ---------------------------------------------------------------------------

/** The tenant accent by role ladder: accent, else secondary, else primary,
 * else the first palette entry, else the Appendix B fallback. A rung only
 * counts when its hex actually parses. */
export function pickAccent(colors: BrandColor[]): string {
  for (const role of ["accent", "secondary", "primary"] as const) {
    const entry = colors.find((c) => c.role === role && parseHex(c.hex));
    if (entry) return entry.hex;
  }
  const first = colors.find((c) => parseHex(c.hex));
  return first ? first.hex : ACCENT_FALLBACK;
}

// ---------------------------------------------------------------------------
// Contrast walking (WCAG 2.1, via the shared luminance math in color.ts)
// ---------------------------------------------------------------------------

/** Floor for accent-colored TEXT on a surface. Everything the accent colors
 * is >= 22px, so the large-text 3.0 floor applies. */
export const ACCENT_ON_SURFACE_MIN = 3.0;
/** Floor for onAccent text on the accent plate. */
export const ON_ACCENT_MIN = 4.5;

const ratio = (a: string, b: string): number => {
  const [ca, cb] = [parseHex(a), parseHex(b)];
  if (!ca || !cb) return 0;
  return contrastRatio(ca, cb);
};

/** hex → HSL (h 0-360, s/l 0-100). */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const byte = (v: number) =>
    Math.round(Math.max(0, Math.min(255, (v + m) * 255)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${byte(rgb[0])}${byte(rgb[1])}${byte(rgb[2])}`;
}

const isLightSurface = (surface: string): boolean => {
  const rgb = parseHex(surface);
  if (!rgb) return true;
  return luminance(rgb) >= 0.5;
};

/** Walk a color toward legibility on the given surface: HSL lightness in
 * steps of 4 (darker on a light surface, lighter on a dark one), capped at
 * 20 steps; past the cap the Appendix B fallback accent takes over. */
export function walkAccent(hex: string, surface: string, min = ACCENT_ON_SURFACE_MIN): string {
  if (ratio(hex, surface) >= min) return hex;
  const hsl = hexToHsl(hex);
  if (!hsl) return ACCENT_FALLBACK;
  const step = isLightSurface(surface) ? -4 : 4;
  let { l } = hsl;
  for (let i = 0; i < 20; i += 1) {
    l += step;
    const candidate = hslToHex(hsl.h, hsl.s, l);
    if (ratio(candidate, surface) >= min) return candidate;
  }
  return ACCENT_FALLBACK;
}

/** Text on the accent plate: near-black or white, whichever clears 4.5 —
 * or, on an accent where neither does, whichever comes closer. */
export function pickOnAccent(accent: string): string {
  const dark = ratio(ON_ACCENT_DARK, accent);
  const light = ratio(ON_ACCENT_LIGHT, accent);
  if (light >= ON_ACCENT_MIN && light >= dark) return ON_ACCENT_LIGHT;
  if (dark >= ON_ACCENT_MIN) return ON_ACCENT_DARK;
  return light >= dark ? ON_ACCENT_LIGHT : ON_ACCENT_DARK;
}

// ---------------------------------------------------------------------------
// Slot resolution
// ---------------------------------------------------------------------------

export interface SlotTable {
  light: Record<SlotColor, string>;
  dark: Record<SlotColor, string>;
}

/** Both colorways' slot values for one tenant palette. */
export function resolveSlots(colors: BrandColor[]): SlotTable {
  const base = pickAccent(colors);
  const accentLight = walkAccent(base, NEUTRALS_LIGHT.surface);
  const accentDark = walkAccent(base, NEUTRALS_DARK.surface);
  return {
    light: { ...NEUTRALS_LIGHT, accent: accentLight, onAccent: pickOnAccent(accentLight) },
    dark: { ...NEUTRALS_DARK, accent: accentDark, onAccent: pickOnAccent(accentDark) },
  };
}

// ---------------------------------------------------------------------------
// Text tokens
// ---------------------------------------------------------------------------

const fillTokens = (text: string, name: string, website: string): string =>
  text.split("{company.name}").join(name).split("{company.website}").join(website);

const usesWebsiteToken = (text: string | undefined): boolean =>
  Boolean(text?.includes("{company.website}"));

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

/** Which blueprint fields survive for this tenant. A role:"logo" field with
 * no uploaded logo is dropped unless the blueprint gave it a placeholder
 * (the partnership slot, which is meaningless without its frames and stays
 * member-editable instead). Static text bound to {company.website} is
 * dropped when there is no website. omitWith cascades the frame shapes. */
function surviving(blueprint: StarterBlueprint, ctx: MaterializeContext): StarterField[] {
  const dropped = new Set<string>();
  for (const f of blueprint.fields) {
    if (f.role === "logo" && !ctx.logoAssetRef && !f.placeholder) dropped.add(f.fieldKey);
    if (f.static && usesWebsiteToken(f.staticValue) && !ctx.company.website)
      dropped.add(f.fieldKey);
  }
  return blueprint.fields.filter(
    (f) => !dropped.has(f.fieldKey) && !(f.omitWith && dropped.has(f.omitWith)),
  );
}

function resolveFont(slot: SlotFont, kit: BrandKit): string {
  if (slot === "label") return LABEL_FONT_FAMILY;
  if (slot === "display") return (kit.headingFont ?? DISPLAY_FONT_FALLBACK).family;
  return (kit.bodyFont ?? BODY_FONT_FALLBACK).family;
}

/** One blueprint field as a concrete TemplateField in the LIGHT colorway. */
function materializeField(
  f: StarterField,
  blueprint: StarterBlueprint,
  ctx: MaterializeContext,
  slots: Record<SlotColor, string>,
): TemplateField {
  const name = ctx.company.name;
  const website = ctx.company.website ?? "";
  const placeholderSource =
    !website && f.placeholderNoWebsite ? f.placeholderNoWebsite : f.placeholder;
  const isLogo = f.role === "logo" && Boolean(ctx.logoAssetRef);
  return {
    id: `starter-${blueprint.starterKey}-${f.fieldKey}`,
    fieldKey: f.fieldKey,
    label: f.label,
    type: f.type,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    static: isLogo ? true : f.static,
    staticValue: isLogo
      ? ctx.logoAssetRef
      : f.staticValue !== undefined
        ? fillTokens(f.staticValue, name, website)
        : undefined,
    placeholder:
      !isLogo && placeholderSource !== undefined
        ? fillTokens(placeholderSource, name, website)
        : undefined,
    shape: f.shape,
    strokeColor: f.strokeColor ? slots[f.strokeColor] : undefined,
    strokeWidthPx: f.strokeWidthPx,
    fontFamily: f.font ? resolveFont(f.font, ctx.kit) : undefined,
    fontWeight: f.fontWeight,
    fontSizePx: f.fontSizePx,
    minFontSizePx: f.minFontSizePx,
    lineHeight: f.lineHeight,
    letterSpacingPx: f.letterSpacingPx,
    uppercase: f.uppercase,
    align: f.align,
    verticalAlign: f.verticalAlign,
    textSizing: f.textSizing,
    colorHex: f.colorHex ? slots[f.colorHex] : undefined,
    plateColor: f.plateColor ? slots[f.plateColor] : undefined,
    platePaddingX: f.platePaddingX,
    platePaddingY: f.platePaddingY,
    objectFit: f.objectFit,
    required: f.required,
  };
}

/** The Dark variant's override entry for one field: ONLY the appearance
 * keys whose dark slot value differs from the light one. */
function darkOverride(f: StarterField, slots: SlotTable): VariantFieldOverride | null {
  const over: VariantFieldOverride = {};
  if (f.colorHex && slots.dark[f.colorHex] !== slots.light[f.colorHex]) {
    over.colorHex = slots.dark[f.colorHex];
  }
  if (f.plateColor && slots.dark[f.plateColor] !== slots.light[f.plateColor]) {
    over.plateColor = slots.dark[f.plateColor];
  }
  if (f.strokeColor && slots.dark[f.strokeColor] !== slots.light[f.strokeColor]) {
    over.strokeColor = slots.dark[f.strokeColor];
  }
  return Object.keys(over).length ? over : null;
}

/** Materialize one blueprint for one tenant. See the module comment for the
 * color model and the baked-at-seed-time drift tradeoff. */
export function materializeStarter(
  blueprint: StarterBlueprint,
  ctx: MaterializeContext,
): NewTemplateInput {
  const slots = resolveSlots(ctx.kit.colors);
  const fields = surviving(blueprint, ctx);
  const materialized = fields.map((f) => materializeField(f, blueprint, ctx, slots.light));

  const overrides: TemplateVariant["overrides"] = {};
  for (const f of fields) {
    const over = darkOverride(f, slots);
    if (over) overrides[f.fieldKey] = over;
  }
  const variants: TemplateVariant[] = [
    { id: "light", name: "Light", isDefault: true, overrides: {} },
    {
      id: "dark",
      name: "Dark",
      backgroundColor: slots.dark[blueprint.backgroundColor],
      overrides,
    },
  ];

  const seededAt = ctx.seededAt ?? new Date().toISOString();
  const editableCount = materialized.filter((f) => !f.static).length;
  return {
    companyId: ctx.company.id,
    name: blueprint.name,
    description: blueprint.description,
    category: blueprint.category,
    tags: [...blueprint.tags],
    status: "published",
    canvasWidth: blueprint.canvasWidth,
    canvasHeight: blueprint.canvasHeight,
    backgroundUrl: "",
    backgroundColor: slots.light[blueprint.backgroundColor],
    fields: materialized,
    variants,
    captionTemplate: fillTokens(
      blueprint.captionTemplate,
      ctx.company.name,
      ctx.company.website ?? "",
    ),
    autobuildMeta: {
      model: "starter",
      sourceKind: "starter",
      generatedAt: seededAt,
      elementCount: materialized.length,
      editableCount,
      source: "starter",
      starterKey: blueprint.starterKey,
      starterVersion: STARTER_VERSION,
      seededAt,
    },
  };
}
