import { describe, expect, it } from "vitest";
import {
  THREAD_PAGE_MAX,
  THREAD_TITLE_MAX,
  clampThreadTitle,
  comesAfter,
  compareThreadKeys,
  decodeThreadCursor,
  encodeThreadCursor,
  isUuid,
  keysetFilter,
  normalizeThreadInput,
  pageLimit,
  pageOf,
  platformsInOrder,
  titleMatches,
  titleSearchPattern,
  type ThreadKey,
} from "./generateThreads";

const PG_TIME = "2026-09-26T10:15:30.123456+00:00";
const UUID_A = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("thread cursor", () => {
  it("round-trips a Postgres timestamp and a uuid exactly", () => {
    const key = { updatedAt: PG_TIME, id: UUID_A };
    expect(decodeThreadCursor(encodeThreadCursor(key))).toEqual(key);
  });

  it("round-trips a toISOString timestamp and the local fallback id", () => {
    const key = { updatedAt: "2026-09-26T10:15:30.123Z", id: "id-1758881730123-k3j2h1" };
    expect(decodeThreadCursor(encodeThreadCursor(key))).toEqual(key);
  });

  it("is opaque and URL-safe", () => {
    const cursor = encodeThreadCursor({ updatedAt: PG_TIME, id: UUID_A });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain(UUID_A);
  });

  it("refuses anything it could not have produced", () => {
    const forge = (v: unknown) =>
      btoa(JSON.stringify(v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const bad = [
      "",
      "not a cursor",
      forge(null),
      forge([PG_TIME]),
      forge([PG_TIME, UUID_A, "extra"]),
      forge({ updatedAt: PG_TIME, id: UUID_A }),
      forge(["yesterday", UUID_A]),
      forge([PG_TIME, 'x",id.gt."0']),
      forge([`${PG_TIME}),or(id.gt.0`, UUID_A]),
      forge([PG_TIME, ""]),
    ];
    for (const cursor of bad) expect(() => decodeThreadCursor(cursor), cursor).toThrow();
  });
});

describe("keyset paging on (updatedAt desc, id desc)", () => {
  it("orders by updatedAt, newest first, then by id, highest first", () => {
    const keys: ThreadKey[] = [
      { updatedAt: "2026-09-01T00:00:00.000Z", id: "b" },
      { updatedAt: "2026-09-02T00:00:00.000Z", id: "a" },
      { updatedAt: "2026-09-01T00:00:00.000Z", id: "c" },
    ];
    expect([...keys].sort(compareThreadKeys).map((k) => k.id)).toEqual(["a", "c", "b"]);
  });

  it("names the rows after a cursor, never the cursor's own row", () => {
    const cursor = { updatedAt: "2026-09-01T00:00:00.000Z", id: "m" };
    expect(comesAfter({ updatedAt: "2026-08-31T23:59:59.999Z", id: "z" }, cursor)).toBe(true);
    expect(comesAfter({ updatedAt: cursor.updatedAt, id: "l" }, cursor)).toBe(true);
    expect(comesAfter(cursor, cursor)).toBe(false);
    expect(comesAfter({ updatedAt: cursor.updatedAt, id: "n" }, cursor)).toBe(false);
    expect(comesAfter({ updatedAt: "2026-09-01T00:00:00.001Z", id: "a" }, cursor)).toBe(false);
  });

  // The local store's exact pipeline, over rows that share timestamps in
  // runs longer than a page.
  const pageThrough = (rows: ThreadKey[], limit: number) => {
    const sorted = [...rows].sort(compareThreadKeys);
    const pages: ThreadKey[][] = [];
    let before: string | null = null;
    for (let guard = 0; guard < 100; guard++) {
      const cursor: ThreadKey | null = before ? decodeThreadCursor(before) : null;
      const fetched: ThreadKey[] = sorted
        .filter((r) => !cursor || comesAfter(r, cursor))
        .slice(0, limit + 1);
      const page: { items: ThreadKey[]; nextBefore: string | null } = pageOf(fetched, limit);
      pages.push(page.items);
      before = page.nextBefore;
      if (!before) break;
    }
    return { sorted, pages };
  };

  const rowsWithTies = (n: number): ThreadKey[] =>
    Array.from({ length: n }, (_, i) => ({
      // Five chats per instant, so ties straddle every page boundary.
      updatedAt: `2026-09-${String(10 + Math.floor(i / 5)).padStart(2, "0")}T12:00:00.000Z`,
      id: `id-${String(i).padStart(3, "0")}`,
    }));

  it("visits every chat exactly once, in order, when timestamps tie across pages", () => {
    const { sorted, pages } = pageThrough(rowsWithTies(30), 12);
    expect(pages.map((p) => p.length)).toEqual([12, 12, 6]);
    expect(pages.flat()).toEqual(sorted);
  });

  it("ends without an empty page when the count is an exact multiple", () => {
    const { sorted, pages } = pageThrough(rowsWithTies(24), 12);
    expect(pages.map((p) => p.length)).toEqual([12, 12]);
    expect(pages.flat()).toEqual(sorted);
  });

  it("says there is no next page when a page comes back short", () => {
    expect(pageOf(rowsWithTies(3), 12).nextBefore).toBeNull();
    expect(pageOf([], 12)).toEqual({ items: [], nextBefore: null });
  });

  it("names the page's last row, not the extra one", () => {
    const rows = rowsWithTies(5);
    const page = pageOf(rows, 4);
    expect(page.items).toEqual(rows.slice(0, 4));
    expect(decodeThreadCursor(page.nextBefore!)).toEqual(rows[3]);
  });

  it("writes the same predicate as a PostgREST filter, values quoted", () => {
    expect(keysetFilter({ updatedAt: PG_TIME, id: UUID_A })).toBe(
      `updated_at.lt."${PG_TIME}",and(updated_at.eq."${PG_TIME}",id.lt."${UUID_A}")`,
    );
  });

  it("keeps page sizes whole and bounded", () => {
    expect(pageLimit(12)).toBe(12);
    expect(pageLimit(4.7)).toBe(4);
    expect(pageLimit(0)).toBe(1);
    expect(pageLimit(-3)).toBe(1);
    expect(pageLimit(Number.NaN)).toBe(1);
    expect(pageLimit(10_000)).toBe(THREAD_PAGE_MAX);
  });
});

describe("title search", () => {
  it("is absent for a blank query", () => {
    expect(titleSearchPattern(undefined)).toBeNull();
    expect(titleSearchPattern("")).toBeNull();
    expect(titleSearchPattern("   ")).toBeNull();
  });

  it("wraps the trimmed text for a substring match", () => {
    expect(titleSearchPattern("  hiring ")).toBe("%hiring%");
  });

  it("matches % _ and \\ literally", () => {
    expect(titleSearchPattern("50% off")).toBe("%50\\% off%");
    expect(titleSearchPattern("q3_launch")).toBe("%q3\\_launch%");
    expect(titleSearchPattern("a\\b")).toBe("%a\\\\b%");
  });

  it("turns * into a one-character wildcard, since PostgREST reads * as %", () => {
    expect(titleSearchPattern("5*")).toBe("%5_%");
    expect(titleSearchPattern("\\*_")).toBe("%\\\\_\\_%");
  });

  it("matches locally without pattern syntax, ignoring case", () => {
    expect(titleMatches("Creative Director post", "director")).toBe(true);
    expect(titleMatches("Creative Director post", "  DIRECTOR ")).toBe(true);
    expect(titleMatches("50% off", "50%")).toBe(true);
    expect(titleMatches("Creative Director post", "%")).toBe(false);
    expect(titleMatches("Anything", undefined)).toBe(true);
    expect(titleMatches("Anything", " ")).toBe(true);
  });

  it("reads * locally as the one-character wildcard Supabase gets", () => {
    // titleSearchPattern("Q*") is %Q_%: a Q with one character after it.
    expect(titleMatches("Q3 promo", "Q*")).toBe(true);
    expect(titleMatches("Big Q", "Q*")).toBe(false);
    expect(titleMatches("5* review", "5*")).toBe(true);
    expect(titleMatches("a.b (c) [d]", "a.b (c) [d]")).toBe(true);
    expect(titleMatches("axb", "a.b")).toBe(false);
    expect(titleMatches("price $5+", "$5+")).toBe(true);
  });
});

describe("platformsInOrder", () => {
  it("returns the distinct set in PLATFORMS order", () => {
    expect(platformsInOrder(["facebook", "instagram", "linkedin", "instagram"])).toEqual([
      "linkedin",
      "instagram",
      "facebook",
    ]);
  });

  it("drops ids this build does not know", () => {
    expect(platformsInOrder(["myspace", "general", "x"])).toEqual(["x", "general"]);
  });

  it("is empty for no chats", () => {
    expect(platformsInOrder([])).toEqual([]);
  });
});

describe("clampThreadTitle", () => {
  it("leaves a title the column accepts alone", () => {
    const title = "t".repeat(THREAD_TITLE_MAX);
    expect(clampThreadTitle(title)).toBe(title);
  });

  it("cuts a long title to the column's limit", () => {
    expect(clampThreadTitle("t".repeat(200))).toHaveLength(THREAD_TITLE_MAX);
  });

  it("counts code points as Postgres does, never splitting an emoji", () => {
    const title = "🎨".repeat(THREAD_TITLE_MAX + 5);
    const clamped = clampThreadTitle(title);
    expect(Array.from(clamped)).toHaveLength(THREAD_TITLE_MAX);
    expect(clamped).toBe("🎨".repeat(THREAD_TITLE_MAX));
    // Exactly at the limit in code points, though twice that in UTF-16.
    expect(clampThreadTitle("🎨".repeat(THREAD_TITLE_MAX))).toBe("🎨".repeat(THREAD_TITLE_MAX));
  });
});

describe("normalizeThreadInput", () => {
  it("clamps the title and orders the platforms, passing the rest through", () => {
    const turns = [
      {
        id: "u1",
        role: "user" as const,
        text: "Hiring post",
        createdAt: "2026-09-26T10:00:00.000Z",
        variations: 2,
        intent: "brief" as const,
      },
    ];
    const preview = { templateId: "t-1", values: {}, canvas: { width: 1080, height: 1350 } };
    const out = normalizeThreadInput({
      title: "x".repeat(130),
      platforms: ["instagram", "linkedin"],
      preview,
      templateId: "t-1",
      turns,
    });
    expect(out.title).toHaveLength(THREAD_TITLE_MAX);
    expect(out.platforms).toEqual(["linkedin", "instagram"]);
    expect(out.preview).toBe(preview);
    expect(out.turns).toBe(turns);
    expect(out.templateId).toBe("t-1");
  });
});

describe("isUuid", () => {
  it("accepts a uuid in either case and nothing else", () => {
    expect(isUuid(UUID_A)).toBe(true);
    expect(isUuid(UUID_A.toUpperCase())).toBe(true);
    expect(isUuid("id-1758881730123-k3j2h1")).toBe(false);
    expect(isUuid("new")).toBe(false);
    expect(isUuid(`${UUID_A} `)).toBe(false);
  });
});
