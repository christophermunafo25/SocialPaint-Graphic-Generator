// The template chat's questions: when a member opens a brand template, the
// chat asks for each member field in turn instead of waiting for a brief.
// The questions are built from the template's fields, never by the model, so
// they are instant, free and always match the template. Every answer is used
// on the graphic exactly as typed (it travels as a `details` entry); the
// model then writes only the caption and picks nothing the member gave.
//
// The rules:
//
//  - One step per member text, multiline or select field the default look
//    shows (detailFieldsFor), and one for the first member image slot, if
//    the template has one (the photo fills it; imageTargetFor).
//  - Required steps first, then optional ones, each in form order. An
//    optional step can be skipped; a skipped field is left off the graphic.
//  - An answer is trimmed, must not be empty, must fit the field's
//    maxLength, and for a select must be one of its options (matched
//    without regard to case, and stored as the option's own spelling).
//
// Pure and unit-tested: the page holds the answers and renders the steps.

import type { FieldValues, TemplateSchema } from "../types";
import { isRequiredField } from "../templates/fieldRules";
import { applyVariantToSchema, defaultVariant } from "../templates/variants";
import type { ChatDetail } from "./chat";
import { detailFieldsFor, type DetailField } from "./details";

/** One question. */
export interface InterviewStep {
  fieldKey: string;
  label: string;
  type: DetailField["type"] | "image";
  optional: boolean;
  question: string;
  placeholder?: string;
  maxLength?: number;
  options?: string[];
}

/** The member's answer to a step: its text, or null when skipped. A photo
 * step's answer is the photo itself, held by the page; here it is "photo". */
export type InterviewAnswers = Record<string, string | null>;

/** The marker a photo step's answer holds once the photo is attached. */
export const PHOTO_ANSWER = "photo";

/** A label as it reads mid-sentence: lowercased, unless it carries
 * capitals past its first letter ("URL", "CTA", "iPhone" stay as they are). */
function inSentence(label: string): string {
  const trimmed = label.trim().replace(/[:?.]+$/, "");
  if (!trimmed) return "this";
  return /[A-Z]/.test(trimmed.slice(1)) ? trimmed : trimmed.toLowerCase();
}

const LEADING_NON_NOUN =
  /^(the|a|an|about|your|our|my|their|how|why|when|where|who|what|which|for|to|at|in|on|with)\b/i;

/** The question for a field, worded from its label. */
export function questionFor(step: Pick<InterviewStep, "label" | "type" | "optional">): string {
  const label = inSentence(step.label);
  if (step.type === "image") {
    return step.optional
      ? `Want to add a photo for the ${label}? Attach it with the plus, or skip it.`
      : `Add a photo for the ${label}. Attach it with the plus.`;
  }
  // A label that does not open on a noun ("About the role", "Your
  // name") reads wrong after "the": quote it instead.
  if (LEADING_NON_NOUN.test(label)) return `What goes in "${step.label.trim()}"?`;
  if (step.type === "select") return `Which ${label}?`;
  return `What should the ${label} say?`;
}

/** The steps for a template, in the order they are asked. */
export function interviewSteps(schema: TemplateSchema): InterviewStep[] {
  const look = defaultVariant(schema)?.id ?? null;
  const text: InterviewStep[] = detailFieldsFor(schema, look).map((f) => {
    const step: InterviewStep = {
      fieldKey: f.fieldKey,
      label: f.label,
      type: f.type,
      optional: f.optional,
      question: "",
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      ...(f.maxLength !== undefined ? { maxLength: f.maxLength } : {}),
      ...(f.options ? { options: f.options } : {}),
    };
    step.question = questionFor(step);
    return step;
  });
  // The same field twice in a form (a key used by two boxes) is one fact.
  const seen = new Set<string>();
  const steps = text.filter((s) => (seen.has(s.fieldKey) ? false : (seen.add(s.fieldKey), true)));
  const slot = applyVariantToSchema(schema, look).fields.find(
    (f) => f.type === "image" && !f.static,
  );
  if (slot) {
    const step: InterviewStep = {
      fieldKey: slot.fieldKey,
      label: slot.label,
      type: "image",
      optional: !isRequiredField(slot),
      question: "",
    };
    step.question = questionFor(step);
    steps.push(step);
  }
  return [...steps.filter((s) => !s.optional), ...steps.filter((s) => s.optional)];
}

