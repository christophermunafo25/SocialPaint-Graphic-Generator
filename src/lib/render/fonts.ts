import type {
  BrandAsset,
  BrandKit,
  FontAssetMetadata,
  FontRef,
  TemplateField,
  TemplateSchema,
} from "../types";
import { resolveFieldStyle } from "../brand/resolveStyle";
import {
  STRETCH_PERCENT,
  familyStyles,
  nearestStyle,
  styleKey,
  toFontStyle,
  type FontStyle,
} from "./fontCatalog";
import { canvasFontShorthand } from "./autoFit";

/** Curated Google Fonts list offered in Brand Studio / onboarding. */
export const GOOGLE_FONTS = [
  "Archivo",
  "Bebas Neue",
  "Cabin",
  "DM Sans",
  "Fira Sans",
  "Inter",
  "Josefin Sans",
  "Karla",
  "Lato",
  "Libre Baskerville",
  "Lora",
  "Manrope",
  "Merriweather",
  "Montserrat",
  "Mulish",
  "Nunito",
  "Open Sans",
  "Oswald",
  "Outfit",
  "Playfair Display",
  "Plus Jakarta Sans",
  "Poppins",
  "Raleway",
  "Roboto",
  "Roboto Slab",
  "Rubik",
  "Sora",
  "Source Sans 3",
  "Space Grotesk",
  "Work Sans",
] as const;

/** family → the style keys already requested from css2. Per-style, not per
 * family: a family loaded for Regular must still be able to fetch Bold later. */
const loadedGoogleStyles = new Map<string, Set<string>>();
const registeredCustomAssets = new Set<string>();
/** family → assetId → @font-face css (data-URL src). Keyed per ASSET, not per
 * family: a brand that uploads Regular and Bold of the same family used to
 * have the second registration overwrite the first, so the export embedded
 * one face and the other silently rasterized as a synthesized fallback. */
const customFaceCss = new Map<string, Map<string, string>>();

const customFamilyCss = (family: string): string | undefined => {
  const faces = customFaceCss.get(family);
  return faces && faces.size > 0 ? [...faces.values()].join("\n") : undefined;
};

/** family → the faces that family actually renders with. */
export type FontUsage = Map<string, FontStyle[]>;

const familyParam = (family: string): string => encodeURIComponent(family).replace(/%20/g, "+");

/** A FontStyle as the CSS font shorthand, for document.fonts.load — the same
 * composer the canvas measurement uses, so what we wait for is exactly what
 * gets measured and drawn. */
const faceShorthand = (family: string, style: FontStyle, sizePx = 16): string =>
  canvasFontShorthand({
    fontFamily: family,
    fontWeight: style.weight,
    fontStyle: style.italic ? "italic" : "normal",
    fontStretch: style.stretch,
    fontSizePx: sizePx,
  });

/** The css2 axis query for a set of faces: `ital,wdth,wght@0,100,400;1,75,700`.
 *
 * css2 is strict in three ways, each a 400 rather than a fallback: axes must
 * be named in alphabetical order, every tuple must carry a value for every
 * named axis, and the tuples must be sorted ascending. Width goes out as the
 * percentage the API expects even though the app stores keywords. */
export function googleAxisQuery(styles: FontStyle[]): string {
  const useItal = styles.some((s) => s.italic);
  const useWdth = styles.some((s) => s.stretch !== "normal");
  const axes = [...(useItal ? ["ital"] : []), ...(useWdth ? ["wdth"] : []), "wght"];
  const tuples = styles.map((s) => [
    ...(useItal ? [s.italic ? 1 : 0] : []),
    ...(useWdth ? [STRETCH_PERCENT[s.stretch]] : []),
    s.weight,
  ]);
  const sorted = [...new Set(tuples.map((t) => t.join(",")))].sort((a, b) => {
    const [x, y] = [a.split(",").map(Number), b.split(",").map(Number)];
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  });
  return `${axes.join(",")}@${sorted.join(";")}`;
}

/** Map requested faces onto ones the family actually has.
 *
 * This is what keeps css2 from answering 400. It tolerates unavailable values
 * inside a list — `Bebas Neue:wght@400;700` quietly returns just the 400 —
 * but a request whose values are ALL unavailable is a hard error, and the
 * catch swallows it into "no font at all". `Bebas Neue:wght@700` and
 * `Oswald:ital,wght@1,400` are both 400s today. */
function requestableStyles(family: string, styles: FontStyle[]): FontStyle[] {
  const known = familyStyles(family);
  const mapped = styles.map((s) => {
    // An unverified family has no table to check against; drop the width,
    // which is the part we cannot guess, and keep weight and italic.
    if (!known.verified) return { ...s, stretch: "normal" as const };
    return nearestStyle(s, known.styles) ?? s;
  });
  return [...new Map(mapped.map((s) => [styleKey(s), s])).values()];
}

/** Every face a family offers at normal width, upright — what a bare family
 * request (a font picker preview) loads. Callers that know which faces they
 * render pass a FontUsage and fetch exactly those instead. */
