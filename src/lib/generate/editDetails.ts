// Edit details' small rules (template-chat PROMPT §11.11, §12.7), pure so
// the editor and its tests read them from one place.

/** A field's status in Edit details: at most one shows. */
export type EditorFieldStatus = "missing" | "tooLong" | "edited";

/** The one status a field shows: Missing, then Too long, then Edited. */
export function fieldStatus(f: {
  missing: boolean;
  tooLong: boolean;
  edited: boolean;
}): EditorFieldStatus | null {
  if (f.missing) return "missing";
  if (f.tooLong) return "tooLong";
  if (f.edited) return "edited";
  return null;
}

/** The note under a blocked Download PNG: what is left to fill, then what
 * is too long ("Shorten: …", proposed copy). */
export function blockedNote(missing: string[], tooLong: string[]): string {
  const parts: string[] = [];
  if (missing.length) parts.push(`Fill required: ${missing.join(", ")}`);
  if (tooLong.length) parts.push(`Shorten: ${tooLong.join(", ")}`);
  return parts.join(". ");
}
