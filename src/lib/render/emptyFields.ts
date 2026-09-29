import type { TemplateField } from "../types";

/** What an empty member field does.
 *  "placeholder": today. It paints its placeholder (or label) at 55%, and an
 *    empty member image paints the designed artwork or the stock portrait.
 *    The builder, gallery thumbnails and template previews use this.
 *  "hideOptional": an empty optional field is left off; an empty required
 *    field paints its placeholder, as today. The fill page, public links
 *    and bulk fill use this.
 *  "chat": an empty optional field is left off; an empty required field
 *    keeps its slot (measured with its placeholder, so nothing around it
 *    moves) and paints nothing. Every chat draft surface uses this.
 *
 * "Left off" means neither measured nor painted. Inside a layout group the
 * stack closes up around it; outside a group its space stays empty. */
export type EmptyFieldsMode = "placeholder" | "hideOptional" | "chat";

/** A member field with nothing in it. Fixed fields are never empty: the
 * admin owns their content. */
export function isEmptyMemberField(field: TemplateField, value: string | undefined): boolean {
  return !field.static && field.type !== "shape" && !value;
}

/** Is this field left off the graphic (neither measured nor painted)? */
export function isLeftOff(
  field: TemplateField,
  value: string | undefined,
  mode: EmptyFieldsMode | undefined,
): boolean {
  if (!mode || mode === "placeholder") return false;
  return Boolean(field.optional) && isEmptyMemberField(field, value);
}

/** Does this field keep its slot but paint nothing? Only an empty required
 * member field under "chat". */
export function paintsNothing(
  field: TemplateField,
  value: string | undefined,
  mode: EmptyFieldsMode | undefined,
): boolean {
  return mode === "chat" && isEmptyMemberField(field, value);
}
