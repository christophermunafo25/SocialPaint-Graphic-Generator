import type { BrandKit, FieldValues, TemplateField } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { resolveFieldStyle } from "../brand/resolveStyle";
import { fitsInContext, type MeasurableSchema } from "../generate/measureProposal";

/** A member text field whose character limit runs past its box. */
export interface LimitOverflow {
  fieldId: string;
  label: string;
  maxLength: number;
}

const FALLBACK_SAMPLE = "Sample copy a member replaces with their own";

/** Copy as long as a field's limit, from the designer's own placeholder:
 * real glyphs in real proportions, with real places to break. */
export function limitSample(field: TemplateField, length: number): string {
  const source = (field.placeholder ?? "").replace(/\s+/g, " ").trim() || FALLBACK_SAMPLE;
  let out = source;
  while (out.length < length) out += ` ${source}`;
  return out.slice(0, length);
}

/** The member text fields a member could overfill without breaking a
 * limit: at its character limit the copy no longer fits the box (or pushes
 * its group off the canvas), so the export would crop it or shrink it past
 * its floor. Publish names each one (326:1233). Fixed text, selects,
 * images and fields with no limit are not measured. */
export function limitOverflows(
  schema: MeasurableSchema,
  values: FieldValues,
  kit: BrandKit | null,
  measure: LineMeasurer,
): LimitOverflow[] {
  const out: LimitOverflow[] = [];
  for (const field of schema.fields) {
    if (field.static || (field.type !== "text" && field.type !== "multiline")) continue;
    // The limit the fill page enforces: a bound type style's, else the
    // field's own.
    const style = resolveFieldStyle(field, kit);
    const limit = style.maxLength ?? field.maxLength;
    if (!limit || limit <= 0) continue;
    const sample = limitSample(field, limit);
    if (!fitsInContext(schema, values, kit, measure, field, style, sample, {})) {
      out.push({ fieldId: field.id, label: field.label, maxLength: limit });
    }
  }
  return out;
}
