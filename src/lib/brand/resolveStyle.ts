import type { BrandKit, BrandTypeStyle, TemplateField, TextGradient } from "../types";
import { deriveColorRoles } from "./system/roles";
import { familyStyles, nearestStyle, styleName, toFontStyle } from "../render/fontCatalog";

/** The styling a field actually renders with after the brand rules engine
 * applies: any property the bound type style DEFINES wins over the field's
 * own value; undefined properties fall through to the field. */
export interface ResolvedFieldStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  fontStretch?: string;
  fontSizePx?: number;
  minFontSizePx?: number;
  minFontScale?: number;
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  /** Palette key from a bound type style ONLY — the one live brand channel.
   * Fields themselves never carry a palette binding. */
  colorKey?: string;
  colorHex?: string;
  textGradient?: import("../types").TextGradient;
  maxLength?: number;
  textSizing?: "free" | "shrink" | "fill";
  /** The style that supplied the locked properties, if any. */
  boundStyle?: BrandTypeStyle;
}

export function getTypeStyle(
  kit: BrandKit | null,
  key: string | undefined,
): BrandTypeStyle | undefined {
  if (!kit || !key) return undefined;
  return kit.typeStyles?.find((s) => s.key === key);
}

/** Absent stays absent: a snapped value that lands on the CSS default for a
 * property the field never set stays unset, so a legacy field keeps resolving
 * to exactly the values it did before. */
const keepAbsent = <T>(raw: T | undefined, next: T, dflt: T): T | undefined =>
  raw === undefined && next === dflt ? undefined : next;

/** #RRGGBB (or #RGB) → [r, g, b], or null when it isn't a parseable hex. */
const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** What enforcement reads for a kit: the palette, which off-palette colours
 * snap to, and the colours that pass untouched, which add the role colours
 * the brand system derives (a neutral from the ramp), so a colour the system
 * itself chose is never snapped away. Cached per kit object. */
const allowedCache = new WeakMap<BrandKit, { palette: string[]; passes: Set<string> }>();
function allowedColors(kit: BrandKit): { palette: string[]; passes: Set<string> } {
  let allowed = allowedCache.get(kit);
  if (!allowed) {
    const palette = [
      ...new Set(kit.colors.map((c) => c.hex.toUpperCase()).filter((h) => hexToRgb(h))),
    ];
    const roles = palette.length ? Object.values(deriveColorRoles(kit)).map((r) => r.hex) : [];
    allowed = { palette, passes: new Set([...palette, ...roles]) };
    allowedCache.set(kit, allowed);
  }
  return allowed;
}

/** Brand enforcement (Settings → Workspace): when the kit forbids off-palette
 * fills, a hex that is not in the palette renders as the NEAREST palette
 * color — deterministic and never blank, where dropping the fill would
 * re-color the field to the browser default. Allowed colors (any case) and
 * unparsable values pass through untouched; an 8-digit hex keeps its alpha
 * and snaps only its color. */
export function clampToPalette(hex: string, kit: BrandKit | null): string {
  if (!kit || kit.allowOffPalette !== false) return hex;
  const { palette, passes } = allowedColors(kit);
  if (palette.length === 0) return hex;
  const alpha = /^#[0-9a-f]{8}$/i.test(hex.trim()) ? hex.trim().slice(7) : "";
  const color = alpha ? hex.trim().slice(0, 7) : hex;
  if (passes.has(color.toUpperCase())) return hex;
  const rgb = hexToRgb(color);
  if (!rgb) return hex;
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const [r, g, b] = hexToRgb(c)!;
    const dist = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best + alpha;
}

const clampGradient = (g: TextGradient | undefined, kit: BrandKit | null) =>
  g && kit?.allowOffPalette === false
    ? { ...g, stops: g.stops.map((st) => ({ ...st, color: clampToPalette(st.color, kit) })) }
    : g;

/** A field with every colour it paints held to the palette: its fill or
 * ink, gradient stops, stroke, text plate and an icon's per-path colours
 * (brand-system Phase 5; text
 * ink and gradients were the only ones before). The same object back when
 * the kit allows any colour, so nothing downstream re-renders for it. */
