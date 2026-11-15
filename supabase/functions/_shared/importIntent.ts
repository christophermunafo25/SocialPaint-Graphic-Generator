// The model pass over a Figma import (import intent, Phase 1). Pure: it
// builds what the model is asked from the fields the walk and the keys
// already produced, and applies a checked answer back onto those same
// fields. Geometry, artwork and paint order never pass through the model.
// It decides only what the keys leave open: labels, Fixed on unkeyed
// layers, a select, a type style, and the template's own details.

import { sanitizeRationale, sanitizeTemplate, type ProposedTemplate } from "./autobuildValidate.ts";
import { slug, type ImportWarning, type SuggestedField } from "./extract.ts";
import { makeMemberField, type CapTrim, type FieldIntent } from "./frameIntent.ts";
import type { ParseReport } from "./recipe.ts";
import type { AnthropicUsage } from "./usage.ts";

/** A field after the model pass. The walk never makes a select or binds a
 * type style; the pass can. Assignable to the app's TemplateField. */
export type IntentField = Omit<SuggestedField, "type"> & {
  type: SuggestedField["type"] | "select";
  options?: string[];
  typeStyleKey?: string;
};

/** The most elements one import asks the model about. Every field the walk
 * found still lands; the ones past the limit keep what the keys gave them. */
export const MAX_ASKED = 40;

export interface IntentElement {
  /** "e1", "e2": short, and never a Figma id the model could confuse. */
  sourceId: string;
  kind: "text" | "image";
  /** The layer's name as the designer wrote it. */
  layer: string;
  text?: string;
  multiline?: boolean;
  /** Text drawn on its own plate (a pill or a tag). */
  plated?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontWeight?: number;
  fontSizePx?: number;
  colorHex?: string;
  /** What the layer's name declares. It outranks the model. */
  declared?: { role: string; kind: string; edit?: string; max?: number; lines?: number };
}

export interface IntentAsk {
  elements: IntentElement[];
  /** Element sourceId to field id. */
  fieldIdByElement: Map<string, string>;
  /** Text and image fields left out by MAX_ASKED. */
  skipped: number;
}

const isText = (f: { type: string }) => f.type === "text" || f.type === "multiline";
const round = (v: number) => Math.round(v);

/** What the model is asked about: the text and image fields, text first,
 * each in reading order. Shapes and icons are drawn, not filled in, so they
 * stay as the walk landed them. */
export function intentAsk(fields: SuggestedField[], intents: FieldIntent[]): IntentAsk {
  const intentById = new Map(intents.map((i) => [i.fieldId, i]));
  const reading = (a: SuggestedField, b: SuggestedField) => a.y - b.y || a.x - b.x;
  const candidates = [
    ...fields.filter(isText).sort(reading),
    ...fields.filter((f) => f.type === "image").sort(reading),
  ];
  const asked = candidates.slice(0, MAX_ASKED);
  const fieldIdByElement = new Map<string, string>();
  const elements = asked.map((f, i): IntentElement => {
    const sourceId = `e${i + 1}`;
    fieldIdByElement.set(sourceId, f.id);
    const intent = intentById.get(f.id);
    const d = intent?.declared;
    const text = isText(f) ? (f.staticValue ?? f.placeholder) : undefined;
    return {
      sourceId,
      kind: isText(f) ? "text" : "image",
      layer: (intent?.layer ?? f.label).slice(0, 120),
      ...(text ? { text: text.slice(0, 300) } : {}),
      ...(f.type === "multiline" ? { multiline: true } : {}),
      ...(f.plateColor ? { plated: true } : {}),
      x: round(f.x),
      y: round(f.y),
      width: round(f.width),
      height: round(f.height),
      fontFamily: f.fontFamily,
      fontWeight: f.fontWeight,
      fontSizePx: f.fontSizePx,
      colorHex: f.colorHex,
      ...(d
        ? {
            declared: {
              role: d.role,
              kind: d.kind,
              ...(d.edit ? { edit: d.edit } : {}),
              ...(d.max !== undefined ? { max: d.max } : {}),
              ...(d.lines !== undefined ? { lines: d.lines } : {}),
            },
          }
        : {}),
    };
  });
  return { elements, fieldIdByElement, skipped: candidates.length - asked.length };
}

