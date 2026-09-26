// The Try next row under the chat's latest finished turn (PROMPT.md §9.4):
// at most three follow-up suggestions, derived on the client from the turn
// itself, in a fixed order:
//
//  1. Fill an empty field: "Add a location". Opens the editor on the draft
//     and focuses the field. No model call.
//  2. Another platform: "Make a Facebook version", for the first of
//     Facebook, Instagram and LinkedIn that no draft is for and that the
//     chat has not asked for already. A model run.
//  3. Another layout: "Try another layout", a freestyle run, offered only
//     when the brand kit has a palette color (freestyle refuses otherwise).
//
// Pure and unit-tested: the page renders the chips, and the chat controller
// runs the platform and layout actions.
//
// "Empty field", as the codebase defines requiredness today: §9.4 asks for
// an OPTIONAL empty field, but there is no optional member field any more.
// isRequiredField (templates/fieldRules.ts) makes every non-fixed field
// required, and TemplateField.required is legacy data nothing reads
// (docs/TEMPLATE_SCHEMA.md). So the rule offers a member text field the
// drafts left empty, which after a generate is a field a freestyle design
// left for the member (library values are checked server-side to fill
// every one), or one the member has since cleared. That is the hole in the
// graphic the chip invites them to fill, and exactly what the frame's "Add
// a location" does.

import type { TemplateField } from "../types";
import { platformById, type PlatformId } from "../templates/platforms";
import {
  isAssistantTurn,
  isUserTurn,
  type AssistantTurn,
  type ChatDraft,
  type ChatTurn,
} from "./chat";
import { primaryPlatformOf } from "./draftView";

export type TryNextAction =
  | { kind: "fillField"; label: string; draftId: string; fieldKey: string }
  | { kind: "platform"; label: string; platform: PlatformId }
  | { kind: "layout"; label: string };

/** The row never shows more than this. */
const MAX_ACTIONS = 3;

/** The platforms rule 2 offers, in the order it offers them. */
const VERSION_PLATFORMS: PlatformId[] = ["facebook", "instagram", "linkedin"];

// ---------------------------------------------------------------------------
// "a" or "an"
// ---------------------------------------------------------------------------
// The article goes by how the next word SOUNDS, which spelling only
// approximates. The rule, in order, on the phrase's first word:
//
//  - A number is said aloud: "an 8-week course", "an 11", "an 18",
//    "an 80s night", "an 11,000"; every other number takes "a".
//  - A single letter, or an acronym said letter by letter, goes by the
//    letter's name: "an X handle", "an A/B test", "an FAQ link", "an HR
//    contact", "an RSVP link", but "a URL slug", "a CTA". A capitalized run
//    counts as an acronym when it has no vowel (RSVP, HR) or when the
//    phrase has lowercase letters elsewhere (so the capitals are
//    deliberate). A label typed all in capitals ("LOCATION", "NAME") is
//    read as a word. Acronyms said as words ("NASA") come out wrong; they
//    are rare in field labels.
//  - A word goes by its first letter, with the known exceptions: a silent h
//    takes "an" (hour, honest, honor, honour, heir), and a vowel said as a
//    consonant takes "a": the "you" sound (university, unique, unit, use,
//    usual, utility, European, euro, ewe, url) and the "w" sound (one,
//    once). "Un-" words keep "an" (an uninvited, an unimportant, an
//    unidentified), as does "onerous".

/** Letters whose names start with a vowel sound: "an F", "an M", "an X". */
const VOWEL_NAMED_LETTERS = "aefhilmnorsx";

/** Words that start with a vowel sound behind a silent h. */
const SILENT_H = ["hour", "honest", "honor", "honour", "heir"];

/** Vowel-spelled words that start with a consonant sound. */
const CONSONANT_SOUND = [
  "uni",
  "use",
  "usu",
  "usa",
  "uti",
  "ute",
  "uto",
  "ura",
  "uri",
  "uro",
  "url",
  "ubi",
  "uku",
  "eu",
  "ewe",
  "one",
  "once",
];

/** ...except these, which keep their vowel sound. */
const VOWEL_SOUND = ["unin", "unim", "unid", "onerous"];

const startsWithAny = (word: string, prefixes: string[]) =>
  prefixes.some((p) => word.startsWith(p));

/** "a" or "an" for `phrase`, by the sound of its first word (the rule
 * above). Give it the phrase as written: capitals are how an acronym is
 * told from a word. */
export function indefiniteArticle(phrase: string): "a" | "an" {
  const first = phrase
    .trim()
    .split(/\s+/)[0]
    .replace(/^[^\p{L}\p{N}]+/u, "");

  const digits = /^[\d,]+/.exec(first)?.[0].replace(/,/g, "");
  if (digits) {
    // Eight, eighty, eight hundred; eleven and eighteen, alone or as
    // thousands and millions (11, 11,000, 18,000,000).
    const eleven = digits.length % 3 === 2 && /^1[18]/.test(digits);
    return digits.startsWith("8") || eleven ? "an" : "a";
  }

  const run = /^\p{L}+/u.exec(first)?.[0] ?? "";
  if (!run) return "a";
  const lower = run.toLowerCase();

  const capitals = run.length > 1 && run === run.toUpperCase() && run !== lower;
  const acronym = capitals && (!/[aeiou]/.test(lower) || /\p{Ll}/u.test(phrase.replace(run, "")));
  if (run.length === 1 || acronym) return VOWEL_NAMED_LETTERS.includes(lower[0]) ? "an" : "a";

  if (startsWithAny(lower, SILENT_H)) return "an";
  if (startsWithAny(lower, CONSONANT_SOUND) && !startsWithAny(lower, VOWEL_SOUND)) return "a";
  return "aeiou".includes(lower[0]) ? "an" : "a";
}

