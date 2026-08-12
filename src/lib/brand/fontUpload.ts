import type { FontAssetMetadata } from "../types";
import { inspectFontBinary, stretchFromName, weightFromName } from "./fontInspect";

const FORMAT_BY_EXT: Record<string, FontAssetMetadata["format"]> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

export const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";
const MAX_FONT_BYTES = 5 * 1024 * 1024;

/** Filename-derived metadata — the fallback when the binary can't be read
 * (WOFF/WOFF2 compress their tables; the browser has no Brotli inflater).
 * Splits camelCase before matching so "NeuethingSans-Bold" finds both the
 * family "Neuething Sans" and the weight. */
function fromFilename(
  base: string,
): Pick<FontAssetMetadata, "family" | "weight" | "style" | "stretch"> {
  const spaced = base.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
  const weight = weightFromName(spaced) ?? 400;
  const stretch = stretchFromName(spaced);
  const italic = /italic|oblique/i.test(spaced);
  const family =
    spaced
      .replace(
        /\b(thin|extra\s?light|ultra\s?light|light|regular|normal|book|medium|semi\s?bold|demi\s?bold|extra\s?bold|ultra\s?bold|bold|black|heavy|italic|oblique|var(iable)?|vf)\b/gi,
        "",
      )
      .replace(/\b(ultra|extra|semi)?\s?(condensed|expanded|extended|wide|narrow)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || base;
  return { family, weight, style: italic ? "italic" : "normal", ...(stretch ? { stretch } : {}) };
}

/** Validate an uploaded font file and derive @font-face metadata.
 *
 * Raw sfnt containers (.ttf/.otf) are read for real: the typographic family
 * from the name table, the true weight and width from OS/2, and — for a
 * variable font — every named instance from fvar, so the whole design space
 * the file carries becomes selectable. Compressed containers fall back to
 * filename heuristics. */
export async function inspectFontFile(
  file: File,
): Promise<{ ok: true; metadata: FontAssetMetadata } | { ok: false; error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_BY_EXT[ext];
  if (!format) {
    return {
      ok: false,
      error: `Unsupported font format ".${ext}" — use .woff2, .woff, .ttf, or .otf.`,
    };
  }
  if (file.size > MAX_FONT_BYTES) {
    return { ok: false, error: "Font file is too large (max 5 MB)." };
  }
  const base = file.name.replace(/\.[^.]+$/, "");
  const guess = fromFilename(base);

  let inspected: ReturnType<typeof inspectFontBinary> = null;
  if (format === "truetype" || format === "opentype") {
    try {
      inspected = inspectFontBinary(await file.arrayBuffer());
    } catch {
      inspected = null; // a malformed table never blocks the upload
    }
  }

  const metadata: FontAssetMetadata = {
    family: inspected?.family ?? guess.family,
    weight: inspected?.weight ?? guess.weight,
    style: (inspected?.italic ?? guess.style === "italic") ? "italic" : "normal",
    format,
  };
  const stretch = inspected?.stretch ?? guess.stretch;
  if (stretch && stretch !== "normal") metadata.stretch = stretch;
  if (inspected?.cuts?.length) {
    metadata.cuts = inspected.cuts.map((c) => ({
      name: c.name,
      weight: c.weight,
      stretch: c.stretch,
      italic: c.italic,
      ...(c.axes && Object.keys(c.axes).length > 0 ? { axes: c.axes } : {}),
    }));
  }
  return { ok: true, metadata };
}
