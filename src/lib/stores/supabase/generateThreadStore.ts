import type {
  GenerateThreadInput,
  GenerateThreadPreview,
  GenerateThreadRecord,
  GenerateThreadSummary,
  StoredTurn,
} from "../../types";
import type { PlatformId } from "../../templates/platforms";
import type { GenerateThreadStore } from "../interfaces";
import { assertNoDataUrls } from "../../generate/dataUrls";
import {
  decodeThreadCursor,
  isUuid,
  keysetFilter,
  normalizeThreadInput,
  pageLimit,
  pageOf,
  platformsInOrder,
  titleSearchPattern,
} from "../generateThreads";
import { supabase } from "./client";

interface ThreadSummaryRow {
  id: string;
  title: string;
  platforms: string[] | null;
  preview: GenerateThreadPreview | null;
  created_at: string;
  updated_at: string;
}

interface ThreadRow extends ThreadSummaryRow {
  turns: StoredTurn[] | null;
}

/** Recent and History never need a chat's turns, which are most of its
 * bytes: a list selects these and nothing else. */
const SUMMARY_COLUMNS = "id, title, platforms, preview, created_at, updated_at";
const RECORD_COLUMNS = `${SUMMARY_COLUMNS}, turns`;

/** Rows per request while collecting the platforms in use. The loop runs
 * until a request comes back empty, so a project whose max-rows setting is
 * below this still sees every chat. */
const PLATFORM_SCAN_PAGE = 1000;

// updated_at keeps the string Postgres wrote, microseconds and all: it is
// half of the History cursor, and a value rounded through Date would no
// longer equal the row it came from.
const toSummary = (r: ThreadSummaryRow): GenerateThreadSummary => ({
  id: r.id,
  title: r.title,
  platforms: platformsInOrder(r.platforms ?? []),
  preview: r.preview ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRecord = (r: ThreadRow): GenerateThreadRecord => ({
  ...toSummary(r),
  turns: r.turns ?? [],
});

/** The columns a write sets. The data: check runs first and throws, so a
 * photo that slipped past threadStorage still never reaches the request. */
function toRow(input: GenerateThreadInput) {
  assertNoDataUrls(input);
  const { title, platforms, preview, turns } = normalizeThreadInput(input);
  return { title, platforms, preview, turns };
}

/** generate_threads (0038). Every policy on the table is
 * user_id = auth.uid() and company_id in current_company_ids(), so RLS is
 * what makes these the signed-in member's own chats; the explicit
 * company_id filter keeps a member of two workspaces in the one they are
 * looking at. user_id is never sent: the column defaults to auth.uid(). */
export class SupabaseGenerateThreadStore implements GenerateThreadStore {
  async list(
    companyId: string,
    opts: { limit: number; before?: string; platform?: PlatformId; q?: string },
  ): Promise<{ items: GenerateThreadSummary[]; nextBefore: string | null }> {
    const limit = pageLimit(opts.limit);
    let q = supabase().from("generate_threads").select(SUMMARY_COLUMNS).eq("company_id", companyId);
    if (opts.platform) q = q.contains("platforms", [opts.platform]);
    const pattern = titleSearchPattern(opts.q);
    if (pattern) q = q.ilike("title", pattern);
    // Keyset, not offset: a chat saved while the member scrolls moves to the
    // top without shifting what the next page holds. The lte bound is an
    // index condition on (company_id, user_id, updated_at desc), so a later
    // page starts reading at the cursor instead of walking every earlier
    // chat; the or filter settles ties on id.
    if (opts.before) {
      const key = decodeThreadCursor(opts.before);
      q = q.lte("updated_at", key.updatedAt).or(keysetFilter(key));
    }
    const { data, error } = await q
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (error) throw error;
    return pageOf((data as ThreadSummaryRow[]).map(toSummary), limit);
  }

  async platformsInUse(companyId: string): Promise<PlatformId[]> {
    const seen = new Set<string>();
    for (let from = 0; ;) {
      const { data, error } = await supabase()
        .from("generate_threads")
        .select("platforms")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PLATFORM_SCAN_PAGE - 1);
      if (error) throw error;
      const rows = data as Array<{ platforms: string[] | null }>;
      if (rows.length === 0) break;
      for (const r of rows) for (const p of r.platforms ?? []) seen.add(p);
      from += rows.length;
    }
    return platformsInOrder(seen);
  }

  async get(companyId: string, id: string): Promise<GenerateThreadRecord | null> {
    // /generate/c/<id> can carry anything; Postgres answers a malformed uuid
    // with an error, not an empty result.
    if (!isUuid(id)) return null;
    const { data, error } = await supabase()
      .from("generate_threads")
      .select(RECORD_COLUMNS)
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data as ThreadRow) : null;
  }

  async create(companyId: string, input: GenerateThreadInput): Promise<GenerateThreadRecord> {
    const row = toRow(input);
    // updated_at from the same clock every later update stamps it with, so
    // a chat's place in History never depends on the gap between the
    // member's clock and the server's.
    const { data, error } = await supabase()
      .from("generate_threads")
      .insert({ company_id: companyId, ...row, updated_at: new Date().toISOString() })
      .select(RECORD_COLUMNS)
      .single();
    if (error) throw error;
    return toRecord(data as ThreadRow);
  }

  async update(companyId: string, id: string, input: GenerateThreadInput): Promise<void> {
    const row = toRow(input);
    if (!isUuid(id)) throw new Error(`Chat ${id} not found`);
    // No updated_at trigger in this schema (see 0038): the store stamps it.
    const { data, error } = await supabase()
      .from("generate_threads")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    // RLS filters a row it hides out of the UPDATE, so a chat deleted
    // elsewhere matches nothing rather than erroring. Say so: the page keeps
    // "not saved yet" up instead of believing a write that never landed.
    if (!data || data.length === 0) throw new Error(`Chat ${id} not found`);
  }

  async remove(companyId: string, id: string): Promise<void> {
    if (!isUuid(id)) return;
    const { error } = await supabase()
      .from("generate_threads")
      .delete()
      .eq("company_id", companyId)
      .eq("id", id);
    if (error) throw error;
  }
}
