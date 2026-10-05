// The chat stand-in on the local backend (new look, Phase 4 for the
// template chat, Phase 5 for Generate). The dev backend has no Edge
// Functions and no model key; in a development build both chats run end to
// end with this stand-in in the model's place. It never writes copy of its own onto a graphic:
// it fills the one template the chat is on with the member's answers, as
// typed, and every other text field with that field's own placeholder, which
// the workspace's admin wrote. So it only ever answers from the workspace's
// own templates (the sample workspace, Acme Studios, in the fixture).
//
// Development builds only: LocalGenerateProvider imports this module behind
// import.meta.env.DEV, so a production bundle never contains it.

import { mergeCaption } from "../../caption";
import type {
  FieldValues,
  GeneratedProposal,
  GenerateInput,
  GenerateRepairInput,
  GenerateRepairResult,
  GenerateResult,
  TemplateSchema,
} from "../../types";
import { detailKindOf } from "../../generate/details";
import { isRequiredField } from "../../templates/fieldRules";
import { classifySize } from "../../templates/platforms";

/** How long a build takes, so the chat's Building state shows. */
export const STAND_IN_DELAY_MS = 1200;

/** The stand-in's one question (proposed copy), asked when a first message
 * gives it nothing structured to build from. */
export const STAND_IN_QUESTION = "What should the post say?";

export const STAND_IN_MODEL = "local stand-in";

/** Refused for what it cannot do: new designs (freestyle) need the model,
 * which needs the Supabase backend and a key. */
export const STAND_IN_REFUSAL =
  "New designs need the Supabase backend and an Anthropic API key (see .env.example).";

/** Most templates a Generate run fills, as the server caps `count`. */
const MAX_PROPOSALS = 3;

/** Waits `ms`, or rejects at once when the chat's Stop aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** The values a template chat build fills `template` with: the member's
 * details verbatim (as the server merges them, generateValidate.ts), the
 * values a follow-up carries for this template under them, and every other
 * member text field from its placeholder. Image fields are left for the
 * member; a select takes its placeholder when that is an option, else its
 * first option. */
export function standInValues(template: TemplateSchema, input: GenerateInput): FieldValues {
  const values: FieldValues = {};
  for (const f of template.fields) {
    if (f.static || f.type === "image" || f.type === "shape") continue;
    if (f.fieldKey in values) continue;
    if (f.type === "select") {
      const options = f.options ?? [];
      const pick = f.placeholder && options.includes(f.placeholder) ? f.placeholder : options[0];
      if (pick) values[f.fieldKey] = pick;
      continue;
    }
    const text = (f.placeholder ?? "").trim();
    if (!text) continue;
    values[f.fieldKey] = f.maxLength !== undefined ? text.slice(0, f.maxLength) : text;
  }
  const keys = new Set(Object.keys(values));
  const carried = input.followUp?.drafts.find((d) => d.templateId === template.id);
  for (const v of carried?.values ?? []) {
    if (keys.has(v.fieldKey) && v.value) values[v.fieldKey] = v.value;
  }
  const memberKeys = new Set(
    template.fields.filter((f) => !f.static && f.type !== "image").map((f) => f.fieldKey),
  );
  for (const d of input.details ?? []) {
    if (memberKeys.has(d.fieldKey)) values[d.fieldKey] = d.value;
  }
  // Generate's facts: each into the first text field that reads as its
  // kind (a headline into a headline or title field), one field per fact.
  const textFields = template.fields.filter(
    (f) => !f.static && (f.type === "text" || f.type === "multiline"),
  );
  const used = new Set<string>();
  for (const fact of input.facts ?? []) {
    const field = textFields.find((f) => !used.has(f.fieldKey) && factFits(fact.kind, f));
    if (!field) continue;
    used.add(field.fieldKey);
    values[field.fieldKey] =
      field.maxLength !== undefined ? fact.value.slice(0, field.maxLength) : fact.value;
  }
  return values;
}

const HEADLINE = /\b(headline|title|heading)\b/;

/** Whether a field reads as a fact's kind, by its label or key. */
function factFits(kind: string, field: TemplateSchema["fields"][number]): boolean {
  if (kind === "headline") {
    return HEADLINE.test(`${field.label} ${field.fieldKey}`.toLowerCase().replace(/[_-]+/g, " "));
  }
  return detailKindOf(field) === kind;
}