const previewStyles = (family: string): FontStyle[] => {
  const known = familyStyles(family);
  const upright = known.styles.filter((s) => !s.italic && s.stretch === "normal");
  return upright.length > 0 ? upright : [toFontStyle(400)];
};

/** Load Google font faces via the css2 API (link injection).
 *
 * One <link> PER family, never a batch: callers pass every family a schema
 * references, which can include uploaded custom families or Figma-imported
 * names Google doesn't know — and css2 answers 400 for the ENTIRE request if
 * any one family is invalid. Batched, one custom font silently killed every
 * Google font that shared its link. Families already registered as custom
 * @font-faces are skipped outright.
 *
 * The request used to be a hardcoded `wght@400;500;600;700;800` for every
 * family, so a field at 100/200/300/900 loaded nothing and rendered a
 * synthesized face, and italic and width were unreachable. */
export function loadGoogleFonts(request: string[] | FontUsage): void {
  const usage: FontUsage = Array.isArray(request)
    ? new Map(request.filter(Boolean).map((f) => [f, previewStyles(f)]))
    : request;
  for (const [family, styles] of usage) {
    if (!family || customFaceCss.has(family)) continue;
    const already = loadedGoogleStyles.get(family) ?? new Set<string>();
    const fresh = requestableStyles(family, styles).filter((s) => !already.has(styleKey(s)));
    if (fresh.length === 0) continue;
    for (const s of fresh) already.add(styleKey(s));
    loadedGoogleStyles.set(family, already);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=" +
      `${familyParam(family)}:${googleAxisQuery(fresh)}` +
      "&display=swap";
    document.head.appendChild(link);
  }
}

/** The @font-face blocks one uploaded asset registers.
 *
 * A static cut is one face carrying its true weight, style, and width. A
 * variable font (metadata.cuts) registers one face PER named instance, all
 * sharing the binary: the conventional weight/stretch descriptors make the
 * cut addressable from the field model, and font-variation-settings pins the
 * actual axis coordinates — required because axis ranges are foundry-defined
 * (Neuething runs wght 50–100, where CSS font-weight alone would clamp). */
export function customFontFaceCss(
  asset: Pick<BrandAsset, "name" | "metadata">,
  src: string,
): string {
  const family = asset.metadata.family ?? asset.name.replace(/\.[^.]+$/, "");
  const format = asset.metadata.format ?? "woff2";
  const face = (opts: {
    weight: number;
    italic: boolean;
    stretch?: string;
    axes?: Record<string, number>;
  }): string => {
    const stretchPct =
      opts.stretch && opts.stretch in STRETCH_PERCENT
        ? STRETCH_PERCENT[opts.stretch as keyof typeof STRETCH_PERCENT]
        : undefined;
    const variation = opts.axes
      ? Object.entries(opts.axes)
          .map(([tag, v]) => `"${tag}" ${v}`)
          .join(", ")
      : undefined;
    return [
      `@font-face {`,
      `  font-family: "${family}";`,
      `  src: url("${src}") format("${format}");`,
      `  font-weight: ${opts.weight};`,
      `  font-style: ${opts.italic ? "italic" : "normal"};`,
      ...(stretchPct !== undefined && stretchPct !== 100
        ? [`  font-stretch: ${stretchPct}%;`]
        : []),
      ...(variation ? [`  font-variation-settings: ${variation};`] : []),
      `}`,
    ].join("\n");
  };
  const cuts = asset.metadata.cuts;
  if (cuts?.length) return cuts.map(face).join("\n");
  return face({
    weight: asset.metadata.weight ?? 400,
    italic: asset.metadata.style === "italic",
    stretch: asset.metadata.stretch,
  });
}

/** Register an uploaded font file as runtime @font-face rules with a data-URL
 * src, making the family usable everywhere the app renders text AND
 * embeddable in PNG exports (via buildFontEmbedCss). */
export async function registerCustomFont(asset: BrandAsset): Promise<void> {
  if (registeredCustomAssets.has(asset.id)) return;
  registeredCustomAssets.add(asset.id);
  const family = asset.metadata.family ?? asset.name.replace(/\.[^.]+$/, "");
  try {
    const dataUrl = asset.url.startsWith("data:")
      ? asset.url
      : await (async () => {
          const blob = await (await fetch(asset.url)).blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })();
    const css = customFontFaceCss(asset, dataUrl);
    const style = document.createElement("style");
    style.dataset.customFont = asset.id;
    style.textContent = css;
    document.head.appendChild(style);
    customFaceCss.set(family, (customFaceCss.get(family) ?? new Map()).set(asset.id, css));
    await document.fonts.load(`16px "${family}"`).catch(() => undefined);
  } catch (e) {
    registeredCustomAssets.delete(asset.id);
    console.error("Custom font registration failed", asset.name, e);
  }
}

/** Load every font a brand kit references (Google + custom).
 *
 * EVERY uploaded font asset registers, not just the heading/body picks:
 * fields and type styles reference uploaded families directly, and a family
 * without a registered @font-face renders as fallback sans-serif everywhere
 * and embeds nothing at export. Registration was previously session-local to
 * the upload — after a reload, only heading/body customs came back. */
