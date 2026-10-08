import { describe, expect, it } from "vitest";
import { readAllPages } from "./readAllPages";

/** A table behind a server that returns at most `cap` rows per response,
 * however many are asked for, as PostgREST's "Max rows" does. */
function cappedTable(total: number, cap: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  let requests = 0;
  const page = async (from: number, to: number) => {
    requests++;
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { page, requests: () => requests };
}

describe("readAllPages (PHASE-8 §9 D3)", () => {
  it("reads every row past the default 1,000-row cap", async () => {
    const t = cappedTable(2500, 1000);
    const rows = await readAllPages(t.page);
    expect(rows).toHaveLength(2500);
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
  });

  it("stays complete when the server's cap is lower than the page asked for", async () => {
    const t = cappedTable(2500, 300);
    expect(await readAllPages(t.page)).toHaveLength(2500);
  });

  it("reads an empty table in one request, and a short one in two", async () => {
    const empty = cappedTable(0, 1000);
    expect(await readAllPages(empty.page)).toEqual([]);
    expect(empty.requests()).toBe(1);
    const short = cappedTable(10, 1000);
    expect(await readAllPages(short.page)).toHaveLength(10);
    expect(short.requests()).toBe(2);
  });

  it("throws the read's error", async () => {
    await expect(
      readAllPages(async () => ({ data: null, error: new Error("denied") })),
    ).rejects.toThrow("denied");
  });
});
