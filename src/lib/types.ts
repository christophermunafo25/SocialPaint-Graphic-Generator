// Domain types shared across the app. Mirrors supabase/migrations/0001_schema.sql.

// Type-only: erased at compile time, so this pulls none of that module's
// icon imports into consumers of types.ts.
import type { PlatformId } from "./templates/platforms";

export type Role = "admin" | "member";

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface BrandColor {
  key: string; // stable palette key (referenced by BrandTypeStyle.colorKey)
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
  /** Brand palette key, resolved at RENDER time. Type styles are the one
   * sanctioned live brand channel — a style locks font, weight, and color
   * across templates by design, behind the impact confirmation in Brand
   * Studio. Field-level color carries no such binding: picking a brand
   * color copies its hex onto the field. */
  colorKey?: string;
  fontSizePx?: number; // set only when the brand fixes the size globally
  maxLength?: number; // "never exceeds N characters"
  /** Locks the field's text sizing mode (see TemplateField.textSizing). */
  textSizing?: "free" | "shrink" | "fill";
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
   * textGradient (same fill pipeline as text); rects also honor
   * cornerRadius. Shapes are always static — never member-editable. */
  shape?: ShapeKind;
  /** Figma node this field was imported from (transient import provenance —
   * used to lift the element off the recomposed background). */
  sourceNodeId?: string;
  /** Binding to a named brand type style. When set, every property that
   * style defines overrides the field-level values below and is locked by
   * the brand rules engine. */
  typeStyleKey?: string;
  // Locked styling the member CANNOT change.
  fontFamily?: string;
  fontWeight?: number; // exact weight from an import; type styles override
  /** The rest of the face. The numeric weight above stays the value the
   * renderer, autoFit measurement and the export embed consume — these two
   * complete it. Absent means normal, so a field saved with only fontWeight
   * renders exactly as it did before these existed. */
  fontStyle?: "normal" | "italic";
  fontStretch?: string; // CSS font-stretch keyword; see FontStretch in render/fontCatalog
  fontSizePx?: number;
  minFontSizePx?: number; // shrink floor
  /** The field's own solid fill. Brand colors copy their hex here at pick
   * time — no field-level binding back to the palette. A bound type style's
   * colorKey (the sanctioned live channel) still wins at render. */
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
  /** How text responds to content length. "free" (or absent): the font size
   * is fixed and the box grows taller as lines wrap — height is computed,
   * never authored. "shrink": the box is exactly what the admin drew and the
   * font size decreases (measured, never estimated) until the content fits —
   * single-line text is width-constrained, multiline is height-constrained
   * with wrapping at the box width. */
  textSizing?: "free" | "shrink" | "fill";
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
  /** "free": a plain group — children keep their authored positions and the
   * group is just a movable bounding box. "stack" (or absent, so every group
   * saved before this field existed keeps its behavior): an auto-layout
   * stack that places children along `direction`. In free mode `direction`,
   * `gap`, `anchor`, `align`, `crossSize`, and `shrinkToFit` are retained
   * but ignored; `x`/`y` are unused (the frame is computed from children). */
  mode?: "free" | "stack";
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
   * minimum font sizes) until the stack fits inside the canvas. Off by default —
   * overflow stays visible, with a builder-only warning. */
  shrinkToFit?: boolean;
}

/** Child reference encoding for LayoutGroup.children. fieldKeys are
 * [a-z0-9_] slugs, so the "group:" prefix can never collide. */
export const groupChildRef = (groupId: string): string => `group:${groupId}`;
export const parseGroupChildRef = (ref: string): string | null =>
  ref.startsWith("group:") ? ref.slice(6) : null;

/** Absent mode means "stack" — the only kind that existed before free
 * groups, so old templates keep their exact behavior. */
export const isFreeGroup = (g: LayoutGroup): boolean => g.mode === "free";

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

/** A public share link for a published template.
 *
 * The token itself is NOT here and cannot be: it is stored hashed, and the
 * plaintext exists only in the response to the request that minted it. An
 * admin who loses a link regenerates it — there is nothing to look up. */