/** The forced tool for a Figma import. It has no box, no colour and no
 * character limit: the frame gives the first two and the browser measures
 * the third. Template details are asked for only when a template lands. */
export function intentTool(mode: "template" | "elements") {
  const template = {
    type: "object",
    additionalProperties: false,
    required: ["name", "description", "category", "tags", "captionTemplate"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      category: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      captionTemplate: { type: "string" },
    },
  };
  return {
    name: "propose_template",
    description:
      mode === "template"
        ? "Propose the member form and the template details for this design."
        : "Propose the member form for these elements.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: mode === "template" ? ["fields", "template", "rationale"] : ["fields", "rationale"],
      properties: {
        fields: {
          type: "array",
          description: "One entry per element, ordered as the member form should read.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["sourceId", "label", "fieldKey", "type", "static"],
            properties: {
              sourceId: { type: "string", description: "The element this entry is." },
              label: { type: "string" },
              fieldKey: { type: "string" },
              type: { type: "string", enum: ["text", "multiline", "image", "select"] },
              options: { type: "array", items: { type: "string" } },
              static: {
                type: "boolean",
                description: "true = Fixed: stays on the canvas, leaves the member form.",
              },
              placeholder: { type: "string" },
              typeStyleKey: { type: "string" },
            },
          },
        },
        ...(mode === "template" ? { template } : {}),
        rationale: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["fieldKey", "why"],
            properties: { fieldKey: { type: "string" }, why: { type: "string" } },
          },
        },
      },
    },
  };
}

/** Room for forty entries, their reasons and the template's details. A
 * ceiling costs nothing unless the answer needs it, and an answer cut off
 * at it is thrown away whole. */
export const INTENT_MAX_TOKENS = 8000;

/** The Messages API request for the pass: the picture when there is one,
 * the request, and one forced tool call. Built here so the function and the
 * eval (scripts/import-intent/eval.mjs) send exactly the same thing. */
export function intentRequest(opts: {
  model: string;
  system: string;
  mode: "template" | "elements";
  imageBase64: string | null;
  userText: string;
}): Record<string, unknown> {
  const tool = intentTool(opts.mode);
  return {
    model: opts.model,
    max_tokens: INTENT_MAX_TOKENS,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [
      {
        role: "user",
        content: [
          ...(opts.imageBase64
            ? [
                {
                  type: "image",
                  source: { type: "base64", media_type: "image/png", data: opts.imageBase64 },
                },
              ]
            : []),
          { type: "text", text: opts.userText },
        ],
      },
    ],
  };
}

export interface IntentAnswer {
  /** The forced tool's input, or undefined when there is nothing to trust:
   * the tool wasn't called, or the turn didn't finish. */
  input: unknown;
  usage: AnthropicUsage | undefined;
  stopReason: string | undefined;
}

/** Read a Messages API response. A turn cut off at the token limit usually
 * still parses, as a valid but partial object, and a declined turn can stop
 * mid-input, so neither one's input is read: the import lands on its keys
 * instead of on half an answer. The usage is returned either way, since the
 * call was made and is metered. */
export function readIntentAnswer(body: unknown, toolName = "propose_template"): IntentAnswer {
  const response = (body ?? {}) as {
    content?: unknown;
    usage?: AnthropicUsage;
    stop_reason?: unknown;
  };
  const stopReason = typeof response.stop_reason === "string" ? response.stop_reason : undefined;
  const usage = response.usage;
  if (stopReason === "max_tokens" || stopReason === "refusal") {
    return { input: undefined, usage, stopReason };
  }
  const blocks = Array.isArray(response.content) ? response.content : [];
  const toolUse = blocks.find(
    (b): b is { type: string; name: string; input?: unknown } =>
      Boolean(b) &&
      typeof b === "object" &&
      (b as { type?: unknown }).type === "tool_use" &&
      (b as { name?: unknown }).name === toolName,
  );
  const input = toolUse?.input;
  return {
    input: input && typeof input === "object" ? input : undefined,
    usage,
    stopReason,
  };
}

