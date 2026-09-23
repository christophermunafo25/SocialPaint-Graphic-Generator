// The starter blueprint model: TemplateSchema-shaped designs with SYMBOLIC
// slots where a real template carries literals. Blueprints are pure data —
// the materializer (materialize.ts) resolves every slot against one tenant's
// brand kit and produces a NewTemplateInput; nothing here touches a store.
//
// Slots are the whole design contract. Surfaces, ink, and borders resolve to
// fixed neutrals (identical for every tenant), and ONLY the accent slot pair
// carries tenant color — which is what makes seeding safe for any palette.

import type { ShapeKind, TemplateField } from "../../types";

/** Symbolic color slots. Light values and the Dark-variant values live in
 * the materializer's slot tables; accent/onAccent are computed per tenant. */
export type SlotColor =
  "surface" | "surfaceAlt" | "ink" | "inkMuted" | "accent" | "onAccent" | "border";

/** Symbolic font slots: display and body come from the tenant's kit; label
 * is a fixed mono default tenants restyle later in the builder. */
export type SlotFont = "display" | "body" | "label";

/** The only text tokens blueprints may carry, inside static strings and
 * placeholders. Nothing else is templated. */
export const TEXT_TOKENS = ["{company.name}", "{company.website}"] as const;

/** One blueprint field: TemplateField geometry and guardrails with slots in
 * place of color/font literals. `id` is minted at materialize time. The
 * fields array order is BOTH paint order and member form order — backer and
 * frame shapes sit immediately before the field they decorate, so ties in
 * the renderer's zIndex fallback (DOM order) paint them underneath. */
export interface StarterField {
  fieldKey: string;
  label: string;
  type: TemplateField["type"];
  /** Marks the tenant-logo slot: the materializer injects the uploaded logo
   * asset as a static image, or (outside the partnership template) drops
   * the field when the tenant has none. */
  role?: "logo";
  /** Omit this field whenever the named fieldKey is omitted — how a logo's
   * border frame follows its logo out of the template. */
  omitWith?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  static?: boolean;
  /** Static text content; may carry TEXT_TOKENS. A STATIC text field whose
   * value uses {company.website} is dropped entirely when the tenant has no
   * website. */
  staticValue?: string;
  /** Editable-field placeholder copy; may carry TEXT_TOKENS. */
  placeholder?: string;
  /** Replacement placeholder when the tenant has no website — for editable
   * copy that embeds {company.website} and cannot simply be dropped. */
  placeholderNoWebsite?: string;
  /** Shape fields. */
  shape?: ShapeKind;
  strokeColor?: SlotColor;
  strokeWidthPx?: number;
  /** Text styling (literals from the Appendix A type ramp). */
  font?: SlotFont;
  fontWeight?: number;
  fontSizePx?: number;
  minFontSizePx?: number;
  lineHeight?: number;
  letterSpacingPx?: number;
  uppercase?: boolean;
  align?: TemplateField["align"];
  verticalAlign?: TemplateField["verticalAlign"];
  textSizing?: TemplateField["textSizing"];
  /** Fill slots. */
  colorHex?: SlotColor;
  plateColor?: SlotColor;
  platePaddingX?: number;
  platePaddingY?: number;
  /** Image fields. */
  objectFit?: TemplateField["objectFit"];
  required?: boolean;
}

/** One starter design, transcribed from Appendix A of the seeding spec. */
export interface StarterBlueprint {
  /** Stable identity ("launch-01") — the idempotency key in autobuildMeta. */
  starterKey: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  canvasWidth: number;
  canvasHeight: number;
  /** May carry TEXT_TOKENS. */
  captionTemplate: string;
  /** Canvas base fill slot (always "surface" in v1). */
  backgroundColor: SlotColor;
  fields: StarterField[];
}
