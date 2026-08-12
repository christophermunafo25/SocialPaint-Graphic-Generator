// Binary font inspection — reads the tables a font file actually carries so
// an upload registers as what it IS, not what its filename suggests.
//
// Scope: raw sfnt containers only (.ttf and .otf — tags 0x00010000, 'OTTO',
// 'true'). WOFF/WOFF2 compress their table data (zlib/Brotli) and the browser
// has no Brotli inflater, so those fall back to filename heuristics upstream.
//
// What gets read:
//  - `name`: the typographic family (nameID 16, falling back to 1) — the name
//    designers know the font by, with none of the filename's camelCase damage.
//  - `OS/2`: usWeightClass and usWidthClass for static cuts, so
//    "NeuethingSans-ExtraBoldExtraExpanded.otf" registers as 800/extra-expanded
//    instead of the filename guess of 700/normal.
//  - `fvar`: a variable font's named instances — every cut the family offers,
//    each mapped onto the conventional CSS weight/stretch slots via its
//    instance name, with the raw axis coordinates kept for
//    font-variation-settings (axes with custom ranges, like a 50–100 wght,
//    cannot be driven by CSS font-weight alone).

import type { FontStretch } from "../render/fontCatalog";

/** One concrete cut a font file offers, CSS-addressable. `axes` carries the
 * variation coordinates when the cut is a variable-font instance. */
export interface FontFaceCut {
  name: string;
  weight: number;
  stretch: FontStretch;
  italic: boolean;
  axes?: Record<string, number>;
}

export interface InspectedFont {
  family?: string;
  /** Static cut's own style (also the fallback when fvar is absent). */
  weight?: number;
  stretch?: FontStretch;
  italic?: boolean;
  /** Present when the file is a variable font with named instances. */
  cuts?: FontFaceCut[];
}

// ---------------------------------------------------------------------------
// Instance-name → CSS slots. Names are the portable truth across foundries;
// axis VALUES are not (Neuething runs wght 50–100 where Inter runs 100–900).
// ---------------------------------------------------------------------------

const WEIGHT_TOKENS: Array<[RegExp, number]> = [
  [/extra\s*light|ultra\s*light/i, 200],
  [/extra\s*black|ultra\s*black/i, 1000],
  [/extra\s*bold|ultra\s*bold/i, 800],
  [/semi\s*bold|demi\s*bold/i, 600],
  [/\bthin\b/i, 100],
  [/\blight\b/i, 300],
  [/\bmedium\b/i, 500],
  [/\bblack\b|\bheavy\b/i, 900],
  [/\bbold\b/i, 700],
  [/\bregular\b|\bnormal\b|\bbook\b/i, 400],
];

const STRETCH_TOKENS: Array<[RegExp, FontStretch]> = [
  [/ultra\s*condensed/i, "ultra-condensed"],
  [/extra\s*condensed/i, "extra-condensed"],
  [/semi\s*condensed/i, "semi-condensed"],
  [/\bcondensed\b|\bnarrow\b/i, "condensed"],
  [/ultra\s*expanded|ultra\s*wide/i, "ultra-expanded"],
  [/extra\s*expanded|extra\s*wide/i, "extra-expanded"],
  [/semi\s*expanded/i, "semi-expanded"],
  [/\bexpanded\b|\bextended\b|\bwide\b/i, "expanded"],
];

export function weightFromName(name: string): number | undefined {
  for (const [re, weight] of WEIGHT_TOKENS) if (re.test(name)) return weight;
  return undefined;
}

export function stretchFromName(name: string): FontStretch | undefined {
  for (const [re, stretch] of STRETCH_TOKENS) if (re.test(name)) return stretch;
  return undefined;
}

/** OS/2 usWidthClass (1–9) → CSS keyword; the spec's own ladder. */
const WIDTH_CLASS: FontStretch[] = [
  "ultra-condensed",
  "extra-condensed",
  "condensed",
  "semi-condensed",
  "normal",
  "semi-expanded",
  "expanded",
  "extra-expanded",
  "ultra-expanded",
];

// ---------------------------------------------------------------------------
// sfnt plumbing
// ---------------------------------------------------------------------------

interface Table {
  offset: number;
  length: number;
}

function tableDirectory(view: DataView): Map<string, Table> | null {
  if (view.byteLength < 12) return null;
  const tag = view.getUint32(0);
  // 0x00010000 (TrueType), 'OTTO' (CFF), 'true' (legacy Apple TrueType)
  if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) return null;
  const numTables = view.getUint16(4);
  if (view.byteLength < 12 + numTables * 16) return null;
  const tables = new Map<string, Table>();
  for (let i = 0; i < numTables; i += 1) {
    const base = 12 + i * 16;
    const name = String.fromCharCode(
      view.getUint8(base),
      view.getUint8(base + 1),
      view.getUint8(base + 2),
      view.getUint8(base + 3),
    );
    tables.set(name, { offset: view.getUint32(base + 8), length: view.getUint32(base + 12) });
  }
  return tables;
}

/** Decode one `name` table string record. Windows records are UTF-16BE; Mac
 * Roman is close enough to Latin-1 for family names. */
