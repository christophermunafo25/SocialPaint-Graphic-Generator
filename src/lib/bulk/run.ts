// The bulk run loop: rows in, one ZIP of PNGs plus a captions file out.
//
// The render step is injected rather than imported. Rendering needs a
// mounted SchemaRenderer and a browser that paints (BulkExportStage), but
// everything else here — the ordering, the file names, the captions file,
// cancellation, what a failed row does to the rest — is plain logic that
// should be testable without a DOM. Recording usage is deliberately not
// done here either: the page records one bulk_export batch after the run
// resolves, so a canceled run still counts what it produced.
//
// jszip loads on demand inside the run. It is only ever needed on this one
// admin surface and has no business in the bundle every member downloads.

import type { FieldValues, TemplateSchema } from "../types";
import { mergeCaption } from "../caption";
import { fillableFields } from "./mapping";
import type { RowCheck } from "./validate";

/** The most rows one run will render. A 1080x1350 PNG is several
 * megabytes, and the archive holds every one of them until it is written,
 * so the cap is a memory budget: 200 keeps a worst-case run well under
 * what a browser tab can hold, and a person with more rows splits the
 * file. */
export const MAX_BULK_ROWS = 200;

/** Slug length inside a file name. Long enough to recognise a row in a
 * folder listing, short enough that the index prefix stays in view. */
const SLUG_MAX = 40;

export interface BulkRunResult {
  zip: Blob;
  /** Rows that rendered and are in the archive. */
  rendered: number;
  /** Rows that were attempted and failed, by their zero-based CSV index. */
  failed: Array<{ index: number; message: string }>;
}

export interface BulkRunInput {
  schema: TemplateSchema;
  /** The rows to render, in order. The page decides which rows qualify
   * (problem-free by default); this loop renders what it is given. */
  checks: RowCheck[];
  render(values: FieldValues): Promise<Blob>;
  onProgress(done: number, total: number): void;
  signal: AbortSignal;
}

/** Lowercase, non-alphanumeric runs collapsed to a dash, trimmed, capped. */
export function slugify(text: string, max = SLUG_MAX): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** The slug half of a row's file name: the first text or multiline field
 * (in schema order) that has a value, falling back to the template's name.
 * The index prefix is what keeps names unique, so a slug only has to be
 * recognisable. */
function rowSlug(schema: TemplateSchema, values: FieldValues): string {
  for (const f of fillableFields(schema)) {
    if (f.type !== "text" && f.type !== "multiline") continue;
    const slug = slugify(values[f.fieldKey] ?? "");
    if (slug) return slug;
  }
  return slugify(schema.name) || "graphic";
}

/** `NNN-slug.png`: the 1-based CSV row number zero-padded to the width of
 * the largest row number in the run, then the slug. The index leads so
 * that sorting a folder by name is sorting by row, and so two rows with
 * the same headline never collide. */
export function rowFileName(
  schema: TemplateSchema,
  index: number,
  values: FieldValues,
  width: number,
): string {
  return `${String(index + 1).padStart(width, "0")}-${rowSlug(schema, values)}.png`;
}

/** One CSV cell, quoted only when the value needs it (a comma, a quote, or
 * a line break — a caption can hold all three). */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The captions file that ships in the archive: one line per rendered
 * row, so the person has the copy for each graphic and not just the
 * graphic. */
export function captionsCsv(
  rows: Array<{ row: number; filename: string; caption: string }>,
): string {
  const lines = ["row,filename,caption"];
  for (const r of rows) {
    lines.push([csvCell(r.row), csvCell(r.filename), csvCell(r.caption)].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export async function runBulk(input: BulkRunInput): Promise<BulkRunResult> {
  const { schema, checks, render, onProgress, signal } = input;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const width = String(Math.max(1, ...checks.map((c) => c.index + 1))).length;
  const captions: Array<{ row: number; filename: string; caption: string }> = [];
  const failed: BulkRunResult["failed"] = [];
  let done = 0;

  for (const check of checks) {
    // Cancellation is checked between rows, never mid-render: a row that
    // has started is finished (or fails on its own), and the run resolves
    // with everything rendered so far rather than throwing it away.
    if (signal.aborted) break;
    const filename = rowFileName(schema, check.index, check.values, width);
    try {
      const blob = await render(check.values);
      // Copy the bytes into the archive and let the Blob go: the run holds
      // the archive, not the archive plus every source image.
      zip.file(filename, await blob.arrayBuffer(), { binary: true, compression: "STORE" });
      captions.push({
        row: check.index + 1,
        filename,
        caption: mergeCaption(schema, check.values),
      });
    } catch (e) {
      failed.push({ index: check.index, message: e instanceof Error ? e.message : String(e) });
    }
    done += 1;
    onProgress(done, checks.length);
  }

  zip.file("captions.csv", captionsCsv(captions));
  // Generated as bytes and wrapped here rather than asking jszip for a Blob,
  // so the same code runs under vitest (node has Blob, not jszip's
  // browser-only Blob path).
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return {
    zip: new Blob([bytes], { type: "application/zip" }),
    rendered: captions.length,
    failed,
  };
}