export async function loadBrandFonts(kit: BrandKit, fontAssets: BrandAsset[]): Promise<void> {
  const refs = [kit.headingFont, kit.bodyFont].filter((r): r is FontRef => Boolean(r));
  loadGoogleFonts(refs.filter((r) => r.source === "google").map((r) => r.family));
  await Promise.all(fontAssets.map((asset) => registerCustomFont(asset)));
}

/** The exact faces a schema renders with — family plus the full style, not
 * family plus a weight. Resolved through the brand rules engine when a kit is
 * given, so type-style-bound faces count too. */
export function schemaFontUsage(schema: TemplateSchema, kit?: BrandKit | null): FontUsage {
  return fieldsFontUsage(schema.fields, kit);
}

/** The builder's edit canvas works from a field list, not a whole schema. */
export function fieldsFontUsage(fields: TemplateField[], kit?: BrandKit | null): FontUsage {
  const usage = new Map<string, Map<string, FontStyle>>();
  for (const f of fields) {
    const style = kit !== undefined ? resolveFieldStyle(f, kit) : f;
    if (!style.fontFamily) continue;
    const face = toFontStyle(style.fontWeight, style.fontStyle, style.fontStretch);
    const group = usage.get(style.fontFamily) ?? new Map<string, FontStyle>();
    group.set(styleKey(face), face);
    usage.set(style.fontFamily, group);
  }
  return new Map([...usage].map(([family, group]) => [family, [...group.values()]]));
}

/** Wait until every FACE used by the schema is ready — called before export so
 * the rasterized PNG uses the correct typefaces. The wait used to be
 * `16px "family"`, which is weight-agnostic (the shorthand defaults to 400),
 * so it returned before the face actually in use had arrived. */
export async function ensureSchemaFontsLoaded(
  schema: TemplateSchema,
  kit?: BrandKit | null,
): Promise<void> {
  await Promise.all(
    [...schemaFontUsage(schema, kit)].flatMap(([family, styles]) =>
      styles.map((style) =>
        document.fonts.load(faceShorthand(family, style)).catch(() => undefined),
      ),
    ),
  );
  await document.fonts.ready;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/** family:faces → css2 @font-face blocks with binaries inlined as data URLs.
 * The key covers style and width as well as weight: keyed on weights alone,
 * a Regular and an Italic of the same family collided and the second one
 * served the first one's cached CSS. */
const googleEmbedCss = new Map<string, string | null>();

async function buildGoogleEmbedCss(family: string, styles: FontStyle[]): Promise<string | null> {
  const usable = requestableStyles(family, styles);
  const key = `${family}:${usable.map(styleKey).sort().join(",")}`;
  if (googleEmbedCss.has(key)) return googleEmbedCss.get(key)!;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=" +
      `${familyParam(family)}:${googleAxisQuery(usable)}` +
      "&display=swap";
    const res = await fetch(cssUrl);
    if (!res.ok) throw new Error(`css2 ${res.status}`);
    let css = await res.text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    await Promise.all(
      urls.map(async (u) => {
        const dataUrl = await blobToDataUrl(await (await fetch(u)).blob());
        css = css.split(u).join(dataUrl);
      }),
    );
    googleEmbedCss.set(key, css);
    return css;
  } catch (e) {
    console.error("Google font embed failed", family, e);
    googleEmbedCss.set(key, null); // unknown family (e.g. a system font) — don't refetch
    return null;
  }
}

/** CSS passed to html-to-image's fontEmbedCSS: EVERY family the schema
 * renders with, embedded as data-URL @font-faces — uploaded faces from the
 * registry, Google faces fetched and inlined (only the weights in use).
 *
 * Embedding everything is load-bearing: the snapshot SVG rasterizes in an
 * isolated context on Safari and Firefox, with NO access to the document's
 * font cache — the old skipFonts path only ever worked on Chromium, which is
 * why exports downloaded from phones fell back to system fonts. */
export async function buildExportFontEmbedCss(
  schema: TemplateSchema,
  kit?: BrandKit | null,
): Promise<string | undefined> {
  const parts = await Promise.all(
    [...schemaFontUsage(schema, kit)].map(([family, styles]) => {
      const custom = customFamilyCss(family);
      return custom ? Promise.resolve(custom) : buildGoogleEmbedCss(family, styles);
    }),
  );
  const css = parts.filter((c): c is string => Boolean(c)).join("\n");
  return css || undefined;
}

/** Font families the given fields reference that this workspace cannot
 * render faithfully: not a Google font and not among the uploaded font
 * assets. Import paths surface these so a designed template doesn't
 * silently fall back to a system face. */
export function unavailableFamilies(
  fields: TemplateField[],
  fontAssets: Array<{ metadata: FontAssetMetadata }>,
): string[] {
  const uploaded = new Set<string>();
  for (const a of fontAssets) {
    if (a.metadata.family) uploaded.add(a.metadata.family);
  }
  const google = new Set<string>(GOOGLE_FONTS);
  const missing = new Set<string>();
  for (const f of fields) {
    const family = f.fontFamily;
    if (family && !google.has(family) && !uploaded.has(family)) missing.add(family);
  }
  return [...missing];
}
