import type { DailyActivityPoint, UsageAction, UsageActor } from "../types";

/** YYYY-MM-DD of an instant in an IANA zone. en-CA is the locale whose
 * short date IS that format. An unknown zone falls back to UTC rather than
 * throwing — a bad timezone string must degrade the chart, not kill it. */
export function dayKeyInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Bucket raw usage events into a continuous run of the last `days` days
 * (zero-filled — the trend chart needs every day present). Shared by both
 * backends so the Insights chart is backend-agnostic.
 *
 * Day boundaries follow `timeZone` (the workspace's zone), not the viewer's
 * browser — two admins in different places read the same chart. The window
 * itself is pure calendar math: today's key in the zone, then previous keys
 * by UTC date arithmetic on it, so a DST shift can never skip or double a
 * bucket. */
export function bucketDailyActivity(
  events: Array<{ action: UsageAction; createdAt: string; actor?: UsageActor }>,
  days: number,
  // The caller's own zone when none is given — what the chart always did.
  timeZone: string = new Intl.DateTimeFormat().resolvedOptions().timeZone,
): DailyActivityPoint[] {
  const byDay = new Map<string, DailyActivityPoint>();
  const [y, m, d] = dayKeyInZone(new Date().toISOString(), timeZone).split("-").map(Number);
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10);
    byDay.set(key, {
      date: key,
      opens: 0,
      downloads: 0,
      publicOpens: 0,
      publicDownloads: 0,
      bulkExports: 0,
    });
  }
  for (const e of events) {
    const point = byDay.get(dayKeyInZone(e.createdAt, timeZone));
    if (!point) continue; // older than the window
    // An event with no actor is a member event: the column was added after
    // the fact and backfilled that way, and the local dev backend has no
    // public links at all.
    const viaLink = e.actor === "public";
    // Every action is named. An `else` here would have quietly folded
    // shares into downloads the day a third action was added.
    if (e.action === "open") {
      point.opens += 1;
      if (viaLink) point.publicOpens += 1;
    } else if (e.action === "download") {
      point.downloads += 1;
      if (viaLink) point.publicDownloads += 1;
    } else if (e.action === "bulk_export") {
      point.bulkExports += 1;
    }
  }
  return [...byDay.values()];
}
