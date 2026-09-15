// The one-screen Insights page's aggregation (2026-09-15), kept pure so
// every counting rule is testable without a database — the pattern set by
// dailyActivity.ts and monthlyUsage.ts. The store hands over raw events
// (getInsightEvents) and this module does ALL the counting, so the numbers
// cannot disagree between the dev and production backends.
//
// Counting rules carried from types.ts and enforced here:
// - Exports are `download` events. A bulk_export is NEVER an export — a
//   bulk run has no opens, and folding it in would break the export rate.
// - Public events are member-equivalent, counted ONCE: one fill through a
//   link is one open and one export, the same as a member's — never added
//   on top.
// - Day, weekday, and month boundaries follow the WORKSPACE timezone
//   (company.timezone), exactly as dailyActivity.ts buckets days.

import type { InsightEvent, TemplateSchema } from "../types";
import type { Member } from "../stores/interfaces";
import { dayKeyInZone } from "../stores/dailyActivity";
import { aspectRatioOf, orientationOf } from "../templates/platforms";
import { ORIENTATION_LABEL } from "../templates/groups";

export type InsightsRange = "7d" | "30d" | "90d" | "12m";
export type InsightsMetric = "exports" | "opens" | "posted";

export const INSIGHTS_RANGES: readonly InsightsRange[] = ["7d", "30d", "90d", "12m"];
export const INSIGHTS_METRICS: readonly InsightsMetric[] = ["exports", "opens", "posted"];

/** "30 days" — the human name of a window, shared by the range control, the
 * chart legend ("Previous 30 days"), and the findings copy. */
export const RANGE_LABEL: Record<InsightsRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
};

/** How a KPI moved against the previous window of the same length (D3).
 * `percent` and `delta` are magnitudes — `direction` carries the sign.
 * A previous of zero with a current above zero is "new": a percentage
 * against nothing would be a fabrication. */
export interface InsightChange {
  direction: "up" | "down" | "flat" | "new";
  percent?: number;
  delta?: number;
}

export interface InsightKpi {
  current: number;
  previous: number;
  change: InsightChange;
}

/** One trend bucket. `date` is the CURRENT window's key (YYYY-MM-DD daily,
 * YYYY-MM on 12m); `previous` is the SAME POSITION in the previous window —
 * both windows carry the same bucket count so the dashed line aligns by
 * index rather than by date. */
export interface TrendPoint {
  date: string;
  current: number;
  previous: number;
}

export interface TopTemplate {
  templateId: string;
  name: string;
  exports: number;
}

export interface WeekdayInsight {
  /** Exports summed Monday..Sunday (current window, workspace zone). */
  totals: number[];
  /** Busiest weekday, 0 = Monday. Earliest index wins a tie. */
  busiest: number;
  /** Mean exports per Monday–Friday calendar day in the window. */
  weekdayAvg: number;
  /** Mean exports per Saturday/Sunday calendar day in the window. */
  weekendAvg: number;
}

export interface SizeSlice {
  /** From the catalogue helpers, never hand-written: "Portrait 4:5". */
  label: string;
  exports: number;
  /** Integer, and the slice percents sum to exactly 100 (largest-remainder
   * rounding) — a donut legend that adds to 99 reads as a bug. */
  percent: number;
}

/** Findings the aggregator can compute from events + templates + members.
 * The unopened-public-link finding needs getPublicLinkUsage and is joined
 * in by the page. Numbers only — copy belongs to the rendering. */
export type InsightFinding =
  | { kind: "templateShare"; templateId: string; name: string; percent: number }
  | { kind: "inactiveMembers"; count: number }
  | { kind: "postingSlipped"; percent: number }
  | { kind: "unusedTemplates"; count: number };

/** One template's numbers in the window — the Export CSV rows. */
export interface InsightTemplateRow {
  templateId: string;
  name: string;
  opens: number;
  exports: number;
  posted: number;
  /** Rendered by bulk fill. Beside exports, never inside them. */
  bulk: number;
  /** The subset of `exports` that came through a public link. */
  publicDownloads: number;
  lastUsedAt: string | null;
}

