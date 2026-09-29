/** A field the member must fill before the graphic renders.
 *
 * An element is either fixed (the admin owns it, the member never sees it)
 * or it is a form field. A form field is required unless the admin marked
 * it Optional; an empty optional field is left off the graphic instead of
 * leaving a hole. Shapes are design-only and never reach the member form.
 *
 * A non-fixed image is required like any other field: the member uploads
 * one before the graphic renders. (The generate edge function still skips
 * images in its own required check, because the model never supplies
 * artwork; it reports them to the member as imageFieldsNeeded instead.)
 *
 * Mirror of src/lib/templates/fieldRules.ts for the Deno runtime, which
 * cannot import from src. The logic must stay byte-identical; change both
 * or neither. Typed structurally because TemplateField does not exist here. */
export function isRequiredField(f: {
  static?: boolean;
  type: string;
  optional?: boolean;
}): boolean {
  if (f.static) return false;
  if (f.type === "shape") return false;
  if (f.optional) return false;
  return true;
}
