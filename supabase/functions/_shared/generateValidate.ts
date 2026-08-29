// Generate validation — the safety layer between the model's proposed posts
// and the client. Pure functions: no I/O, no Deno globals, so the same code
// runs in the Edge Function and under vitest.
//
// The dividing line it enforces: the model chooses a templateId from the
// candidate set and writes VALUES into fields an admin deliberately exposed —
// nothing else. Geometry, type, color, and every locked property are out of
// reach by construction, because the only thing that leaves this module is
// (templateId, fieldKey → string).

/** One field of a candidate template, as validation sees it: the FULL field
 * list including fixed fields, so a write against a fixed field can be named
 * as such rather than reported as "unknown". The model is shown a narrower
 * view (see modelCandidates). */
export interface CandidateField {
  fieldKey: string;
  label: string;
  type: "text" | "multiline" | "image" | "select";
  /** Fixed by the admin — exists on the canvas, never writable. */
  static?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  options?: string[];
}

/** A published template as a generation candidate. Everything here is stored
 * data or derived from it. The client-side catalog
 * (src/lib/templates/catalog.ts) is the richer version of this record — it
 * is not ported into the Deno bundle because it imports lucide icons and
 * React types; the few derived properties needed here are computed below. */
export interface CandidateTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  canvasWidth: number;
  canvasHeight: number;
  orientation: Orientation;
  platforms: GeneratePlatform[];
  fields: CandidateField[];
}

// ---------------------------------------------------------------------------
// Platform + orientation, derived from canvas size. Mirrors
// src/lib/templates/platforms.ts (KNOWN_SIZES as of 2026-08-07) — data only,
// since that module imports lucide icons the Deno bundle cannot carry.
// ---------------------------------------------------------------------------

export const GENERATE_PLATFORM_IDS = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "email",
  "display",
  "web",
  "print",
  "general",
] as const;

export type GeneratePlatform = (typeof GENERATE_PLATFORM_IDS)[number];

export type Orientation = "square" | "portrait" | "vertical" | "landscape";

const KNOWN_SIZES: Array<{ width: number; height: number; platforms: GeneratePlatform[] }> = [
  { width: 1080, height: 1350, platforms: ["instagram", "facebook", "linkedin"] },
  { width: 1080, height: 1080, platforms: ["instagram", "facebook"] },
  { width: 1080, height: 566, platforms: ["instagram"] },
  { width: 1080, height: 1920, platforms: ["instagram", "facebook", "linkedin"] },
  { width: 1200, height: 630, platforms: ["facebook"] },
  { width: 1200, height: 1200, platforms: ["linkedin"] },
  { width: 1200, height: 627, platforms: ["linkedin"] },
  { width: 1440, height: 1440, platforms: ["general"] },
];

/** Exact dimension match only, same policy as the client catalog: a
 * near-miss is a different size, and guessing would let a platform filter
 * exclude templates it should not. */
export function classifyPlatforms(width: number, height: number): GeneratePlatform[] {
  const hit = KNOWN_SIZES.find((s) => s.width === width && s.height === height);
  return hit ? hit.platforms : ["general"];
}

export function orientationOf(width: number, height: number): Orientation {
  const r = width / height;
  if (Math.abs(r - 1) < 0.01) return "square";
  if (r > 1) return "landscape";
  return r <= 0.6 ? "vertical" : "portrait";
}

// ---------------------------------------------------------------------------
// Candidate construction from database rows
// ---------------------------------------------------------------------------

/** The templates row columns this feature reads. Loose nulls because the
 * database allows them on the text columns. */
export interface TemplateRowLike {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  canvas_width: number;
  canvas_height: number;
}

/** The template_fields row columns this feature reads. */
export interface FieldRowLike {
  field_key: string;
  label: string;
  type: string;
  is_static: boolean | null;
  required: boolean | null;
  max_length: number | null;
  placeholder: string | null;
  options: string[] | null;
}

const CANDIDATE_FIELD_TYPES = new Set(["text", "multiline", "image", "select"]);

/** Build one candidate from its rows. Shape and legacy location fields are
 * excluded outright — shapes are decoration and neither is ever writable. */
