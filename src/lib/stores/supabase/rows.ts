// Postgres row shapes (snake_case) and mappers to domain types.

import type {
  BrandAsset,
  BrandColor,
  BrandKit,
  BrandTypeStyle,
  CanvasPreset,
  Company,
  FontRef,
  TemplateField,
  TemplateSchema,
  TemplateStatus,
} from "../../types";
import { BUCKETS, publicUrl } from "./client";

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export const toCompany = (r: CompanyRow): Company => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  createdAt: r.created_at,
});

export interface CanvasPresetRow {
  id: string;
  label: string;
  width: number;
  height: number;
  enabled: boolean;
}

export const toCanvasPreset = (r: CanvasPresetRow): CanvasPreset => ({ ...r });

export interface BrandKitRow {
  id: string;
  company_id: string;
  colors: BrandColor[];
  type_styles: BrandTypeStyle[] | null;
  guidelines: string[] | null;
  heading_font: FontRef | null;
  body_font: FontRef | null;
  primary_logo_asset_id: string | null;
}

export const toBrandKit = (r: BrandKitRow): BrandKit => ({
  id: r.id,
  companyId: r.company_id,
  colors: r.colors ?? [],
  typeStyles: r.type_styles ?? [],
  guidelines: r.guidelines ?? [],
  headingFont: r.heading_font ?? undefined,
  bodyFont: r.body_font ?? undefined,
  primaryLogoAssetId: r.primary_logo_asset_id ?? undefined,
});

export interface BrandAssetRow {
  id: string;
  company_id: string;
  kind: BrandAsset["kind"];
  name: string;
  storage_path: string;
  metadata: BrandAsset["metadata"];
  created_at: string;
}

export const toBrandAsset = (r: BrandAssetRow): BrandAsset => ({
  id: r.id,
  companyId: r.company_id,
  kind: r.kind,
  name: r.name,
  url: resolveUrl(BUCKETS.brandAssets, r.storage_path),
  metadata: r.metadata ?? {},
  createdAt: r.created_at,
});

