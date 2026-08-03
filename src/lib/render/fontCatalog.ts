// Font catalogue — answers one question: given a family, what styles exist?
//
// The builder used to offer an unconditional 100–900 ladder for every family.
// Most families do not have those weights: Bebas Neue ships a single 400 face,
// Lato skips 200/500/600/800, and six of the curated Google families have no
// italic at all. Picking an absent style rendered a synthesized face in the
// preview and — worse — made the export embed request fail outright, so the
// PNG fell back to a system font. Style lists therefore come from real
// metadata here, never from a generated ladder.

import type { BrandAsset, FontAssetMetadata } from "../types";

// ---------------------------------------------------------------------------
// Style vocabulary
// ---------------------------------------------------------------------------

export type FontStretch =
  | "ultra-condensed"
  | "extra-condensed"
  | "condensed"
  | "semi-condensed"
  | "normal"
  | "semi-expanded"
  | "expanded"
  | "extra-expanded"
  | "ultra-expanded";

/** CSS font-stretch keyword → percentage. These are the CSS spec's values and
 * they are also exactly what the css2 API emits back: requesting `wdth,wght@125,700`
 * on Archivo returns `font-stretch: expanded`. Keeping the app in keywords
 * rather than percentages means the stored value, the CSS we write, and the
 * CSS Google serves all agree without conversion. */
export const STRETCH_PERCENT: Record<FontStretch, number> = {
  "ultra-condensed": 50,
  "extra-condensed": 62.5,
  condensed: 75,
  "semi-condensed": 87.5,
  normal: 100,
  "semi-expanded": 112.5,
  expanded: 125,
  "extra-expanded": 150,
  "ultra-expanded": 200,
};

/** Narrow-to-wide — the order Figma lists width groups in. */
export const STRETCH_ORDER = Object.keys(STRETCH_PERCENT) as FontStretch[];

const STRETCH_NAME: Record<FontStretch, string> = {
  "ultra-condensed": "UltraCondensed",
  "extra-condensed": "ExtraCondensed",
  condensed: "Condensed",
  "semi-condensed": "SemiCondensed",
  normal: "",
  "semi-expanded": "SemiExpanded",
  expanded: "Expanded",
  "extra-expanded": "ExtraExpanded",
  "ultra-expanded": "UltraExpanded",
};

export const isFontStretch = (v: string | undefined): v is FontStretch =>
  v !== undefined && v in STRETCH_PERCENT;

/** One concrete face a family offers. `stretch` is always populated (normal
 * when the family has no width axis) so comparisons never juggle undefined. */
export interface FontStyle {
  weight: number;
  italic: boolean;
  stretch: FontStretch;
}

export type FontSource = "custom" | "google" | "unknown";

