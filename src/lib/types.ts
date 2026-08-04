// Domain types shared across the app. Mirrors supabase/migrations/0001_schema.sql.

export type Role = "admin" | "member";

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface BrandColor {
  key: string; // palette key referenced by TemplateField.colorKey
  name: string;
  hex: string;
}

export interface FontRef {
  source: "google" | "custom";
  family: string;
  assetId?: string; // brand_assets id when source === "custom"
}

/** A named brand type style ("role") — the unit of the brand rules engine.
 * Every property a style DEFINES is locked: fields bound to the style render
 * with it and the builder/end user cannot override it. Properties left
 * undefined stay editable per field (e.g. layout-specific font size). */
export interface BrandTypeStyle {
  key: string; // stable slug, e.g. "heading"
  name: string; // "Heading"
  font?: FontRef;
  weight?: number; // exact weight the family actually ships, not a 100–900 assumption
  /** Italic and width, so a style can lock a FULL face ("Bold Expanded")
   * rather than a weight alone. Absent means normal — a style saved before
   * these existed locks exactly what it locked before. */
  fontStyle?: "normal" | "italic";
  fontStretch?: string; // CSS font-stretch keyword; see FontStretch in render/fontCatalog
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  colorKey?: string; // brand palette key
  fontSizePx?: number; // set only when the brand fixes the size globally
  maxLength?: number; // "never exceeds N characters"
  autoFit?: boolean;
}

export interface BrandKit {
  id: string;
  companyId: string;
  colors: BrandColor[]; // unlimited
  typeStyles: BrandTypeStyle[]; // unlimited
  /** Accepted free-text brand rules (from guidelines.md import or typed in). */
  guidelines: string[];
  headingFont?: FontRef;
  bodyFont?: FontRef;
  primaryLogoAssetId?: string;
}

export type AssetKind = "logo" | "font" | "image";

export interface FontAssetMetadata {
  family?: string;
  weight?: number;
  style?: "normal" | "italic";
  format?: "woff2" | "woff" | "truetype" | "opentype";
}

export interface BrandAsset {
  id: string;
  companyId: string;
  kind: AssetKind;
  name: string;
  url: string; // resolved public URL (storage_path is an implementation detail)
  metadata: FontAssetMetadata;
  createdAt: string;
}

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  enabled: boolean;
}

export interface TextGradient {
  angle: number; // degrees, CSS linear-gradient convention
  stops: Array<{ position: number; color: string }>; // position 0..1, #RRGGBB
}

export type FieldType = "text" | "multiline" | "image" | "select" | "shape";

/** Decorative shape kinds (a "line" is a thin rect). */
export type ShapeKind = "rect" | "ellipse" | "triangle" | "star";

/** Per-corner radius for image fields (px, canvas space). Uniform radius is
 * simply all four corners equal — the builder's link toggle edits them
 * together. */