export function enforceFieldPalette(field: TemplateField, kit: BrandKit | null): TemplateField {
  if (!kit || kit.allowOffPalette !== false) return field;
  // A field that sets no colour paints the renderer's default ink, which is
  // held too. A stroke-only shape paints no fill, and text bound to a type
  // style takes the style's colour, which a field colour could displace.
  const paintsDefault =
    !field.colorHex &&
    !field.textGradient &&
    field.type !== "image" &&
    !field.typeStyleKey &&
    !(field.type === "shape" && field.strokeColor);
  return {
    ...field,
    colorHex: field.colorHex
      ? clampToPalette(field.colorHex, kit)
      : paintsDefault
        ? clampToPalette(DEFAULT_INK, kit)
        : field.colorHex,
    textGradient: clampGradient(field.textGradient, kit),
    strokeColor: field.strokeColor ? clampToPalette(field.strokeColor, kit) : field.strokeColor,
    plateColor: field.plateColor ? clampToPalette(field.plateColor, kit) : field.plateColor,
    // A multi-colour icon or logo carries a colour per path.
    vector: field.vector?.paths.some((p) => p.colorHex)
      ? {
          ...field.vector,
          paths: field.vector.paths.map((p) =>
            p.colorHex ? { ...p, colorHex: clampToPalette(p.colorHex, kit) } : p,
          ),
        }
      : field.vector,
  };
}

/** The renderer's ink for a field that sets no colour, and its ground for a
 * canvas that sets none (DEFAULT_FILL_HEX and the white base in
 * SchemaRenderer), so enforcement can hold them too. */
export const DEFAULT_INK = "#111111";
export const DEFAULT_GROUND = "#FFFFFF";

/** The canvas's own colour and gradient held to the palette, likewise,
 * including the white a canvas with neither paints. */
export function enforceBackground<
  T extends { backgroundColor?: string; backgroundGradient?: TextGradient },
>(bg: T, kit: BrandKit | null): T {
  if (!kit || kit.allowOffPalette !== false) return bg;
  return {
    ...bg,
    backgroundColor: clampToPalette(bg.backgroundColor || DEFAULT_GROUND, kit),
    backgroundGradient: clampGradient(bg.backgroundGradient, kit),
  };
}

export function resolveFieldStyle(field: TemplateField, kit: BrandKit | null): ResolvedFieldStyle {
  const style = getTypeStyle(kit, field.typeStyleKey);
  // Enforcement switch #1: normally a bound style's properties win over the
  // field's own; when the kit allows overrides the precedence flips and the
  // style only fills the gaps the field left.
  const override = kit?.allowStyleOverride === true;
  const pick = <T>(styleVal: T | undefined, fieldVal: T | undefined): T | undefined =>
    override ? (fieldVal ?? styleVal) : (styleVal ?? fieldVal);
  const fontFamily = pick(style?.font?.family, field.fontFamily);
  const rawWeight = pick(style?.weight, field.fontWeight);
  const rawStyle = pick(style?.fontStyle, field.fontStyle);
  const rawStretch = pick(style?.fontStretch, field.fontStretch);

  // Snap onto a face the family actually has. A brand rule can name a weight
  // the chosen family cannot draw — "Subhead is always Bold" over Bebas Neue,
  // which ships one 400 face — and asking for it anyway renders a synthesized
  // bold in the preview while the export embeds the real 400. Only families
  // the catalogue can verify are snapped; an uploaded or imported family has
  // no table to check against, so its value is left exactly as authored.
  const known = fontFamily ? familyStyles(fontFamily) : undefined;
  const face = known?.verified
    ? nearestStyle(toFontStyle(rawWeight, rawStyle, rawStretch), known.styles)
    : undefined;

  return {
    fontFamily,
    fontWeight: face ? keepAbsent(rawWeight, face.weight, 400) : rawWeight,
    fontStyle: face ? keepAbsent(rawStyle, face.italic ? "italic" : "normal", "normal") : rawStyle,
    fontStretch: face ? keepAbsent(rawStretch, face.stretch, "normal") : rawStretch,
    fontSizePx: pick(style?.fontSizePx, field.fontSizePx),
    minFontSizePx: field.minFontSizePx,
    minFontScale: field.minFontScale,
    uppercase: pick(style?.uppercase, field.uppercase),
    letterSpacingPx: pick(style?.letterSpacingPx, field.letterSpacingPx),
    lineHeight: pick(style?.lineHeight, field.lineHeight),
    // The style's palette binding stays the live channel — except when the
    // kit allows overrides AND the field carries its own fill, which is the
    // one case a field-level value may displace it.
    colorKey: override && (field.colorHex || field.textGradient) ? undefined : style?.colorKey,
    colorHex: field.colorHex ? clampToPalette(field.colorHex, kit) : field.colorHex,
    // Enforcement switch #2 applies to gradients too — every stop snaps, so
    // "no off-palette colors" cannot be routed around with a two-stop
    // gradient of the same hex.
    textGradient: clampGradient(field.textGradient, kit),
    maxLength: pick(style?.maxLength, field.maxLength),
    textSizing: pick(style?.textSizing, field.textSizing),
    boundStyle: style,
  };
}