function decodeNameString(
  view: DataView,
  offset: number,
  length: number,
  platformID: number,
): string {
  if (platformID === 3 || platformID === 0) {
    let out = "";
    for (let i = 0; i + 1 < length; i += 2) out += String.fromCharCode(view.getUint16(offset + i));
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

/** nameID → best available string (Windows-English records preferred). */
function readNames(view: DataView, table: Table): Map<number, string> {
  const names = new Map<number, string>();
  const scores = new Map<number, number>();
  const count = view.getUint16(table.offset + 2);
  const stringOffset = table.offset + view.getUint16(table.offset + 4);
  for (let i = 0; i < count; i += 1) {
    const rec = table.offset + 6 + i * 12;
    if (rec + 12 > view.byteLength) break;
    const platformID = view.getUint16(rec);
    const languageID = view.getUint16(rec + 4);
    const nameID = view.getUint16(rec + 6);
    const length = view.getUint16(rec + 8);
    const offset = stringOffset + view.getUint16(rec + 10);
    if (offset + length > view.byteLength) continue;
    // Prefer Windows (3) over Unicode (0) over Mac (1); English over the rest.
    const score =
      (platformID === 3 ? 40 : platformID === 0 ? 30 : 20) +
      (languageID === 0x409 || languageID === 0 ? 5 : 0);
    if ((scores.get(nameID) ?? -1) >= score) continue;
    const value = decodeNameString(view, offset, length, platformID).trim();
    if (!value) continue;
    names.set(nameID, value);
    scores.set(nameID, score);
  }
  return names;
}

interface FvarData {
  axes: Array<{ tag: string; min: number; def: number; max: number }>;
  instances: Array<{ nameID: number; coords: number[] }>;
}

function readFvar(view: DataView, table: Table): FvarData | null {
  const o = table.offset;
  if (o + 16 > view.byteLength) return null;
  const axesOffset = o + view.getUint16(o + 4);
  const axisCount = view.getUint16(o + 8);
  const axisSize = view.getUint16(o + 10);
  const instanceCount = view.getUint16(o + 12);
  const instanceSize = view.getUint16(o + 14);
  const fixed = (at: number) => view.getInt32(at) / 65536;
  const axes: FvarData["axes"] = [];
  for (let i = 0; i < axisCount; i += 1) {
    const a = axesOffset + i * axisSize;
    if (a + 20 > view.byteLength) return null;
    const tag = String.fromCharCode(
      view.getUint8(a),
      view.getUint8(a + 1),
      view.getUint8(a + 2),
      view.getUint8(a + 3),
    );
    axes.push({ tag, min: fixed(a + 4), def: fixed(a + 8), max: fixed(a + 12) });
  }
  const instances: FvarData["instances"] = [];
  const instancesOffset = axesOffset + axisCount * axisSize;
  for (let i = 0; i < instanceCount; i += 1) {
    const at = instancesOffset + i * instanceSize;
    if (at + 4 + axisCount * 4 > view.byteLength) break;
    const nameID = view.getUint16(at);
    const coords: number[] = [];
    for (let j = 0; j < axisCount; j += 1) coords.push(fixed(at + 4 + j * 4));
    instances.push({ nameID, coords });
  }
  return { axes, instances };
}

// ---------------------------------------------------------------------------
// The inspection
// ---------------------------------------------------------------------------

export function inspectFontBinary(buffer: ArrayBuffer): InspectedFont | null {
  const view = new DataView(buffer);
  const tables = tableDirectory(view);
  if (!tables) return null;

  const nameTable = tables.get("name");
  const names = nameTable ? readNames(view, nameTable) : new Map<number, string>();
  // 16 = typographic family ("Neuething Sans"); 1 folds the style in for
  // non-typographic families ("Neuething Sans Bold") — strip it via 17/2.
  let family = names.get(16);
  if (!family) {
    family = names.get(1);
    const subfamily = names.get(17) ?? names.get(2);
    if (family && subfamily && subfamily !== "Regular" && family.endsWith(` ${subfamily}`)) {
      family = family.slice(0, -subfamily.length - 1);
    }
  }

  const result: InspectedFont = { family: family || undefined };

  const os2 = tables.get("OS/2");
  if (os2 && os2.offset + 8 <= view.byteLength) {
    const weightClass = view.getUint16(os2.offset + 4);
    const widthClass = view.getUint16(os2.offset + 6);
    if (weightClass >= 1 && weightClass <= 1000) result.weight = weightClass;
    if (widthClass >= 1 && widthClass <= 9) result.stretch = WIDTH_CLASS[widthClass - 1];
    if (os2.offset + 64 <= view.byteLength) {
      result.italic = (view.getUint16(os2.offset + 62) & 1) === 1; // fsSelection ITALIC
    }
  }
  const subfamilyName = names.get(17) ?? names.get(2);
  if (subfamilyName) {
    result.weight = weightFromName(subfamilyName) ?? result.weight;
    result.stretch = stretchFromName(subfamilyName) ?? result.stretch;
    if (/italic|oblique/i.test(subfamilyName)) result.italic = true;
  }

  const fvarTable = tables.get("fvar");
  const fvar = fvarTable ? readFvar(view, fvarTable) : null;
  if (fvar && fvar.instances.length > 0) {
    const seen = new Set<string>();
    const cuts: FontFaceCut[] = [];
    for (const inst of fvar.instances) {
      const name = names.get(inst.nameID) ?? "Regular";
      const weight = weightFromName(name) ?? 400;
      const stretch = stretchFromName(name) ?? "normal";
      const italic = /italic|oblique/i.test(name);
      const key = `${weight}:${italic ? "i" : "n"}:${stretch}`;
      // Instances that collapse onto the same CSS slot (optical-size axes,
      // grades) keep only the first — one face per addressable style.
      if (seen.has(key)) continue;
      seen.add(key);
      const axes: Record<string, number> = {};
      fvar.axes.forEach((axis, i) => {
        axes[axis.tag] = inst.coords[i];
      });
      cuts.push({ name, weight, stretch, italic, axes });
    }
    if (cuts.length > 0) result.cuts = cuts;
  }

  return result;
}