export function candidateFromRows(
  template: TemplateRowLike,
  fieldRows: FieldRowLike[],
): CandidateTemplate {
  const fields: CandidateField[] = [];
  for (const row of fieldRows) {
    if (!CANDIDATE_FIELD_TYPES.has(row.type)) continue;
    fields.push({
      fieldKey: row.field_key,
      label: row.label,
      type: row.type as CandidateField["type"],
      static: row.is_static === true ? true : undefined,
      required: row.required === true ? true : undefined,
      maxLength: typeof row.max_length === "number" ? row.max_length : undefined,
      placeholder: row.placeholder ?? undefined,
      options: row.options ?? undefined,
    });
  }
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    category: template.category ?? "",
    tags: template.tags ?? [],
    canvasWidth: template.canvas_width,
    canvasHeight: template.canvas_height,
    orientation: orientationOf(template.canvas_width, template.canvas_height),
    platforms: classifyPlatforms(template.canvas_width, template.canvas_height),
    fields,
  };
}

/** The view the MODEL is shown: fixed fields removed entirely, so the field
 * list it reasons over is exactly the set it may write. Validation keeps the
 * full list so a write against a fixed field is reported by name. */
export function modelCandidates(candidates: CandidateTemplate[]): CandidateTemplate[] {
  return candidates.map((c) => ({
    ...c,
    fields: c.fields.filter((f) => !f.static).map(({ static: _static, ...rest }) => rest),
  }));
}

// ---------------------------------------------------------------------------
// Model output validation
// ---------------------------------------------------------------------------

/** What the model proposes, per the propose_posts tool. values is an array
 * (not an object) so the tool schema can describe it properly and validation
 * can report per-entry errors; it converts to a map after validation. */
export interface ProposedGeneration {
  templateId: string;
  values: Array<{ fieldKey: string; value: string }>;
  caption: string;
  why: string;
  /** When the request said the member supplied a photo: the image field it
   * belongs in. Optional, and only ever advisory — an invalid key is
   * dropped with a warning, never an error. */
  imageTargetFieldKey?: string;
}

export interface GenerateModelOutput {
  proposals: ProposedGeneration[];
}

/** An image field the member still has to fill before the graphic is
 * complete — reported honestly so the client can say so before the member
 * commits to a choice. */
export interface ImageFieldNeeded {
  fieldKey: string;
  label: string;
  required: boolean;
}

export interface ValidatedGeneration {
  templateId: string;
  templateName: string;
  /** fieldKey → value, every entry verified against the template's fields. */
  values: Record<string, string>;
  caption: string;
  why: string;
  imageFieldsNeeded: ImageFieldNeeded[];
  /** Verified to name a member-editable image field on this template. */
  imageTargetFieldKey?: string;
}

export interface GenerateValidationOutput {
  proposals: ValidatedGeneration[];
  warnings: string[];
}

/** Hard failure — the proposals cannot be shown. The engine retries once
 * with these errors appended, then answers 502. */
export class GenerateValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "GenerateValidationError";
    this.errors = errors;
  }
}

/** Absent an admin maxLength, the ceiling that separates copy from garbage.
 * Matches the autobuild clamp. */
const HARD_VALUE_CAP = 2000;

