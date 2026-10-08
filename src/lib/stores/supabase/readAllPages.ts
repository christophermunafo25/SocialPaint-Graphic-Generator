/** One page of a PostgREST read: the rows, or the error. */
export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Every row of a read, a page at a time (PHASE-8.md §9 D3).
 *
 * PostgREST returns at most its "Max rows" per response (1000 by default)
 * and says nothing when it stops early, so an unpaged read silently drops
 * rows once a workspace grows. `page(from, to)` must build a FRESH query
 * with a stable order (created_at, then id) and `.range(from, to)`; this
 * asks for pages until one comes back empty, advancing by the rows it
 * actually got, so the read is complete whatever the server's cap is.
 */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}
