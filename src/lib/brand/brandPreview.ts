// Brand Studio's live preview as a real template: Figma node 170:239
// ("Product Promo CTA Post / Light / Green") rebuilt as a TemplateSchema and
// repainted with the tenant's brand. Pure — the photo arrives as a URL, so
// this module imports no assets and can run under the node test environment.

import type { BrandColor, TemplateField, TemplateSchema } from "@/lib/types";
import { contrastRatio, luminance, parseHex, readableOn, toHex, type RGBA } from "@/lib/color";
import { AA_LARGE, AA_SMALL } from "@/lib/templates/variantContrast";
import { DEFAULT_PALETTE } from "@/lib/theme";

export const BRAND_PREVIEW_ARTBOARD = { width: 1080, height: 1350 } as const;

// ---------------------------------------------------------------------------
// Artboard geometry — canvas px, top-left anchor, from Figma node 170:239.
// ---------------------------------------------------------------------------

/** Shape behind the photo — Figma 170:241. */
const BACKDROP_BOX = { x: 0, y: 826, width: 1080, height: 524 } as const;

/** Photo — Figma 170:254. */
const PHOTO_BOX = { x: 90, y: 624, width: 898, height: 504 } as const;
const PHOTO_CORNERS = { tl: 0, tr: 60, br: 0, bl: 60 } as const;

/** CTA outline — Figma 170:242. */
const CTA_OUTLINE_BOX = { x: 90, y: 1207, width: 900, height: 68 } as const;
const CTA_OUTLINE_RADIUS = 34;

/** CTA pill — Figma 170:251 (label 170:252 shares this box). */
const CTA_PILL_BOX = { x: 91, y: 1208, width: 898, height: 66 } as const;
const CTA_PILL_RADIUS = 33;

/** Logo — Figma 170:258 (the company-name fallback shares this box). */
const LOGO_BOX = { x: 376, y: 106, width: 328, height: 58 } as const;

/** Headline — Figma 170:256. Box height is the design's two lines. */
const HEADLINE_BOX = { x: 141, y: 226, width: 799, height: 222 } as const;

/** Subcopy — Figma 170:257. Box height is the design's two lines. */
const SUBCOPY_BOX = { x: 201, y: 493, width: 678, height: 72 } as const;

// Type sizes from the design (D5: weights fixed — headline 600, rest 500).
const HEADLINE_SIZE = 130;
const HEADLINE_MIN_SIZE = 72;
const SUBCOPY_SIZE = 30;
const SUBCOPY_MIN_SIZE = 22;
const COMPANY_NAME_SIZE = 44;
const COMPANY_NAME_MIN_SIZE = 24;
const CTA_LABEL_SIZE = 30;

/** Longest company name the 328px identity box holds at the 24px shrink
 * floor. Shrink overflows rather than clips, so the string is bounded. */
const COMPANY_NAME_MAX_CHARS = 24;

// D7 sample copy — the Figma subcopy is placeholder Latin and does not ship.
const HEADLINE_COPY = "This is a headline for this graphic";
const SUBCOPY_COPY = "This is supporting copy for this graphic, set in your body face.";
const CTA_COPY = "Get started";

// ---------------------------------------------------------------------------
// Palette resolution (decisions D1–D3)
// ---------------------------------------------------------------------------

export interface PreviewColors {
  /** Shape behind the photo (D1). */
  dark: string;
  /** Artboard surface (D2). */
  light: string;
  /** CTA pill fill (D3). */
  accent: string;
  /** Headline and subcopy. */
  ink: string;
  /** CTA label. */
  onAccent: string;
  /** CTA outline. D3 wants the headline ink, but the ring sits on the DARK
   * band, not the surface ink was checked against — so it keeps the ink only
   * while the ink is legible there. */
  outline: string;
}

interface PaletteEntry {
  color: BrandColor;
  /** Normalized paint value: shorthand expanded, alpha stripped, #RRGGBB. */
  hex: string;
  rgb: RGBA;
  lum: number;
}

const defaultHex = (key: string): string => DEFAULT_PALETTE.find((c) => c.key === key)!.hex;

/** #RGB/#RGBA shorthand expands before parsing, and the returned channels are
 * the OPAQUE color. luminance/contrastRatio ignore alpha, so keeping an alpha
 * byte would let a transparent `text` pass the legibility gates and paint the
 * headline invisible — the preview paints every palette color opaque. */
const normalizedRgb = (hex: string): RGBA | null => {
  const short = /^#?([0-9a-fA-F]{3,4})$/.exec(hex.trim());
  const full = short ? `#${[...short[1]].map((c) => c + c).join("")}` : hex;
  const rgb = parseHex(full);
  return rgb ? { ...rgb, a: 1 } : null;
};