const tokenCount = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** Tokens in and out for one response. Input read from or written to the
 * cache is input all the same. */
export function tokensOf(usage: AnthropicUsage | undefined): {
  inputTokens: number;
  outputTokens: number;
} {
  return {
    inputTokens:
      tokenCount(usage?.input_tokens) +
      tokenCount(usage?.cache_read_input_tokens) +
      tokenCount(usage?.cache_creation_input_tokens),
    outputTokens: tokenCount(usage?.output_tokens),
  };
}

/** The brand's type styles as the pass reads them: every property a style
 * defines is one a bound field would be drawn with. */
export interface KitTypeStyle {
  key: string;
  name: string;
  font?: { family?: string };
  weight?: number;
  fontStyle?: string;
  fontStretch?: string;
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  colorKey?: string;
  fontSizePx?: number;
  textSizing?: string;
}

export interface IntentBrand {
  typeStyles: KitTypeStyle[];
  colors: Array<{ key: string; name?: string; hex: string }>;
  catalog: Array<{ name: string; category: string }>;
}

/** The per-request half of the prompt. The system prompt is static and
 * cached; everything that changes per import rides here. */
export function intentUserText(opts: {
  mode: "template" | "elements";
  frameName: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: IntentElement[];
  brand: IntentBrand;
  hint?: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `Canvas: ${opts.canvasWidth}x${opts.canvasHeight}px. Source: figma. Frame: ${JSON.stringify(opts.frameName.slice(0, 120))}.`,
  );
  parts.push(
    [
      "This design was imported from Figma with exact geometry, and it stays exactly as drawn. You decide the member form only.",
      "- Give every element one entry, referenced by sourceId.",
      "- An element with `declared.edit` is already decided by the designer: repeat it (member means static false, fixed means static true). An element without it is yours to judge.",
      "- `declared.role` names the element's job. Use it for the label.",
      "- Keep each element's kind: a text element is text, multiline or select, and an image element is image. The system keeps single or multiple lines as designed.",
      "- Do not give character limits, boxes or colours. The system measures the limits and the frame gives the rest.",
      "- typeStyleKey: only when the element is drawn exactly in that style (same family, weight, size and colour). When it is merely similar, leave it out.",
    ].join("\n"),
  );
  parts.push(`Elements:\n${JSON.stringify(opts.elements)}`);
  parts.push(
    `Brand kit. Type styles: ${JSON.stringify(
      opts.brand.typeStyles.map((s) => ({
        key: s.key,
        name: s.name,
        family: s.font?.family,
        weight: s.weight,
        fontSizePx: s.fontSizePx,
      })),
    )}; palette: ${JSON.stringify(opts.brand.colors)}.`,
  );
  if (opts.mode === "template") {
    parts.push(
      opts.brand.catalog.length
        ? `Existing catalog (reuse this category/tag vocabulary): ${JSON.stringify(opts.brand.catalog)}`
        : "The catalog is empty, so choose a sensible first category.",
    );
  } else {
    parts.push(
      "These elements are being pasted into a template that already exists, so there are no template details to give.",
    );
  }
  if (opts.hint) parts.push(`Admin's note: ${opts.hint}`);
  return parts.join("\n\n");
}

/** Nothing in the answer could be used. The import lands on its keys. */
export class IntentProposalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentProposalError";
  }
}

const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

/** Why binding `style` would change how `field` is drawn, or null when
 * every property the style defines matches the layer within rounding. */
