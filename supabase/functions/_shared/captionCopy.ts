// Captions the model writes follow the house copy rules (CJ, 2026-11-16):
// no emoji, no exclamation points and no em dashes. Each prompt asks for
// that; plainCaption holds it once the model has answered, on every route
// that writes one (auto build, Generate's posts and its new designs). Pure,
// so the same code runs in the Edge Functions and under vitest. Every
// character below is written as an escape, so nothing invisible hides here.

/** Emoji pictographs, except the three marks a brand name may carry
 * (copyright, registered, trade mark). */
const PICTOGRAPH = /(?![\u{A9}\u{AE}\u{2122}])\p{Extended_Pictographic}/gu;

/** What is left of an emoji once its pictographs are gone: the joiner,
 * presentation selectors, the keycap, skin tones, flag letters and tag runs. */
const EMOJI_PART =
  /\u{200D}|\u{FE0E}|\u{FE0F}|\u{20E3}|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{E0020}-\u{E007F}]/gu;

/** A run of exclamation marks (double and question forms included), with
 * any question marks beside it. */
const EXCLAMATION = /[!?\u{203C}\u{2049}]*[!\u{203C}\u{2049}][!?\u{203C}\u{2049}]*/gu;
const ASKS = /[?\u{2049}]/u;

/** The inverted exclamation mark that opens a Spanish exclamation. */
const INVERTED_EXCLAMATION = /\u{A1}/gu;

/** An em dash or horizontal bar, or a spaced en dash standing in for one,
 * with the spaces around it. An en dash between numbers is a range and
 * stays. */
const DASH = /[ \t]*[\u{2014}\u{2015}][ \t]*|(?<!\d)[ \t]+\u{2013}[ \t]+(?!\d)/gu;

/** A dash that opens or closes a line goes. After a stop or a comma it
 * leaves a space, and anywhere else it becomes a comma. */
const replaceDash = (dash: string, at: number, all: string): string => {
  const before = all[at - 1];
  const after = all[at + dash.length];
  if (before === undefined || before === "\n" || after === undefined || after === "\n") return "";
  return /[.?,;:]/.test(before) ? " " : ", ";
};

/** The caption without emoji, exclamation points or em dashes. An
 * exclamation point becomes a full stop, an em dash a comma, and emoji go.
 * Merge tags and line breaks are kept. */
export function plainCaption(text: string): string {
  return (
    text
      .replace(INVERTED_EXCLAMATION, "")
      .replace(EXCLAMATION, (run) => (ASKS.test(run) ? "?" : "."))
      .replace(PICTOGRAPH, "")
      .replace(EMOJI_PART, "")
      .replace(DASH, replaceDash)
      // Tidy what the removals leave: a space before punctuation, doubled
      // commas, a comma before a full stop, runs of spaces and blank lines.
      .replace(/[ \t]+([,.?;:])/g, "$1")
      .replace(/,(?:[ \t]*,)+/g, ",")
      .replace(/[,;:][ \t]*([.?])(?!\.)/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/^[ \t]+|[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