export interface Insights {
  kpis: {
    exports: InsightKpi;
    opens: InsightKpi;
    posted: InsightKpi;
    activeMembers: InsightKpi;
  };
  /** Aligned current/previous series per metric. `members` counts DISTINCT
   * active members per bucket — the Active members sparkline. */
  series: {
    exports: TrendPoint[];
    opens: TrendPoint[];
    posted: TrendPoint[];
    members: TrendPoint[];
  };
  /** Top 5 by exports in the window; templates with zero exports never
   * appear (the card says "No exports in this range" instead). */
  topTemplates: TopTemplate[];
  weekday: WeekdayInsight;
  /** Exports by orientation-and-ratio label, largest first: top 3 plus
   * "Other" when more exist. Empty when the window has no sized exports. */
  sizes: SizeSlice[];
  findings: InsightFinding[];
  templateRows: InsightTemplateRow[];
}

const DAY_COUNT: Record<Exclude<InsightsRange, "12m">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Keys advance by UTC date arithmetic on the zone-local key — the
 * bucketDailyActivity trick, so a DST shift can never skip or double a
 * day. `endKey` inclusive, oldest first. */
function dayKeysEndingAt(endKey: string, count: number): string[] {
  const [y, m, d] = endKey.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return keys;
}

function daysBetween(startKey: string, endKey: string): string[] {
  const [y, m, d] = startKey.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 0; ; i++) {
    const key = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    keys.push(key);
    if (key >= endKey) break;
  }
  return keys;
}

function monthKeysEndingAt(endMonth: string, count: number): string[] {
  const [y, m] = endMonth.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }
  return keys;
}

/** 0 = Monday .. 6 = Sunday for a YYYY-MM-DD key. */
function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

interface InsightWindow {
  /** Every calendar day in the window, oldest first. */
  days: string[];
  /** Series bucket keys — the days themselves, or months on 12m. */
  buckets: string[];
  /** Bucket index for a day key, or -1 when the day is outside. */
  bucketIndex(dayKey: string): number;
}

function dailyWindow(days: string[]): InsightWindow {
  const index = new Map(days.map((k, i) => [k, i]));
  return { days, buckets: days, bucketIndex: (k) => index.get(k) ?? -1 };
}

function monthlyWindow(days: string[], months: string[]): InsightWindow {
  const index = new Map(months.map((k, i) => [k, i]));
  const daySet = new Set(days);
  return {
    days,
    buckets: months,
    bucketIndex: (k) => (daySet.has(k) ? (index.get(k.slice(0, 7)) ?? -1) : -1),
  };
}

function buildWindows(
  range: InsightsRange,
  timeZone: string,
  now: Date,
): { current: InsightWindow; previous: InsightWindow } {
  const todayKey = dayKeyInZone(now.toISOString(), timeZone);
  if (range === "12m") {
    const months = monthKeysEndingAt(todayKey.slice(0, 7), 24);
    const previousMonths = months.slice(0, 12);
    const currentMonths = months.slice(12);
    const currentDays = daysBetween(`${currentMonths[0]}-01`, todayKey);
    // The previous window runs through the day before the current one.
    const previousEnd = dayKeysEndingAt(currentDays[0], 2)[0];
    const previousDays = daysBetween(`${previousMonths[0]}-01`, previousEnd);
    return {
      current: monthlyWindow(currentDays, currentMonths),
      previous: monthlyWindow(previousDays, previousMonths),
    };
  }
  const n = DAY_COUNT[range];
  const currentDays = dayKeysEndingAt(todayKey, n);
  const previousEnd = dayKeysEndingAt(currentDays[0], 2)[0];
  const previousDays = dayKeysEndingAt(previousEnd, n);
  return { current: dailyWindow(currentDays), previous: dailyWindow(previousDays) };
}

/** Where the events fetch starts: the first day of the PREVIOUS window,
 * with a day of slack for the zone offset — the exact boundaries belong to
 * buildInsights, the filter only has to be generous (the monthStartIso
 * convention). */
export function insightWindowStartIso(
  range: InsightsRange,
  timeZone: string,
  now = new Date(),
): string {
  const { previous } = buildWindows(range, timeZone, now);
  const [y, m, d] = previous.days[0].split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString();
}

function changeOf(current: number, previous: number, mode: "percent" | "delta"): InsightChange {
  if (previous === 0) return current === 0 ? { direction: "flat" } : { direction: "new" };
  const diff = current - previous;
  if (diff === 0) return { direction: "flat" };
  const direction = diff > 0 ? ("up" as const) : ("down" as const);
  return mode === "percent"
    ? { direction, percent: Math.round((Math.abs(diff) / previous) * 100) }
    : { direction, delta: Math.abs(diff) };
}

