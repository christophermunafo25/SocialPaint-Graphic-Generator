// Details: the fields a member can fill in themselves from a template
// chat's plus menu (Template chat PROMPT §11.4 to §11.6). Each one becomes a
// tag beside the plus and travels with the message as a `details` entry,
// applied verbatim; the model never writes it.

import type { GenerateFactKind, TemplateField, TemplateSchema } from "../types";
import { isRequiredField } from "../templates/fieldRules";
import { applyVariantToSchema } from "../templates/variants";

/** What a detail holds, which picks its glyph and whether its tag leads
 * with a globe. */
export type DetailKind = "link" | "date" | "place" | "text";

/** One row of the menu's Details section. */
export interface DetailField {
  fieldKey: string;
  label: string;
  kind: DetailKind;
  type: "text" | "multiline" | "select";
  optional: boolean;
  placeholder?: string;
  maxLength?: number;
  options?: string[];
}

/** A detail the member has added, waiting beside the plus or sent. */
export interface DetailTagValue {
  fieldKey: string;
  label: string;
  value: string;
  kind: DetailKind;
}

const words = (field: Pick<TemplateField, "label" | "fieldKey">): string =>
  `${field.label} ${field.fieldKey}`.toLowerCase().replace(/[_-]+/g, " ");

const LINK = /\b(link|url|website|web site|apply)\b/;
const DATE = /\b(date|time|when|deadline)\b/;
const PLACE = /\b(location|place|venue|city|address)\b/;

/** A field reads as a link, a date or time, or a place by its label or
 * key; anything else is text. Link wins over the others ("Apply by date"
 * is still where to apply). */
export function detailKindOf(field: Pick<TemplateField, "label" | "fieldKey">): DetailKind {
  const w = words(field);
  if (LINK.test(w)) return "link";
  if (DATE.test(w)) return "date";
  if (PLACE.test(w)) return "place";
  return "text";
}

/** The Details rows for a template in a look: every member text,
 * multiline or select field the look shows, in form order. Fixed, image,
 * shape and look-hidden fields are left out (a look removes its hidden
 * fields from the schema it renders). */
export function detailFieldsFor(schema: TemplateSchema, variantId?: string | null): DetailField[] {
  const rendered = applyVariantToSchema(schema, variantId);
  const out: DetailField[] = [];
  for (const f of rendered.fields) {
    if (f.static) continue;
    if (f.type !== "text" && f.type !== "multiline" && f.type !== "select") continue;
    out.push({
      fieldKey: f.fieldKey,
      label: f.label,
      kind: detailKindOf(f),
      type: f.type,
      optional: !isRequiredField(f),
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      ...(typeof f.maxLength === "number" ? { maxLength: f.maxLength } : {}),
      ...(f.type === "select" && f.options ? { options: f.options } : {}),
    });
  }
  return out;
}

/** Adds or replaces the tag for a field, keeping its place when it is
 * already there and appending otherwise. A blank value removes it. */
export function upsertDetail(
  tags: readonly DetailTagValue[],
  field: Pick<DetailField, "fieldKey" | "label" | "kind">,
  value: string,
): DetailTagValue[] {
  const trimmed = value.trim();
  const i = tags.findIndex((t) => t.fieldKey === field.fieldKey);
  if (!trimmed) return i < 0 ? [...tags] : tags.filter((_, j) => j !== i);
  const tag: DetailTagValue = {
    fieldKey: field.fieldKey,
    label: field.label,
    value: trimmed,
    kind: field.kind,
  };
  if (i < 0) return [...tags, tag];
  return tags.map((t, j) => (j === i ? tag : t));
}

/** Generate's Details (new look, Phase 5; Figma 13:2285): not tied to a
 * template, so a fixed four, each tag's fieldKey its kind. They travel as
 * `facts`, which the model places wherever a field fits. */
export interface GenerateDetailKind {
  fieldKey: GenerateFactKind;
  label: string;
  kind: DetailKind;
  placeholder: string;
}

export const GENERATE_DETAILS: readonly GenerateDetailKind[] = [
  { fieldKey: "headline", label: "Headline", kind: "text", placeholder: "Spring open house" },
  { fieldKey: "date", label: "Date & time", kind: "date", placeholder: "Saturday, May 4 at 6 PM" },
  { fieldKey: "place", label: "Location", kind: "place", placeholder: "Denver, CO" },
  { fieldKey: "link", label: "Link", kind: "link", placeholder: "example.com/rsvp" },
];

/** A fact's longest value, as template-generate caps it. */
export const MAX_FACT_VALUE = 300;

const FACT_KINDS = new Set<string>(GENERATE_DETAILS.map((d) => d.fieldKey));

/** Whether a sent detail's key is one of Generate's kinds. */
export function isFactKind(key: string): key is GenerateFactKind {
  return FACT_KINDS.has(key);
}
