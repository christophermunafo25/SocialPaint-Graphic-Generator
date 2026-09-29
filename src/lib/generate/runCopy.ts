// Every sentence and step label a Generate chat run shows (PROMPT §9.2,
// §9.3), in one pure module so the reducer, the controller and the page all
// say the same thing and a test pins each string. The progress bar moves by
// step, never by time: step 1 is reading the brief, step 2 rendering the
// proposals, step 3 checking that every line fits.
//
// No string here carries an em dash: the chat shows all of them to the
// member (PROMPT §2).

import type { GenerateMeta } from "../types";

export type RunMode = "library" | "freestyle";

/** The chat title until the server's title (or the brief's first words)
 * arrives (PROMPT §8.4). */
export const NEW_CHAT_TITLE = "New chat";

/** Step 1's label, both modes. */
export const STEP_READING = "Reading your brief";
/** Step 3's label: a repair round is in flight, or the last proposal is
 * being resolved. */
export const STEP_CHECKING = "Checking every line fits";

/** The reply when the server sent none (an older deployment, or the model
 * gave nothing usable). */
export const DONE_FALLBACK = "Here you go, with a caption for each draft.";
/** A stopped turn keeps whatever resolved before the stop. */
export const STOPPED_STATUS = "Stopped. The drafts that finished are below.";
/** Every proposal was dropped. Today's copy, unchanged. */
export const NOTHING_FIT =
  "None of the drafts fit their templates. Try a shorter brief, or fill a template directly. The library is unaffected.";
/** A failure with no sentence of its own (the provider's fallback reads the
 * same). */
export const GENERATE_FAILED = "Generate failed. Try again.";

/** A template chat's status while it builds (Template chat PROMPT §12.4). */
export const fillingInStatus = (templateName: string) => `Filling in ${templateName}.`;

/** The copy while the model call is in flight. */
export function askingCopy(mode: RunMode): { stepLabel: string; status: string } {
  return {
    stepLabel: STEP_READING,
    status:
      mode === "freestyle"
        ? "Designing new layouts from your brand kit."
        : "Reading your brief and choosing from your templates.",
  };
}

/** What step 2 knows about one proposal: its template's name and, when the
 * client can tell before the template is fetched, its canvas size. */
export interface ProposalShape {
  templateName: string;
  canvas: { width: number; height: number } | null;
}

/** Step 2's label, by the number of distinct canvas sizes the proposals
 * span: one reads "Rendering your draft", two "Rendering both sizes" (the
 * frame's copy), more "Rendering N sizes". A proposal whose size is unknown
 * counts as a size of its own, so the label never promises fewer sizes
 * than the member is about to see. */
export function measuringStepLabel(proposals: readonly ProposalShape[]): string {
  const sizes = new Set(
    proposals.map((p, i) => (p.canvas ? `${p.canvas.width}x${p.canvas.height}` : `unknown-${i}`)),
  );
  if (sizes.size <= 1) return "Rendering your draft";
  if (sizes.size === 2) return "Rendering both sizes";
  return `Rendering ${sizes.size} sizes`;
}

/** "A", "A and B", "A, B, and C" (the Oxford comma, as the app writes
 * lists). */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Step 2's status in library mode: the templates being filled, each name
 * once, in proposal order. */
export function fillingStatus(templateNames: readonly string[]): string {
  const names = [...new Set(templateNames.map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return "Filling in your templates.";
  return `Filling in your ${joinNames(names)} template${names.length === 1 ? "" : "s"}.`;
}

/** Step 2's status in freestyle mode. */
export function layingOutStatus(count: number): string {
  return count === 1 ? "Laying out 1 new design." : `Laying out ${count} new designs.`;
}

/** The copy once the proposals are in hand. */
export function measuringCopy(
  mode: RunMode,
  proposals: readonly ProposalShape[],
): { stepLabel: string; status: string } {
  return {
    stepLabel: measuringStepLabel(proposals),
    status:
      mode === "freestyle"
        ? layingOutStatus(proposals.length)
        : fillingStatus(proposals.map((p) => p.templateName)),
  };
}

/** The progress row's label and the progress bar's aria-valuetext, for
 * example "2 of 3 · Rendering both sizes". */
export function progressLabel(step: 1 | 2 | 3, stepLabel: string): string {
  return `${step} of 3 · ${stepLabel}`;
}

// The warnings a dropped proposal leaves, verbatim from the page this chat
// replaces. They render under the drafts, one per line.

/** A freestyle design whose copy overflows (no stored template to repair
 * against, so it is dropped honestly). */
export const overflowingDesignWarning = (templateName: string) =>
  `Dropped the "${templateName}" design because its copy overflows.`;

/** A library proposal whose template was unpublished or removed since. */
export const unavailableWarning = (templateName: string) =>
  `"${templateName}" is no longer available and was skipped.`;

/** A library proposal that still overflows after its one repair round. */
export const unfittableDraftWarning = (templateName: string) =>
  `Dropped a "${templateName}" draft because its copy couldn't be made to fit the design.`;

/** Provenance, in the open: which model, from which library. The page this
 * chat replaces drew it under the drafts; the chat carries it in the
 * drafts' accessible description only (PROMPT §9.2 item 4). */
export function provenanceSentence(meta: {
  model: GenerateMeta["model"];
  candidateCount: number;
  mode: RunMode;
}): string {
  const templates = (n: number) => `${n} published template${n === 1 ? "" : "s"}`;
  if (meta.mode === "freestyle") {
    return `Drafted by ${meta.model} from your brand kit${
      meta.candidateCount > 0 ? `, with ${templates(meta.candidateCount)} as reference` : ""
    }.`;
  }
  return `Drafted by ${meta.model} from ${
    meta.candidateCount === 1 ? "the template you picked" : templates(meta.candidateCount)
  }.`;
}
