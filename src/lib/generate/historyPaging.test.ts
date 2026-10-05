import { describe, expect, it } from "vitest";
import type { GenerateThreadSummary } from "../types";
import {
  HISTORY_PAGE_SIZE,
  canLoadMore,
  historyReducer,
  initialHistory,
  isEmptyHistory,
  loadingCount,
  pendingRequest,
  showingChats,
  type HistoryPaging,
} from "./historyPaging";

const chat = (n: number): GenerateThreadSummary => ({
  id: `chat-${n}`,
  title: `Chat ${n}`,
  platforms: ["instagram"],
  preview: null,
  templateId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
});

const chats = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => chat(from + i));

/** The list after the page it is waiting on lands. */
const land = (s: HistoryPaging, items: GenerateThreadSummary[], nextBefore: string | null) =>
  historyReducer(s, { type: "loaded", request: pendingRequest(s)!, items, nextBefore });

describe("historyReducer", () => {
  it("starts a filter loading its first page, with nothing to show", () => {
    const s = initialHistory("all");
    expect(s).toEqual({ filter: "all", items: [], cursor: undefined, phase: "loading" });
    expect(pendingRequest(s)).toEqual({ filter: "all", cursor: undefined });
    expect(canLoadMore(s)).toBe(false);
    expect(isEmptyHistory(s)).toBe(false);
  });

  it("keeps a full page and the cursor to the next", () => {
    const s = land(initialHistory("all"), chats(0, HISTORY_PAGE_SIZE), "c1");
    expect(s.items).toHaveLength(HISTORY_PAGE_SIZE);
    expect(s.cursor).toBe("c1");
    expect(s.phase).toBe("idle");
    expect(canLoadMore(s)).toBe(true);
    expect(pendingRequest(s)).toBeNull();
  });

  it("asks for the next page from the cursor and appends it", () => {
    let s = land(initialHistory("all"), chats(0, 12), "c1");
    s = historyReducer(s, { type: "more" });
    expect(pendingRequest(s)).toEqual({ filter: "all", cursor: "c1" });
    expect(canLoadMore(s)).toBe(false);
    s = land(s, chats(12, 12), "c2");
    expect(s.items.map((c) => c.id)).toEqual(chats(0, 24).map((c) => c.id));
    expect(s.cursor).toBe("c2");
  });

  it("ends at a short page and asks for nothing more", () => {
    let s = land(initialHistory("all"), chats(0, 12), "c1");
    s = land(historyReducer(s, { type: "more" }), chats(12, 5), null);
    expect(s.cursor).toBeNull();
    expect(s.items).toHaveLength(17);
    expect(canLoadMore(s)).toBe(false);
    expect(historyReducer(s, { type: "more" })).toBe(s);
  });

  it("ends at a full page the store says is the last (no empty page after it)", () => {
    const s = land(initialHistory("all"), chats(0, 12), null);
    expect(s.cursor).toBeNull();
    expect(canLoadMore(s)).toBe(false);
  });

  it("treats a short page as the end even if the store sent a cursor", () => {
    const s = land(initialHistory("all"), chats(0, 3), "stray");
    expect(s.cursor).toBeNull();
  });

  it("reads an empty first page as an empty list", () => {
    const s = land(initialHistory("all"), [], null);
    expect(isEmptyHistory(s)).toBe(true);
    expect(s.items).toEqual([]);
  });

  it("ignores a second 'more' while a page is loading", () => {
    let s = land(initialHistory("all"), chats(0, 12), "c1");
    s = historyReducer(s, { type: "more" });
    expect(historyReducer(s, { type: "more" })).toBe(s);
  });

  it("starts over when the filter changes, and drops the old filter's late page", () => {
    let s = land(initialHistory("all"), chats(0, 12), "c1");
    s = historyReducer(s, { type: "more" });
    const late = pendingRequest(s)!;
    s = historyReducer(s, { type: "filter", filter: "instagram" });
    expect(s).toEqual(initialHistory("instagram"));
    const after = historyReducer(s, {
      type: "loaded",
      request: late,
      items: chats(12, 12),
      nextBefore: "c2",
    });
    expect(after).toBe(s);
    expect(historyReducer(s, { type: "failed", request: late })).toBe(s);
  });

  it("keeps the list when the same filter is set again", () => {
    const s = land(initialHistory("all"), chats(0, 12), "c1");
    expect(historyReducer(s, { type: "filter", filter: "all" })).toBe(s);
  });

  it("lands a page once: a second answer to the same request is dropped", () => {
    const start = land(initialHistory("all"), chats(0, 12), "c1");
    const loading = historyReducer(start, { type: "more" });
    const request = pendingRequest(loading)!;
    const once = historyReducer(loading, {
      type: "loaded",
      request,
      items: chats(12, 12),
      nextBefore: "c2",
    });
    const twice = historyReducer(once, {
      type: "loaded",
      request,
      items: chats(12, 12),
      nextBefore: "c2",
    });
    expect(twice).toBe(once);
    expect(twice.items).toHaveLength(24);
  });

  it("never shows a chat twice, even one that moved between pages", () => {
    let s = land(initialHistory("all"), chats(0, 12), "c1");
    s = historyReducer(s, { type: "more" });
    s = land(s, [chat(11), ...chats(12, 11)], "c2");
    const ids = s.items.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(23);
    // The cursor still comes from the store: the page was full.
    expect(s.cursor).toBe("c2");
  });

  it("keeps what loaded when a page fails, and retries that same page", () => {
    let s = land(initialHistory("all"), chats(0, 12), "c1");
    s = historyReducer(s, { type: "more" });
    s = historyReducer(s, { type: "failed", request: pendingRequest(s)! });
    expect(s.phase).toBe("error");
    expect(s.items).toHaveLength(12);
    expect(canLoadMore(s)).toBe(false);
    expect(historyReducer(s, { type: "more" })).toBe(s);
    s = historyReducer(s, { type: "retry" });
    expect(pendingRequest(s)).toEqual({ filter: "all", cursor: "c1" });
    s = land(s, chats(12, 2), null);
    expect(s.items).toHaveLength(14);
    expect(s.cursor).toBeNull();
  });

  it("retries a failed first page from the start", () => {
    let s = initialHistory("all");
    s = historyReducer(s, { type: "failed", request: pendingRequest(s)! });
    expect(isEmptyHistory(s)).toBe(false);
    s = historyReducer(s, { type: "retry" });
    expect(pendingRequest(s)).toEqual({ filter: "all", cursor: undefined });
  });

  it("ignores retry unless a page failed", () => {
    const s = land(initialHistory("all"), chats(0, 12), "c1");
    expect(historyReducer(s, { type: "retry" })).toBe(s);
  });
});

describe("loadingCount", () => {
  it("is one whole row after a full row", () => {
    expect(loadingCount(12, 4)).toBe(4);
    expect(loadingCount(12, 3)).toBe(3);
    expect(loadingCount(24, 2)).toBe(2);
    expect(loadingCount(0, 3)).toBe(3);
  });

  it("finishes a partial last row", () => {
    expect(loadingCount(7, 4)).toBe(1);
    expect(loadingCount(12, 5)).toBe(3);
    expect(loadingCount(13, 2)).toBe(1);
  });

  it("is four before the grid has been measured", () => {
    expect(loadingCount(12, 0)).toBe(4);
    expect(loadingCount(0, Number.NaN)).toBe(4);
  });
});

describe("showingChats", () => {
  it("counts chats in the live region's words", () => {
    expect(showingChats(12)).toBe("Showing 12 chats");
    expect(showingChats(1)).toBe("Showing 1 chat");
    expect(showingChats(0)).toBe("Showing 0 chats");
  });
});
