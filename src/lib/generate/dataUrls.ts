// The data-URL guard a stored Generate chat passes before every write
// (PROMPT.md §2, §9.8): the member's photo never reaches a stored row.
//
// A leaf on purpose. Both GenerateThreadStore implementations run
// assertNoDataUrls, and the store layer is reachable from the public link
// page (through SchemaRenderer and the stores index), so anything this file
// imported would ship to link visitors. It imports types and nothing else;
// threadStorage.ts, which converts a whole chat, re-exports it.

import type { GenerateThreadInput } from "../types";

/** A string that starts with "data:", in any case, after any leading
 * spaces or control characters, once every tab and line break in it is
 * removed: what a browser's URL parser reads as a data URL. Every photo
 * and uploaded image in the chat is held as one ("data:image/jpeg;base64,
 * …"), and the parser forgives more than that form: whitespace after the
 * colon ("data: image/png;base64,…"), a line break anywhere ("da\nta:…")
 * and a media type it cannot parse ("data:Q3;base64,…") all still load as
 * an image. So the rule has no exceptions (PROMPT §9.8: strip every value
 * that starts with "data:"), and a member's line that happens to begin
 * with "data:" is dropped with the rest. */
const DATA_URL = /^[\s\p{Cc}]*data:/iu;
/** What the URL parser removes from anywhere in a URL before reading it. */
const TAB_OR_NEWLINE = /[\t\n\r]/g;

export function isDataUrl(value: string): boolean {
  return DATA_URL.test(value.replace(TAB_OR_NEWLINE, ""));
}

/** Throws when any string in `input`, at any depth, is a data URL (an
 * object key included). The store's last check before every write: the
 * member's photo never reaches a stored row (PROMPT §2). The message names
 * where the data URL sits, never the data itself. */
export function assertNoDataUrls(input: GenerateThreadInput): void {
  const at = dataUrlPath(input, "thread");
  if (at !== null) throw new Error(`Refusing to save a chat that holds a data URL at ${at}.`);
}

function dataUrlPath(value: unknown, path: string): string | null {
  if (typeof value === "string") return isDataUrl(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = dataUrlPath(item, `${path}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (isDataUrl(key)) return `${path} (a key)`;
      const found = dataUrlPath(item, `${path}.${key}`);
      if (found !== null) return found;
    }
  }
  return null;
}
