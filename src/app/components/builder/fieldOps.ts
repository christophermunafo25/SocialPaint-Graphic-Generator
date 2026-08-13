// Shared field operations for the Template Builder's Fields step: palette
// element defaults, canvas layer (z) ordering, and the copy/paste clipboard.
// The fields ARRAY order is the member form order; paint order is zIndex —
// two separate concerns, never conflated.

import type { BrandKit, FieldType, ShapeKind, TemplateField } from "@/lib/types";
import { newId } from "@/lib/stores/local/db";
import { suggestFieldKey } from "@/lib/caption";

export interface PaletteItem {
  /** Stable id carried through drag-and-drop (shapes share type "shape"). */
  id: string;
  type: FieldType;
  shape?: ShapeKind;
  label: string;
  width: number;
  height: number;
  /** Field group vs decorative shape group in the palette. */
  group: "fields" | "shapes";
}

/** The draggable element palette. Dropping one creates a pre-sized, pre-typed
 * element; fields immediately open for naming. Shapes are always static —
 * design-only, never in the member form. A line is a thin rect. */
export const PALETTE_ITEMS: PaletteItem[] = [
  { id: "text", type: "text", label: "Text", width: 480, height: 90, group: "fields" },
  {
    id: "multiline",
    type: "multiline",
    label: "Multiline text",
    width: 520,
    height: 220,
    group: "fields",
  },
  { id: "image", type: "image", label: "Image", width: 420, height: 420, group: "fields" },
  { id: "select", type: "select", label: "Dropdown", width: 480, height: 90, group: "fields" },
  {
    id: "rect",
    type: "shape",
    shape: "rect",
    label: "Rectangle",
    width: 420,
    height: 300,
    group: "shapes",
  },
  {
    id: "ellipse",
    type: "shape",
    shape: "ellipse",
    label: "Ellipse",
    width: 320,
    height: 320,
    group: "shapes",
  },
  {
    id: "triangle",
    type: "shape",
    shape: "triangle",
    label: "Triangle",
    width: 320,
    height: 280,
    group: "shapes",
  },
  {
    id: "star",
    type: "shape",
    shape: "star",
    label: "Star",
    width: 320,
    height: 320,
    group: "shapes",
  },
  {
    id: "line",
    type: "shape",
    shape: "rect",
    label: "Line",
    width: 480,
    height: 8,
    group: "shapes",
  },
];

/** dataTransfer MIME key for palette drags (payload = PaletteItem.id). */
export const PALETTE_MIME = "application/x-sp-element";

/** Palette-id prefix for brand logo tiles (payload = `logo:<assetId>`). */
export const LOGO_PALETTE_PREFIX = "logo:";

const maxZ = (fields: TemplateField[]) => fields.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);

/** Build a new field of the given palette type centered at a canvas point,
 * clamped inside the canvas, painted on top of everything existing. */
export function fieldFromPalette(
  item: PaletteItem,
  at: { x: number; y: number },
  existing: TemplateField[],
  kit: BrandKit | null,
  canvas: { width: number; height: number },
): TemplateField {
  const width = Math.min(item.width, canvas.width);
  const height = Math.min(item.height, canvas.height);
  const x = Math.round(Math.max(0, Math.min(canvas.width - width, at.x - width / 2)));
  const y = Math.round(Math.max(0, Math.min(canvas.height - height, at.y - height / 2)));
  const isText = item.type !== "image" && item.type !== "shape";
  return {
    id: newId(),
    label: item.label,
    fieldKey: suggestFieldKey(item.label, existing),
    type: item.type,
    x,
    y,
    width,
    height,
    zIndex: maxZ(existing) + 1,
    ...(isText
      ? {
          fontFamily: kit?.headingFont?.family,
          fontSizePx: Math.max(18, Math.min(90, Math.round(height * 0.5))),
          colorKey: kit?.colors.find((c) => c.key === "text")?.key ?? kit?.colors[0]?.key,
          align: "left" as const,
          textSizing: "shrink" as const,
        }
      : {}),
    ...(item.type === "shape"
      ? {
          shape: item.shape ?? ("rect" as const),
          colorHex: "#d9d9d9", // design-tool default grey; recolor in Fill
          static: true, // shapes are design-only — never in the member form
        }
      : {}),
    ...(item.type === "select" ? { options: [] } : {}),
  };
}

/** Build a fixed image field for a brand logo dropped from the palette.
 *
 * Always `objectFit: "contain"` — a logo must never crop, whatever box it
 * lands in or gets resized to. Static with the artwork as `staticValue`:
 * the logo is brand chrome, members never see it as a form field. The box
 * takes the logo's natural aspect ratio when known (scaled to a hand-sized
 * default), so "contain" shows no letterboxing until the admin reshapes it. */
