// How a chat draft reads on screen (PROMPT.md §7.14, §7.16, §9.9): the
// values its preview paints, its name and caption, the labels on the
// caption card's platform switch, the compact card's platform meta, and the
// chat's fallback title. Pure, so the thread, the caption card and the
// editor all derive these from one place and the rules are unit-tested.
//
// A draft's platform is always its canvas's PRIMARY platform: the first
// entry classifySize gives for the size. One size can serve several
// platforms (1080 × 1350 is the portrait post on Instagram, Facebook and
// LinkedIn), but a draft is one card with one label, and the Figma labels
// the 1080 × 1350 draft "Instagram" everywhere it names it.

import type { FieldValues, GeneratedProposal, TemplateSchema } from "../types";
import { mergeCaption } from "../caption";
import { classifySize, platformById, type PlatformId } from "../templates/platforms";
import {
  isUserTurn,
  type AssistantTurn,
  type ChatDraft,
  type ChatPhoto,
  type ChatThread,
} from "./chat";

/** The image field a supplied photo lands in: the server-validated hint when
 * it names a member image slot, else the first member image field. Null when
 * the design has no member image slot at all. (Moved from the one-shot
 * GeneratePage, unchanged.) */
export function imageTargetFor(proposal: GeneratedProposal, schema: TemplateSchema): string | null {
  const slots = schema.fields.filter((f) => f.type === "image" && !f.static);
  if (slots.length === 0) return null;
  const hinted = proposal.imageTargetFieldKey
    ? slots.find((f) => f.fieldKey === proposal.imageTargetFieldKey)
    : undefined;
  return (hinted ?? slots[0]).fieldKey;
}

/** The values a draft's preview paints: its own, with the turn's photo in
 * its target slot (imageTargetFor), uncropped, exactly as the one-shot page
 * previewed it. The photo is laid over the values, never written into the
 * draft, so it stays out of the thread and out of anything saved (PROMPT.md
 * §9.8). With no photo, no schema (a gone template) or no member image slot
 * the draft's own values object comes back as is, so a memo keyed on it
 * holds. */
export function previewValues(draft: ChatDraft, photo: ChatPhoto | null | undefined): FieldValues {
  if (!photo || !draft.schema) return draft.values;
  const target = imageTargetFor(draft.proposal, draft.schema);
  return target ? { ...draft.values, [target]: photo.dataUrl } : draft.values;
}

/** The name a draft goes by: its template's current name (a library
 * template renamed since the chat was saved shows the new one), a freestyle
 * draft's design name, else the name it was proposed under (a gone
 * template). */
export function draftName(draft: ChatDraft): string {
  return draft.schema?.name || draft.proposal.design?.name || draft.proposal.templateName;
}

/** caption.ts's merge-tag pattern, to read which fields a caption uses. */
const MERGE_TAG = /\{([a-zA-Z0-9_]+)\}/g;

/** Whether every field `captionTemplate` tags still holds the value it was
 * proposed with. A missing value and an empty one read the same. */
function taggedValuesUnchanged(
  captionTemplate: string,
  current: FieldValues,
  proposed: FieldValues,
): boolean {
  for (const [, key] of captionTemplate.matchAll(MERGE_TAG)) {
    if ((current[key] ?? "") !== (proposed[key] ?? "")) return false;
  }
  return true;
}

/** The caption shown for a draft (PROMPT.md §7.16): the proposal's caption,
 * else the template's caption merged from the draft's current values.
 *
 * Where the caption came from decides whether an edit changes it:
 *  - A library draft's `proposal.caption` is the model's own prose. It stays
 *    as written whatever the member edits. When the model sent none, the
 *    caption is the template's `captionTemplate`, merged from the current
 *    values on every call, so it follows each edit.
 *  - A freestyle draft's `proposal.caption` came from its design's
 *    `captionTemplate` too: the server resolved the tags against the
 *    proposal's values. It is shown as the server resolved it until the
 *    member changes a field the caption tags, then merged from the current
 *    values like any template caption (blanks read "____", as on the fill
 *    page).
 *  - A draft whose template is gone keeps the proposal's caption, the only
 *    one it has.
 *
 * The turn's photo plays no part: images have no caption text. */
export function captionFor(draft: ChatDraft): string {
  const { proposal, schema, values } = draft;
  if (!schema) return proposal.caption;
  if (!proposal.design) {
    return proposal.caption.trim() ? proposal.caption : mergeCaption(schema, values);
  }
  return taggedValuesUnchanged(schema.captionTemplate, values, proposal.values)
    ? proposal.caption
    : mergeCaption(schema, values);
}