export function styleMismatch(
  style: KitTypeStyle,
  field: SuggestedField,
  hexByColorKey: Map<string, string>,
): string | null {
  if (style.font?.family !== undefined) {
    if (style.font.family.trim().toLowerCase() !== (field.fontFamily ?? "").trim().toLowerCase()) {
      return "font";
    }
  }
  if (style.weight !== undefined && style.weight !== (field.fontWeight ?? 400)) return "weight";
  if (style.fontStyle !== undefined && style.fontStyle !== (field.fontStyle ?? "normal")) {
    return "italic";
  }
  // The walk doesn't read a face's width, so a style that sets one can't be
  // shown to match.
  if (style.fontStretch !== undefined && style.fontStretch !== "normal") return "width";
  if (style.uppercase !== undefined && style.uppercase !== Boolean(field.uppercase)) {
    return "case";
  }
  if (
    style.letterSpacingPx !== undefined &&
    !near(style.letterSpacingPx, field.letterSpacingPx ?? 0, 0.5)
  ) {
    return "letter spacing";
  }
  if (style.lineHeight !== undefined) {
    if (field.lineHeight === undefined || !near(style.lineHeight, field.lineHeight, 0.01)) {
      return "line height";
    }
  }
  if (style.fontSizePx !== undefined) {
    if (field.fontSizePx === undefined || !near(style.fontSizePx, field.fontSizePx, 0.5)) {
      return "size";
    }
  }
  if (style.colorKey !== undefined) {
    const hex = hexByColorKey.get(style.colorKey);
    if (!hex || field.textGradient || hex.toUpperCase() !== (field.colorHex ?? "").toUpperCase()) {
      return "color";
    }
  }
  if (style.textSizing !== undefined && style.textSizing !== (field.textSizing ?? "free")) {
    return "sizing";
  }
  return null;
}

interface ProposedEntry {
  sourceId?: unknown;
  label?: unknown;
  fieldKey?: unknown;
  type?: unknown;
  options?: unknown;
  static?: unknown;
  placeholder?: unknown;
  typeStyleKey?: unknown;
}

export interface IntentOutcome {
  /** Template mode only. */
  template?: ProposedTemplate;
  rationale: Array<{ fieldKey: string; why: string }>;
  /** Member field ids in the order the form should read. Paint order is the
   * fields array, which this never reorders. */
  formOrder: string[];
  issues: ImportWarning[];
}

/** Apply the model's answer to the fields, in place, keeping only what
 * passes. Declared intent wins: a parsed `edit` or `max` is never
 * overturned. Throws IntentProposalError when no entry names an element. */
