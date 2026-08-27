import type { DailyActivityPoint, UsageAction, UsageActor } from "../types";

/** Bucket raw usage events into a continuous run of the last `days` days
 * (zero-filled — the trend chart needs every day present). Shared by both
 * backends so the Insights chart is backend-agnostic. */
export function bucketDailyActivity(
  events: Array<{ action: UsageAction; createdAt: string; actor?: UsageActor }>,
  days: number,
): DailyActivityPoint[] {
  const byDay = new Map<string, DailyActivityPoint>();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, opens: 0, downloads: 0, publicOpens: 0, publicDownloads: 0 });
  }
  for (const e of events) {
    const point = byDay.get(e.createdAt.slice(0, 10));
    if (!point) continue; // older than the window
    // An event with no actor is a member event: the column was added after
    // the fact and backfilled that way, and the local dev backend has no
    // public links at all.
    const viaLink = e.actor === "public";
    if (e.action === "open") {
      point.opens += 1;
      if (viaLink) point.publicOpens += 1;
    } else {
      point.downloads += 1;
      if (viaLink) point.publicDownloads += 1;
    }
  }
  return [...byDay.values()];
}
