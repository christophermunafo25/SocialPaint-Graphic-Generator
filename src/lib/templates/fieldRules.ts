import type { TemplateField } from "../types";

/** A field the member must fill before the graphic renders.
 *
 * There is no Required toggle any more: an element is either fixed (the
 * admin owns it, the member never sees it) or it is a form field, and a
 * form field with nothing in it is a hole in the graphic. Two carve-outs
 * survive because they are not fields at all, or already have a fallback:
 *
 *  - Shapes are design-only. They never reach the member form.
 *  - Images keep the artwork the admin drew. The renderer falls back to it
 *    when the member uploads nothing, so an empty image is not a hole.
 *    This mirrors the carve-out generateValidate.ts already applies.
 *
 * The Deno runtime cannot import from src, so the edge functions carry a
 * byte-identical copy in supabase/functions/_shared/fieldRules.ts. Change
 * both or neither. */
export function isRequiredField(f: Pick<TemplateField, "static" | "type">): boolean {
  if (f.static) return false;
  if (f.type === "shape") return false;
  if (f.type === "image") return false;
  return true;
}
