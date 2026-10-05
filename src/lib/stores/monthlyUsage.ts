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
    bulkExports: 0,
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
    } else if (e.action === "bulk_export") {
      out.bulkExports += 1;
    }
  }
  out.templatesUsed = templates.size;
  out.membersActive = members.size;
  return out;
}

/** The exact first instant of the current calendar month in `timeZone`
 * (local midnight on the 1st), as an ISO string. Unlike monthStartIso this
 * is not padded: the AI usage totals are summed by the database from this
 * bound, with no second pass to drop events from last month. `now` is for
 * tests. An unknown zone reads as UTC. */
export function exactMonthStartIso(timeZone: string, now: Date = new Date()): string {
  const parts = (d: Date) => {
    try {
      const f = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).formatToParts(d);
      const get = (t: string) => Number(f.find((p) => p.type === t)?.value);
      return {
        y: get("year"),
        m: get("month"),
        d: get("day"),
        h: get("hour"),
        mi: get("minute"),
        s: get("second"),
      };
    } catch {
      return {
        y: d.getUTCFullYear(),
        m: d.getUTCMonth() + 1,
        d: d.getUTCDate(),
        h: d.getUTCHours(),
        mi: d.getUTCMinutes(),
        s: d.getUTCSeconds(),
      };
    }
  };
  const { y, m } = parts(now);
  // Midnight on the 1st as if the zone were UTC, then corrected by the
  // zone's offset at that instant (twice, so a DST change is settled).
  let guess = Date.UTC(y, m - 1, 1);
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    guess += Date.UTC(y, m - 1, 1) - asUtc;
  }
  return new Date(guess).toISOString();
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** A token count as Settings' AI usage card shows it: "1.2M", "318.4K". */
export const compactCount = (n: number): string => compact.format(n);

/** Settings' AI usage line (template-chat PROMPT §15, proposed copy):
 * "128 requests · 412K tokens in · 38K out, this month". */
export function aiUsageLine(u: { requests: number; inputTokens: number; outputTokens: number }) {
  const requests = `${u.requests.toLocaleString("en")} request${u.requests === 1 ? "" : "s"}`;
  return `${requests} · ${compact.format(u.inputTokens)} tokens in · ${compact.format(u.outputTokens)} out, this month`;
}
