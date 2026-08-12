// Auto-build validation — the safety layer between the model's proposal and
// the draft. Pure functions: no I/O, no Deno globals, so the same code runs
// in the Edge Function and under vitest.
//
// The dividing line it enforces (Rule 1): Claude decides SEMANTICS, the
// extractor owns GEOMETRY. Every x/y/width/height/rotation/fontSize/color/
// align on a geometry path is copied verbatim from the extraction after the
// model responds; the model contributes only the twelve semantic properties.
// The one exception is the flat-image path, where no geometry exists and the
// model's proposed boxes are clamped hard.

import type { ExtractedElement, ExtractionResult } from "./extract.ts";

export type AutobuildSourceKind = "figma" | "canva" | "image";

/** What the model proposes per field. Geometry paths reference elements by
 * sourceId only; the image path proposes a box instead. */
export interface ProposedField {
  sourceId?: string;
  box?: { x: number; y: number; width: number; height: number };
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image" | "select";
  options?: string[];
  static?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  typeStyleKey?: string;
  colorKey?: string;
}

export interface ProposedTemplate {
  name: string;
  description: string;
  category: string;
  tags: string[];
  captionTemplate: string;
}

export interface ModelProposal {
  fields: ProposedField[];
  template: ProposedTemplate;
  rationale: Array<{ fieldKey: string; why: string }>;
}

/** Structural subset of the app's TemplateField — kept local so the Edge
 * bundle never imports from src/. Shapes must stay assignable. */
export interface ValidatedField {
  id: string;
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image" | "select";
  sourceNodeId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  static?: boolean;
  staticValue?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  typeStyleKey?: string;
  colorKey?: string;
  options?: string[];
  fontFamily?: string;
  fontWeight?: number;
  fontSizePx?: number;
  colorHex?: string;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  autoFit?: boolean;
  objectFit?: "cover";
}

export interface BrandContext {
  typeStyleKeys: string[];
  colorKeys: string[];
}

export interface ValidationOutput {
  fields: ValidatedField[];
  template: ProposedTemplate;
  rationale: Array<{ fieldKey: string; why: string }>;
  warnings: string[];
}

/** Hard failure — nothing usable survived. The engine retries once with these
 * errors appended, then answers 502. */
export class AutobuildValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "AutobuildValidationError";
    this.errors = errors;
  }
}

const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const FIELD_TYPES = new Set(["text", "multiline", "image", "select"]);
const MAX_ELEMENTS = 40;

/** Slug a string into a valid, unique fieldKey. */
function reslug(raw: string, taken: Set<string>): string {
  const base =
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "field";
  const rooted = /^[a-z]/.test(base) ? base : `f_${base}`;
  let key = rooted;
  let n = 2;
  while (taken.has(key)) key = `${rooted}_${n++}`;
  taken.add(key);
  return key;
}

/** Copy geometry + typography from the extraction — never from the model. */
function geometryFrom(
  el: ExtractedElement,
): Omit<ValidatedField, "id" | "label" | "fieldKey" | "type"> {
  return {
    sourceNodeId: el.sourceId,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    opacity: el.opacity,
    fontFamily: el.fontFamily,
    fontWeight: el.fontWeight,
    fontSizePx: el.fontSizePx,
    colorHex: el.colorHex,
    align: el.align,
    uppercase: el.uppercase,
    letterSpacingPx: el.letterSpacingPx,
    lineHeight: el.lineHeight,
  };
}