export function applyIntentProposal(
  proposal: unknown,
  ctx: {
    mode: "template" | "elements";
    fields: SuggestedField[];
    intents: FieldIntent[];
    ask: IntentAsk;
    brand: Pick<IntentBrand, "typeStyles" | "colors">;
  },
): IntentOutcome {
  const raw = (proposal ?? {}) as { fields?: unknown; template?: unknown; rationale?: unknown };
  if (!Array.isArray(raw.fields)) throw new IntentProposalError("The answer has no fields.");

  const fieldById = new Map(ctx.fields.map((f) => [f.id, f as IntentField]));
  const intentById = new Map(ctx.intents.map((i) => [i.fieldId, i]));
  const styleByKey = new Map(ctx.brand.typeStyles.map((s) => [s.key, s]));
  const hexByColorKey = new Map(ctx.brand.colors.map((c) => [c.key, c.hex]));
  const issues: ImportWarning[] = [];

  // Resolve entries to fields first: keys are unique across the whole
  // frame, so the fields no entry names hold theirs before any are given.
  const entries: Array<{ entry: ProposedEntry; field: IntentField }> = [];
  const seen = new Set<string>();
  for (const entry of raw.fields as ProposedEntry[]) {
    if (!entry || typeof entry !== "object" || typeof entry.sourceId !== "string") continue;
    const fieldId = ctx.ask.fieldIdByElement.get(entry.sourceId);
    const field = fieldId ? fieldById.get(fieldId) : undefined;
    if (!field || seen.has(field.id)) continue;
    seen.add(field.id);
    entries.push({ entry, field });
  }
  if (!entries.length) throw new IntentProposalError("No entry names an element.");

  const taken = new Set(ctx.fields.filter((f) => !seen.has(f.id)).map((f) => f.fieldKey));
  const proposedOrder: string[] = [];

  for (const { entry, field } of entries) {
    const declared = intentById.get(field.id)?.declared;
    const text = isText(field);

    const label = typeof entry.label === "string" ? entry.label.trim().slice(0, 60) : "";
    if (label) field.label = label;

    // Fixed or member. A layer that says which is never asked twice.
    if (!declared?.edit && entry.static === false && field.static) {
      if (text || field.type === "image") makeMemberField(field as SuggestedField);
    }
    const member = !field.static;

    // A member's single line can be a closed list. Single or multiple lines
    // stay as the walk read them from the node.
    if (member && field.type === "text" && entry.type === "select") {
      const options = (Array.isArray(entry.options) ? entry.options : [])
        .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        .map((o) => o.trim().slice(0, 80))
        .slice(0, 12);
      if (options.length >= 2) {
        field.type = "select";
        field.options = options;
      }
    }

    // The designer's copy is the sample on the canvas. The model's example
    // fills in only where there is none.
    if (member && text && !field.placeholder && typeof entry.placeholder === "string") {
      const placeholder = entry.placeholder.trim().slice(0, 120);
      if (placeholder) field.placeholder = placeholder;
    }

    if (text && typeof entry.typeStyleKey === "string") {
      const style = styleByKey.get(entry.typeStyleKey);
      if (style) {
        if (styleMismatch(style, field as SuggestedField, hexByColorKey)) {
          issues.push({
            layer: field.label,
            nodeId: field.sourceNodeId,
            issue: `close to the ${style.name} style but not the same, so it isn't bound.`,
            severity: "info",
          });
        } else {
          field.typeStyleKey = style.key;
        }
      }
    }

    const key = typeof entry.fieldKey === "string" ? entry.fieldKey : "";
    if (FIELD_KEY_RE.test(key) && !taken.has(key)) {
      taken.add(key);
      field.fieldKey = key;
    } else {
      field.fieldKey = slug(field.label.slice(0, 32), taken);
    }
    proposedOrder.push(field.id);
  }

  const isMember = (id: string) => {
    const f = fieldById.get(id);
    return Boolean(f && !f.static && f.type !== "shape" && f.type !== "icon");
  };
  const formOrder = [
    ...proposedOrder.filter(isMember),
    ...ctx.fields.filter((f) => !seen.has(f.id) && isMember(f.id)).map((f) => f.id),
  ];

  const validKeys = new Set(ctx.fields.map((f) => f.fieldKey));
  const warnings: string[] = [];
  const template =
    ctx.mode === "template" ? sanitizeTemplate(raw.template, validKeys, warnings) : undefined;
  return {
    ...(template ? { template } : {}),
    rationale: sanitizeRationale(raw.rationale, validKeys),
    formOrder,
    issues,
  };
}

/** What an import read and what the pass cost, returned with the result. */
export interface ImportIntentReport {
  /** "model": keys and the model pass. "keys": the call failed or was
   * skipped, and the fields stand on their keys. */
  filledBy: "model" | "keys";
  layers: number;
  keyed: number;
  /** Kinds and keys kept but not understood. */
  unknown: string[];
  /** Colour roles as written (reported, not stored). */
  roles: Array<{ fieldKey: string; fill?: string; text?: string; color?: string }>;
  /** Text fields and the `max` and `lines` their layers declare, for the
   * measured limits. */
  limits: Array<{ fieldId: string; max?: number; lines?: number }>;
  /** Text boxes for the browser to re-place from real font metrics. */
  capTrim: CapTrim[];
  /** Member field ids in form order. */
  formOrder: string[];
  calls: number;
  inputTokens: number;
  outputTokens: number;
  modelMs: number;
}

export interface ModelCost {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  modelMs: number;
}

export const NO_MODEL_COST: ModelCost = { calls: 0, inputTokens: 0, outputTokens: 0, modelMs: 0 };

