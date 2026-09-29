import type { FieldValues, TemplateField, TemplateSchema } from "./types";

/**
 * Fill a caption template's {field_key} placeholders from entered values.
 * Unfilled placeholders render as a readable blank ("____") rather than
 * leaking the raw tag. An empty OPTIONAL field is left out of the caption,
 * as it is left off the graphic, and the doubled space it leaves is tidied.
 */
export function mergeCaption(template: TemplateSchema, values: FieldValues): string {
  let blanked = false;
  const merged = template.captionTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (raw, key: string) => {
    const field = template.fields.find((f) => f.fieldKey === key);
    // Static elements have fixed content, not member values.
    if (field?.static) return field.type === "image" ? raw : field.staticValue || "____";
    const value = values[key];
    if (!value && field?.optional) {
      blanked = true;
      return "";
    }
    if (!value) return "____";
    if (field?.type === "image") return raw; // images have no caption text
    return value;
  });
  if (!blanked) return merged;
  return merged
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/, ""))
    .join("\n");
}

/** Rewrite every {oldKey} tag to {newKey} — keeps a caption template in sync
 * when renaming a field re-derives its merge tag. */
export function retagCaption(caption: string, oldKey: string, newKey: string): string {
  if (!caption || oldKey === newKey) return caption;
  return caption.split(`{${oldKey}}`).join(`{${newKey}}`);
}

/** Suggest a unique snake_case field key from a label ("Team Name" → team_name). */
export function suggestFieldKey(label: string, taken: TemplateField[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (taken.some((f) => f.fieldKey === key)) key = `${base}_${n++}`;
  return key;
}