export function validateGeneration(
  output: GenerateModelOutput,
  candidates: CandidateTemplate[],
  count: number,
): GenerateValidationOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const raw = Array.isArray(output?.proposals) ? output.proposals : [];
  let list = raw;
  if (list.length > count) {
    warnings.push(`The model returned ${list.length} proposals — keeping the first ${count}.`);
    list = list.slice(0, count);
  }

  const proposals: ValidatedGeneration[] = [];

  list.forEach((p, i) => {
    const label = `Proposal ${i + 1}`;
    const template = p && typeof p.templateId === "string" ? byId.get(p.templateId) : undefined;
    if (!template) {
      errors.push(
        `${label}: templateId "${String(p?.templateId)}" is not one of the candidate templates.`,
      );
      return;
    }
    const fieldsByKey = new Map(template.fields.map((f) => [f.fieldKey, f]));
    const values: Record<string, string> = {};

    for (const entry of Array.isArray(p.values) ? p.values : []) {
      if (!entry || typeof entry.fieldKey !== "string" || typeof entry.value !== "string") {
        errors.push(`${label}: every values entry needs a string fieldKey and a string value.`);
        continue;
      }
      const field = fieldsByKey.get(entry.fieldKey);
      if (!field) {
        errors.push(`${label}: field "${entry.fieldKey}" does not exist on "${template.name}".`);
        continue;
      }
      if (field.static) {
        errors.push(
          `${label}: field "${entry.fieldKey}" is fixed by the admin and cannot be written.`,
        );
        continue;
      }
      // The model cannot produce a headshot and must not try — a value here
      // is stripped, and the member's remaining work is reported instead.
      if (field.type === "image") {
        warnings.push(
          `${label}: dropped the value for image field "${entry.fieldKey}" — images come from the member.`,
        );
        continue;
      }
      if (entry.fieldKey in values) {
        warnings.push(`${label}: duplicate value for "${entry.fieldKey}" — keeping the first.`);
        continue;
      }
      const value = entry.value.trim();
      if (!value) {
        warnings.push(`${label}: dropped an empty value for "${entry.fieldKey}".`);
        continue;
      }
      if (field.type === "select" && !(field.options ?? []).includes(value)) {
        errors.push(
          `${label}: "${value}" is not an option for "${entry.fieldKey}" — the options are: ${(field.options ?? []).join(", ")}.`,
        );
        continue;
      }
      const cap = field.maxLength ?? HARD_VALUE_CAP;
      if (value.length > cap) {
        // Never truncate silently — a value cut mid-word is how a generated
        // graphic ends up reading "Senior Nurse Practitione".
        errors.push(
          `${label}: the value for "${entry.fieldKey}" is ${value.length} characters — the limit is ${cap}. Write a shorter value.`,
        );
        continue;
      }
      values[entry.fieldKey] = value;
    }

    // A proposal that skips a required text field is a broken graphic, not a
    // choice — send it back rather than showing a hole where the headline goes.
    for (const field of template.fields) {
      if (field.static || field.type === "image" || field.required !== true) continue;
      if (!(field.fieldKey in values)) {
        errors.push(
          `${label}: required field "${field.fieldKey}" on "${template.name}" has no value.`,
        );
      }
    }

    // The photo target is advisory: a key that does not name a member image
    // slot is dropped with a warning, never an error — the client falls back
    // to the first member image field, and a bad hint must not cost a retry.
    let imageTargetFieldKey: string | undefined;
    if (p.imageTargetFieldKey !== undefined) {
      const target =
        typeof p.imageTargetFieldKey === "string"
          ? fieldsByKey.get(p.imageTargetFieldKey)
          : undefined;
      if (target && target.type === "image" && target.static !== true) {
        imageTargetFieldKey = target.fieldKey;
      } else {
        warnings.push(
          `${label}: imageTargetFieldKey "${String(p.imageTargetFieldKey)}" is not a member image slot on "${template.name}" — ignored.`,
        );
      }
    }

    proposals.push({
      templateId: template.id,
      templateName: template.name,
      values,
      caption: typeof p.caption === "string" ? p.caption.trim().slice(0, 600) : "",
      why: typeof p.why === "string" ? p.why.trim().slice(0, 200) : "",
      imageFieldsNeeded: template.fields
        .filter((f) => !f.static && f.type === "image")
        .map((f) => ({ fieldKey: f.fieldKey, label: f.label, required: f.required === true })),
      imageTargetFieldKey,
    });
  });

  if (proposals.length === 0) {
    errors.push("No usable proposals survived validation.");
  }
  if (errors.length > 0) throw new GenerateValidationError(errors);

  // Distinct templates give the member a real choice. Only a preference:
  // when the library is smaller than the ask, repeats are the honest outcome.
  const distinct = new Set(proposals.map((x) => x.templateId));
  if (
    proposals.length > 1 &&
    distinct.size < proposals.length &&
    candidates.length >= proposals.length
  ) {
    warnings.push("Some proposals use the same template even though the library has alternatives.");
  }

  return { proposals, warnings };
}