// ---------------------------------------------------------------------------
// Rule 1: an empty field
// ---------------------------------------------------------------------------

/** A field the member fills in with text (the rule leaves out images, which
 * have their own upload, and selects, which a generate always fills). */
const isMemberText = (f: TemplateField) =>
  !f.static && (f.type === "text" || f.type === "multiline");

/** A label as the editor links fields by it (PROMPT.md §9.5): lowercase,
 * letters and digits only. Empty for a label with neither. */
const labelKey = (label: string) => label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const isEmpty = (draft: ChatDraft, fieldKey: string) => !(draft.values[fieldKey] ?? "").trim();

/** Whether `field` (whose label key is `key`, never empty) is still empty
 * across the turn: empty in its own draft, and in every draft whose field
 * the editor would link to it (the same fieldKey, or the same label key).
 * Editing one of a linked set writes every member, so a location one draft
 * already has is not a location to add. */
function emptyAcrossTurn(field: TemplateField, key: string, drafts: ChatDraft[]): boolean {
  return drafts.every(
    (d) =>
      !d.schema ||
      d.schema.fields.every(
        (f) =>
          !isMemberText(f) ||
          (f.fieldKey !== field.fieldKey && labelKey(f.label) !== key) ||
          isEmpty(d, f.fieldKey),
      ),
  );
}

/** The first member text field, in form order across the turn's drafts
 * (the first draft's fields in their order, then the next draft's), that is
 * empty across the turn and has a label to name it by (one with a letter or
 * a digit in it). A draft whose template is gone has no fields to offer. */
function fillFieldAction(drafts: ChatDraft[]): TryNextAction | null {
  for (const draft of drafts) {
    for (const field of draft.schema?.fields ?? []) {
      if (!isMemberText(field) || !isEmpty(draft, field.fieldKey)) continue;
      const key = labelKey(field.label);
      if (!key || !emptyAcrossTurn(field, key, drafts)) continue;
      const label = field.label.trim().replace(/\s+/g, " ");
      return {
        kind: "fillField",
        label: `Add ${indefiniteArticle(label)} ${label.toLowerCase()}`,
        draftId: draft.id,
        fieldKey: field.fieldKey,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 2: another platform
// ---------------------------------------------------------------------------

/** The first of Facebook, Instagram and LinkedIn that no draft is for and
 * that the chat has not already asked for (`asked`, platformsAskedFor).
 * A draft is for its canvas's primary platform, the one its caption tab and
 * compact card name (draftView.ts), so a 1080 × 1350 "Instagram" draft
 * still leaves room for "Make a Facebook version", as frame 05 draws it,
 * although the same size also serves Facebook.
 *
 * That same overlap is why an answered platform is never offered again: the
 * server takes every size a platform uses as a candidate for it, so "Make
 * a Facebook version" can come back as the same 1080 × 1350 draft, which
 * is for Instagram by the rule above. Without the second condition the row
 * under it would offer the same chip again, and every click would spend a
 * generate on the same answer. */
function platformAction(
  drafts: ChatDraft[],
  asked: ReadonlySet<PlatformId> | undefined,
): TryNextAction | null {
  const covered = new Set(drafts.map((d) => primaryPlatformOf(d.canvas)));
  const platform = VERSION_PLATFORMS.find((p) => !covered.has(p) && !asked?.has(p));
  if (!platform) return null;
  const name = platformById(platform).label;
  return { kind: "platform", label: `Make ${indefiniteArticle(name)} ${name} version`, platform };
}

/** The platforms a chat has asked for with rule 2's chip (or anything
 * else that sent a platform run) and been answered: a reply to that
 * message finished with drafts. A run that was stopped, or failed, showed
 * nothing for its platform, so the chip stays on offer. In the order it
 * asked. */
export function platformsAskedFor(turns: readonly ChatTurn[]): Set<PlatformId> {
  const answered = new Set<string>();
  for (const t of turns) {
    if (isAssistantTurn(t) && t.phase === "done" && t.drafts.length > 0) answered.add(t.replyTo);
  }
  const asked = new Set<PlatformId>();
  for (const t of turns) {
    if (isUserTurn(t) && t.intent === "platform" && t.platformHint && answered.has(t.id)) {
      asked.add(t.platformHint);
    }
  }
  return asked;
}

// ---------------------------------------------------------------------------

/** The Try next actions for a turn, at most three, in the order above.
 * Only a finished turn with drafts has any: the page shows the row under
 * the latest `done` turn and hides it while a run is in flight. The
 * layout action needs a palette color because freestyle refuses a brand kit
 * without one; `paletteSize` is the active kit's color count.
 * `askedPlatforms` is platformsAskedFor over the thread: a platform the
 * chat has already asked for, and had answered, is not offered again
 * (rule 2). */
export function deriveTryNext(
  turn: AssistantTurn,
  opts: { paletteSize: number; askedPlatforms?: ReadonlySet<PlatformId> },
): TryNextAction[] {
  if (turn.phase !== "done" || turn.drafts.length === 0) return [];
  const actions: TryNextAction[] = [];
  const fill = fillFieldAction(turn.drafts);
  if (fill) actions.push(fill);
  const platform = platformAction(turn.drafts, opts.askedPlatforms);
  if (platform) actions.push(platform);
  if (opts.paletteSize > 0) actions.push({ kind: "layout", label: "Try another layout" });
  return actions.slice(0, MAX_ACTIONS);
}
