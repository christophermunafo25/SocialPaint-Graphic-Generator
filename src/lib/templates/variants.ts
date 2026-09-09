// Template variations: the merge layer between a template's ONE field array
// and the colourway a given render wants.
//
// A variation overrides appearance only. This module is where that rule is
// enforced: the override whitelist below is the complete list of what may
// differ between variations, VariantFieldOverride is closed to everything
// else at compile time, and a stored blob carrying any other key has that
// key ignored rather than applied. Geometry, type, guardrails, identity, and
// layout groups are shared, so a filler's values (keyed by fieldKey) survive
// switching looks and an admin moving one element moves it in every look.
//
// Pure: no React, no store access, no DOM. SchemaRenderer resolves a variant
// once per render and hands everything downstream — resolveFieldStyle,
// autoFit, the layout pass, the PNG export — an already-merged field, so
// none of them know variations exist.

import type {
  TemplateField,
  TemplateSchema,
  TemplateVariant,
  TextGradient,
  VariantFieldOverride,
} from "../types";

/** The whitelist IS the product. A key not on this list is shared across
 * every variation and cannot diverge. */
export const VARIANT_OVERRIDE_KEYS = [
  "colorHex",
  "textGradient",
  "typeStyleKey",
  "opacity",
  "staticValue",
  "hidden",
] as const satisfies ReadonlyArray<keyof VariantFieldOverride>;

/** Everything a variation must NOT be able to touch. Named so the
 * compile-time check below reads as the rule it enforces. */
type StructuralKey =
  | "id"
  | "label"
  | "type"
  | "fieldKey"
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "flipX"
  | "flipY"
  | "anchor"
  | "zIndex"
  | "static"
  | "cornerRadius"
  | "shape"
  | "sourceNodeId"
  | "fontFamily"
  | "fontWeight"
  | "fontStyle"
  | "fontStretch"
  | "fontSizePx"
  | "minFontSizePx"
  | "align"
  | "verticalAlign"
  | "uppercase"
  | "letterSpacingPx"
  | "lineHeight"
  | "maxLength"
  | "textSizing"
  | "objectFit"
  | "aspectRatio"
  | "options"
  | "placeholder"
  | "required";

// Compile-time proof that the override type cannot carry a structural
// property. If someone adds `x?: number` to VariantFieldOverride, this line
// stops compiling; if someone adds a new structural property to
// TemplateField, the second line asks them to classify it.
type _NoStructuralOverrides =
  Extract<keyof VariantFieldOverride, StructuralKey> extends never ? true : never;
type _EveryFieldKeyClassified =
  Exclude<keyof TemplateField, StructuralKey | keyof VariantFieldOverride> extends never
    ? true
    : never;
const _structuralGuard: [_NoStructuralOverrides, _EveryFieldKeyClassified] = [true, true];
void _structuralGuard;

/** True when the template has more than one look to choose between. A
 * single stored variation is still single-variant for every surface: no
 * picker, no filmstrip. */
export function hasVariants(schema: Pick<TemplateSchema, "variants">): boolean {
  return (schema.variants?.length ?? 0) > 1;
}

/** The variation to render: the one asked for when it exists, else the
 * default, else the first. Undefined when the template has none — the
 * pre-feature path. A stale id (a pinned link to a deleted variation, a
 * bookmarked picker state) lands on the default instead of failing. */
export function getVariant(
  schema: Pick<TemplateSchema, "variants">,
  variantId?: string | null,
): TemplateVariant | undefined {
  const variants = schema.variants;
  if (!variants?.length) return undefined;
  if (variantId) {
    const exact = variants.find((v) => v.id === variantId);
    if (exact) return exact;
  }
  return defaultVariant(schema);
}

/** The default variation: flagged, else the first. */
export function defaultVariant(
  schema: Pick<TemplateSchema, "variants">,
): TemplateVariant | undefined {
  const variants = schema.variants;
  if (!variants?.length) return undefined;
  return variants.find((v) => v.isDefault) ?? variants[0];
}

/** Find a variation by NAME (case-insensitive, trimmed) — the bulk fill
 * CSV's `variant` column names looks, not ids. */
export function variantByName(
  schema: Pick<TemplateSchema, "variants">,
  name: string,
): TemplateVariant | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return undefined;
  return schema.variants?.find((v) => v.name.trim().toLowerCase() === wanted);
}

/** The override entry for a field in a variation, restricted to the
 * whitelist. Stored JSON is read, never trusted: a geometry key that
 * somehow landed in the blob is dropped here. */
