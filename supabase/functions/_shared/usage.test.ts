import { describe, expect, it, vi } from "vitest";
import { recordModelUsage, usageRow, type ModelUsageEntry, type UsageDb } from "./usage.ts";

const entry = (overrides: Partial<ModelUsageEntry> = {}): ModelUsageEntry => ({
  companyId: "ca700000-0000-4000-8000-00000000000a",
  userId: "u1",
  fn: "template-generate",
  kind: "generate",
  model: "claude-sonnet-4-6",
  usage: {
    input_tokens: 1200,
    output_tokens: 300,
    cache_read_input_tokens: 900,
    cache_creation_input_tokens: 40,
  },
  ...overrides,
});

/** A fake client that records every insert and answers with `result`. */
function fakeDb(result: () => Promise<{ error: unknown }>) {
  const rows: unknown[] = [];
  const tables: string[] = [];
  const db: UsageDb = {
    from(table) {
      tables.push(table);
      return {
        insert(row) {
          rows.push(row);
          return result();
        },
      };
    },
  };
  return { db, rows, tables };
}

describe("usageRow", () => {
  it("maps Anthropic's usage names onto the table's columns", () => {
    expect(usageRow(entry())).toEqual({
      company_id: "ca700000-0000-4000-8000-00000000000a",
      user_id: "u1",
      fn: "template-generate",
      kind: "generate",
      model: "claude-sonnet-4-6",
      input_tokens: 1200,
      output_tokens: 300,
      cache_read_tokens: 900,
      cache_write_tokens: 40,
    });
  });

  it("logs a missing or malformed count as 0", () => {
    const row = usageRow(
      entry({ usage: { input_tokens: "12", output_tokens: -3, cache_read_input_tokens: NaN } }),
    );
    expect(row).toMatchObject({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    });
    expect(usageRow(entry({ usage: undefined })).input_tokens).toBe(0);
    expect(usageRow(entry({ usage: null })).output_tokens).toBe(0);
  });

  it("keeps a null company for a call made before one exists", () => {
    const row = usageRow(entry({ companyId: null, fn: "brand-from-website", kind: "brand" }));
    expect(row.company_id).toBeNull();
    expect(row.fn).toBe("brand-from-website");
  });
});

describe("recordModelUsage", () => {
  it("inserts one row into ai_usage_events", async () => {
    const { db, rows, tables } = fakeDb(async () => ({ error: null }));
    await recordModelUsage(db, entry({ kind: "retry" }));
    expect(tables).toEqual(["ai_usage_events"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "retry", input_tokens: 1200 });
  });

  it("never throws when the insert fails or the client throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = fakeDb(async () => ({ error: { message: "permission denied" } }));
    await expect(recordModelUsage(failing.db, entry())).resolves.toBeUndefined();
    const throwing = fakeDb(() => Promise.reject(new Error("network down")));
    await expect(recordModelUsage(throwing.db, entry())).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