/** Which field-level controls a bound style locks (for the builder UI).
 * When the kit allows style overrides, nothing is locked — the bound style
 * becomes a default rather than a rule. */
export function lockedProperties(
  style: BrandTypeStyle | undefined,
  kit?: BrandKit | null,
): Set<string> {
  const locked = new Set<string>();
  if (!style || kit?.allowStyleOverride === true) return locked;
  if (style.font) locked.add("fontFamily");
  if (style.weight !== undefined) locked.add("weight");
  if (style.fontStyle !== undefined) locked.add("fontStyle");
  if (style.fontStretch !== undefined) locked.add("fontStretch");
  if (style.fontSizePx !== undefined) locked.add("fontSizePx");
  if (style.uppercase !== undefined) locked.add("uppercase");
  if (style.letterSpacingPx !== undefined) locked.add("letterSpacingPx");
  if (style.lineHeight !== undefined) locked.add("lineHeight");
  if (style.colorKey !== undefined) locked.add("colorKey");
  if (style.maxLength !== undefined) locked.add("maxLength");
  if (style.textSizing !== undefined) locked.add("textSizing");
  return locked;
}

/** Whether the two-step picker's STYLE control is locked. Binding a font locks
 * it too: a style that says "always Neuething Sans Bold Expanded" cannot leave
 * the face editable, and a style that fixes only the weight locks the style
 * control while the family stays free. */
export const isStyleLocked = (locked: Set<string>): boolean =>
  locked.has("fontFamily") ||
  locked.has("weight") ||
  locked.has("fontStyle") ||
  locked.has("fontStretch");

/** Human-readable rule sentences for a type style — how marketing sees the
 * rules they've encoded ("Heading is always uppercase"). */
export function ruleSentences(style: BrandTypeStyle, kit: BrandKit | null): string[] {
  const rules: string[] = [];
  const colorName = kit?.colors.find((c) => c.key === style.colorKey)?.name;
  // The face reads as a name, never as raw values: "Bold Expanded", not
  // "700 / ultra-expanded". Only named when the style actually fixes part of
  // it — a style that locks the family alone stays "always Montserrat".
  const face =
    style.weight !== undefined || style.fontStyle !== undefined || style.fontStretch !== undefined
      ? styleName(toFontStyle(style.weight, style.fontStyle, style.fontStretch))
      : "";
  if (style.font) {
    rules.push(
      `${style.name} is always ${style.font.family}${face ? ` ${face}` : ""}${colorName ? ` in ${colorName}` : ""}.`,
    );
  } else if (face) {
    // A weight-only lock used to produce no sentence at all, leaving the
    // control disabled with nothing explaining why.
    rules.push(`${style.name} is always ${face}${colorName ? ` in ${colorName}` : ""}.`);
  } else if (colorName) {
    rules.push(`${style.name} is always ${colorName}.`);
  }
  if (style.uppercase) rules.push(`${style.name} is always UPPERCASE.`);
  if (style.fontSizePx !== undefined)
    rules.push(`${style.name} is fixed at ${style.fontSizePx}px.`);
  if (style.maxLength !== undefined)
    rules.push(`${style.name} never exceeds ${style.maxLength} characters.`);
  if (style.textSizing === "shrink") rules.push(`${style.name} shrinks to fit its box.`);
  if (style.textSizing === "fill") rules.push(`${style.name} is sized to fill its box.`);
  if (style.textSizing === "free")
    rules.push(`${style.name} keeps its set size — the box grows with content.`);
  return rules;
}
