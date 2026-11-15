// What the browser adds to an import before it lands (import intent, Phase
// 1): the three things only real glyphs and the live kit can answer. Text
// on a cap-trimmed layer is re-placed from the face's own metrics, every
// member text field gets a measured character limit, and colours the kit
// would repaint are named. Pure apart from the injected measurers, so the
// builder, the fidelity replay and vitest run the same code.

import type { BrandKit, ImportIntentReport, ImportIssue, TemplateField } from "../types";
import { clampToPalette, resolveFieldStyle } from "../brand/resolveStyle";
import { characterBudget } from "../generate/measureProposal";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  canvasFontShorthand,
  minFontSizeFor,
  type LineMeasurer,
} from "../render/autoFit";

/** A face's vertical metrics as fractions of its font size. */
export interface FaceMetrics {
  ascent: number;
  descent: number;
}

/** Metrics for a face, or null when it isn't loaded (a fallback's metrics
 * would move the text to the wrong place). */
export type FaceMeasurer = (face: {
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  fontStretch?: string;
}) => FaceMetrics | null;

/** Engines round a face's metrics to whole pixels at the size they draw,
 * each a little differently. A field's place can't depend on the engine
 * that imported it, so the face is measured large and scaled down. */
const METRICS_PX = 1000;

/** The real measurer: a canvas context, answering only for loaded faces. */
export function createFaceMeasurer(): FaceMeasurer {
  let ctx: CanvasRenderingContext2D | null = null;
  return (face) => {
    if (!face.fontFamily) return null;
    try {
      if (!document.fonts.check(canvasFontShorthand({ ...face, fontSizePx: 16 }))) return null;
    } catch {
      return null;
    }
    ctx ??= document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.font = canvasFontShorthand({ ...face, fontSizePx: METRICS_PX });
    const m = ctx.measureText("H");
    const ascent = m.fontBoundingBoxAscent / METRICS_PX;
    const descent = m.fontBoundingBoxDescent / METRICS_PX;
    if (![ascent, descent].every((v) => Number.isFinite(v) && v > 0)) return null;
    return { ascent, descent };
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const isText = (f: TemplateField) => f.type === "text" || f.type === "multiline";
const isMember = (f: TemplateField) => !f.static && f.type !== "shape" && f.type !== "icon";

/** A move smaller than this is the rounding of the numbers behind it, and
 * a design that was exact stays exactly where it was. */
const MIN_SHIFT_PX = 1;

/** Re-place text the import grew back from a cap trim.
 *
 * Figma's box started at the first line's cap height. The import grew it to
 * whole lines by splitting the trim evenly above and below, which is exact
 * only for a face whose rise above its capitals equals its descent (Inter
 * is one). A browser centres the face's ascent plus descent in the line, so
 * the baseline sits half the leading plus the ascent below the line's top.
 * Putting that baseline where Figma had it moves the box by
 * (cap height + descent - ascent) / 2. A box that took a band keeps the
 * band's far edge where the layout put it. */
export function correctCapTrim(
  fields: TemplateField[],
  capTrim: ImportIntentReport["capTrim"],
  kit: BrandKit | null,
  faces: FaceMeasurer,
): TemplateField[] {
  const byId = new Map(capTrim.map((c) => [c.fieldId, c]));
  return fields.map((field) => {
    const entry = byId.get(field.id);
    if (!entry || !isText(field)) return field;
    const style = resolveFieldStyle(field, kit);
    const metrics = faces(style);
    if (!metrics) return field;
    const size = style.fontSizePx ?? DEFAULT_FONT_SIZE;
    const shift = round2((entry.capHeight + metrics.descent * size - metrics.ascent * size) / 2);
    if (Math.abs(shift) < MIN_SHIFT_PX) return field;
    if (entry.band === "up") return { ...field, height: round2(field.height + shift) };
    if (entry.band === "down") {
      return { ...field, y: round2(field.y + shift), height: round2(field.height - shift) };
    }
    return { ...field, y: round2(field.y + shift) };
  });
}

const FALLBACK_SAMPLE = "Sample copy a member replaces with their own";
const SAMPLE_LENGTH = 600;

/** A long run of the designer's own copy: real glyphs in real proportions,
 * with real places to break. */
function longSample(field: TemplateField): string {
  const source = (field.placeholder ?? "").replace(/\s+/g, " ").trim() || FALLBACK_SAMPLE;
  let out = source;
  while (out.length < SAMPLE_LENGTH) out += ` ${source}`;
  return out;
}

/** How wide a single-line pill's copy may run. The pill hugs its text and
 * grows from the edge it holds, so its room is the way to the next element
 * on that side, or to the margin it already keeps from the canvas edge. */
function pillRoom(field: TemplateField, fields: TemplateField[], canvasWidth: number): number {
  const left = field.x;
  const right = field.x + field.width;
  const pad = 2 * (field.platePaddingX ?? 0);
  const beside = fields.filter(
    (o) =>
      o.id !== field.id &&
      o.anchor !== "center" &&
      o.y < field.y + field.height &&
      o.y + o.height > field.y &&
      // Whatever it sits on is behind it, not beside it.
      !(o.x <= left && o.x + o.width >= right),
  );
  const nextRight = Math.min(
    canvasWidth - Math.max(0, left),
    ...beside.filter((o) => o.x >= right).map((o) => o.x),
  );
  const nextLeft = Math.max(
    Math.max(0, canvasWidth - right),
    ...beside.filter((o) => o.x + o.width <= left).map((o) => o.x + o.width),
  );
  const align = field.align ?? "left";
  const span =
    align === "left"
      ? nextRight - left
      : align === "right"
        ? right - nextLeft
        : 2 * Math.min(nextRight - (left + right) / 2, (left + right) / 2 - nextLeft);
  return Math.max(field.width, span) - pad;
}

/** Give every member text field its measured character limit.
 *
 * The limit is the most of the designer's own copy that fits the box at the
 * field's shrink floor, inside `lines` when the layer names them. A keyed
 * `max` that is lower wins; one that can't fit is lowered, and the import
 * says so. A field in a face this workspace can't draw keeps what its keys
 * gave it, since a fallback's glyphs measure nothing. */
export function measureLimits(
  fields: TemplateField[],
  opts: {
    limits: ImportIntentReport["limits"];
    kit: BrandKit | null;
    measure: LineMeasurer;
    canvasWidth: number;
    canvasHeight: number;
    /** Families that can't be drawn here. */
    missingFonts?: string[];
  },
): { fields: TemplateField[]; issues: ImportIssue[] } {
  const declaredById = new Map(opts.limits.map((l) => [l.fieldId, l]));
  const missing = new Set(opts.missingFonts ?? []);
  const issues: ImportIssue[] = [];
  const out = fields.map((field) => {
    if (!isText(field) || field.static) return field;
    const declared = declaredById.get(field.id);
    const style = resolveFieldStyle(field, opts.kit);
    if (style.fontFamily && missing.has(style.fontFamily)) return field;

    let probe: TemplateField;
    let probeStyle = style;
    if (field.plateColor) {
      // A multiline plate hugs its height, so only its keys bound it.
      if (field.type === "multiline") return field;
      probe = {
        ...field,
        plateColor: undefined,
        width: pillRoom(field, fields, opts.canvasWidth),
      };
      // A pill never shrinks: it grows with its copy at the designed size.
      probeStyle = { ...style, textSizing: "free" };
    } else if (declared?.lines !== undefined && field.type === "multiline") {
      const base = style.fontSizePx ?? DEFAULT_FONT_SIZE;
      const shrinks = style.textSizing === "shrink" || style.textSizing === "fill";
      const size = shrinks ? minFontSizeFor(style, base) : base;
      const lineBox = size * (style.lineHeight ?? DEFAULT_LINE_HEIGHT);
      probe = { ...field, height: Math.min(field.height, declared.lines * lineBox + 0.5) };
    } else {
      probe = field;
    }

    const budget = characterBudget(
      { fields: [probe], canvasWidth: opts.canvasWidth, canvasHeight: opts.canvasHeight },
      {},
      opts.kit,
      opts.measure,
      probe,
      probeStyle,
      longSample(field),
    );
    if (budget < 1) return field;
    if (declared?.max === undefined) return { ...field, maxLength: budget };
    if (declared.max <= budget) return { ...field, maxLength: declared.max };
    const where =
      declared.lines !== undefined
        ? `${declared.lines} line${declared.lines === 1 ? "" : "s"} here`
        : "here";
    issues.push({
      layer: field.label,
      nodeId: field.sourceNodeId ?? "",
      issue: `max=${declared.max} doesn't fit ${where}; ${budget} does.`,
      severity: "info",
    });
    return { ...field, maxLength: budget };
  });
  return { fields: out, issues };
}

/** The colours an import carries that the kit will repaint, said once. Only
 * a kit that holds fills to its palette repaints anything. */
export function offPaletteIssue(
  fields: TemplateField[],
  kit: BrandKit | null,
  layer: string,
): ImportIssue | null {
  if (!kit || kit.allowOffPalette !== false) return null;
  const off = new Set<string>();
  const check = (hex: string | undefined) => {
    if (!hex || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex.trim())) return;
    if (clampToPalette(hex, kit) !== hex) off.add(hex.trim().slice(0, 7).toUpperCase());
  };
  for (const f of fields) {
    if (f.type === "image") continue;
    check(f.colorHex);
    check(f.strokeColor);
    check(f.plateColor);
    for (const stop of f.textGradient?.stops ?? []) check(stop.color);
    for (const path of f.vector?.paths ?? []) check(path.colorHex);
  }
  if (!off.size) return null;
  const list = [...off];
  return {
    layer,
    nodeId: "",
    issue:
      list.length === 1
        ? `this color isn't in your palette and will show as the nearest one: ${list[0]}.`
        : `these colors aren't in your palette and will show as the nearest one: ${list.join(", ")}.`,
    severity: "degraded",
  };
}

/** Everything the browser adds, in the order it has to happen: the boxes
 * move first, since the limits are measured in them. */
export function prepareImport(
  fields: TemplateField[],
  opts: {
    intent?: ImportIntentReport;
    kit: BrandKit | null;
    measure: LineMeasurer;
    faces: FaceMeasurer;
    canvasWidth: number;
    canvasHeight: number;
    /** The frame's name, for an issue about the import as a whole. */
    layer: string;
    missingFonts?: string[];
  },
): { fields: TemplateField[]; issues: ImportIssue[] } {
  const placed = correctCapTrim(fields, opts.intent?.capTrim ?? [], opts.kit, opts.faces);
  const measured = measureLimits(placed, {
    limits: opts.intent?.limits ?? [],
    kit: opts.kit,
    measure: opts.measure,
    canvasWidth: opts.canvasWidth,
    canvasHeight: opts.canvasHeight,
    missingFonts: opts.missingFonts,
  });
  const palette = offPaletteIssue(measured.fields, opts.kit, opts.layer);
  return {
    fields: measured.fields,
    issues: [...measured.issues, ...(palette ? [palette] : [])],
  };
}

const MAX_NAMED = 4;

/** "Headline", "Headline and Photo", "Headline, Call to action and Photo",
 * and past four names, the rest as a count. */
function nameList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

/** The notice after an import: how many elements landed and which of them
 * members fill in, in form order. */
export function importSummary(imported: TemplateField[], how: "imported" | "pasted"): string {
  const count = `${imported.length} element${imported.length === 1 ? "" : "s"}`;
  const landed = how === "imported" ? `${count} imported` : `${count} pasted from Figma`;
  const members = imported.filter(isMember);
  if (!members.length) return `${landed}, all fixed.`;
  return `${landed}. Members fill in ${members.length}: ${nameList(members.map((f) => f.label))}.`;
}