// ---------------------------------------------------------------------------
// Repair — the second round of the measurement pass
// ---------------------------------------------------------------------------
// Character-count validation is all a Deno function can do; the client owns
// the real glyph measurement (src/lib/generate/measureProposal.ts). When a
// value that passed maxLength still overflows its box, the client sends the
// offending fields back with hard character budgets DERIVED FROM MEASUREMENT,
// and this round rewrites only those values.

/** One field the client measured as overflowing: the value that was too
 * long, and the largest character count that measurably fits. */
export interface RepairFieldRequest {
  fieldKey: string;
  value: string;
  characterBudget: number;
}

/** What the model returns from the repair_values tool. */
export interface RepairModelOutput {
  values: Array<{ fieldKey: string; value: string }>;
}

const REPAIR_BUDGET_CEILING = 2000;

/** Check the client-named repair targets against the template and clamp each
 * budget: never above the field's own maxLength, never above the hard cap.
 * The client's budget is only ever a TIGHTENING — a bogus large budget cannot
 * loosen the admin's limit. Returns errors instead of throwing so the caller
 * can answer 400 with all of them at once. */
export function buildRepairRequests(
  candidate: CandidateTemplate,
  entries: Array<{ fieldKey: string; value: string; characterBudget: number }>,
): { requests: RepairFieldRequest[]; errors: string[] } {
  const errors: string[] = [];
  const requests: RepairFieldRequest[] = [];
  const fieldsByKey = new Map(candidate.fields.map((f) => [f.fieldKey, f]));
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.fieldKey)) {
      errors.push(`repair.fields: "${entry.fieldKey}" is listed twice.`);
      continue;
    }
    seen.add(entry.fieldKey);
    const field = fieldsByKey.get(entry.fieldKey);
    if (!field) {
      errors.push(`repair.fields: "${entry.fieldKey}" does not exist on "${candidate.name}".`);
      continue;
    }
    if (field.static) {
      errors.push(`repair.fields: "${entry.fieldKey}" is fixed by the admin.`);
      continue;
    }
    if (field.type !== "text" && field.type !== "multiline") {
      // select values are the admin's own options and images are never text —
      // neither can be "rewritten shorter".
      errors.push(`repair.fields: "${entry.fieldKey}" is not a text field.`);
      continue;
    }
    requests.push({
      fieldKey: entry.fieldKey,
      value: entry.value,
      characterBudget: Math.max(
        1,
        Math.min(
          Math.round(entry.characterBudget),
          field.maxLength ?? REPAIR_BUDGET_CEILING,
          REPAIR_BUDGET_CEILING,
        ),
      ),
    });
  }
  return { requests, errors };
}

// ---------------------------------------------------------------------------
// Freestyle — a NEW design instead of a library fill
// ---------------------------------------------------------------------------
// The member opted out of the library's layouts, so the model proposes
// geometry — the one thing library mode never lets it do. The brand boundary
// moves rather than disappears: every color is a brand palette KEY resolved
// to its hex here, every type binding must name a real brand type style, all
// text is shrink-sized so length can't break the box, and the published
// library rides along as style reference. On-brand by constraint instead of
// by construction, and the surface says so.

export interface FreestyleContext {
  canvasWidth: number;
  canvasHeight: number;
  palette: Array<{ key: string; hex: string }>;
  typeStyleKeys: string[];
}

/** What the model proposes per freestyle element. `value` is the static
 * content for a fixed element, or the pre-filled member value for an
 * editable one. */
export interface ProposedDesignField {
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image" | "shape";
  shape?: "rect" | "ellipse";
  static?: boolean;
  value?: string;
  box: { x: number; y: number; width: number; height: number };
  typeStyleKey?: string;
  colorKey?: string;
  fontSizePx?: number;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
}

export interface ProposedDesign {
  name: string;
  backgroundColorKey?: string;
  fields: ProposedDesignField[];
  caption: string;
  why: string;
}

export interface FreestyleModelOutput {
  proposals: ProposedDesign[];
}

/** Structural subset of the app's TemplateField, same policy as autobuild's
 * ValidatedField: the Edge bundle never imports from src/, shapes must stay
 * assignable. */
