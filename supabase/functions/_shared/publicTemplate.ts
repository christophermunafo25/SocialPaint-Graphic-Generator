// The public read payload: exactly what an anonymous visitor needs to render
// and fill one template, and nothing else.
//
// The payload is shaped as the same snake_case ROWS the authenticated client
// already receives, so the browser maps it with the one existing mapper
// (src/lib/stores/supabase/rows.ts). That is deliberate. A second mapper
// would drift the moment someone adds a column, and a template that renders
// differently on the public page than it does for a signed-in member breaks
// the promise this feature makes: the exported PNG is byte-identical either
// way.
//
// The two tables are treated differently on purpose:
//
//   * templates      — an explicit ALLOWLIST. The row carries company_id,
//                      status, category, tags, autobuild_meta (which holds
//                      build provenance down to per-field rationale) and
//                      timestamps. None of it renders; all of it stays home.
//   * template_fields — passed through minus template_id, with the row id and
//                      any storage reference substituted. Every column on
//                      that table is a render property; passing them through
//                      is what keeps the two render paths in step.

import {
  fontAssetFamily,
  parseStorageRef,
  refKey,
  refWithImpliedBucket,
  referencedColorKeys,
  referencedFontFamilies,
  referencedTypeStyleKeys,
  type FieldLike,
  type FontAssetLike,
  type StorageRef,
  type TypeStyleLike,
} from "./publicLink.ts";

/** A row as it comes out of Postgres. Loose on purpose — the pass-through
 * for template_fields must not need updating when a column is added. */
export type Row = Record<string, unknown>;

export interface PublicPayload {
  template: Row;
  brandKit: Row;
  fontAssets: Row[];
  /** Whether image fields accept an upload on this link. */
  allowUploads: boolean;
  /** How long the signed asset URLs in this payload last, so the page can
   * re-read the link before they lapse rather than after. */
  assetTtlSeconds: number;
}

/** Columns of template_fields that must never leave, whatever else does. */
const FIELD_COLUMNS_WITHHELD = new Set(["template_id"]);

/** The visitor's view of the template id. There is no reason for a public
 * page to learn a real one: nothing on that path queries by id, and the two
 * places the client touches it (a React key and an error-report context) do
 * not care what the string is. */
export const SURROGATE_TEMPLATE_ID = "public-link";

const surrogateFieldId = (index: number): string => `f${index + 1}`;

/** Substitute a storage reference for its signed URL.
 *
 * Returns the value untouched when it is not one of our objects (a genuinely
 * external image, a data URL), and an empty string when it IS one of ours but
 * signing failed. Empty is the honest answer: the renderer marks the image
 * unresolved, and the export gate refuses rather than shipping a PNG with a
 * hole where the logo should be. */
export function signValue(
  impliedBucket: "brand-assets" | "template-backgrounds",
  value: string | null | undefined,
  signed: Map<string, string>,
): string | null {
  if (!value) return null;
  const ref = refWithImpliedBucket(impliedBucket, value);
  if (!ref) return value;
  return signed.get(refKey(ref)) ?? "";
}

export interface BuildInput {
  /** The templates row, straight from the database. */
  template: Row;
  /** template_fields rows, in sort order. */
  fields: Row[];
  /** The company's active brand_kits row, or null. */
  brandKit: Row | null;
  /** The company's brand_assets rows of kind 'font'. */
  fontAssets: Row[];
  /** refKey → signed URL, for every object this template paints. */
  signed: Map<string, string>;
  allowUploads: boolean;
  assetTtlSeconds: number;
}

/** Build the response. Pure: the caller does the database reads and the
 * signing, so this function — the one that decides what crosses the
 * boundary — is fully testable. */
