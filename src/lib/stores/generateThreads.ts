// Pure helpers behind GenerateThreadStore (migration 0038), shared by the
// Supabase and local implementations so both page, search and order chats
// the same way, and so each rule is a tested sentence rather than a hope.
//
// History pages newest first on (updated_at desc, id desc). The cursor names
// the last chat of a page by BOTH keys: paging on updated_at alone would
// skip or repeat chats that share a timestamp, which a debounced save and a
// run finishing together can produce.

import { PLATFORMS, type PlatformId } from "../templates/platforms";
import type { GenerateThreadInput } from "../types";

/** The column's check (char_length(title) <= 120). */
export const THREAD_TITLE_MAX = 120;

/** Largest page a caller may ask for. History asks for 12, Recent for 4. */
export const THREAD_PAGE_MAX = 100;

/** The two keys a page is ordered by. */
export interface ThreadKey {
  updatedAt: string;
  id: string;
}

// A timestamp as Postgres (via PostgREST) or toISOString writes one, and an
// id as either backend issues one (a uuid, or the local fallback id). Both
// are checked on the way back in: the cursor ends up inside a PostgREST
// filter, so nothing that could close a quote or a group gets through.
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}(:\d{2})?)$/;
const CURSOR_ID = /^[A-Za-z0-9-]{1,64}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for an id Postgres could hold in a uuid column. A /generate/c/<id>
 * URL can carry anything, and Postgres refuses a malformed uuid with an
 * error rather than matching nothing. */
export const isUuid = (id: string): boolean => UUID.test(id);

const toBase64Url = (s: string): string =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (s: string): string => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
};

/** The opaque `nextBefore` for a page whose last chat is `key`. Callers
 * hand it back as `before` and never read it. */
export function encodeThreadCursor(key: ThreadKey): string {
  return toBase64Url(JSON.stringify([key.updatedAt, key.id]));
}

/** Reads a cursor back. Throws on anything encodeThreadCursor could not
 * have produced: a tampered cursor must not become a filter. */
export function decodeThreadCursor(cursor: string): ThreadKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(cursor));
  } catch {
    parsed = null;
  }
  if (
    Array.isArray(parsed) &&
    parsed.length === 2 &&
    typeof parsed[0] === "string" &&
    typeof parsed[1] === "string" &&
    CURSOR_TIMESTAMP.test(parsed[0]) &&
    CURSOR_ID.test(parsed[1])
  ) {
    return { updatedAt: parsed[0], id: parsed[1] };
  }
  throw new Error("Invalid chat history cursor.");
}

/** Sort comparator for (updatedAt desc, id desc). Compares the strings as
 * written: the local backend stamps every row with toISOString (fixed
 * width, UTC), so lexical order is time order there; the Supabase store
 * sorts in SQL and never calls this. */
export function compareThreadKeys(a: ThreadKey, b: ThreadKey): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/** True when `key` sorts strictly after `cursor` in that order, that is,
 * belongs on a later page than the chat the cursor names. */
export const comesAfter = (key: ThreadKey, cursor: ThreadKey): boolean =>
  compareThreadKeys(key, cursor) > 0;

/** The same predicate as a PostgREST `or` filter:
 * updated_at < t, or updated_at = t and id < i. Values are quoted so the
 * colons and dots of a timestamp are never read as filter syntax. */
export function keysetFilter(cursor: ThreadKey): string {
  const t = `"${cursor.updatedAt}"`;
  const id = `"${cursor.id}"`;
  return `updated_at.lt.${t},and(updated_at.eq.${t},id.lt.${id})`;
}

/** A page size the stores can use: whole, at least 1, at most
 * THREAD_PAGE_MAX. */
export function pageLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 1;
  return Math.min(Math.max(Math.floor(limit), 1), THREAD_PAGE_MAX);
}

/** Cuts rows fetched with `limit + 1` down to one page. The extra row is
 * only there to say whether another page exists; when it does, the cursor
 * names the page's last chat. */
export function pageOf<T extends ThreadKey>(
  rows: T[],
  limit: number,
): { items: T[]; nextBefore: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextBefore: rows.length > limit && last ? encodeThreadCursor(last) : null };
}

/** The ILIKE pattern for a title search, or null when there is nothing to
 * search for. The member's text is matched literally: `\`, `%` and `_` are
 * escaped (backslash is Postgres's default LIKE escape). PostgREST reads
 * every `*` in a like pattern as `%`, and no escape survives that, so a `*`
 * becomes `_`, which still matches the `*` itself (and any one other
 * character, the narrowest widening available). */
export function titleSearchPattern(q: string | undefined): string | null {
  const needle = q?.trim();
  if (!needle) return null;
  const escaped = needle.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, "_");
  return `%${escaped}%`;
}

/** The local backend's title search, the same match titleSearchPattern
 * asks Postgres for: the trimmed text as a case-insensitive substring,
 * every character literal except `*`, which matches any one character. */
export function titleMatches(title: string, q: string | undefined): boolean {
  const needle = q?.trim();
  if (!needle) return true;
  const pattern = needle.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".");
  return new RegExp(pattern, "isu").test(title);
}

/** Distinct platform ids in PLATFORMS order. Anything that is not a
 * platform this build knows is dropped, so a stored id that has since been
 * retired never reaches platformById. */
export function platformsInOrder(ids: Iterable<string>): PlatformId[] {
  const seen = new Set<string>(ids);
  return PLATFORMS.map((p) => p.id).filter((id) => seen.has(id));
}

/** A title the column accepts: at most THREAD_TITLE_MAX characters counted
 * as Postgres counts them (code points, so an emoji is never split). */
export function clampThreadTitle(title: string): string {
  const chars = Array.from(title);
  return chars.length > THREAD_TITLE_MAX ? chars.slice(0, THREAD_TITLE_MAX).join("") : title;
}

/** What both stores write: the title the column accepts and the platforms
 * in their one order. Turns, preview and the template pass through as
 * given (an absent templateId, from an older caller, writes null). */
export function normalizeThreadInput(input: GenerateThreadInput): GenerateThreadInput {
  return {
    title: clampThreadTitle(input.title),
    platforms: platformsInOrder(input.platforms),
    preview: input.preview,
    templateId: input.templateId ?? null,
    turns: input.turns,
  };
}
