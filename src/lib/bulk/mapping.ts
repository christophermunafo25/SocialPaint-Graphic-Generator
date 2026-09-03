// Columns to fields: which template fields a CSV can fill, a best-effort
// automatic mapping from header text, and the one-row-to-values step that
// turns a spreadsheet line into exactly what the fill form would have
// produced.
//
// The mapping is deliberately conservative. It matches on the field key,
// then the label, then a normalized form of either, and nothing else: no
// column-position guessing and no edit-distance fuzz. A column the person
// has to map by hand costs one click; a column that was silently mapped to
// the wrong field costs a run of graphics with the wrong text on them.

import type { FieldValues, TemplateField, TemplateSchema } from "../types";
import { suggestFieldKey } from "../caption";

/** The fields a CSV row can fill: member-editable, non-image, non-shape. A
 * static field paints its staticValue whatever a member enters, an image
 * cannot travel in a spreadsheet cell, and a shape is always static. */
export function fillableFields(schema: Pick<TemplateSchema, "fields">): TemplateField[] {
  return schema.fields.filter(
    (f) => !f.static && (f.type === "text" || f.type === "multiline" || f.type === "select"),
  );
}

/** Column index -> fieldKey, or null for "ignore this column". */
export type ColumnMap = Array<string | null>;

/** The same normalization that turns a label into a field key ("Team Name"
 * becomes team_name), reused so a header and a field agree on what "the
 * same words" means. Empty input stays empty rather than becoming the
 * "field" fallback a key suggestion would use. */
function normalize(text: string): string {
  const trimmed = text.trim();
  return trimmed ? suggestFieldKey(trimmed, []) : "";
}

/** Best-effort automatic mapping from headers to fields. Three passes over
 * every column, strictest first, each field claimed at most once: an exact
 * key match anywhere beats a normalized match anywhere. Anything unmatched
 * maps to null. */
export function autoMap(headers: string[], fields: TemplateField[]): ColumnMap {
  const map: ColumnMap = headers.map(() => null);
  const claimed = new Set<string>();

  const pass = (matches: (header: string, field: TemplateField) => boolean) => {
    headers.forEach((header, i) => {
      if (map[i] !== null) return;
      const field = fields.find((f) => !claimed.has(f.fieldKey) && matches(header, f));
      if (!field) return;
      map[i] = field.fieldKey;
      claimed.add(field.fieldKey);
    });
  };

  pass((header, f) => header === f.fieldKey);
  pass((header, f) => header.toLowerCase() === f.label.trim().toLowerCase());
  pass((header, f) => {
    const h = normalize(header);
    return h !== "" && (h === f.fieldKey || h === normalize(f.label));
  });
  return map;
}

/** One CSV row + a map -> the FieldValues a fill form would have produced.
 * A cell is the value as typed; nothing is coerced or reformatted. When two
 * columns map to the same field the leftmost wins, so the value the person
 * saw first in the mapping table is the one that renders. */
export function rowToValues(row: string[], map: ColumnMap): FieldValues {
  const values: FieldValues = {};
  map.forEach((fieldKey, i) => {
    if (fieldKey === null || fieldKey in values) return;
    values[fieldKey] = row[i] ?? "";
  });
  return values;
}

/** One CSV cell for the starter file, quoted when the text needs it. */
function starterCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The starter file: a header of every fillable field's label and one row
 * of each field's placeholder (or nothing). A person who opens this in a
 * spreadsheet and fills it down never has a column-naming question, and
 * autoMap matches every column on the label tier. */
export function starterCsv(schema: Pick<TemplateSchema, "fields">): string {
  const fields = fillableFields(schema);
  const header = fields.map((f) => starterCell(f.label)).join(",");
  const row = fields.map((f) => starterCell(f.placeholder ?? "")).join(",");
  return `${header}\r\n${row}\r\n`;
}