function whitelisted(raw: VariantFieldOverride | undefined): VariantFieldOverride {
  const out: VariantFieldOverride = {};
  if (!raw) return out;
  for (const key of VARIANT_OVERRIDE_KEYS) {
    const value = raw[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** One field as this variation renders it: a shallow merge of the field's
 * whitelisted overrides over its base values. Returns the SAME object when
 * there is nothing to apply, so a single-variant template's memo chains are
 * untouched. `staticValue` only applies to fixed elements — a member field's
 * content belongs to the member. `hidden` is not merged onto the field; see
 * applyVariantToFields, which drops hidden fields instead. */
export function applyVariant(field: TemplateField, variant?: TemplateVariant): TemplateField {
  if (!variant) return field;
  const raw = variant.overrides?.[field.fieldKey];
  if (!raw) return field;
  const over = whitelisted(raw);
  const next: TemplateField = { ...field };
  let changed = false;
  if (over.colorHex !== undefined) {
    next.colorHex = over.colorHex;
    changed = true;
  }
  if (over.textGradient !== undefined) {
    next.textGradient = over.textGradient;
    changed = true;
  } else if (over.colorHex !== undefined && field.textGradient) {
    // A variation that sets a solid is asking for a solid: the base gradient
    // would otherwise win over it (gradient beats solid at render).
    next.textGradient = undefined;
    changed = true;
  }
  if (over.typeStyleKey !== undefined) {
    next.typeStyleKey = over.typeStyleKey;
    changed = true;
  }
  if (over.opacity !== undefined) {
    next.opacity = over.opacity;
    changed = true;
  }
  if (over.staticValue !== undefined && field.static) {
    next.staticValue = over.staticValue;
    changed = true;
  }
  return changed ? next : field;
}

/** Every field as this variation renders it, hidden ones removed. Returns
 * the SAME array when the variation changes nothing. */
export function applyVariantToFields(
  fields: TemplateField[],
  variant?: TemplateVariant,
): TemplateField[] {
  if (!variant) return fields;
  let changed = false;
  const out: TemplateField[] = [];
  for (const field of fields) {
    if (variant.overrides?.[field.fieldKey]?.hidden === true) {
      changed = true;
      continue;
    }
    const merged = applyVariant(field, variant);
    if (merged !== field) changed = true;
    out.push(merged);
  }
  return changed ? out : fields;
}

export interface ResolvedBackground {
  color?: string;
  gradient?: TextGradient;
  url: string;
}

/** The canvas background this variation paints. The colour+gradient pair is
 * replaced as a unit when the variation sets either (a variation that sets
 * only a colour wants a solid, not the base gradient over a different
 * fallback); the image is swapped only when the variation names one. */
export function resolveVariantBackground(
  schema: Pick<TemplateSchema, "backgroundColor" | "backgroundGradient" | "backgroundUrl">,
  variant?: TemplateVariant,
): ResolvedBackground {
  const base: ResolvedBackground = {
    color: schema.backgroundColor,
    gradient: schema.backgroundGradient,
    url: schema.backgroundUrl,
  };
  if (!variant) return base;
  const setsFill =
    variant.backgroundColor !== undefined || variant.backgroundGradient !== undefined;
  return {
    color: setsFill ? (variant.backgroundColor ?? schema.backgroundColor) : schema.backgroundColor,
    gradient: setsFill ? variant.backgroundGradient : schema.backgroundGradient,
    url: variant.backgroundUrl ?? schema.backgroundUrl,
  };
}

/** The whole schema as one variation renders it: merged fields, hidden
 * fields dropped, background resolved. Identity, dimensions, caption, and
 * layout groups pass through untouched. Returns the SAME schema object when
 * the template has no variations or the variation changes nothing, which is
 * what keeps the pre-feature path byte for byte identical. */
export function applyVariantToSchema(
  schema: TemplateSchema,
  variantId?: string | null,
): TemplateSchema {
  const variant = getVariant(schema, variantId);
  if (!variant) return schema;
  const fields = applyVariantToFields(schema.fields, variant);
  const bg = resolveVariantBackground(schema, variant);
  const sameBg =
    bg.color === schema.backgroundColor &&
    bg.gradient === schema.backgroundGradient &&
    bg.url === schema.backgroundUrl;
  if (fields === schema.fields && sameBg) return schema;
  return {
    ...schema,
    fields,
    backgroundColor: bg.color,
    backgroundGradient: bg.gradient,
    backgroundUrl: bg.url,
  };
}

/** Rename support: a field's fieldKey re-derives when its label changes,
 * and every variation's override map must follow — the same moment
 * retagCaption rewrites the caption's merge tags. Returns the SAME array
 * when nothing referenced the old key. */
export function retagVariants(
  variants: TemplateVariant[] | undefined,
  oldKey: string,
  newKey: string,
): TemplateVariant[] | undefined {
  if (!variants?.length || oldKey === newKey) return variants;
  let changed = false;
  const out = variants.map((v) => {
    if (!v.overrides || !(oldKey in v.overrides)) return v;
    changed = true;
    const overrides: TemplateVariant["overrides"] = {};
    for (const [key, value] of Object.entries(v.overrides)) {
      overrides[key === oldKey ? newKey : key] = value;
    }
    return { ...v, overrides };
  });
  return changed ? out : variants;
}

/** Delete support: drop override entries for fields that no longer exist,
 * so the stored blob never carries an orphan key. Returns the SAME array
 * when there was nothing to prune. */
export function pruneVariants(
  variants: TemplateVariant[] | undefined,
  liveFieldKeys: Iterable<string>,
): TemplateVariant[] | undefined {
  if (!variants?.length) return variants;
  const live = new Set(liveFieldKeys);
  let changed = false;
  const out = variants.map((v) => {
    const keys = Object.keys(v.overrides ?? {});
    if (keys.every((k) => live.has(k))) return v;
    changed = true;
    const overrides: TemplateVariant["overrides"] = {};
    for (const k of keys) if (live.has(k)) overrides[k] = v.overrides[k];
    return { ...v, overrides };
  });
  return changed ? out : variants;
}

/** Fields with no override entry in this variation — they inherit their
 * base styling there. For the builder's "not styled in N variations" chip;
 * deliberately NOT auto-filled, because inheriting is often exactly right. */
export function unstyledKeys(
  schema: Pick<TemplateSchema, "fields">,
  variant: TemplateVariant,
): string[] {
  return schema.fields.filter((f) => !variant.overrides?.[f.fieldKey]).map((f) => f.fieldKey);
}

/** How many variations leave this field unstyled. Zero on a single-variant
 * template, where the question does not arise. */
export function unstyledVariantCount(
  schema: Pick<TemplateSchema, "fields" | "variants">,
  fieldKey: string,
): number {
  if (!hasVariants(schema)) return 0;
  return schema.variants!.filter((v) => !v.overrides?.[fieldKey]).length;
}

/** The variation a template is left with after removing one: the list
 * without it, with exactly one default. Removing the last returns
 * undefined — the column goes back to null and the template is
 * single-variant again. */
export function removeVariant(
  variants: TemplateVariant[] | undefined,
  variantId: string,
): TemplateVariant[] | undefined {
  const rest = (variants ?? []).filter((v) => v.id !== variantId);
  if (rest.length === 0) return undefined;
  return ensureOneDefault(rest);
}

/** Exactly one default: keep the first flagged one, flag the first if none. */
export function ensureOneDefault(variants: TemplateVariant[]): TemplateVariant[] {
  let seen = false;
  const out = variants.map((v) => {
    if (v.isDefault && !seen) {
      seen = true;
      return v;
    }
    return v.isDefault ? { ...v, isDefault: undefined } : v;
  });
  if (!seen && out.length) out[0] = { ...out[0], isDefault: true };
  return out;
}

/** A new variation cloned from `source` (its override map and background,
 * never its identity or default flag), named "Variation N" unless told
 * otherwise. The clone is what "Add variation" appends: an admin starts
 * from the look they are on and changes what differs. */
export function cloneVariant(
  source: TemplateVariant | undefined,
  id: string,
  name: string,
): TemplateVariant {
  const overrides: TemplateVariant["overrides"] = {};
  for (const [key, value] of Object.entries(source?.overrides ?? {})) {
    overrides[key] = { ...whitelisted(value) };
  }
  return {
    id,
    name,
    ...(source?.backgroundColor !== undefined ? { backgroundColor: source.backgroundColor } : {}),
    ...(source?.backgroundGradient !== undefined
      ? { backgroundGradient: structuredClone(source.backgroundGradient) }
      : {}),
    ...(source?.backgroundUrl !== undefined ? { backgroundUrl: source.backgroundUrl } : {}),
    overrides,
  };
}

/** A fresh variation name no sibling already uses: "Variation 2", "Variation 3", … */
export function nextVariantName(variants: TemplateVariant[] | undefined): string {
  const taken = new Set((variants ?? []).map((v) => v.name.trim().toLowerCase()));
  let n = (variants?.length ?? 0) + 1;
  while (taken.has(`variation ${n}`)) n += 1;
  return `Variation ${n}`;
}