export interface FreestyleField {
  id: string;
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image" | "shape";
  shape?: "rect" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  static?: boolean;
  staticValue?: string;
  placeholder?: string;
  required?: boolean;
  typeStyleKey?: string;
  colorHex?: string;
  fontSizePx?: number;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  textSizing?: "shrink";
  objectFit?: "cover";
}

export interface ValidatedDesign {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor?: string;
  fields: FreestyleField[];
  /** Pre-filled member values for the editable text fields. */
  values: Record<string, string>;
  /** The caption with its {field_key} merge tags resolved — display copy. */
  caption: string;
  /** The caption as authored, tags intact — this is what makes a saved
   * design a REAL template: future fills merge their own values in. */
  captionTemplate: string;
  why: string;
  imageFieldsNeeded: ImageFieldNeeded[];
}

const FREESTYLE_FIELD_CAP = 12;
const FREESTYLE_VALUE_CAP = 500;
const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** Slug a string into a valid, unique fieldKey (autobuild's policy). */
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

/** The canvas a freestyle design targets for a platform: the first known
 * size that serves it, else the platform-neutral square. */
export function canvasForPlatform(platform: GeneratePlatform | undefined): {
  width: number;
  height: number;
} {
  if (platform) {
    const hit = KNOWN_SIZES.find((s) => s.platforms.includes(platform));
    if (hit) return { width: hit.width, height: hit.height };
  }
  return { width: 1440, height: 1440 };
}

export function validateFreestyle(
  output: FreestyleModelOutput,
  ctx: FreestyleContext,
  count: number,
): { designs: ValidatedDesign[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hexByKey = new Map(ctx.palette.map((c) => [c.key, c.hex]));
  const typeStyles = new Set(ctx.typeStyleKeys);

  const raw = Array.isArray(output?.proposals) ? output.proposals : [];
  let list = raw;
  if (list.length > count) {
    warnings.push(`The model returned ${list.length} designs — keeping the first ${count}.`);
    list = list.slice(0, count);
  }

  const designs: ValidatedDesign[] = [];

  list.forEach((p, i) => {
    const label = `Design ${i + 1}`;
    const taken = new Set<string>();
    const values: Record<string, string> = {};
    const fields: FreestyleField[] = [];

    let proposals = Array.isArray(p?.fields) ? p.fields : [];
    if (proposals.length > FREESTYLE_FIELD_CAP) {
      warnings.push(
        `${label}: ${proposals.length} elements — keeping the first ${FREESTYLE_FIELD_CAP}.`,
      );
      proposals = proposals.slice(0, FREESTYLE_FIELD_CAP);
    }

    for (const f of proposals) {
      const name = typeof f?.label === "string" ? f.label.trim().slice(0, 60) : "";
      if (!name) {
        warnings.push(`${label}: dropped an element with no label.`);
        continue;
      }
      if (!["text", "multiline", "image", "shape"].includes(f.type)) {
        warnings.push(`${label}: dropped "${name}" — unknown type "${String(f.type)}".`);
        continue;
      }
      // Geometry is clamped hard, autobuild's flat-image policy: the model
      // proposes, the canvas decides. Shapes may bleed full canvas (a color
      // block is legitimate design); text and images may not swallow it.
      const b = f.box;
      if (
        !b ||
        ![b.x, b.y, b.width, b.height].every((v) => typeof v === "number" && Number.isFinite(v))
      ) {
        warnings.push(`${label}: dropped "${name}" — no usable box.`);
        continue;
      }
      const W = ctx.canvasWidth;
      const H = ctx.canvasHeight;
      const x = Math.min(Math.max(0, Math.round(b.x)), W);
      const y = Math.min(Math.max(0, Math.round(b.y)), H);
      const width = Math.min(Math.round(b.width), W - x);
      const height = Math.min(Math.round(b.height), H - y);
      if (width < 8 || height < 8) {
        warnings.push(`${label}: dropped "${name}" — box under 8px after clamping.`);
        continue;
      }
      if (f.type !== "shape" && width * height > 0.9 * W * H) {
        warnings.push(`${label}: dropped "${name}" — box covers over 90% of the canvas.`);
        continue;
      }

      const key =
        typeof f.fieldKey === "string" && FIELD_KEY_RE.test(f.fieldKey) && !taken.has(f.fieldKey)
          ? (taken.add(f.fieldKey), f.fieldKey)
          : reslug(typeof f.fieldKey === "string" && f.fieldKey ? f.fieldKey : name, taken);

      let typeStyleKey = f.typeStyleKey;
      if (typeStyleKey !== undefined && !typeStyles.has(typeStyleKey)) {
        warnings.push(
          `${label}: "${name}" names type style "${typeStyleKey}" — not in the brand kit, unbound.`,
        );
        typeStyleKey = undefined;
      }
      // The palette is the ONLY color channel. An unknown key on text falls
      // back to the renderer's default ink; a shape without a real palette
      // color has nothing to paint and is dropped.
      let colorHex: string | undefined;
      if (f.colorKey !== undefined) {
        colorHex = hexByKey.get(f.colorKey);
        if (colorHex === undefined) {
          warnings.push(
            `${label}: "${name}" names palette key "${f.colorKey}" — not in the brand kit.`,
          );
        }
      }

      const value = typeof f.value === "string" ? f.value.trim().slice(0, FREESTYLE_VALUE_CAP) : "";
      const zIndex = fields.length;

      if (f.type === "shape") {
        const kind = f.shape === "ellipse" ? "ellipse" : f.shape === "rect" ? "rect" : undefined;
        if (!kind) {
          warnings.push(`${label}: dropped shape "${name}" — kind must be rect or ellipse.`);
          continue;
        }
        if (!colorHex) {
          warnings.push(`${label}: dropped shape "${name}" — shapes need a brand palette color.`);
          continue;
        }
        fields.push({
          id: crypto.randomUUID(),
          label: name,
          fieldKey: key,
          type: "shape",
          shape: kind,
          x,
          y,
          width,
          height,
          zIndex,
          static: true,
          colorHex,
        });
        continue;
      }

      if (f.type === "image") {
        // The model cannot produce artwork: a fixed image would be an empty
        // hole forever, so images are always member slots.
        if (f.static === true) {
          warnings.push(
            `${label}: image "${name}" made member-editable — the model cannot supply artwork.`,
          );
        }
        fields.push({
          id: crypto.randomUUID(),
          label: name,
          fieldKey: key,
          type: "image",
          x,
          y,
          width,
          height,
          zIndex,
          objectFit: "cover",
        });
        continue;
      }

      // Text. Fixed text needs content or it is nothing; editable text gets
      // the proposed value as the member value, and shrink sizing so length
      // can never escape the box the model drew.
      if (f.static === true) {
        if (!value) {
          warnings.push(`${label}: dropped fixed text "${name}" — no content.`);
          continue;
        }
        fields.push({
          id: crypto.randomUUID(),
          label: name,
          fieldKey: key,
          type: f.type,
          x,
          y,
          width,
          height,
          zIndex,
          static: true,
          staticValue: value,
          typeStyleKey,
          colorHex,
          fontSizePx: clampFont(f.fontSizePx),
          align: cleanAlign(f.align),
          uppercase: f.uppercase === true || undefined,
          textSizing: "shrink",
        });
        continue;
      }
      fields.push({
        id: crypto.randomUUID(),
        label: name,
        fieldKey: key,
        type: f.type,
        x,
        y,
        width,
        height,
        zIndex,
        placeholder: value || name,
        typeStyleKey,
        colorHex,
        fontSizePx: clampFont(f.fontSizePx),
        align: cleanAlign(f.align),
        uppercase: f.uppercase === true || undefined,
        textSizing: "shrink",
      });
      if (value) values[key] = value;
      else warnings.push(`${label}: editable "${name}" has no value — left for the member.`);
    }

    const editableText = fields.filter(
      (x) => !x.static && (x.type === "text" || x.type === "multiline"),
    );
    if (fields.length < 2 || editableText.length < 1) {
      errors.push(
        `${label}: too little survived validation (${fields.length} elements, ${editableText.length} editable text) — propose a fuller design.`,
      );
      return;
    }

    let backgroundColor: string | undefined;
    if (p.backgroundColorKey !== undefined) {
      backgroundColor = hexByKey.get(p.backgroundColorKey);
      if (backgroundColor === undefined) {
        warnings.push(
          `${label}: background key "${p.backgroundColorKey}" is not in the brand kit — white canvas.`,
        );
      }
    }

    // The caption is a TEMPLATE: {field_key} tags referencing editable
    // fields survive (autobuild's policy), anything else is stripped — so a
    // design saved to the library carries a caption future fills can merge
    // their own values into. The resolved form is what today's card shows.
    const editableKeys = new Set(fields.filter((x) => !x.static).map((x) => x.fieldKey));
    const captionTemplate = (typeof p.caption === "string" ? p.caption.trim().slice(0, 600) : "")
      .replace(/\{([a-z][a-z0-9_]*)\}/g, (tag, key: string) => {
        if (editableKeys.has(key)) return tag;
        warnings.push(`${label}: caption tag {${key}} doesn't match any field — removed.`);
        return "";
      })
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    const caption = captionTemplate
      .replace(/\{([a-z][a-z0-9_]*)\}/g, (_tag, key: string) => values[key] ?? "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    designs.push({
      name: (typeof p.name === "string" && p.name.trim() ? p.name.trim() : "New design").slice(
        0,
        80,
      ),
      canvasWidth: ctx.canvasWidth,
      canvasHeight: ctx.canvasHeight,
      backgroundColor,
      fields,
      values,
      caption,
      captionTemplate,
      why: typeof p.why === "string" ? p.why.trim().slice(0, 200) : "",
      imageFieldsNeeded: fields
        .filter((x) => !x.static && x.type === "image")
        .map((x) => ({ fieldKey: x.fieldKey, label: x.label, required: false })),
    });
  });

  if (designs.length === 0) {
    errors.push("No usable designs survived validation.");
    throw new GenerateValidationError(errors);
  }
  // Partial success stands: some designs made it, the failures are noted.
  warnings.push(...errors);
  return { designs, warnings };
}

const clampFont = (v: number | undefined): number | undefined =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(400, Math.max(10, Math.round(v)))
    : undefined;

const cleanAlign = (v: string | undefined): "left" | "center" | "right" | undefined =>
  v === "left" || v === "center" || v === "right" ? v : undefined;

/** Validate a repair round: every requested field rewritten, nothing else
 * touched, every rewrite inside its budget. Throws GenerateValidationError
 * for the retry, exactly like validateGeneration. */
export function validateRepair(
  output: RepairModelOutput,
  requests: RepairFieldRequest[],
): { values: Record<string, string>; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const budgetByKey = new Map(requests.map((r) => [r.fieldKey, r.characterBudget]));
  const values: Record<string, string> = {};

  for (const entry of Array.isArray(output?.values) ? output.values : []) {
    if (!entry || typeof entry.fieldKey !== "string" || typeof entry.value !== "string") {
      errors.push("Every values entry needs a string fieldKey and a string value.");
      continue;
    }
    const budget = budgetByKey.get(entry.fieldKey);
    if (budget === undefined) {
      errors.push(`"${entry.fieldKey}" was not asked for — rewrite only the listed fields.`);
      continue;
    }
    if (entry.fieldKey in values) {
      warnings.push(`Duplicate value for "${entry.fieldKey}" — keeping the first.`);
      continue;
    }
    const value = entry.value.trim();
    if (!value) {
      errors.push(`The rewrite for "${entry.fieldKey}" is empty.`);
      continue;
    }
    if (value.length > budget) {
      errors.push(
        `The rewrite for "${entry.fieldKey}" is ${value.length} characters — the budget is ${budget}. Write a shorter value.`,
      );
      continue;
    }
    values[entry.fieldKey] = value;
  }

  for (const r of requests) {
    if (!(r.fieldKey in values)) {
      errors.push(`"${r.fieldKey}" was not rewritten — every listed field needs a new value.`);
    }
  }

  if (errors.length > 0) throw new GenerateValidationError(errors);
  return { values, warnings };
}
