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

/** Intrinsic size of an SVG document, from its markup. Logo SVGs are often
 * exported without width/height attributes; the browser then reports the
 * replaced-element fallback (300×150) as the natural size, which is NOT the
 * artwork and produces a wrong-aspect box that "contain" can't save. Explicit
 * absolute width/height win; a viewBox is the truth otherwise; null when the
 * document declares neither (nothing trustworthy to size from). Regex-based
 * so it runs identically in the browser and under vitest. */
export function svgIntrinsicSize(svgText: string): { width: number; height: number } | null {
  const open = /<svg\b[^>]*>/i.exec(svgText)?.[0];
  if (!open) return null;
  const attr = (name: string): string | null =>
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(open)?.[1] ?? null;
  // Percentages and other relative units resolve against the CONTAINER, not
  // the artwork — only unitless/px values describe the document itself.
  const absolute = (v: string | null): number | null => {
    if (!v) return null;
    const m = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/.exec(v);
    return m ? parseFloat(m[1]) : null;
  };
  const w = absolute(attr("width"));
  const h = absolute(attr("height"));
  if (w && h && w > 0 && h > 0) return { width: w, height: h };
  const vb = attr("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(parseFloat);
  if (vb?.length === 4 && vb.every((n) => Number.isFinite(n)) && vb[2] > 0 && vb[3] > 0) {
    return { width: vb[2], height: vb[3] };
  }
  return null;
}

export const isSvgSource = (nameOrUrl: string): boolean =>
  /\.svg(\?|#|$)/i.test(nameOrUrl) || nameOrUrl.startsWith("data:image/svg");

/** Diagonal offset between elements added to the same spot, canvas px. */
const CASCADE_STEP = 40;

/** Nudge a landing point until nothing already sits there. Clicking a
 * palette tile repeatedly aims at the same canvas center every time, which
 * drops elements exactly on top of each other and reads as "nothing
 * happened". Each occupied spot pushes the next one down and right,
 * Finder-style; the cascade restarts at the original point once it would
 * leave the canvas, so it can never walk an element out of reach. */
export function cascadePoint(
  at: { x: number; y: number },
  existing: TemplateField[],
  canvas: { width: number; height: number },
  /** The element's size, so occupancy is judged on where the box actually
   * LANDS. Callers clamp boxes into the canvas, so past a point the cascade
   * would keep proposing fresh points that all clamp to the same spot —
   * stacking elements again, which is the very thing this prevents. */
  size?: { width: number; height: number },
): { x: number; y: number } {
  const w = size?.width ?? 0;
  const h = size?.height ?? 0;
  /** Where a click at `p` really puts the box centre, clamping included. */
  const landedCentre = (p: { x: number; y: number }) => {
    if (!size) return p;
    const x = Math.max(0, Math.min(canvas.width - w, p.x - w / 2));
    const y = Math.max(0, Math.min(canvas.height - h, p.y - h / 2));
    return { x: x + w / 2, y: y + h / 2 };
  };
  const taken = (p: { x: number; y: number }) => {
    const c = landedCentre(p);
    return existing.some((f) => {
      const cx = f.anchor === "center" ? f.x : f.x + f.width / 2;
      const cy = f.anchor === "center" ? f.y : f.y + f.height / 2;
      return Math.abs(cx - c.x) < 1 && Math.abs(cy - c.y) < 1;
    });
  };
  let point = at;
  // Bounded by the canvas, so this terminates even with hundreds of fields.
  for (let i = 1; taken(point); i++) {
    const next = { x: at.x + i * CASCADE_STEP, y: at.y + i * CASCADE_STEP };
    // Give up once the BOX would clamp — past that, every further step lands
    // in the same place and the cascade stops meaning anything.
    if (next.x - w / 2 > canvas.width - w || next.y - h / 2 > canvas.height - h) return at;
    point = next;
  }
  return point;
}

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
          colorHex: kit?.colors.find((c) => c.key === "text")?.hex ?? kit?.colors[0]?.hex,
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
  "colorHex",
  "textGradient",
  "opacity",
] as const;
const IMAGE_STYLE_PROPS = ["cornerRadius", "opacity", "objectFit"] as const;
const SHAPE_STYLE_PROPS = ["colorHex", "textGradient", "cornerRadius", "opacity"] as const;

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

/** Fixed image element from a pasted or dropped file: box at the image's
 * natural aspect ratio, scaled to a hand-sized default and clamped into the
 * canvas — the same landing logoFieldFromAsset gives brand logos, but with
 * the artwork as the fixed content. */
export function imageFieldFromUpload(
  url: string,
  name: string,
  natural: { width: number; height: number } | null,
  at: { x: number; y: number },
  existing: TemplateField[],
  canvas: { width: number; height: number },
): TemplateField {
  const DEFAULT = Math.round(Math.min(canvas.width, canvas.height) * 0.45);
  const ratio =
    natural && natural.width > 0 && natural.height > 0 ? natural.width / natural.height : 1;
  let width = ratio >= 1 ? DEFAULT : Math.round(DEFAULT * ratio);
  let height = ratio >= 1 ? Math.round(DEFAULT / ratio) : DEFAULT;
  const scale = Math.min(1, canvas.width / width, canvas.height / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const x = Math.round(Math.max(0, Math.min(canvas.width - width, at.x - width / 2)));
  const y = Math.round(Math.max(0, Math.min(canvas.height - height, at.y - height / 2)));
  const base = name.replace(/\.[^.]+$/, "").trim() || "Image";
  const label = existing.some((f) => f.label === base) ? `${base} copy` : base;
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
    objectFit: "cover",
    ...(natural ? { aspectRatio: ratio } : {}),
    static: true,
    staticValue: url,
  };
}

/** Fixed text element from pasted plain text — the palette's text defaults
 * with the pasted copy as fixed content. */
export function textFieldFromPaste(
  text: string,
  at: { x: number; y: number },
  existing: TemplateField[],
  kit: BrandKit | null,
  canvas: { width: number; height: number },
): TemplateField {
  const multiline = text.includes("\n") || text.length > 60;
  const item = PALETTE_ITEMS.find((p) => p.id === (multiline ? "multiline" : "text"))!;
  const f = fieldFromPalette(item, at, existing, kit, canvas);
  return {
    ...f,
    label: "Pasted text",
    fieldKey: suggestFieldKey("Pasted text", existing),
    static: true,
    staticValue: text,
  };
}
