import type { BrandColor, BrandTypeStyle } from "../types";

/** Design-system import: tolerant parsers that turn a design-tokens JSON
 * (e.g. the tokens.json Claude Design exports, W3C design-tokens files, or
 * simple {colors:{...}} maps) into palette entries + type styles, and a
 * guidelines.md into suggested brand rules. File/import-based — not a live
 * connector. */

export interface DesignSystemImportResult {
  colors: BrandColor[];
  typeStyles: BrandTypeStyle[];
  skipped: string[]; // token groups we recognized but don't consume (spacing, radii…)
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\(/;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "token";

const titleCase = (s: string) =>
  s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

function isColorValue(v: unknown): v is string {
  return typeof v === "string" && (HEX_RE.test(v.trim()) || RGB_RE.test(v.trim()));
}

/** Unwrap W3C design-token leaves ({ $value: ... } / { value: ... }). */
function leafValue(node: unknown): unknown {
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if ("$value" in o) return o.$value;
    if ("value" in o && Object.keys(o).length <= 3) return o.value;
  }
  return node;
}

interface TypographyLeaf {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  textTransform?: string;
  letterSpacing?: number | string;
  lineHeight?: number | string;
}

const px = (v: number | string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const weightNum = (v: number | string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  if (typeof v === "number") return v;
  const named: Record<string, number> = {
    light: 300,
    regular: 400,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  };
  return named[v.toLowerCase()] ?? px(v);
};

/** Parse any tokens JSON into colors + type styles. Walks the whole tree so
 * nesting conventions don't matter. */
export function parseDesignTokens(json: unknown): DesignSystemImportResult {
  const colors: BrandColor[] = [];
  const typeStyles: BrandTypeStyle[] = [];
  const skipped = new Set<string>();
  const seenColorKeys = new Set<string>();
  const seenStyleKeys = new Set<string>();

  const walk = (node: unknown, path: string[]) => {
    const value = leafValue(node);

    if (isColorValue(value)) {
      const name = path[path.length - 1] ?? "color";
      let key = slug(name);
      if (seenColorKeys.has(key)) key = slug(path.slice(-2).join("_"));
      if (!seenColorKeys.has(key)) {
        seenColorKeys.add(key);
        colors.push({ key, name: titleCase(name), hex: String(value).trim() });
      }
      return;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const o = value as Record<string, unknown>;
      // Composite typography token (W3C $type: typography, or shaped like one)
      const looksTypographic =
        "fontFamily" in o || "fontSize" in o || "fontWeight" in o || "textTransform" in o;
      const inTypeGroup = path.some((p) => /typ(e|ography)|text|font/i.test(p));
      if (looksTypographic && (inTypeGroup || "fontFamily" in o)) {
        const t = o as TypographyLeaf;
        const name = path[path.length - 1] ?? "style";
        let key = slug(name);
        if (seenStyleKeys.has(key)) key = slug(path.slice(-2).join("_"));
        if (!seenStyleKeys.has(key)) {
          seenStyleKeys.add(key);
          typeStyles.push({
            key,
            name: titleCase(name),
            font: t.fontFamily
              ? {
                  source: "google",
                  family: String(t.fontFamily).split(",")[0].replace(/["']/g, "").trim(),
                }
              : undefined,
            weight: weightNum(t.fontWeight),
            fontSizePx: px(t.fontSize),
            uppercase:
              typeof t.textTransform === "string" && /upper/i.test(t.textTransform)
                ? true
                : undefined,
            letterSpacingPx: px(t.letterSpacing),
            lineHeight: typeof t.lineHeight === "number" ? t.lineHeight : undefined,
          });
        }
        return;
      }
      if (
        path.length === 1 &&
        /spacing|space|radius|radii|shadow|elevation|breakpoint|z-?index|duration|easing/i.test(
          path[0],
        )
      ) {
        skipped.add(path[0]);
        return; // recognized but not consumed by the portal (yet)
      }
      for (const [k, v] of Object.entries(o)) {
        if (k.startsWith("$")) continue;
        walk(v, [...path, k]);
      }
    }
  };

  walk(json, []);
  return { colors, typeStyles, skipped: [...skipped] };
}

/** Pull suggested brand rules out of a guidelines.md: lines that read like
 * do/don't rules ("always", "never", "do not", "avoid", "must"). The admin
 * reviews and accepts; accepted lines land in brandKit.guidelines. */
export function parseGuidelines(markdown: string): string[] {
  const suggestions: string[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw
      .replace(/^[\s>*+-]+/, "")
      .replace(/^#+\s*/, "")
      .replace(/\*\*/g, "")
      .trim();
    if (line.length < 8 || line.length > 200) continue;
    if (/\b(always|never|do not|don['’]t|avoid|must|only use|no )\b/i.test(line)) {
      suggestions.push(line);
    }
    if (suggestions.length >= 40) break;
  }
  return [...new Set(suggestions)];
}
