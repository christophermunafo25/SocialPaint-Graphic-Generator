// Model usage metering (migration 0039, ai_usage_events). Every Anthropic
// response's `usage` becomes one row, written with the service role so a
// member can never forge or erase it. Pure apart from the one insert, and
// that insert is injected, so the same code runs in Deno and under vitest.
//
// Logging never fails the member's request: an insert error, or a throw, is
// logged and swallowed. The caller awaits it, so it delays the response by
// the insert and nothing more.

import { logError } from "./http.ts";

export type UsageFn = "template-generate" | "template-autobuild" | "brand-from-website";

/** What the call was for. A validation retry is a second paid call and is
 * logged as "retry" whatever it retried. */
export type UsageKind = "generate" | "retry" | "repair" | "freestyle" | "autobuild" | "brand";

/** The Anthropic response's usage object, as far as this reads it. Every
 * count is optional and untrusted: a missing or malformed one logs as 0. */
export interface AnthropicUsage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
}

export interface ModelUsageEntry {
  /** null for a call made before a company exists (brand-from-website). */
  companyId: string | null;
  userId: string | null;
  fn: UsageFn;
  kind: UsageKind;
  model: string;
  usage: AnthropicUsage | null | undefined;
}

/** The ai_usage_events row for one model call. */
export interface UsageRow {
  company_id: string | null;
  user_id: string | null;
  fn: UsageFn;
  kind: UsageKind;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

/** The integer column's ceiling. A count past it is not a real response. */
const INT_MAX = 2_147_483_647;

function tokenCount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.floor(v), INT_MAX);
}

export function usageRow(entry: ModelUsageEntry): UsageRow {
  const u = entry.usage ?? {};
  return {
    company_id: entry.companyId,
    user_id: entry.userId,
    fn: entry.fn,
    kind: entry.kind,
    model: entry.model,
    input_tokens: tokenCount(u.input_tokens),
    output_tokens: tokenCount(u.output_tokens),
    cache_read_tokens: tokenCount(u.cache_read_input_tokens),
    cache_write_tokens: tokenCount(u.cache_creation_input_tokens),
  };
}

/** The slice of a Supabase client this needs: one insert. */
export interface UsageDb {
  from(table: "ai_usage_events"): {
    insert(row: UsageRow): PromiseLike<{ error: unknown }>;
  };
}

/** Insert one ai_usage_events row. Never throws. */
export async function recordModelUsage(db: UsageDb, entry: ModelUsageEntry): Promise<void> {
  try {
    const { error } = await db.from("ai_usage_events").insert(usageRow(entry));
    if (error) logError(entry.fn, error);
  } catch (e) {
    logError(entry.fn, e);
  }
}