export function buildPublicPayload(input: BuildInput): PublicPayload {
  const { template, fields, brandKit, fontAssets, signed } = input;

  const fieldLikes = fields as unknown as FieldLike[];
  const typeStyles = ((brandKit?.type_styles as TypeStyleLike[] | null) ?? []).filter(
    (s): s is TypeStyleLike => Boolean(s?.key),
  );

  const boundStyleKeys = referencedTypeStyleKeys(fieldLikes);
  const boundColorKeys = referencedColorKeys(fieldLikes, typeStyles);
  const families = referencedFontFamilies(fieldLikes, typeStyles);

  return {
    // ALLOWLIST. Adding a line here is a decision about what an anonymous
    // stranger on the internet may read; treat it as one.
    template: {
      id: SURROGATE_TEMPLATE_ID,
      name: template.name,
      description: template.description ?? "",
      canvas_width: template.canvas_width,
      canvas_height: template.canvas_height,
      background_storage_path: signValue(
        "template-backgrounds",
        template.background_storage_path as string | null,
        signed,
      ),
      background_color: template.background_color ?? null,
      background_gradient: template.background_gradient ?? null,
      layout_groups: template.layout_groups ?? null,
      caption_template: template.caption_template ?? "",
      // Constants, not data. The mapper wants these columns; the visitor
      // learns nothing from them.
      company_id: "",
      status: "published",
      category: "",
      tags: [],
      autobuild_meta: null,
      created_at: "",
      updated_at: "",
      template_fields: fields.map((field, index) => publicField(field, index, signed)),
    },
    brandKit: {
      id: "",
      company_id: "",
      // Only the palette entries a bound type style actually names. The rest
      // of the brand's colours are none of a public visitor's business.
      colors: ((brandKit?.colors as Array<{ key?: string }> | null) ?? []).filter(
        (c) => c?.key && boundColorKeys.has(c.key),
      ),
      type_styles: typeStyles.filter((s) => boundStyleKeys.has(s.key)),
      // Free-text brand rules are the most confidential thing in the kit and
      // render nothing. Never.
      guidelines: [],
      // Used by Brand Studio and the font pickers, never by field
      // resolution — so the public path does not need them.
      heading_font: null,
      body_font: null,
      primary_logo_asset_id: null,
    },
    fontAssets: fontAssets
      .filter((asset) => families.has(fontAssetFamily(asset as unknown as FontAssetLike)))
      .map((asset, index) => publicFontAsset(asset, index, signed)),
    allowUploads: input.allowUploads,
    assetTtlSeconds: input.assetTtlSeconds,
  };
}

function publicField(field: Row, index: number, signed: Map<string, string>): Row {
  const out: Row = {};
  for (const [column, value] of Object.entries(field)) {
    if (FIELD_COLUMNS_WITHHELD.has(column)) continue;
    out[column] = value;
  }
  out.id = surrogateFieldId(index);
  if (field.type === "image") {
    out.static_value = signValue("brand-assets", field.static_value as string | null, signed);
  }
  return out;
}

function publicFontAsset(asset: Row, index: number, signed: Map<string, string>): Row {
  return {
    id: `font-${index + 1}`,
    company_id: "",
    kind: "font",
    name: asset.name,
    storage_path: signValue("brand-assets", asset.storage_path as string | null, signed) ?? "",
    metadata: asset.metadata ?? {},
    created_at: "",
  };
}

/** Every object this response needs signed: the template's own assets plus
 * the files behind the uploaded font families it renders with. */
export function payloadAssetRefs(input: {
  template: Row;
  fields: Row[];
  brandKit: Row | null;
  fontAssets: Row[];
}): StorageRef[] {
  const refs = new Map<string, StorageRef>();
  const add = (ref: StorageRef | null) => {
    if (ref) refs.set(refKey(ref), ref);
  };

  add(
    refWithImpliedBucket(
      "template-backgrounds",
      input.template.background_storage_path as string | null,
    ),
  );
  for (const field of input.fields) {
    if (field.type !== "image") continue;
    add(refWithImpliedBucket("brand-assets", field.static_value as string | null));
  }

  const typeStyles = ((input.brandKit?.type_styles as TypeStyleLike[] | null) ?? []).filter(
    (s): s is TypeStyleLike => Boolean(s?.key),
  );
  const families = referencedFontFamilies(input.fields as unknown as FieldLike[], typeStyles);
  for (const asset of input.fontAssets) {
    if (!families.has(fontAssetFamily(asset as unknown as FontAssetLike))) continue;
    add(refWithImpliedBucket("brand-assets", asset.storage_path as string | null));
  }

  return [...refs.values()];
}

/** Defence in depth for the review this function is supposed to get: no
 * value that looks like one of our storage references may survive into the
 * response. If one does, signing missed an object and the page would attempt
 * an anonymous sign, which RLS refuses — a slow, confusing failure instead of
 * a loud one. */
export function findUnsignedRefs(payload: PublicPayload): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (parseStorageRef(value)) found.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(payload.template);
  walk(payload.brandKit);
  walk(payload.fontAssets);
  return found;
}