/** The first step with no answer yet, or null when every step has one. */
export function currentStep(
  steps: readonly InterviewStep[],
  answers: InterviewAnswers,
): InterviewStep | null {
  return steps.find((s) => !(s.fieldKey in answers)) ?? null;
}

export type AnswerCheck = { ok: true; value: string } | { ok: false; error: string };

/** Checks a typed answer against its step. */
export function checkAnswer(step: InterviewStep, raw: string): AnswerCheck {
  const value = step.type === "multiline" ? raw.trim() : raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, error: "Type an answer first." };
  if (step.type === "select") {
    const match = step.options?.find((o) => o.toLowerCase() === value.toLowerCase());
    return match ? { ok: true, value: match } : { ok: false, error: "Choose one of the options." };
  }
  if (step.maxLength !== undefined && value.length > step.maxLength) {
    return {
      ok: false,
      error: `Keep it to ${step.maxLength} characters. That's ${value.length}.`,
    };
  }
  return { ok: true, value };
}

/** The opening line above the first question. */
export function interviewIntro(templateName: string, steps: readonly InterviewStep[]): string {
  const required = steps.filter((s) => !s.optional).length;
  const n = steps.length;
  if (n === 0) return `${templateName} has nothing to fill in.`;
  const count = n === 1 ? "one question" : `${n} questions`;
  const extra = required < n && required > 0 ? " The last ones are optional." : "";
  return `Let's fill in ${templateName}. I've got ${count} for you.${extra}`;
}

/** What the build sends: the answers as details (text fields only; the photo
 * travels as the message's photo), the fields skipped, and a brief made of
 * the answers, which the model writes the caption from and the chat is
 * titled by until the model names it. */
export function interviewMessage(
  steps: readonly InterviewStep[],
  answers: InterviewAnswers,
): { text: string; details: ChatDetail[]; skipped: string[] } {
  const details: ChatDetail[] = [];
  const skipped: string[] = [];
  for (const s of steps) {
    const a = answers[s.fieldKey];
    if (a === null || a === undefined) {
      if (s.fieldKey in answers) skipped.push(s.fieldKey);
      continue;
    }
    if (s.type === "image") continue;
    details.push({ fieldKey: s.fieldKey, label: s.label, value: a });
  }
  const text = details.map((d) => `${d.label}: ${d.value}`).join("\n") || "Build it as it is.";
  return { text, details, skipped };
}

/** The question and answer pairs a sent interview reads as in the thread,
 * rebuilt from the template and the message: answered fields with their
 * values, skipped ones as null, the photo step as PHOTO_ANSWER when the
 * message had a photo. Steps the message says nothing about are left out
 * (the template changed since). */
export function interviewTranscript(
  steps: readonly InterviewStep[],
  sent: { details?: readonly ChatDetail[]; skipped: readonly string[]; hadPhoto: boolean },
): Array<{ step: InterviewStep; answer: string | null }> {
  const values: FieldValues = {};
  for (const d of sent.details ?? []) values[d.fieldKey] = d.value;
  const out: Array<{ step: InterviewStep; answer: string | null }> = [];
  for (const step of steps) {
    if (step.type === "image") {
      if (sent.hadPhoto) out.push({ step, answer: PHOTO_ANSWER });
      else if (sent.skipped.includes(step.fieldKey)) out.push({ step, answer: null });
      continue;
    }
    const v = values[step.fieldKey];
    if (typeof v === "string" && v) out.push({ step, answer: v });
    else if (sent.skipped.includes(step.fieldKey)) out.push({ step, answer: null });
  }
  return out;
}