export interface TemplateLink {
  id: string;
  /** Admin's own label ("Speaker confirmation email"). Never shown to a
   * visitor; it is how an admin tells five links apart when revoking one. */
  name: string;
  /** Whether image fields are offered to whoever opens this link. */
  allowUploads: boolean;
  expiresAt: string | null;
  /** Cap on opens, or null for no cap. */
  useCap: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A newly minted link and its one and only sight of the plaintext token. */
export interface TemplateLinkWithToken {
  link: TemplateLink;
  token: string;
}

/** The fields an admin may change after a link exists. The token is not one
 * of them — changing a token is `regenerate`, which is a different action
 * with different consequences. */
export interface TemplateLinkPatch {
  name?: string;
  allowUploads?: boolean;
  /** ISO-8601, or null to remove the expiry. */
  expiresAt?: string | null;
  /** A positive integer, or null to remove the cap. */
  useCap?: number | null;
}

/** "open" is a page view, "download" an exported PNG, "share" the person
 * taking that PNG to LinkedIn. Adding a fourth means revisiting every
 * tally — they name each action explicitly rather than treating one as the
 * default, precisely so a new one cannot be silently miscounted. */
export type UsageAction = "open" | "download" | "share";

/** Where a usage event came from. A public fill has no user to attribute it
 * to and is never given a fabricated one — this is how the two are told
 * apart instead. */
export type UsageActor = "member" | "public";

export interface UsageSummaryRow {
  templateId: string;
  templateName: string;
  opens: number;
  downloads: number;
  /** Exports that went on to LinkedIn. The gap between this and `downloads`
   * is the interesting number: a template exported forty times and posted
   * twice has a caption problem, not a template problem. */
  shares: number;
  /** The subset of `downloads` that came through a public link. An admin who
   * sent a link out wants to know it is working, and a public fill is not a
   * member fill — so it is counted separately rather than folded in. */
  publicDownloads: number;
  /** The subset of `opens` that came through a public link. */
  publicOpens: number;
  lastUsedAt: string | null;
}

export interface UsageSummary {
  rows: UsageSummaryRow[];
  totalDownloads: number;
}

/** Usage for one public link. Answers the question an admin actually has
 * when they are running several links to the same template: which one is
 * pulling?
 *
 * Counts here come from usage_events, NOT from template_links.use_count.
 * The two measure different things on purpose: use_count is what the gate
 * claimed against the open cap and includes a refresh, while this is what
 * was recorded as activity. */
export interface PublicLinkUsageRow {
  linkId: string;
  /** The admin's own label, or empty if they never named it. */
  linkName: string;
  templateId: string;
  templateName: string;
  opens: number;
  downloads: number;
  /** Exports from this link that went on to LinkedIn. */
  shares: number;
  lastUsedAt: string | null;
  /** Set when the link has been revoked — the counts are history, and this
   * is why they stopped growing. */
  revokedAt: string | null;
}

/** One day of activity for the Insights trend chart (date = YYYY-MM-DD). */
export interface DailyActivityPoint {
  date: string;
  opens: number;
  downloads: number;
  /** The SUBSET of `opens` that came through a public link — not a separate
   * category to be added on top. The chart draws it as an overlay for
   * exactly that reason. */
  publicOpens: number;
  /** The subset of `downloads` that came through a public link. */
  publicDownloads: number;
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

/** Input to the Generate flow: a member's brief plus optional narrowing
 * hints. Mirrors the template-generate Edge Function's request body, minus
 * companyId, which the store supplies. */
export interface GenerateInput {
  /** What the member wants to post, in their own words. The one control that
   * matters; capped at 1,500 characters server-side. */
  brief: string;
  /** Prefer templates sized for this platform. A preference, not a filter
   * that can empty the set — the server falls back to the whole library with
   * a warning when nothing matches. */
  platformHint?: PlatformId;
  /** "Use this one" from a template card: the server fills exactly this
   * template instead of choosing. */
  templateIdHint?: string;
  /** How many proposals to return (1–3; the server defaults to 3). */
  count?: number;
  /** "library" (default) fills existing published templates — on-brand by
   * construction. "freestyle" lets the model propose NEW layouts, kept on
   * brand by constraint: palette keys and brand type styles only, with the
   * published library fed in as style reference. */
  mode?: "library" | "freestyle";
  /** The member already supplied a photo. ONLY this flag and its aspect
   * cross the wire — the image itself is a data URL in page state and never
   * reaches the server or the model. */
  hasImage?: boolean;
  /** The supplied photo's width over height, so the model can prefer a
   * template whose image slot suits it. */
  imageAspect?: number;
}

/** A freestyle proposal's design: a complete, ephemeral template the client
 * renders and fills WITHOUT persisting anything — assembled into a
 * TemplateSchema by designToSchema. Every color arrived as a brand palette
 * key and left the server as its resolved hex. */
export interface GeneratedDesign {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor?: string;
  /** Caption with {field_key} merge tags intact, so a design saved to the
   * library carries a caption that works for every future fill. */
  captionTemplate: string;
  fields: TemplateField[];
}

/** One generated proposal: a fill of an existing published template. Values
 * only — the model never touches layout, type, color, or any locked
 * property, which is what makes the output on-brand by construction. */
export interface GeneratedProposal {
  templateId: string;
  /** Echoed so a result card can be labeled without a second lookup. */
  templateName: string;
  /** Seeds TemplateUsePage's values state. Every entry was validated
   * server-side against the template's own fields; image fields are never
   * present. */
  values: FieldValues;
  /** One or two sentences the member would post alongside the graphic. */
  caption: string;
  /** The model's one-sentence case for this template, shown on the card. */
  why: string;
  /** Image fields the member still has to fill — reported so the client can
   * say so honestly before the member commits to a choice. */
  imageFieldsNeeded: Array<{ fieldKey: string; label: string; required: boolean }>;
  /** When the member supplied a photo (hasImage), the field it belongs in —
   * the model has the field labels, so it can tell a headshot slot from a
   * background. Validated server-side to name a member image slot on the
   * chosen template; the client falls back to the first member image field
   * when absent. */
  imageTargetFieldKey?: string;
  /** Freestyle mode only: the new design itself. When present, templateId is
   * a synthetic marker and the client renders this instead of fetching. */
  design?: GeneratedDesign;
}

/** Provenance for a generate call — AutoBuildMeta's spirit: every generated
 * thing can answer which model made it, from which library, and when. */
export interface GenerateMeta {
  model: string;
  generatedAt: string;
  /** How many published templates the model chose among. */
  candidateCount: number;
  briefLength: number;
}

/** The template-generate Edge Function's response. Nothing is persisted
 * server-side — the client renders these and seeds the fill page with the
 * chosen one. */
export interface GenerateResult {
  proposals: GeneratedProposal[];
  warnings: string[];
  meta: GenerateMeta;
}

/** One field the client-side measurement pass found overflowing: the value
 * that ran over, and the largest character count that measurably fits —
 * derived from real glyph measurement, never guessed. */
export interface GenerateRepairField {
  fieldKey: string;
  value: string;
  characterBudget: number;
}

/** A repair round: rewrite ONLY the named fields of one proposal's template,
 * keeping everything that fit. The Edge Function can check character counts
 * and nothing else (Deno has no font stack), so the budgets come from the
 * browser's measurement pass. */
export interface GenerateRepairInput {
  templateId: string;
  /** The original brief, so the rewrite keeps its facts and voice. */
  brief: string;
  fields: GenerateRepairField[];
}

export interface GenerateRepairResult {
  /** A rewrite for exactly each requested fieldKey, each within its budget. */
  values: FieldValues;
  warnings: string[];
  meta: { model: string; generatedAt: string };
}

/** One per-layer import issue — lets the builder point at the layer that
 * degraded instead of dumping a joined paragraph. */
export interface ImportIssue {
  layer: string;
  nodeId: string;
  issue: string;
  severity: "info" | "degraded";
}

export interface DesignImportResult {
  backgroundUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  suggestedFields: TemplateField[];
  warnings: string[];
  warningDetails?: ImportIssue[];
  /** Echo of the imported frame link — used for the layered re-render. */
  sourceUrl?: string;
  /** The (pruned) node tree the import walked — handed back to the layered
   * re-render so both passes decompose one consistent snapshot instead of
   * re-fetching a tree that may have drifted. */
  tree?: unknown;
}

/** Element-level import: a single Figma layer (pasted as a link) becomes
 * live elements — no background, no canvas change. Fields and units are
 * relative to the element's own box; `afterExcluded` on a unit interleaves
 * it back into paint order among the fields. */
export interface ElementImportResult {
  elementWidth: number;
  elementHeight: number;
  fields: TemplateField[];
  units: FigmaLayerUnit[];
  warnings: string[];
  warningDetails?: ImportIssue[];
  sourceUrl?: string;
}

/** One paintable unit of a decomposed Figma frame (frame-relative, scale 1). */
export interface FigmaLayerUnit {
  kind: "node" | "solid" | "gradient" | "imageFill" | "stroke";
  /** Source layer name — the field label if this unit is lifted. */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string; // node render / image fill (re-hosted in our Storage)
  color?: string; // solid / stroke
  opacity?: number;
  stops?: Array<{ position: number; color: string }>; // gradient
  handles?: Array<{ x: number; y: number }>; // gradient handle positions (normalized)
  /** Which gradient primitive ("linear" when absent). */
  gradientType?: "linear" | "radial" | "angular";
  /** Image-fill crop: 2×3 affine mapping the layer's unit square onto
   * normalized image coordinates (Figma scaleMode STRETCH). */
  transform?: number[][];
  /** Degrees about the unit's center (fills of a rotated node — node
   * renders bake their rotation into the PNG). */
  rotation?: number;
  /** Rounded corners for rect fills, strokes, and image fills. */
  cornerRadius?: CornerRadius;
  /** Frame-relative clip rect (mask or clipsContent ancestor). */
  clip?: { x: number; y: number; width: number; height: number };
  /** Stroke units: outline width in px. */
  strokeWeight?: number;
  /** VECTOR nodes: SVG path data recorded for a future vector-native pass. */
  pathData?: string;
  /** This unit paints ABOVE the k-th lifted field (1-based, paint order) —
   * it must become a static field at that z, never part of the background. */
  afterExcluded?: number;
}

export interface LayerRenderResult {
  canvasWidth: number;
  canvasHeight: number;
  units: FigmaLayerUnit[];
  warnings: string[];
  warningDetails?: ImportIssue[];
}
