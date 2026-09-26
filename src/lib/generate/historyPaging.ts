// History's list of chats (PROMPT.md §8.6, §9.9): the member's chats,
// newest first, twelve at a time, for one filter at a time (a platform and
// a title search, both from the URL). A pure reducer, so each paging rule
// is a tested sentence rather than a hope:
//
//  - a new filter starts over from its first page;
//  - a page lands only if it answers the request the list is waiting on,
//    so a late page for an earlier filter, or a second answer to the same
//    request, never lands twice or in the wrong list;
//  - a page that comes back short is the end, and nothing asks for more;
//  - a failed page keeps what already loaded, and retry asks for that same
//    page again.
//
// The page owns the requests (the store, the IntersectionObserver); this
// file owns what they mean.

import type { GenerateThreadSummary } from "../types";

/** Chats per page (PROMPT §8.6). */
export const HISTORY_PAGE_SIZE = 12;

/** How many loading cards stand in for a page on its way (PROMPT §8.6). */
export const HISTORY_LOADING_CARDS = 4;

export interface HistoryPaging {
  /** The filter these chats answer (the page's key for its platform, its
   * search and its workspace). */
  filter: string;
  /** Every chat loaded so far, in the store's order. */
  items: GenerateThreadSummary[];
  /** Where the next page starts: undefined before the first page, the
   * store's cursor while more may follow, null once a page came back short
   * (the end of the list). */
  cursor: string | null | undefined;
  /** `loading`: the page at `cursor` is on its way. `idle`: settled.
   * `error`: that page failed, and retry asks for it again. */
  phase: "loading" | "idle" | "error";
}

/** The page a request asked for: the filter and the cursor it was sent
 * with. A result names it, so the reducer can tell whether it is the one
 * the list is waiting on. */
export interface HistoryRequest {
  filter: string;
  cursor: string | null | undefined;
}

export type HistoryAction =
  /** The URL's filter changed (or the workspace did): start over. */
  | { type: "filter"; filter: string }
  /** The foot of the grid came near: ask for the next page, if there is one
   * and nothing is loading. */
  | { type: "more" }
  | {
      type: "loaded";
      request: HistoryRequest;
      items: GenerateThreadSummary[];
      nextBefore: string | null;
    }
  | { type: "failed"; request: HistoryRequest }
  /** Ask again for the page that failed. */
  | { type: "retry" };

/** A filter's list before its first page: loading, nothing to show. */
export function initialHistory(filter: string): HistoryPaging {
  return { filter, items: [], cursor: undefined, phase: "loading" };
}

/** Whether a result answers the request the list is waiting on. */
const answers = (s: HistoryPaging, request: HistoryRequest): boolean =>
  s.phase === "loading" && s.filter === request.filter && s.cursor === request.cursor;

export function historyReducer(s: HistoryPaging, action: HistoryAction): HistoryPaging {
  switch (action.type) {
    case "filter":
      return action.filter === s.filter ? s : initialHistory(action.filter);
    case "more":
      return canLoadMore(s) ? { ...s, phase: "loading" } : s;
    case "loaded": {
      if (!answers(s, action.request)) return s;
      // Keyset paging never repeats a chat, but a chat saved between two
      // pages can move; a list keyed by id must not show one twice.
      const seen = new Set(s.items.map((c) => c.id));
      const fresh = action.items.filter((c) => !seen.has(c.id));
      const short = action.items.length < HISTORY_PAGE_SIZE || action.nextBefore === null;
      return {
        ...s,
        items: fresh.length ? [...s.items, ...fresh] : s.items,
        cursor: short ? null : action.nextBefore,
        phase: "idle",
      };
    }
    case "failed":
      return answers(s, action.request) ? { ...s, phase: "error" } : s;
    case "retry":
      return s.phase === "error" ? { ...s, phase: "loading" } : s;
  }
}

/** The request the list is waiting on, or null when it is not loading. */
export function pendingRequest(s: HistoryPaging): HistoryRequest | null {
  return s.phase === "loading" ? { filter: s.filter, cursor: s.cursor } : null;
}

/** Settled with another page to come: the sentinel may ask for it. */
export function canLoadMore(s: HistoryPaging): boolean {
  return s.phase === "idle" && typeof s.cursor === "string";
}

/** Settled at the end with nothing in it: an empty list, which the page
 * shows as "No chats yet" or as the filter's empty state. */
export function isEmptyHistory(s: HistoryPaging): boolean {
  return s.phase === "idle" && s.cursor === null && s.items.length === 0;
}

/** The shapes of the loading cards that follow `loaded` chats: 4:5 and
 * 1.91:1, alternating by place in the grid (even places portrait), as the
 * frame draws its loading row, so the pattern carries on across pages. */
export function loadingShapes(
  loaded: number,
  count: number = HISTORY_LOADING_CARDS,
): Array<"portrait" | "landscape"> {
  return Array.from({ length: count }, (_, i) =>
    (loaded + i) % 2 === 0 ? "portrait" : "landscape",
  );
}

/** What the live region says once a page lands (PROMPT §8.6, proposed
 * copy): "Showing 12 chats", "Showing 1 chat". */
export function showingChats(n: number): string {
  return `Showing ${n} chat${n === 1 ? "" : "s"}`;
}