export function logoFieldFromAsset(
  asset: { id: string; name: string; url: string },
  natural: { width: number; height: number } | null,
  at: { x: number; y: number },
  existing: TemplateField[],
  canvas: { width: number; height: number },
): TemplateField {
  const DEFAULT = 360; // longest side, in canvas px — prominent but not dominant
  const ratio =
    natural && natural.width > 0 && natural.height > 0 ? natural.width / natural.height : 1;
  let width = ratio >= 1 ? DEFAULT : Math.round(DEFAULT * ratio);
  let height = ratio >= 1 ? Math.round(DEFAULT / ratio) : DEFAULT;
  // Clamp preserving the ratio — "contain" would mask distortion, but the
  // box should still start true to the artwork.
  const scale = Math.min(1, canvas.width / width, canvas.height / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const x = Math.round(Math.max(0, Math.min(canvas.width - width, at.x - width / 2)));
  const y = Math.round(Math.max(0, Math.min(canvas.height - height, at.y - height / 2)));
  const base = asset.name.replace(/\.[^.]+$/, "").trim() || "Logo";
  const label = uniqueLabel(base, existing);
  return {
    id: newId(),
    label,
    fieldKey: suggestFieldKey(label, existing),
    type: "image",
    x,
    y,
    width,
    height,
    zIndex: maxZ(existing) + 1,
    objectFit: "contain",
    ...(natural ? { aspectRatio: ratio } : {}),
    static: true,
    staticValue: asset.url,
  };
}

/** A label not already used by any field ("Photo" → "Photo copy" → "Photo copy 2"). */
function uniqueLabel(base: string, fields: TemplateField[]): string {
  const taken = new Set(fields.map((f) => f.label));
  if (!taken.has(base)) return base;
  let candidate = `${base} copy`;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base} copy ${n++}`;
  return candidate;
}

/** Paint order: zIndex ascending, ties by array (form) order. */
export function paintOrder(fields: TemplateField[]): TemplateField[] {
  return fields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.zIndex ?? 0) - (b.f.zIndex ?? 0) || a.i - b.i)
    .map((e) => e.f);
}

/** Move the given fields to the front or back of the paint order, then
 * renormalize every zIndex to 0..n-1 (never negative — a negative z would
 * paint behind the background image). Array (form) order is untouched. */
export function setLayerOrder(
  fields: TemplateField[],
  ids: string[],
  where: "front" | "back",
): TemplateField[] {
  const idSet = new Set(ids);
  const ordered = paintOrder(fields);
  const moved = ordered.filter((f) => idSet.has(f.id));
  const rest = ordered.filter((f) => !idSet.has(f.id));
  const next = where === "front" ? [...rest, ...moved] : [...moved, ...rest];
  const z = new Map(next.map((f, i) => [f.id, i]));
  return fields.map((f) => ({ ...f, zIndex: z.get(f.id)! }));
}

// ---------------------------------------------------------------------------
// Clipboard — module-level so it survives step navigation within the session.
// ---------------------------------------------------------------------------

let clipboard: TemplateField[] = [];
let pasteGeneration = 0;

export function copyToClipboard(fields: TemplateField[]): void {
  if (!fields.length) return;
  clipboard = structuredClone(fields);
  pasteGeneration = 0;
}

export function clipboardHasFields(): boolean {
  return clipboard.length > 0;
}

/** Materialize the clipboard as brand-new fields: fresh ids, unique labels
 * and merge tags (never a duplicate tag), painted on top. Without `at`, each
 * successive paste lands at a growing small offset; with `at` (context-menu
 * paste), the group's top-left lands at that canvas point. */
export function pasteFromClipboard(
  existing: TemplateField[],
  at?: { x: number; y: number },
): TemplateField[] {
  if (!clipboard.length) return [];
  pasteGeneration += 1;
  const offset = 16 * pasteGeneration;
  const minX = Math.min(...clipboard.map((f) => f.x));
  const minY = Math.min(...clipboard.map((f) => f.y));
  let z = maxZ(existing);
  const accumulated = [...existing];
  return clipboard.map((src) => {
    const label = uniqueLabel(src.label, accumulated);
    const field: TemplateField = {
      ...structuredClone(src),
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, accumulated),
      x: at ? Math.round(at.x + (src.x - minX)) : src.x + offset,
      y: at ? Math.round(at.y + (src.y - minY)) : src.y + offset,
      zIndex: ++z,
      sourceNodeId: undefined, // a pasted copy is not backed by the Figma node
    };
    accumulated.push(field);
    return field;
  });
}

/** Duplicate in place (⌘D): copy + paste in one step without touching the
 * persistent clipboard. */
export function duplicateFields(
  targets: TemplateField[],
  existing: TemplateField[],
): TemplateField[] {
  let z = maxZ(existing);
  const accumulated = [...existing];
  return targets.map((src) => {
    const label = uniqueLabel(src.label, accumulated);
    const field: TemplateField = {
      ...structuredClone(src),
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, accumulated),
      x: src.x + 16,
      y: src.y + 16,
      zIndex: ++z,
      sourceNodeId: undefined,
    };
    accumulated.push(field);
    return field;
  });
}

/** True when a keyboard event originates from a typing context — shortcuts
 * must never fire while the admin is typing in an input. */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

// ---------------------------------------------------------------------------
// Style clipboard — Figma's "copy/paste properties": the LOOK of an element,
// never its content, geometry, or form identity. Module-level like the field
// clipboard, so a style survives step navigation within the session.
// ---------------------------------------------------------------------------

/** Every property that is "style". Copy takes all of these from the source;
 * paste applies the type-appropriate subset and CLEARS what the source lacks
 * — pasting a gradient-free style onto a gradient field removes the gradient,
 * because paste-style means "adopt this look", not "merge looks". */
const TEXT_STYLE_PROPS = [
  "typeStyleKey",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "fontStretch",
  "fontSizePx",
  "minFontSizePx",
  "uppercase",
  "letterSpacingPx",
  "lineHeight",
  "align",
  "verticalAlign",
  "textSizing",
  "colorKey",
  "colorHex",
  "textGradient",
  "opacity",
] as const;
const IMAGE_STYLE_PROPS = ["cornerRadius", "opacity", "objectFit"] as const;
const SHAPE_STYLE_PROPS = [
  "colorKey",
  "colorHex",
  "textGradient",
  "cornerRadius",
  "opacity",
] as const;

type StyleProp =
  | (typeof TEXT_STYLE_PROPS)[number]
  | (typeof IMAGE_STYLE_PROPS)[number]
  | (typeof SHAPE_STYLE_PROPS)[number];

const ALL_STYLE_PROPS = [
  ...new Set<StyleProp>([...TEXT_STYLE_PROPS, ...IMAGE_STYLE_PROPS, ...SHAPE_STYLE_PROPS]),
];

export type FieldStyle = Partial<Pick<TemplateField, StyleProp>>;

const propsForType = (type: FieldType): readonly StyleProp[] =>
  type === "image" ? IMAGE_STYLE_PROPS : type === "shape" ? SHAPE_STYLE_PROPS : TEXT_STYLE_PROPS;

let styleClipboard: FieldStyle | null = null;

/** Lift the style off a field into the clipboard. */
export function copyStyle(field: TemplateField): void {
  const style: FieldStyle = {};
  for (const p of ALL_STYLE_PROPS) {
    const v = field[p];
    if (v !== undefined) (style as Record<StyleProp, unknown>)[p] = v;
  }
  styleClipboard = structuredClone(style);
}

export const clipboardHasStyle = (): boolean => styleClipboard !== null;

/** A field wearing the clipboard's style: the properties that mean something
 * for its type are set from the clipboard (absent ones clear); everything
 * else — content, geometry, type, form identity — is untouched. Pasting a
 * headline's style onto an image applies just the shared visuals (opacity),
 * exactly like Figma pasting properties across element kinds. */
export function applyClipboardStyle(field: TemplateField): TemplateField {
  if (!styleClipboard) return field;
  const next: TemplateField = { ...field };
  for (const p of propsForType(field.type)) {
    (next as Record<StyleProp, unknown>)[p] = structuredClone(styleClipboard[p]);
  }
  return next;
}

/** Test-only: reset the style clipboard between cases. */
export function clearStyleClipboard(): void {
  styleClipboard = null;
}

/** The longest entry a member could make in a field — what the worst-case
 * preview fills the canvas with. Bounded by maxLength when set; otherwise a
 * long-but-plausible sample so the admin still sees the failure shape. */
export function worstCaseText(field: TemplateField): string {
  const sample = "The quick brown fox jumps over the lazy dog and keeps right on running";
  const target = field.maxLength ?? (field.type === "multiline" ? 240 : 80);
  let out = sample;
  while (out.length < target) out = `${out} ${sample}`;
  return out.slice(0, target).trimEnd();
}