/** What the stand-in reads from the local store. */
export interface StandInLoaders {
  get(id: string): Promise<TemplateSchema | null>;
  listPublished(companyId: string): Promise<TemplateSchema[]>;
}

/** A proposal filling `template` (standInValues), its caption merged. */
function proposalFor(template: TemplateSchema, input: GenerateInput): GeneratedProposal {
  const values = standInValues(template, input);
  const firstImage = template.fields.find((f) => !f.static && f.type === "image");
  return {
    templateId: template.id,
    templateName: template.name,
    values,
    caption: mergeCaption(template, values),
    why: "",
    imageFieldsNeeded: template.fields
      .filter((f) => !f.static && f.type === "image")
      .map((f) => ({ fieldKey: f.fieldKey, label: f.label, required: isRequiredField(f) })),
    ...(input.hasImage && firstImage ? { imageTargetFieldKey: firstImage.fieldKey } : {}),
  };
}

/** The templates a Generate run fills: a follow-up's own, or up to `count`
 * published templates, those serving the platform hint first, then the
 * rest, each in the store's order (most recently updated first). */
function pickTemplates(published: TemplateSchema[], input: GenerateInput): TemplateSchema[] {
  const count = Math.max(1, Math.min(MAX_PROPOSALS, input.count ?? MAX_PROPOSALS));
  const byId = new Map(published.map((t) => [t.id, t]));
  const carried = (input.followUp?.drafts ?? [])
    .map((d) => byId.get(d.templateId))
    .filter((t): t is TemplateSchema => Boolean(t));
  if (carried.length > 0) return carried.slice(0, count);
  const hint = input.platformHint;
  const serves = (t: TemplateSchema) =>
    hint !== undefined && classifySize(t.canvasWidth, t.canvasHeight).platforms.includes(hint);
  return [...published.filter(serves), ...published.filter((t) => !serves(t))].slice(0, count);
}

/** A title from the brief's first sentence, at most six words (2 to 60
 * characters). */
function titleFrom(brief: string): string {
  const sentence = brief
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s/)[0];
  const words = sentence.split(" ").slice(0, 6).join(" ");
  return words.replace(/[.!?,;:]+$/, "").slice(0, 60) || "New chat";
}

/** One build on the local backend: a template chat (`templateIdHint`
 * set) fills that template; a Generate run fills up to `count` published
 * templates. A freestyle request is refused. */
export async function standInGenerate(
  companyId: string,
  input: GenerateInput,
  loaders: StandInLoaders,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  if (input.mode === "freestyle") throw new Error(STAND_IN_REFUSAL);
  let templates: TemplateSchema[];
  if (input.templateIdHint) {
    const template = await loaders.get(input.templateIdHint);
    if (!template || template.companyId !== companyId || template.status !== "published") {
      throw new Error("That template isn't available any more.");
    }
    templates = [template];
  } else {
    templates = pickTemplates(await loaders.listPublished(companyId), input);
    if (templates.length === 0) throw new Error(STAND_IN_REFUSAL);
  }
  await wait(STAND_IN_DELAY_MS, signal);
  const meta = {
    model: STAND_IN_MODEL,
    generatedAt: new Date().toISOString(),
    candidateCount: templates.length,
    briefLength: input.brief.length,
  };
  if (input.allowQuestion && input.templateIdHint) {
    return { proposals: [], warnings: [], meta, question: STAND_IN_QUESTION };
  }
  const template = templates[0];
  return {
    proposals: templates.map((t) => proposalFor(t, input)),
    warnings: [],
    meta,
    ...(input.templateIdHint
      ? {
          reply: `Here's ${template.name}, filled in with your answers.`,
          title: template.name,
        }
      : {
          reply:
            templates.length === 1
              ? `Here's ${template.name}, from your templates.`
              : `Here are ${templates.length} drafts from your templates.`,
          title: input.followUp ? undefined : titleFrom(input.brief),
        }),
  };
}

/** Repair has no model to rewrite with: the values come back unchanged. */
export function standInRepair(input: GenerateRepairInput): GenerateRepairResult {
  const values: FieldValues = {};
  for (const f of input.fields) values[f.fieldKey] = f.value;
  return {
    values,
    warnings: [],
    meta: { model: STAND_IN_MODEL, generatedAt: new Date().toISOString() },
  };
}