export function validateProposal(
  proposal: ModelProposal,
  extraction: ExtractionResult,
  brand: BrandContext,
  sourceKind: AutobuildSourceKind,
): ValidationOutput {
  const warnings: string[] = [];
  const errors: string[] = [];
  const isImagePath = sourceKind === "image";

  const byId = new Map(extraction.elements.map((el) => [el.sourceId, el]));
  const typeStyles = new Set(brand.typeStyleKeys);
  const colors = new Set(brand.colorKeys);
  const takenKeys = new Set<string>();
  const claimed = new Set<string>();
  const fields: ValidatedField[] = [];

  const proposals = Array.isArray(proposal.fields) ? proposal.fields : [];

  for (const p of proposals) {
    // ---- element resolution ------------------------------------------------
    let element: ExtractedElement | undefined;
    if (!isImagePath) {
      if (!p.sourceId || !byId.has(p.sourceId)) {
        warnings.push(
          `Dropped "${p.label ?? p.fieldKey ?? "?"}": sourceId ${p.sourceId ?? "(none)"} is not in the extraction.`,
        );
        continue;
      }
      if (claimed.has(p.sourceId)) {
        warnings.push(
          `Dropped "${p.label}": element ${p.sourceId} was already claimed by an earlier field.`,
        );
        continue;
      }
      element = byId.get(p.sourceId)!;
      if (element.kind === "shape") {
        // Shapes are context, never field candidates: the platform's shape
        // fields are geometric primitives that can't reproduce arbitrary
        // vector artwork, and on the Canva path (no recompose) a shape field
        // would paint an approximation over the real artwork.
        warnings.push(
          `Dropped "${p.label}": ${p.sourceId} is a shape — shapes stay in the artwork.`,
        );
        continue;
      }
      claimed.add(p.sourceId);
    }

    // ---- semantics ---------------------------------------------------------
    const label = typeof p.label === "string" ? p.label.trim().slice(0, 60) : "";
    if (!label) {
      warnings.push(`Dropped a field with an empty label (sourceId ${p.sourceId ?? "?"}).`);
      if (p.sourceId) claimed.delete(p.sourceId);
      continue;
    }

    if (!FIELD_TYPES.has(p.type)) {
      warnings.push(`Dropped "${label}": unknown field type "${String(p.type)}".`);
      if (p.sourceId) claimed.delete(p.sourceId);
      continue;
    }

    let type = p.type;
    let options: string[] | undefined;
    if (type === "select") {
      const clean = (Array.isArray(p.options) ? p.options : [])
        .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        .map((o) => o.trim())
        .slice(0, 12);
      if (clean.length < 1) {
        warnings.push(`"${label}": select without options — demoted to text.`);
        type = "text";
      } else {
        options = clean;
      }
    }

    const key =
      typeof p.fieldKey === "string" && FIELD_KEY_RE.test(p.fieldKey) && !takenKeys.has(p.fieldKey)
        ? (takenKeys.add(p.fieldKey), p.fieldKey)
        : reslug(typeof p.fieldKey === "string" && p.fieldKey ? p.fieldKey : label, takenKeys);
    if (key !== p.fieldKey) {
      warnings.push(`"${label}": fieldKey "${String(p.fieldKey)}" re-slugged to "${key}".`);
    }

    let typeStyleKey = p.typeStyleKey;
    if (typeStyleKey !== undefined && !typeStyles.has(typeStyleKey)) {
      warnings.push(`"${label}": type style "${typeStyleKey}" is not in the brand kit — unbound.`);
      typeStyleKey = undefined;
    }
    let colorKey = p.colorKey;
    if (colorKey !== undefined && !colors.has(colorKey)) {
      warnings.push(
        `"${label}": palette key "${colorKey}" is not in the brand kit — keeping the extracted color.`,
      );
      colorKey = undefined;
    }

    let maxLength =
      typeof p.maxLength === "number" && Number.isFinite(p.maxLength)
        ? Math.min(2000, Math.max(1, Math.round(p.maxLength)))
        : undefined;

    const isStatic = p.static === true;

    // ---- geometry ----------------------------------------------------------
    let geometry: ReturnType<typeof geometryFrom> | null = null;
    if (element) {
      geometry = geometryFrom(element);
    } else {
      // Image path only: the model proposes boxes; clamp hard.
      const b = p.box;
      if (
        !b ||
        ![b.x, b.y, b.width, b.height].every((v) => typeof v === "number" && Number.isFinite(v))
      ) {
        warnings.push(`Dropped "${label}": no usable box on the image path.`);
        continue;
      }
      const W = extraction.canvasWidth;
      const H = extraction.canvasHeight;
      const x = Math.min(Math.max(0, Math.round(b.x)), W);
      const y = Math.min(Math.max(0, Math.round(b.y)), H);
      const width = Math.min(Math.round(b.width), W - x);
      const height = Math.min(Math.round(b.height), H - y);
      if (width < 8 || height < 8) {
        warnings.push(`Dropped "${label}": box under 8px after clamping.`);
        continue;
      }
      if (width * height > 0.9 * W * H) {
        warnings.push(`Dropped "${label}": box covers over 90% of the canvas.`);
        continue;
      }
      geometry = { x, y, width, height };
    }

    fields.push({
      id: crypto.randomUUID(),
      label,
      fieldKey: key,
      type,
      options,
      ...geometry,
      // Fixed text keeps the source content as its baked value; editable text
      // keeps it as the placeholder. Static fields carry no member-input
      // guardrails.
      static: isStatic || undefined,
      staticValue: isStatic && element?.text ? element.text : undefined,
      placeholder: !isStatic
        ? typeof p.placeholder === "string" && p.placeholder.trim()
          ? p.placeholder.trim().slice(0, 120)
          : element?.text?.slice(0, 80)
        : undefined,
      required: !isStatic && p.required === true ? true : undefined,
      maxLength: !isStatic && type !== "image" ? maxLength : undefined,
      typeStyleKey,
      colorKey,
      autoFit: type === "text" || type === "multiline" ? true : undefined,
      objectFit: type === "image" ? "cover" : undefined,
    });
  }

  // ---- coverage: unclaimed elements become Fixed fields --------------------
  // "Fixed is a property of a live field, not an absence." The recompose
  // excludes every imported element, so an element the model skipped must
  // still land as a field or it vanishes from the design entirely.
  if (!isImagePath) {
    for (const el of extraction.elements) {
      if (claimed.has(el.sourceId) || el.kind === "shape") continue;
      const label = el.text?.trim().slice(0, 40) || (el.kind === "image" ? "Image" : "Text");
      fields.push({
        id: crypto.randomUUID(),
        label,
        fieldKey: reslug(label, takenKeys),
        type: el.kind === "image" ? "image" : "text",
        ...geometryFrom(el),
        static: true,
        staticValue: el.kind === "text" ? el.text : undefined,
        autoFit: el.kind === "text" ? true : undefined,
        objectFit: el.kind === "image" ? "cover" : undefined,
      });
      warnings.push(
        `"${label}": not in the proposal — imported as Fixed so it stays on the canvas.`,
      );
    }
  }

  // ---- totals --------------------------------------------------------------
  if (fields.length === 0) {
    errors.push("No usable fields survived validation.");
  }
  if (fields.length > MAX_ELEMENTS) {
    warnings.push(`Proposal had ${fields.length} elements — keeping the first ${MAX_ELEMENTS}.`);
    fields.length = MAX_ELEMENTS;
  }

  if (errors.length > 0) throw new AutobuildValidationError(errors);

  // ---- template + caption --------------------------------------------------
  const t = proposal.template ?? ({} as ProposedTemplate);
  const validKeys = new Set(fields.map((f) => f.fieldKey));
  let caption = typeof t.captionTemplate === "string" ? t.captionTemplate : "";
  caption = caption
    .replace(/\{([a-z][a-z0-9_]*)\}/g, (tag, key: string) => {
      if (validKeys.has(key)) return tag;
      warnings.push(`Caption tag {${key}} doesn't match any field — removed.`);
      return "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const template: ProposedTemplate = {
    name: (typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Untitled template").slice(
      0,
      80,
    ),
    description: typeof t.description === "string" ? t.description.trim().slice(0, 300) : "",
    category: typeof t.category === "string" ? t.category.trim().slice(0, 60) : "",
    tags: (Array.isArray(t.tags) ? t.tags : [])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().slice(0, 40))
      .slice(0, 8),
    captionTemplate: caption,
  };

  const rationale = (Array.isArray(proposal.rationale) ? proposal.rationale : [])
    .filter(
      (r) =>
        r &&
        typeof r.fieldKey === "string" &&
        typeof r.why === "string" &&
        validKeys.has(r.fieldKey),
    )
    .map((r) => ({ fieldKey: r.fieldKey, why: r.why.slice(0, 200) }));

  return { fields, template, rationale, warnings };
}
