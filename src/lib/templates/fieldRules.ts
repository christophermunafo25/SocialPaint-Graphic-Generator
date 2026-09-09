import type { TemplateField } from "../types";

/** A field the member must fill before the graphic renders.
 *
 * There is no Required toggle any more: an element is either fixed (the
 * admin owns it, the member never sees it) or it is a form field, and a
 * form field with nothing in it is a hole in the graphic. One carve-out
 * survives because it is not a field at all:
 *
 *  - Shapes are design-only. They never reach the member form.
 *
 * A non-fixed image is required like any other field: the member uploads
 * one before the graphic renders. (The generate edge function still skips
 * images in its own required check, because the model never supplies
 * artwork; it reports them to the member as imageFieldsNeeded instead.)
 *
 * The Deno runtime cannot import from src, so the edge functions carry a
 * byte-identical copy in supabase/functions/_shared/fieldRules.ts. Change
 * both or neither. */
export function isRequiredField(f: Pick<TemplateField, "static" | "type">): boolean {
  if (f.static) return false;
  if (f.type === "shape") return false;
  return true;
}
