import type { MonthlyUsage, UsageAction, UsageActor } from "../types";
import { dayKeyInZone } from "./dailyActivity";

/** First instant of the current calendar month in `timeZone`, as an ISO
 * string usable in a created_at >= filter. Approximate by construction: the
 * month boundary is computed as UTC midnight of the zone's current
 * YYYY-MM-01, which can be off by the zone offset at the edge — the shared
 * summarizer below re-checks each event's month key, so the filter only has
 * to be generous, not exact. */
export function monthStartIso(timeZone: string): string {
  const key = dayKeyInZone(new Date().toISOString(), timeZone);
  const [y, m] = key.split("-").map(Number);
  // One day of slack either side of the UTC boundary covers every offset.
  return new Date(Date.UTC(y, m - 1, 1) - 24 * 3600 * 1000).toISOString();
}

/** Reduce raw events to the Usage section's month card. Shared by both
 * backends so the numbers cannot disagree between dev and production. Events
 * outside the zone's current month are dropped here (see monthStartIso). */
export function summarizeMonthlyUsage(
  events: Array<{
    templateId: string;
    userId: string | null;
    action: UsageAction;
    actor?: UsageActor;
    createdAt: string;
  }>,
  timeZone: string,
): MonthlyUsage {
  const monthKey = dayKeyInZone(new Date().toISOString(), timeZone).slice(0, 7);
  const templates = new Set<string>();
  const members = new Set<string>();
  const out: MonthlyUsage = {
    opens: 0,
    downloads: 0,
    publicOpens: 0,
    templatesUsed: 0,
    membersActive: 0,
  };
  for (const e of events) {
    if (dayKeyInZone(e.createdAt, timeZone).slice(0, 7) !== monthKey) continue;
    templates.add(e.templateId);
    if (e.userId) members.add(e.userId);
    // Named explicitly — see the note in 0027_share_events.sql.
    if (e.action === "open") {
      out.opens += 1;
      if (e.actor === "public") out.publicOpens += 1;
    } else if (e.action === "download") {
      out.downloads += 1;
    }
  }
  out.templatesUsed = templates.size;
  out.membersActive = members.size;
  return out;
}
