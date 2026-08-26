// Anonymous resume.
//
// A public visitor has no identity to attach a server-side draft to, and
// inventing one would mean fingerprinting them. localStorage is the honest
// compromise: the work survives a closed tab on the same device and browser,
// and nowhere else. The page says so plainly rather than letting a speaker
// discover it the hard way.
//
// TEXT ONLY. A cropped photo is a multi-megabyte data URL that would blow the
// storage quota and fail on write — quietly, in most browsers, which is the
// worst possible way for a draft to not work. The photo is re-added on
// resume, and the page says that too.

import type { FieldValues, TemplateField } from "../types";

const PREFIX = "sp-public-fill:";

/** A stale draft is worse than none: a speaker returning to an event graphic
 * weeks later should start clean rather than wonder where old text came
 * from. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredDraft {
  savedAt: number;
  values: FieldValues;
}

/** Keyed by a cheap digest of the token rather than the token itself. The
 * token is already in the URL and the browser's history, so this is tidiness
 * rather than secrecy — but it also keeps one device's drafts for two
 * different links from colliding on a shared prefix. */
function keyFor(token: string): string {
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) {
    hash = ((hash << 5) + hash + token.charCodeAt(i)) >>> 0;
  }
  return `${PREFIX}${hash.toString(36)}`;
}

/** Which of a template's fields are worth persisting: everything a visitor
 * typed or chose. Image fields hold data URLs and are deliberately excluded. */
export function draftableKeys(fields: TemplateField[]): Set<string> {
  return new Set(fields.filter((f) => !f.static && f.type !== "image").map((f) => f.fieldKey));
}

/** Does this template have anything a draft could hold? A template that is
 * one photo field has nothing to resume, and promising resume there would be
 * a lie. */
export const hasDraftableFields = (fields: TemplateField[]): boolean =>
  draftableKeys(fields).size > 0;

export function loadDraft(token: string, fields: TemplateField[]): FieldValues | null {
  try {
    const raw = window.localStorage.getItem(keyFor(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed?.values || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearDraft(token);
      return null;
    }
    // Only keys the CURRENT template still has: an admin who reworked the
    // template must not have a stale value reappear under a reused key.
    const allowed = draftableKeys(fields);
    const values: FieldValues = {};
    for (const [key, value] of Object.entries(parsed.values)) {
      if (allowed.has(key) && typeof value === "string") values[key] = value;
    }
    return Object.keys(values).length > 0 ? values : null;
  } catch {
    // Private browsing, a cleared store, a quota error, a half-written
    // entry. None of these are the visitor's problem: no draft, carry on.
    return null;
  }
}

export function saveDraft(token: string, fields: TemplateField[], values: FieldValues): void {
  try {
    const allowed = draftableKeys(fields);
    const kept: FieldValues = {};
    for (const [key, value] of Object.entries(values)) {
      if (allowed.has(key) && value) kept[key] = value;
    }
    if (Object.keys(kept).length === 0) {
      clearDraft(token);
      return;
    }
    const draft: StoredDraft = { savedAt: Date.now(), values: kept };
    window.localStorage.setItem(keyFor(token), JSON.stringify(draft));
  } catch {
    // Same as above. A draft that cannot be written is a missing
    // convenience, never a broken fill.
  }
}

export function clearDraft(token: string): void {
  try {
    window.localStorage.removeItem(keyFor(token));
  } catch {
    // Nothing to do and nothing to tell the visitor.
  }
}
