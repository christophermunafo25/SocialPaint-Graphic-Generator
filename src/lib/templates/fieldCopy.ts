// The words a member field speaks in on the fill page and in the Details
// panel (new look, Phase 4): the photo field's placeholder and the error a
// required field shows when it is empty. Proposed copy (PHASE-4.md §7).

/** A label as it reads mid-sentence: lowercased, unless it carries capitals
 * past its first letter ("URL", "CTA", "iPhone" stay as they are). */
export function labelInSentence(label: string): string {
  const trimmed = label.trim().replace(/[:?.]+$/, "");
  if (!trimmed) return "photo";
  return /[A-Z]/.test(trimmed.slice(1)) ? trimmed : trimmed.toLowerCase();
}

/** The photo field's placeholder, written like the inputs' placeholders:
 * Add plus the label with its article ("Add a photo", "Add an image",
 * "Add a headshot"). */
export function addPhotoPlaceholder(label: string): string {
  const noun = labelInSentence(label);
  const article = /^[aeiou]/i.test(noun) ? "an" : "a";
  return `Add ${article} ${noun}`;
}

/** The error under a required field left empty when the person presses
 * Download. A photo says what to do with it ("Add a photo."); every other
 * field names itself ("Fill in the headline."). */
export function requiredError(field: { label: string; type: string }): string {
  if (field.type === "image") return `${addPhotoPlaceholder(field.label)}.`;
  return `Fill in the ${labelInSentence(field.label)}.`;
}

/** The error under a value too long for its line at its smallest size (the
 * template chat's Edit details): the Missing and Too long statuses moved to
 * the Field's error line (PHASE-4.md §9 D3). */
export const TOO_LONG_ERROR = "Too long to fit. Shorten it.";