export interface CornerRadius {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

export interface TemplateField {
  id: string;
  label: string;
  type: FieldType;
  fieldKey: string; // stable slug used in {merge_tags}
  // Placement in canvas pixel space. x/y are the box's top-left unless
  // anchor === "center" (then x/y are the box center — used for
  // center-anchored text like the reference generator's name field).
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees, about the box center
  anchor?: "topLeft" | "center";
  /** Canvas paint (layer) order — higher paints on top. This is a SEPARATE
   * concern from the fields array order, which is the member form order. */
  zIndex?: number;
  /** Static element: exists on the graphic but is NOT a member-editable
   * field — no form entry, no caption tag, no required check. The admin
   * fixes its content in `staticValue` (text, or an image URL). */
  static?: boolean;
  staticValue?: string;
  /** Image fields only: rounded corners, rendered identically in the
   * builder, member preview, and PNG export. */
  cornerRadius?: CornerRadius;
  /** Element opacity, 0–100 (default 100). */
  opacity?: number;
  /** Shape fields only: which shape to draw. Fill comes from colorHex /
   * colorKey / textGradient (same fill pipeline as text); rects also honor
   * cornerRadius. Shapes are always static — never member-editable. */
  shape?: ShapeKind;
  /** Figma node this field was imported from (transient import provenance —
   * used to lift the element off the recomposed background). */
  sourceNodeId?: string;
  /** Binding to a named brand type style. When set, every property that
   * style defines overrides the field-level values below and is locked by
   * the brand rules engine. */
  typeStyleKey?: string;
  // Locked styling the member CANNOT change. colorKey references the brand
  // kit palette so a palette change propagates everywhere.
  fontFamily?: string;
  fontWeight?: number; // exact weight from an import; type styles override
  /** The rest of the face. The numeric weight above stays the value the
   * renderer, autoFit measurement and the export embed consume — these two
   * complete it. Absent means normal, so a field saved with only fontWeight
   * renders exactly as it did before these existed. */
  fontStyle?: "normal" | "italic";
  fontStretch?: string; // CSS font-stretch keyword; see FontStretch in render/fontCatalog
  fontSizePx?: number;
  minFontSizePx?: number; // autoFit floor
  colorKey?: string;
  /** Literal color fallback (e.g. from a Figma import) — used only when no
   * type style or palette colorKey applies. */
  colorHex?: string;
  /** Optional text fill gradient (wins over solid color when set). */
  textGradient?: TextGradient;
  align?: "left" | "center" | "right";
  /** Vertical placement of text within the box (default middle). */
  verticalAlign?: "top" | "middle" | "bottom";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  // Guardrails
  maxLength?: number;
  autoFit?: boolean;
  /** The box width is a hard constraint: single-line text shrinks (measured,
   * not estimated) until it fits, multi-line text wraps at it, and nothing
   * ever escapes the box. */
  fixedWidth?: boolean;
  objectFit?: "cover" | "contain";
  aspectRatio?: number;
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export type TemplateStatus = "draft" | "published";

export interface TemplateSchema {
  id: string;
  companyId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: TemplateStatus;
  // v1 is always 1440×1440 (square-1440 preset) but ALWAYS read from here —
  // the renderer, builder, and export never hardcode a dimension.
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  /** Canvas base fill for blank-built templates. Precedence when rendering:
   * background image (backgroundUrl) → gradient → color → white. */
  backgroundColor?: string;
  backgroundGradient?: TextGradient;
  fields: TemplateField[];
  captionTemplate: string; // "{name} celebrated {years} incredible years!"
  createdAt: string;
  updatedAt: string;
}

export type NewTemplateInput = Omit<TemplateSchema, "id" | "createdAt" | "updatedAt">;

export type UsageAction = "open" | "download";

export interface UsageSummaryRow {
  templateId: string;
  templateName: string;
  opens: number;
  downloads: number;
  lastUsedAt: string | null;
}

export interface UsageSummary {
  rows: UsageSummaryRow[];
  totalDownloads: number;
}

/** One day of activity for the Insights trend chart (date = YYYY-MM-DD). */
export interface DailyActivityPoint {
  date: string;
  opens: number;
  downloads: number;
}

/** The values a member has entered for a template's fields, keyed by fieldKey.
 * Image fields hold a data URL. */
export type FieldValues = Record<string, string>;

export interface DesignImportResult {
  backgroundUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  suggestedFields: TemplateField[];
  warnings: string[];
  /** Echo of the imported frame link — used for the layered re-render. */
  sourceUrl?: string;
}

/** One paintable unit of a decomposed Figma frame (frame-relative, scale 1). */
export interface FigmaLayerUnit {
  kind: "node" | "solid" | "gradient" | "imageFill";
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string; // node render / image fill (re-hosted in our Storage)
  color?: string; // solid
  opacity?: number;
  stops?: Array<{ position: number; color: string }>; // gradient
  handles?: Array<{ x: number; y: number }>; // gradient handle positions (normalized)
}

export interface LayerRenderResult {
  canvasWidth: number;
  canvasHeight: number;
  units: FigmaLayerUnit[];
  warnings: string[];
}