/** The report for an import, read off its fields after everything landed. */
export function intentReport(opts: {
  fields: SuggestedField[];
  intents: FieldIntent[];
  parse: ParseReport;
  capTrim: CapTrim[];
  filledBy: "model" | "keys";
  formOrder?: string[];
  cost: ModelCost;
}): ImportIntentReport {
  const fieldById = new Map(opts.fields.map((f) => [f.id, f]));
  const landed = opts.intents.filter((i) => fieldById.has(i.fieldId));
  const members = opts.fields
    .filter((f) => !f.static && f.type !== "shape" && f.type !== "icon")
    .map((f) => f.id);
  return {
    filledBy: opts.filledBy,
    layers: opts.parse.layers,
    keyed: opts.parse.keyed,
    unknown: [...opts.parse.unknownKinds, ...opts.parse.unknownKeys],
    roles: landed
      .filter((i) => i.declared.fill || i.declared.text || i.declared.color)
      .map((i) => ({
        fieldKey: fieldById.get(i.fieldId)!.fieldKey,
        ...(i.declared.fill ? { fill: i.declared.fill } : {}),
        ...(i.declared.text ? { text: i.declared.text } : {}),
        ...(i.declared.color ? { color: i.declared.color } : {}),
      })),
    limits: landed
      .filter((i) => i.declared.max !== undefined || i.declared.lines !== undefined)
      .map((i) => ({
        fieldId: i.fieldId,
        ...(i.declared.max !== undefined ? { max: i.declared.max } : {}),
        ...(i.declared.lines !== undefined ? { lines: i.declared.lines } : {}),
      })),
    capTrim: opts.capTrim.filter((c) => fieldById.has(c.fieldId)),
    formOrder: opts.formOrder ?? members,
    ...opts.cost,
  };
}

/** Said once when an import lands without the model pass. */
export function unfilledIssue(frameName: string, mode: "template" | "elements"): ImportWarning {
  return {
    layer: frameName,
    nodeId: "",
    issue:
      mode === "template"
        ? "the form wasn't filled in, so labels come from the layer names and the caption is empty."
        : "the form wasn't filled in, so labels come from the layer names.",
    severity: "info",
  };
}

/** Said once when a frame has more text and image layers than one pass
 * asks about. */
export function skippedIssue(frameName: string, skipped: number): ImportWarning {
  return {
    layer: frameName,
    nodeId: "",
    issue: `${skipped} element${skipped === 1 ? " was" : "s were"} left as the layer names set ${skipped === 1 ? "it" : "them"}, since one import fills in ${MAX_ASKED}.`,
    severity: "info",
  };
}

/** A keyed logo takes the brand's own (I5): `variant=primary` with a
 * `surface` swaps the Figma artwork for the kit's primary logo for that
 * surface, contained so a different aspect never crops it. Without one in
 * the kit the Figma artwork stays, and the import says so. */
export function applyKitLogos(
  fields: SuggestedField[],
  intents: FieldIntent[],
  kitLogos: { light?: string; dark?: string },
  issues: ImportWarning[],
): void {
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  for (const intent of intents) {
    const d = intent.declared;
    const field = fieldById.get(intent.fieldId);
    if (!field || field.type !== "image") continue;
    if (d.kind !== "logo" || d.variant !== "primary" || !d.surface) continue;
    const source = kitLogos[d.surface];
    if (!source) {
      issues.push({
        layer: field.label,
        nodeId: field.sourceNodeId,
        issue: `Brand Studio has no ${d.surface} primary logo, so the Figma artwork stays.`,
        severity: "info",
      });
      continue;
    }
    field.staticValue = source;
    field.objectFit = "contain";
    // The crop and the mask were drawn for the Figma artwork.
    delete field.imageRect;
    delete field.maskUrl;
    issues.push({
      layer: field.label,
      nodeId: field.sourceNodeId,
      issue: `swapped for your ${d.surface} primary logo.`,
      severity: "info",
    });
  }
}
