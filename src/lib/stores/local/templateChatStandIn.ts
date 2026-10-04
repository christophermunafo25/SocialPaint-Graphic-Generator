// The template chat's stand-in on the local backend (new look, Phase 4,
// PHASE-4.md §9 D2). The dev backend has no Edge Functions and no model key,
// so Generate stays off there; the template chat still runs end to end with
// this stand-in in its place. It never writes copy of its own onto a graphic:
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
  GenerateInput,
  GenerateRepairInput,
  GenerateRepairResult,
  GenerateResult,
  TemplateSchema,
} from "../../types";
import { isRequiredField } from "../../templates/fieldRules";

/** How long a build takes, so the chat's Building state shows. */
export const STAND_IN_DELAY_MS = 1200;

/** The stand-in's one question (proposed copy), asked when a first message
 * gives it nothing structured to build from. */
export const STAND_IN_QUESTION = "What should the post say?";

export const STAND_IN_MODEL = "local stand-in";

/** Refused for anything but a template chat: Generate itself stays off on
 * the local backend and says so. */
export const STAND_IN_REFUSAL =
  "Generate requires the Supabase backend and an Anthropic API key (see .env.example).";

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
  return values;
}

/** One template chat build on the local backend. `getTemplate` reads the
 * local store; a request without `templateIdHint` is refused. */
export async function standInGenerate(
  companyId: string,
  input: GenerateInput,
  getTemplate: (id: string) => Promise<TemplateSchema | null>,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  if (!input.templateIdHint) throw new Error(STAND_IN_REFUSAL);
  const template = await getTemplate(input.templateIdHint);
  if (!template || template.companyId !== companyId || template.status !== "published") {
    throw new Error("That template isn't available any more.");
  }
  await wait(STAND_IN_DELAY_MS, signal);
  const meta = {
    model: STAND_IN_MODEL,
    generatedAt: new Date().toISOString(),
    candidateCount: 1,
    briefLength: input.brief.length,
  };
  if (input.allowQuestion) {
    return { proposals: [], warnings: [], meta, question: STAND_IN_QUESTION };
  }
  const values = standInValues(template, input);
  return {
    proposals: [
      {
        templateId: template.id,
        templateName: template.name,
        values,
        caption: mergeCaption(template, values),
        why: "",
        imageFieldsNeeded: template.fields
          .filter((f) => !f.static && f.type === "image")
          .map((f) => ({ fieldKey: f.fieldKey, label: f.label, required: isRequiredField(f) })),
      },
    ],
    warnings: [],
    meta,
    reply: `Here's ${template.name}, filled in with your answers.`,
    title: template.name,
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