/** Integer percentages that sum to exactly 100 (largest remainder). */
function percentagesOf(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return values.map(() => 0);
  const raw = values.map((v) => (v * 100) / total);
  const floors = raw.map(Math.floor);
  const out = [...floors];
  const spare = 100 - floors.reduce((a, b) => a + b, 0);
  const byRemainder = raw
    .map((v, i) => [v - floors[i], i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < spare; k++) out[byRemainder[k][1]] += 1;
  return out;
}

export function buildInsights(input: {
  events: InsightEvent[];
  templates: TemplateSchema[];
  members: Member[];
  range: InsightsRange;
  timeZone: string;
  now?: Date;
}): Insights {
  const { events, templates, members, range, timeZone } = input;
  const now = input.now ?? new Date();
  const { current, previous } = buildWindows(range, timeZone, now);

  const bucketCount = current.buckets.length;
  const zeros = () => new Array<number>(bucketCount).fill(0);
  const counts = {
    exports: { current: zeros(), previous: zeros() },
    opens: { current: zeros(), previous: zeros() },
    posted: { current: zeros(), previous: zeros() },
  };
  const memberBuckets = {
    current: Array.from({ length: bucketCount }, () => new Set<string>()),
    previous: Array.from({ length: bucketCount }, () => new Set<string>()),
  };
  const totals = {
    exports: { current: 0, previous: 0 },
    opens: { current: 0, previous: 0 },
    posted: { current: 0, previous: 0 },
  };
  const activeMembers = { current: new Set<string>(), previous: new Set<string>() };

  const templateById = new Map(templates.map((t) => [t.id, t]));
  const rowByTemplate = new Map<string, InsightTemplateRow>();
  const rowOf = (templateId: string): InsightTemplateRow => {
    let row = rowByTemplate.get(templateId);
    if (!row) {
      row = {
        templateId,
        name: templateById.get(templateId)?.name ?? "(deleted template)",
        opens: 0,
        exports: 0,
        posted: 0,
        bulk: 0,
        publicDownloads: 0,
        lastUsedAt: null,
      };
      rowByTemplate.set(templateId, row);
    }
    return row;
  };
  // Every template gets a CSV row, event-bearing or not — an admin
  // exporting the window wants the zeros too.
  for (const t of templates) rowOf(t.id);

  const weekdayTotals = new Array<number>(7).fill(0);
  const sizeCounts = new Map<string, number>();
  const sizeLabelOf = (t: TemplateSchema): string =>
    `${ORIENTATION_LABEL[orientationOf(t.canvasWidth, t.canvasHeight)]} ${aspectRatioOf(t.canvasWidth, t.canvasHeight)}`;
  /** Ids of templates with ANY event in the current window — the
   * unused-published-templates finding's complement. */
  const usedTemplates = new Set<string>();

  for (const e of events) {
    const dayKey = dayKeyInZone(e.createdAt, timeZone);
    const curIdx = current.bucketIndex(dayKey);
    const prevIdx = curIdx === -1 ? previous.bucketIndex(dayKey) : -1;
    if (curIdx === -1 && prevIdx === -1) continue;
    const win = curIdx !== -1 ? ("current" as const) : ("previous" as const);
    const idx = curIdx !== -1 ? curIdx : prevIdx;

    // Named explicitly — see the note in 0027_share_events.sql. A
    // bulk_export is deliberately absent from every metric tally.
    if (e.action === "download") {
      totals.exports[win] += 1;
      counts.exports[win][idx] += 1;
    } else if (e.action === "open") {
      totals.opens[win] += 1;
      counts.opens[win][idx] += 1;
    } else if (e.action === "share") {
      totals.posted[win] += 1;
      counts.posted[win][idx] += 1;
    }
    if (e.actor === "member" && e.userId) {
      activeMembers[win].add(e.userId);
      memberBuckets[win][idx].add(e.userId);
    }

    if (win !== "current") continue;

    usedTemplates.add(e.templateId);
    const row = rowOf(e.templateId);
    if (e.action === "download") {
      row.exports += 1;
      if (e.actor === "public") row.publicDownloads += 1;
      weekdayTotals[weekdayOf(dayKey)] += 1;
      const template = templateById.get(e.templateId);
      // A deleted template has no size left to group by; its export still
      // counts everywhere else.
      if (template) {
        const label = sizeLabelOf(template);
        sizeCounts.set(label, (sizeCounts.get(label) ?? 0) + 1);
      }
    } else if (e.action === "open") {
      row.opens += 1;
    } else if (e.action === "share") {
      row.posted += 1;
    } else if (e.action === "bulk_export") {
      row.bulk += 1;
    }
    if (!row.lastUsedAt || e.createdAt > row.lastUsedAt) row.lastUsedAt = e.createdAt;
  }

  const kpis = {
    exports: {
      current: totals.exports.current,
      previous: totals.exports.previous,
      change: changeOf(totals.exports.current, totals.exports.previous, "percent"),
    },
    opens: {
      current: totals.opens.current,
      previous: totals.opens.previous,
      change: changeOf(totals.opens.current, totals.opens.previous, "percent"),
    },
    posted: {
      current: totals.posted.current,
      previous: totals.posted.previous,
      change: changeOf(totals.posted.current, totals.posted.previous, "percent"),
    },
    activeMembers: {
      current: activeMembers.current.size,
      previous: activeMembers.previous.size,
      change: changeOf(activeMembers.current.size, activeMembers.previous.size, "delta"),
    },
  };

  const seriesOf = (metric: InsightsMetric): TrendPoint[] =>
    current.buckets.map((date, i) => ({
      date,
      current: counts[metric].current[i],
      previous: counts[metric].previous[i],
    }));
  const series = {
    exports: seriesOf("exports"),
    opens: seriesOf("opens"),
    posted: seriesOf("posted"),
    members: current.buckets.map((date, i) => ({
      date,
      current: memberBuckets.current[i].size,
      previous: memberBuckets.previous[i].size,
    })),
  };

  const templateRows = [...rowByTemplate.values()].sort(
    (a, b) => b.exports - a.exports || b.opens - a.opens || a.name.localeCompare(b.name),
  );
  const topTemplates: TopTemplate[] = templateRows
    .filter((r) => r.exports > 0)
    .slice(0, 5)
    .map((r) => ({ templateId: r.templateId, name: r.name, exports: r.exports }));

  // Busiest weekday: strict > so the EARLIEST index wins a tie.
  let busiest = 0;
  for (let i = 1; i < 7; i++) if (weekdayTotals[i] > weekdayTotals[busiest]) busiest = i;
  let weekdayDays = 0;
  let weekendDays = 0;
  for (const day of current.days) {
    if (weekdayOf(day) < 5) weekdayDays += 1;
    else weekendDays += 1;
  }
  const weekdayExports = weekdayTotals.slice(0, 5).reduce((a, b) => a + b, 0);
  const weekendExports = weekdayTotals[5] + weekdayTotals[6];
  const weekday: WeekdayInsight = {
    totals: weekdayTotals,
    busiest,
    weekdayAvg: weekdayDays === 0 ? 0 : weekdayExports / weekdayDays,
    weekendAvg: weekendDays === 0 ? 0 : weekendExports / weekendDays,
  };

  const rankedSizes = [...sizeCounts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
  );
  const shown = rankedSizes.slice(0, 3);
  const rest = rankedSizes.slice(3);
  const sizeEntries: Array<{ label: string; exports: number }> = shown.map(([label, exports]) => ({
    label,
    exports,
  }));
  if (rest.length > 0) {
    sizeEntries.push({ label: "Other", exports: rest.reduce((n, [, c]) => n + c, 0) });
  }
  const sizePercents = percentagesOf(sizeEntries.map((s) => s.exports));
  const sizes: SizeSlice[] = sizeEntries.map((s, i) => ({ ...s, percent: sizePercents[i] }));

  const findings: InsightFinding[] = [];
  if (totals.exports.current > 0 && topTemplates.length > 0) {
    const share = topTemplates[0].exports / totals.exports.current;
    if (share >= 0.2) {
      findings.push({
        kind: "templateShare",
        templateId: topTemplates[0].templateId,
        name: topTemplates[0].name,
        percent: Math.round(share * 100),
      });
    }
  }
  const inactive = members.filter((m) => !activeMembers.current.has(m.userId)).length;
  if (inactive > 0) findings.push({ kind: "inactiveMembers", count: inactive });
  if (
    kpis.posted.change.direction === "down" &&
    kpis.exports.change.direction === "up" &&
    kpis.posted.change.percent !== undefined
  ) {
    findings.push({ kind: "postingSlipped", percent: kpis.posted.change.percent });
  }
  const unused = templates.filter(
    (t) => t.status === "published" && !usedTemplates.has(t.id),
  ).length;
  if (unused > 0) findings.push({ kind: "unusedTemplates", count: unused });

  return { kpis, series, topTemplates, weekday, sizes, findings, templateRows };
}
