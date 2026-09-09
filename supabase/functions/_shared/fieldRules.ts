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
 * Mirror of src/lib/templates/fieldRules.ts for the Deno runtime, which
 * cannot import from src. The logic must stay byte-identical; change both
 * or neither. Typed structurally because TemplateField does not exist here. */
export function isRequiredField(f: { static?: boolean; type: string }): boolean {
  if (f.static) return false;
  if (f.type === "shape") return false;
  if (f.type === "image") return false;
  return true;
}