/** The canvas's primary platform (see the file header). "general" when the
 * size is not in the catalogue, or is its platform-neutral square. */
export function primaryPlatformOf(canvas: { width: number; height: number }): PlatformId {
  return classifySize(canvas.width, canvas.height).platforms[0];
}

/** The platform a draft card names in its compact meta (PROMPT.md §7.14 as
 * amended by CJ, §15 item 17): "Instagram", "LinkedIn". Null when the size
 * maps to no platform ("general"), where the card keeps its size meta. */
export function platformLabelFor(canvas: { width: number; height: number }): string | null {
  const primary = primaryPlatformOf(canvas);
  return primary === "general" ? null : platformById(primary).label;
}

/** How many times each label occurs. */
function tally(labels: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return counts;
}

/** The caption card's platform switch (PROMPT.md §7.16): one segment per
 * draft, in the turn's order, labelled with the draft's platform
 * (platformById of its primary platform, so a custom size reads "General").
 * Drafts that share a platform go by their template names instead, and the
 * rest keep theirs. Two labels can still tie (the same template twice, or a
 * template named like another draft's platform); tied labels are then
 * numbered in order, "Now hiring 1" and "Now hiring 2", so every segment
 * reads differently. The card hides the switch for a single draft. */
export function captionTabs(drafts: ChatDraft[]): Array<{ id: string; label: string }> {
  const platforms = drafts.map((d) => platformById(primaryPlatformOf(d.canvas)).label);
  const perPlatform = tally(platforms);
  const named = drafts.map((d, i) =>
    (perPlatform.get(platforms[i]) ?? 0) > 1 ? draftName(d) : platforms[i],
  );
  const perLabel = tally(named);
  const seen = new Map<string, number>();
  return drafts.map((d, i) => {
    const label = named[i];
    if ((perLabel.get(label) ?? 0) < 2) return { id: d.id, label };
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return { id: d.id, label: `${label} ${n}` };
  });
}

/** A fallback title keeps this many of the brief's words. */
const TITLE_WORDS = 6;
/** And at most this many characters, ellipsis included: the server's own
 * title limit, well inside the 120 the generate_threads check allows. A
 * brief whose first words run long (a pasted link) is cut to fit. */
const TITLE_MAX = 60;
/** Closing punctuation a title never ends on, as the server's title rule
 * strips it (. , ; : ! ? … and dashes, with any space before them). */
const CLOSING_PUNCTUATION = /[\s.,;:!?\u2026\u2013\u2014-]+$/;

/** `text` without closing punctuation, unless that is all it is. */
function withoutClosingPunctuation(text: string): string {
  return text.replace(CLOSING_PUNCTUATION, "") || text;
}

/** The chat's title when the server sends none (PROMPT.md §9.9): the first
 * six words of the brief, whitespace collapsed, with a trailing "…" when
 * the brief runs longer. Like the server's titles it never ends on closing
 * punctuation, so "Open house Saturday." reads "Open house Saturday" and a
 * cut after "Director," reads "…Director…" without the comma. It stays
 * within 60 characters: six long words are cut at the last word that fits
 * (a single word longer than that, mid-word) and take the ellipsis too.
 * Characters are counted as code points, so a cut never splits an emoji.
 * An empty brief gives an empty title; the chat never sends one. */
export function fallbackTitle(brief: string): string {
  const words = brief.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const title = words.slice(0, TITLE_WORDS).join(" ");
  const chars = Array.from(title);
  if (chars.length > TITLE_MAX) {
    // Back to the last space that leaves room for the ellipsis, so the cut
    // ends on a whole word; a first word too long for that is cut short.
    const reach = chars.slice(0, TITLE_MAX).join("");
    const space = reach.lastIndexOf(" ");
    const cut = space > 0 ? reach.slice(0, space) : chars.slice(0, TITLE_MAX - 1).join("");
    return `${withoutClosingPunctuation(cut)}\u2026`;
  }
  return words.length > TITLE_WORDS
    ? `${withoutClosingPunctuation(title)}\u2026`
    : withoutClosingPunctuation(title);
}

/** The photo an assistant turn's drafts were made with: the one
 * snapshotted on the user turn it replies to (PROMPT.md §9.2), or null when
 * that message had none. A reopened chat never has one (photos are not
 * saved), and a later attach or remove never reaches an earlier turn. */
export function turnPhoto(thread: ChatThread, assistant: AssistantTurn): ChatPhoto | null {
  const asked = thread.turns.find((t) => t.id === assistant.replyTo);
  return asked && isUserTurn(asked) ? (asked.photo ?? null) : null;
}
