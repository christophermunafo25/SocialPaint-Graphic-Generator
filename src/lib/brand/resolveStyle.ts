import type { BrandKit, BrandTypeStyle, TemplateField } from "../types";
import { styleName, toFontStyle } from "../render/fontCatalog";

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
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  colorKey?: string;
  colorHex?: string;
  textGradient?: import("../types").TextGradient;
  maxLength?: number;
  autoFit?: boolean;
  /** The style that supplied the locked properties, if any. */
  boundStyle?: BrandTypeStyle;
}

export function getTypeStyle(kit: BrandKit | null, key: string | undefined): BrandTypeStyle | undefined {
  if (!kit || !key) return undefined;
  return kit.typeStyles?.find((s) => s.key === key);
}

export function resolveFieldStyle(field: TemplateField, kit: BrandKit | null): ResolvedFieldStyle {
  const style = getTypeStyle(kit, field.typeStyleKey);
  return {
    fontFamily: style?.font?.family ?? field.fontFamily,
    fontWeight: style?.weight ?? field.fontWeight,
    fontStyle: style?.fontStyle ?? field.fontStyle,
    fontStretch: style?.fontStretch ?? field.fontStretch,
    fontSizePx: style?.fontSizePx ?? field.fontSizePx,
    minFontSizePx: field.minFontSizePx,
    uppercase: style?.uppercase ?? field.uppercase,
    letterSpacingPx: style?.letterSpacingPx ?? field.letterSpacingPx,
    lineHeight: style?.lineHeight ?? field.lineHeight,
    colorKey: style?.colorKey ?? field.colorKey,
    colorHex: field.colorHex,
    textGradient: field.textGradient,
    maxLength: style?.maxLength ?? field.maxLength,
    autoFit: style?.autoFit ?? field.autoFit,
    boundStyle: style,
  };
}

/** Which field-level controls a bound style locks (for the builder UI). */
export function lockedProperties(style: BrandTypeStyle | undefined): Set<string> {
  const locked = new Set<string>();
  if (!style) return locked;
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
  if (style.autoFit !== undefined) locked.add("autoFit");
  return locked;
}

/** Whether the two-step picker's STYLE control is locked. Binding a font locks
 * it too: a style that says "always Neuething Sans Bold Expanded" cannot leave
 * the face editable, and a style that fixes only the weight locks the style
 * control while the family stays free. */
export const isStyleLocked = (locked: Set<string>): boolean =>
  locked.has("fontFamily") || locked.has("weight") || locked.has("fontStyle") || locked.has("fontStretch");

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
  if (style.fontSizePx !== undefined) rules.push(`${style.name} is fixed at ${style.fontSizePx}px.`);
  if (style.maxLength !== undefined) rules.push(`${style.name} never exceeds ${style.maxLength} characters.`);
  if (style.autoFit) rules.push(`${style.name} auto-shrinks to fit its box.`);
  return rules;
}