export interface TemplateFieldRow {
  id: string;
  template_id: string;
  sort_order: number;
  field_key: string;
  label: string;
  type: TemplateField["type"];
  type_style_key: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number | null;
  flip_x: boolean | null;
  flip_y: boolean | null;
  anchor: TemplateField["anchor"] | null;
  z_index: number | null;
  corner_radius: import("../../types").CornerRadius | null;
  opacity: number | null;
  shape: import("../../types").ShapeKind | null;
  is_static: boolean | null;
  static_value: string | null;
  font_family: string | null;
  font_weight: number | null;
  font_style: "normal" | "italic" | null;
  font_stretch: string | null;
  color_hex: string | null;
  text_gradient: import("../../types").TextGradient | null;
  font_size_px: number | null;
  min_font_size_px: number | null;
  /** Retired live palette binding (prompt 23) — the column survives in the
   * DB, unread and written null, until it has been dead long enough to drop. */
  color_key?: string | null;
  align: TemplateField["align"] | null;
  vertical_align: TemplateField["verticalAlign"] | null;
  uppercase: boolean | null;
  letter_spacing_px: number | null;
  line_height: number | null;
  max_length: number | null;
  text_sizing: TemplateField["textSizing"] | null;
  object_fit: TemplateField["objectFit"] | null;
  aspect_ratio: number | null;
  options: string[] | null;
  placeholder: string | null;
  required: boolean;
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

/** storage_path columns normally hold bucket-relative paths, but may hold a
 * full URL (e.g. a Figma-rendered background re-hosted elsewhere). */
export const resolveUrl = (bucket: string, path: string): string =>
  /^https?:\/\//.test(path) ? path : publicUrl(bucket, path);

export const toTemplateField = (r: TemplateFieldRow): TemplateField => ({
  id: r.id,
  fieldKey: r.field_key,
  label: r.label,
  type: r.type,
  typeStyleKey: opt(r.type_style_key),
  x: Number(r.x),
  y: Number(r.y),
  width: Number(r.width),
  height: Number(r.height),
  rotation: opt(r.rotation) === undefined ? undefined : Number(r.rotation),
  flipX: opt(r.flip_x),
  flipY: opt(r.flip_y),
  anchor: opt(r.anchor),
  zIndex: opt(r.z_index) === undefined ? undefined : Number(r.z_index),
  cornerRadius: opt(r.corner_radius),
  opacity: opt(r.opacity) === undefined ? undefined : Number(r.opacity),
  shape: opt(r.shape),
  static: opt(r.is_static),
  staticValue: opt(r.static_value),
  fontFamily: opt(r.font_family),
  fontWeight: opt(r.font_weight) === undefined ? undefined : Number(r.font_weight),
  fontStyle: opt(r.font_style),
  fontStretch: opt(r.font_stretch),
  colorHex: opt(r.color_hex),
  textGradient: opt(r.text_gradient),
  fontSizePx: opt(r.font_size_px) === undefined ? undefined : Number(r.font_size_px),
  minFontSizePx: opt(r.min_font_size_px) === undefined ? undefined : Number(r.min_font_size_px),
  align: opt(r.align),
  verticalAlign: opt(r.vertical_align),
  uppercase: opt(r.uppercase),
  letterSpacingPx: opt(r.letter_spacing_px) === undefined ? undefined : Number(r.letter_spacing_px),
  lineHeight: opt(r.line_height) === undefined ? undefined : Number(r.line_height),
  maxLength: opt(r.max_length),
  textSizing: opt(r.text_sizing),
  objectFit: opt(r.object_fit),
  aspectRatio: opt(r.aspect_ratio) === undefined ? undefined : Number(r.aspect_ratio),
  options: opt(r.options),
  placeholder: opt(r.placeholder),
  required: r.required,
});

export const fieldToRow = (
  templateId: string,
  f: TemplateField,
  sortOrder: number,
): Omit<TemplateFieldRow, "id"> => ({
  template_id: templateId,
  sort_order: sortOrder,
  field_key: f.fieldKey,
  label: f.label,
  type: f.type,
  type_style_key: f.typeStyleKey ?? null,
  x: f.x,
  y: f.y,
  width: f.width,
  height: f.height,
  rotation: f.rotation ?? null,
  flip_x: f.flipX ?? null,
  flip_y: f.flipY ?? null,
  anchor: f.anchor ?? null,
  z_index: f.zIndex ?? null,
  corner_radius: f.cornerRadius ?? null,
  opacity: f.opacity ?? null,
  shape: f.shape ?? null,
  is_static: f.static ?? null,
  static_value: f.staticValue ?? null,
  font_family: f.fontFamily ?? null,
  font_weight: f.fontWeight ?? null,
  font_style: f.fontStyle ?? null,
  font_stretch: f.fontStretch ?? null,
  color_hex: f.colorHex ?? null,
  text_gradient: f.textGradient ?? null,
  font_size_px: f.fontSizePx ?? null,
  min_font_size_px: f.minFontSizePx ?? null,
  align: f.align ?? null,
  vertical_align: f.verticalAlign ?? null,
  uppercase: f.uppercase ?? null,
  letter_spacing_px: f.letterSpacingPx ?? null,
  line_height: f.lineHeight ?? null,
  max_length: f.maxLength ?? null,
  text_sizing: f.textSizing ?? null,
  object_fit: f.objectFit ?? null,
  aspect_ratio: f.aspectRatio ?? null,
  options: f.options ?? null,
  placeholder: f.placeholder ?? null,
  required: f.required ?? false,
});

export interface TemplateRow {
  id: string;
  company_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: TemplateStatus;
  canvas_width: number;
  canvas_height: number;
  background_storage_path: string | null;
  background_color: string | null;
  background_gradient: import("../../types").TextGradient | null;
  layout_groups: import("../../types").LayoutGroup[] | null;
  caption_template: string;
  autobuild_meta: import("../../types").AutoBuildMeta | null;
  created_at: string;
  updated_at: string;
  template_fields?: TemplateFieldRow[];
}

export const toTemplate = (r: TemplateRow): TemplateSchema => ({
  id: r.id,
  companyId: r.company_id,
  name: r.name,
  description: r.description,
  category: r.category,
  tags: r.tags ?? [],
  status: r.status,
  canvasWidth: r.canvas_width,
  canvasHeight: r.canvas_height,
  backgroundColor: r.background_color ?? undefined,
  backgroundGradient: r.background_gradient ?? undefined,
  backgroundUrl: r.background_storage_path
    ? resolveUrl(BUCKETS.templateBackgrounds, r.background_storage_path)
    : "",
  fields: (r.template_fields ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toTemplateField),
  layoutGroups: r.layout_groups ?? undefined,
  captionTemplate: r.caption_template,
  autobuildMeta: r.autobuild_meta ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
