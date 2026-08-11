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
  /** CSS font-stretch keyword for a static width cut (absent = normal). */
  stretch?: string;
  format?: "woff2" | "woff" | "truetype" | "opentype";
  /** A variable font's named instances — every cut the file offers, each
   * mapped to CSS weight/stretch slots with its raw axis coordinates kept
   * for font-variation-settings. One @font-face registers per cut, and the
   * builder's style picker lists them all. */
  cuts?: Array<{
    name: string;
    weight: number;
    stretch: string;
    italic: boolean;
    axes?: Record<string, number>;
  }>;
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
  /** Mirror the content horizontally / vertically (Figma-style flip).
   * Applied as a scale on the content inside the box, after rotation —
   * renders identically in the builder, member preview, and PNG export. */
  flipX?: boolean;
  flipY?: boolean;
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

/** A point along one axis of a layout group: the main-axis anchor (which
 * point holds still as content grows) or the cross-axis alignment. */
export type GroupAxisPoint = "start" | "center" | "end";

/** An auto-layout stack: an ordered run of fields placed along an axis with
 * a fixed gap, anchored at a point that does not move when content grows.
 *
 * Groups are pure layout metadata, deliberately OUTSIDE the fields array:
 * fields stay flat, so the member form order (fields array), caption merge
 * tags, and paint order (zIndex) provably cannot change when an admin groups
 * elements. A template with no groups renders through the identical path it
 * always did.
 *
 * Geometry semantics, vertical direction (horizontal swaps the axes):
 *  - x is the stack's left edge; crossSize its width.
 *  - y is the ANCHOR point: the top edge when anchor="start", the vertical
 *    center when "center", the bottom edge when "end". Content grows away
 *    from it, which is the whole point of the feature.
 *  - Main-axis size is computed from measured content — never stored.
 */
export interface LayoutGroup {
  /** Client-generated and persisted verbatim (the DB re-mints template_fields
   * row ids on every save, so groups never reference fields by row id). */
  id: string;
  name: string;
  direction: "vertical" | "horizontal";
  /** Canvas px between adjacent children. */
  gap: number;
  anchor: GroupAxisPoint;
  align: GroupAxisPoint;
  x: number;
  y: number;
  crossSize: number;
  /** Ordered stack children: a field's fieldKey (the one save-stable field
   * identifier), or "group:<id>" for a nested group. Array order IS the
   * stack order — a third ordering, separate from form order and zIndex. */
  children: string[];
  /** Overflow policy: proportionally shrink text children (never below their
   * autoFit floors) until the stack fits inside the canvas. Off by default —
   * overflow stays visible, with a builder-only warning. */
  shrinkToFit?: boolean;
}

/** Child reference encoding for LayoutGroup.children. fieldKeys are
 * [a-z0-9_] slugs, so the "group:" prefix can never collide. */
export const groupChildRef = (groupId: string): string => `group:${groupId}`;
export const parseGroupChildRef = (ref: string): string | null =>
  ref.startsWith("group:") ? ref.slice(6) : null;

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
  /** Auto-layout stacks over the flat fields (absent = none — the pre-groups
   * rendering path, byte for byte). */
  layoutGroups?: LayoutGroup[];
  captionTemplate: string; // "{name} celebrated {years} incredible years!"
  /** Present when Claude built this template's fields (auto-build). */
  autobuildMeta?: AutoBuildMeta;
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

/** Where a design import comes from. "image" is a flat PNG/JPEG with no
 * source geometry — the one path where box proposals are estimated rather
 * than extracted. */
export type DesignSourceKind = "figma" | "canva" | "image";

export type DesignSource =
  | { kind: "figma"; url: string }
  | { kind: "canva"; url: string }
  | { kind: "image"; backgroundUrl: string; canvasWidth: number; canvasHeight: number };

/** Provenance for an AI-built template: which model, from what source, what
 * it decided, and why. Stored on the template so a misbehaving template can
 * be traced to a human or a model. */
export interface AutoBuildMeta {
  model: string;
  sourceKind: string;
  generatedAt: string;
  elementCount: number;
  editableCount: number;
  rationale?: Array<{ fieldKey: string; why: string }>;
}

/** The template-autobuild Edge Function's response — a finished proposal the
 * client applies to its draft. Never written server-side. */
export interface AutoBuildResult {
  sourceKind: DesignSourceKind;
  backgroundUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  sourceUrl?: string;
  /** Ordered as the FORM should read; `static` already set. */
  fields: TemplateField[];
  template: {
    name: string;
    description: string;
    category: string;
    tags: string[];
    captionTemplate: string;
  };
  rationale: Array<{ fieldKey: string; why: string }>;
  warnings: string[];
  meta: AutoBuildMeta;
}

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