export interface FamilyStyles {
  family: string;
  source: FontSource;
  styles: FontStyle[];
  /** False when the styles are a guess rather than real metadata (a Figma
   * import or a system font we have no file and no table entry for). The UI
   * says so rather than pretending the list is complete. */
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Naming — the single weight-name mapping in the app
// ---------------------------------------------------------------------------

const WEIGHT_NAMES: Array<[number, string]> = [
  [100, "Thin"],
  [200, "ExtraLight"],
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
  [800, "ExtraBold"],
  [900, "Black"],
  // DM Sans, Mulish and Nunito genuinely reach 1000. CSS has no name for it;
  // Google's own UI calls it ExtraBlack.
  [1000, "ExtraBlack"],
];

/** 700 → "Bold". Off-ladder weights (a variable font's 350) take the nearest
 * name rather than inventing one. `resolveStyle` imports this so rule
 * sentences and the style picker can never disagree. */
export function weightName(weight: number): string {
  let best = WEIGHT_NAMES[0];
  for (const entry of WEIGHT_NAMES) {
    if (Math.abs(entry[0] - weight) < Math.abs(best[0] - weight)) best = entry;
  }
  return best[1];
}

/** Figma's style naming: weight, then width, then Italic — "Bold Expanded",
 * "Medium UltraExpanded", "Bold Italic". Regular is implied once any other
 * token is present, so 400 italic reads "Italic", not "Regular Italic". */
export function styleName(style: FontStyle): string {
  const tokens = [
    style.weight === 400 ? "" : weightName(style.weight),
    STRETCH_NAME[style.stretch],
    style.italic ? "Italic" : "",
  ].filter(Boolean);
  return tokens.length > 0 ? tokens.join(" ") : "Regular";
}

/** Stable identity for a style — option values, dedupe, and Map keys. */
export const styleKey = (s: FontStyle): string =>
  `${s.weight}:${s.italic ? "i" : "n"}:${s.stretch}`;

export function parseStyleKey(key: string): FontStyle | undefined {
  const [w, i, stretch] = key.split(":");
  const weight = Number(w);
  if (!Number.isFinite(weight) || !isFontStretch(stretch)) return undefined;
  return { weight, italic: i === "i", stretch };
}

/** Build a FontStyle from the three loose values a field carries. Absent
 * means normal — the backward-compatible reading of a legacy field that has
 * only `fontWeight`. */
export function toFontStyle(
  weight?: number,
  fontStyle?: string,
  fontStretch?: string,
): FontStyle {
  return {
    weight: weight ?? 400,
    italic: fontStyle === "italic",
    stretch: isFontStretch(fontStretch) ? fontStretch : "normal",
  };
}

// ---------------------------------------------------------------------------
// Google families — a static table, verified against Google's own metadata
// ---------------------------------------------------------------------------

interface GoogleFamilyAxes {
  /** The discrete instances Google serves, NOT a 100–900 assumption. */
  weights: number[];
  italic: boolean;
  /** Width keywords the wdth axis actually covers. Absent = no width axis.
   * Only stops INSIDE the axis range are listed: css2 answers 400 for an
   * out-of-range value (Merriweather's max is 112, so semi-expanded at 112.5
   * is a hard error, not a clamp). */
  stretches?: FontStretch[];
}

/** Generated from https://fonts.google.com/metadata/fonts (fetched 2026-08-03),
 * the same source fonts.google.com renders from, and spot-checked against live
 * css2 responses. Covers exactly the curated GOOGLE_FONTS list — a family added
 * there without a row here falls through to the unverified path rather than
 * silently getting a wrong ladder (fontCatalog.test.ts guards this). */
export const GOOGLE_FAMILY_AXES: Record<string, GoogleFamilyAxes> = {
  "Archivo": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, stretches: ["extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded"] },
  "Bebas Neue": { weights: [400], italic: false },
  "Cabin": { weights: [400, 500, 600, 700], italic: true, stretches: ["condensed", "semi-condensed", "normal"] },
  "DM Sans": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], italic: true },
  "Fira Sans": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  "Inter": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  "Josefin Sans": { weights: [100, 200, 300, 400, 500, 600, 700], italic: true },
  "Karla": { weights: [200, 300, 400, 500, 600, 700, 800], italic: true },
  "Lato": { weights: [100, 300, 400, 700, 900], italic: true },
  "Libre Baskerville": { weights: [400, 500, 600, 700], italic: true },
  "Lora": { weights: [400, 500, 600, 700], italic: true },
  "Manrope": { weights: [200, 300, 400, 500, 600, 700, 800], italic: false },
  "Merriweather": { weights: [300, 400, 500, 600, 700, 800, 900], italic: true, stretches: ["semi-condensed", "normal"] },
  "Montserrat": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  "Mulish": { weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000], italic: true },
  "Nunito": { weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000], italic: true },
  "Open Sans": { weights: [300, 400, 500, 600, 700, 800], italic: true, stretches: ["condensed", "semi-condensed", "normal"] },
  "Oswald": { weights: [200, 300, 400, 500, 600, 700], italic: false },
  "Outfit": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false },
  "Playfair Display": { weights: [400, 500, 600, 700, 800, 900], italic: true },
  "Plus Jakarta Sans": { weights: [200, 300, 400, 500, 600, 700, 800], italic: true },
  "Poppins": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  "Raleway": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  "Roboto": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, stretches: ["condensed", "semi-condensed", "normal"] },
  "Roboto Slab": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false },
  "Rubik": { weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  "Sora": { weights: [100, 200, 300, 400, 500, 600, 700, 800], italic: false },
  "Source Sans 3": { weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  "Space Grotesk": { weights: [300, 400, 500, 600, 700], italic: false },
  "Work Sans": { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
};

function expandGoogle(axes: GoogleFamilyAxes): FontStyle[] {
  const stretches = axes.stretches ?? (["normal"] as FontStretch[]);
  const styles: FontStyle[] = [];
  for (const stretch of stretches) {
    for (const weight of axes.weights) {
      styles.push({ weight, italic: false, stretch });
      if (axes.italic) styles.push({ weight, italic: true, stretch });
    }
  }
  return styles;
}

// ---------------------------------------------------------------------------
// Uploaded families — authoritative, because a file either exists or it doesn't
// ---------------------------------------------------------------------------

type FontAssetLike = Pick<BrandAsset, "kind" | "name" | "metadata">;

/** The family name an uploaded asset registers under. Must match
 * `registerCustomFont` exactly (fonts.ts) or the catalogue would offer styles
 * under a name no @font-face answers to. */
export const assetFamily = (asset: FontAssetLike): string =>
  asset.metadata.family ?? asset.name.replace(/\.[^.]+$/, "");

const styleFromMetadata = (m: FontAssetMetadata): FontStyle => ({
  weight: m.weight ?? 400,
  italic: m.style === "italic",
  stretch: "normal",
});

/** family → the styles that actually have a file behind them. */
export function customFamilyStyles(assets: FontAssetLike[]): Map<string, FontStyle[]> {
  const byFamily = new Map<string, Map<string, FontStyle>>();
  for (const asset of assets) {
    if (asset.kind !== "font") continue;
    const family = assetFamily(asset);
    const style = styleFromMetadata(asset.metadata);
    const group = byFamily.get(family) ?? new Map<string, FontStyle>();
    group.set(styleKey(style), style);
    byFamily.set(family, group);
  }
  return new Map([...byFamily].map(([family, group]) => [family, sortStyles([...group.values()])]));
}

// ---------------------------------------------------------------------------
// The lookup
// ---------------------------------------------------------------------------

/** Narrow → wide, light → heavy, upright before italic. */
export function sortStyles(styles: FontStyle[]): FontStyle[] {
  return [...styles].sort(
    (a, b) =>
      STRETCH_ORDER.indexOf(a.stretch) - STRETCH_ORDER.indexOf(b.stretch) ||
      a.weight - b.weight ||
      Number(a.italic) - Number(b.italic),
  );
}

/** What styles does this family have?
 *
 * Uploaded assets win over the Google table — a company that uploads a file
 * named for a Google family means their file. `current` is the style the field
 * already carries: for an unknown family it is kept in the list so an imported
 * field never loses the weight it was designed with. */
export function familyStyles(
  family: string,
  assets: FontAssetLike[] = [],
  current?: FontStyle,
): FamilyStyles {
  const custom = customFamilyStyles(assets).get(family);
  if (custom?.length) return { family, source: "custom", styles: custom, verified: true };

  const axes = GOOGLE_FAMILY_AXES[family];
  if (axes) return { family, source: "google", styles: sortStyles(expandGoogle(axes)), verified: true };

  // Unknown (Figma import, system font): a conservative pair plus whatever the
  // field already renders with, deduped.
  const guess = new Map<string, FontStyle>();
  for (const weight of [400, 700]) {
    const style: FontStyle = { weight, italic: false, stretch: "normal" };
    guess.set(styleKey(style), style);
  }
  if (current) guess.set(styleKey(current), current);
  return { family, source: "unknown", styles: sortStyles([...guess.values()]), verified: false };
}

/** Does this exact style exist in the list? */
export const hasStyle = (styles: FontStyle[], style: FontStyle): boolean =>
  styles.some((s) => styleKey(s) === styleKey(style));

/** Map a style onto the closest one a different family actually has — what
 * runs when the family changes. Figma keeps you as close as it can rather
 * than dropping you back to Regular: same weight when present, otherwise the
 * nearest weight; italic and width preserved only where they exist. */
export function nearestStyle(target: FontStyle, styles: FontStyle[]): FontStyle | undefined {
  if (styles.length === 0) return undefined;
  if (hasStyle(styles, target)) return target;

  // Width first — a face of the wrong width is a bigger visual jump than a
  // face one weight step off.
  const atStretch = styles.filter((s) => s.stretch === target.stretch);
  const atNormal = styles.filter((s) => s.stretch === "normal");
  let pool = atStretch.length > 0 ? atStretch : atNormal.length > 0 ? atNormal : styles;

  const atItalic = pool.filter((s) => s.italic === target.italic);
  if (atItalic.length > 0) pool = atItalic;

  // Ties (target 500 between 400 and 600) resolve to the lighter face.
  return pool.reduce((best, s) =>
    Math.abs(s.weight - target.weight) < Math.abs(best.weight - target.weight) ? s : best,
  );
}

/** Styles split into the width groups the picker draws dividers between.
 * A family with no width axis yields a single unlabeled group. */
export function styleGroups(styles: FontStyle[]): Array<{ stretch: FontStretch; label: string; styles: FontStyle[] }> {
  const groups = new Map<FontStretch, FontStyle[]>();
  for (const style of sortStyles(styles)) {
    groups.set(style.stretch, [...(groups.get(style.stretch) ?? []), style]);
  }
  const single = groups.size === 1;
  return [...groups].map(([stretch, group]) => ({
    stretch,
    label: single ? "" : STRETCH_NAME[stretch] || "Normal",
    styles: group,
  }));
}