const byLuminance = (
  entries: PaletteEntry[],
  pick: (a: number, b: number) => boolean,
): PaletteEntry | undefined =>
  entries.reduce<PaletteEntry | undefined>(
    (best, e) => (best === undefined || pick(e.lum, best.lum) ? e : best),
    undefined,
  );

/** The graphic's brand colors, from an arbitrary tenant palette. The palette
 * has no dark or light role, so both are DERIVED: light is `background` or
 * the palest color; dark is `primary` when it genuinely reads as dark against
 * that surface, otherwise the deepest remaining color. Unparsable hexes are
 * skipped, so a half-typed color can never blank a block. */
export function resolvePreviewColors(colors: BrandColor[]): PreviewColors {
  const entries: PaletteEntry[] = [];
  for (const color of colors) {
    const rgb = normalizedRgb(color.hex);
    if (rgb) entries.push({ color, hex: toHex(rgb), rgb, lum: luminance(rgb) });
  }

  // D2: light surface — `background`, else the highest-luminance color.
  const lightEntry =
    entries.find((e) => e.color.key === "background") ?? byLuminance(entries, (a, b) => a > b);
  const light = lightEntry?.hex ?? defaultHex("background");
  const lightRgb = lightEntry?.rgb ?? parseHex(defaultHex("background"))!;
  const lightLum = lightEntry?.lum ?? luminance(lightRgb);

  // Both dark branches enforce the same bar: meaningfully darker than the
  // surface AND clearing 3:1 against it. Same-hex duplicates of the surface
  // fail it by construction, and a fallback can never re-select a color the
  // primary gate just rejected.
  const readsAsDark = (e: PaletteEntry): boolean =>
    e.lum < lightLum && contrastRatio(e.rgb, lightRgb) >= AA_LARGE;

  // D1: dark — primary when it genuinely reads as dark; else the deepest
  // color that does; else the default primary; and when even that dissolves
  // into the surface, the maximum-contrast pick. The band must always show.
  const primary = entries.find((e) => e.color.key === "primary");
  let dark: string;
  if (primary && readsAsDark(primary)) {
    dark = primary.hex;
  } else {
    const deepest = byLuminance(entries.filter(readsAsDark), (a, b) => a < b);
    if (deepest) {
      dark = deepest.hex;
    } else {
      const fallback = parseHex(defaultHex("primary"))!;
      dark =
        luminance(fallback) < lightLum && contrastRatio(fallback, lightRgb) >= AA_LARGE
          ? defaultHex("primary")
          : readableOn(light);
    }
  }

  // D3: accent, with the default standing in when the palette has none.
  const accent = entries.find((e) => e.color.key === "accent")?.hex ?? defaultHex("accent");

  // Ink: the palette's text color when it is genuinely legible on the
  // surface (WCAG AA body threshold), else the chosen legible fallback.
  const text = entries.find((e) => e.color.key === "text");
  const ink = text && contrastRatio(text.rgb, lightRgb) >= AA_SMALL ? text.hex : readableOn(light);

  // The outline's ring paints over `dark`, so the ink carries over only
  // while it stays legible there.
  const outline =
    contrastRatio(parseHex(ink)!, parseHex(dark)!) >= AA_LARGE ? ink : readableOn(dark);

  return { dark, light, accent, ink, onAccent: readableOn(accent), outline };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface BrandPreviewInput {
  colors: BrandColor[];
  headingFamily: string;
  bodyFamily: string;
  logoUrl?: string;
  companyName: string;
  photoUrl: string;
}

/** Fixed stamps: the preview schema is ephemeral and never persisted, so its
 * timestamps carry no information — but the type requires them. */
const PREVIEW_TIMESTAMP = "2026-01-01T00:00:00.000Z";

/** The preview graphic as a TemplateSchema, so it renders through the exact
 * path real templates take — SchemaRenderer, font loading, and measured
 * shrink fitting included. Every field is static: this is a picture of the
 * brand, not a fillable template. */
export function buildBrandPreviewSchema(input: BrandPreviewInput): TemplateSchema {
  const { dark, light, accent, ink, onAccent, outline } = resolvePreviewColors(input.colors);

  // The canvas never clips text (shrink overflows visibly past the box), so
  // the one tenant-controlled string is bounded here, the way the old rail's
  // `truncate` ellipsis did. A blank name means no identity element at all —
  // painting the field's label as if it were brand copy is worse than an
  // empty band.
  const companyName = ellipsize(input.companyName.trim(), COMPANY_NAME_MAX_CHARS);
  const identity = input.logoUrl
    ? field({
        id: "bp-logo",
        label: "Logo",
        fieldKey: "logo",
        type: "image",
        ...LOGO_BOX,
        zIndex: 6,
        staticValue: input.logoUrl,
        objectFit: "contain",
      })
    : companyName
      ? field({
          id: "bp-company-name",
          label: "Company name",
          fieldKey: "company_name",
          type: "text",
          ...LOGO_BOX,
          zIndex: 6,
          staticValue: companyName,
          fontFamily: input.headingFamily,
          fontWeight: 600,
          fontSizePx: COMPANY_NAME_SIZE,
          minFontSizePx: COMPANY_NAME_MIN_SIZE,
          textSizing: "shrink",
          align: "center",
          verticalAlign: "middle",
          colorHex: ink,
        })
      : null;

  const fields: TemplateField[] = [
    field({
      id: "bp-backdrop",
      label: "Backdrop",
      fieldKey: "backdrop",
      type: "shape",
      shape: "rect",
      ...BACKDROP_BOX,
      zIndex: 1,
      colorHex: dark,
    }),
    field({
      id: "bp-photo",
      label: "Sample photo",
      fieldKey: "photo",
      type: "image",
      ...PHOTO_BOX,
      zIndex: 2,
      staticValue: input.photoUrl,
      objectFit: "cover",
      cornerRadius: { ...PHOTO_CORNERS },
    }),
    field({
      id: "bp-cta-outline",
      label: "CTA outline",
      fieldKey: "cta_outline",
      type: "shape",
      shape: "rect",
      ...CTA_OUTLINE_BOX,
      zIndex: 3,
      colorHex: outline,
      cornerRadius: uniformRadius(CTA_OUTLINE_RADIUS),
    }),
    field({
      id: "bp-cta-pill",
      label: "CTA pill",
      fieldKey: "cta_pill",
      type: "shape",
      shape: "rect",
      ...CTA_PILL_BOX,
      zIndex: 4,
      colorHex: accent,
      cornerRadius: uniformRadius(CTA_PILL_RADIUS),
    }),
    field({
      id: "bp-cta-label",
      label: "CTA label",
      fieldKey: "cta_label",
      type: "text",
      ...CTA_PILL_BOX,
      zIndex: 5,
      staticValue: CTA_COPY,
      fontFamily: input.bodyFamily,
      fontWeight: 500,
      fontSizePx: CTA_LABEL_SIZE,
      lineHeight: 1.4,
      letterSpacingPx: -0.45,
      align: "center",
      verticalAlign: "middle",
      colorHex: onAccent,
    }),
    ...(identity ? [identity] : []),
    field({
      id: "bp-headline",
      label: "Headline",
      fieldKey: "headline",
      type: "multiline",
      ...HEADLINE_BOX,
      zIndex: 7,
      staticValue: HEADLINE_COPY,
      fontFamily: input.headingFamily,
      fontWeight: 600,
      fontSizePx: HEADLINE_SIZE,
      minFontSizePx: HEADLINE_MIN_SIZE,
      textSizing: "shrink",
      lineHeight: 0.85,
      letterSpacingPx: -3.9,
      align: "center",
      verticalAlign: "middle",
      colorHex: ink,
    }),
    field({
      id: "bp-subcopy",
      label: "Subcopy",
      fieldKey: "subcopy",
      type: "multiline",
      ...SUBCOPY_BOX,
      zIndex: 8,
      staticValue: SUBCOPY_COPY,
      fontFamily: input.bodyFamily,
      fontWeight: 500,
      fontSizePx: SUBCOPY_SIZE,
      minFontSizePx: SUBCOPY_MIN_SIZE,
      textSizing: "shrink",
      lineHeight: 1.2,
      letterSpacingPx: -0.45,
      align: "center",
      verticalAlign: "top",
      colorHex: ink,
      opacity: 70,
    }),
  ];

  return {
    id: "brand-studio-preview",
    companyId: "brand-studio-preview",
    name: "",
    description: "",
    category: "",
    tags: [],
    status: "draft",
    canvasWidth: BRAND_PREVIEW_ARTBOARD.width,
    canvasHeight: BRAND_PREVIEW_ARTBOARD.height,
    backgroundUrl: "",
    backgroundColor: light,
    fields,
    captionTemplate: "",
    createdAt: PREVIEW_TIMESTAMP,
    updatedAt: PREVIEW_TIMESTAMP,
  };
}

/** Every preview element is a fixed part of the graphic, never a form field. */
const field = (f: Omit<TemplateField, "static">): TemplateField => ({ ...f, static: true });

const uniformRadius = (r: number) => ({ tl: r, tr: r, br: r, bl: r });

const ellipsize = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
