// The Insights page's aggregation (2026-09-15; new look, Phase 8), kept pure so
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
// - Day and month boundaries, and the busiest weekday and part of day, follow the WORKSPACE timezone
//   (company.timezone), exactly as dailyActivity.ts buckets days.

import type { InsightEvent, TemplateSchema } from "../types";
import { dayKeyInZone } from "../stores/dailyActivity";
import { classifySize, PLATFORMS, type PlatformId } from "../templates/platforms";

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

/** The page's filters (PHASE-8.md §2): one template, one member (or the
 * public links' visitors), one platform. A template's platforms come from
 * its canvas size, as the Brand Templates chips do: the filter means
 * "templates sized for this platform", never where a graphic was posted. */
export interface InsightsFilters {
  templateId?: string | null;
  /** A member's user id, or PUBLIC_MEMBER for public-link visitors. */
  member?: string | null;
  platform?: PlatformId | null;
}

/** The member filter's entry for events from public links (D4). */
export const PUBLIC_MEMBER = "public";

/** When in the day an event happened, in the workspace's zone. */
export type DayPart = "morning" | "afternoon" | "evening" | "night";

/** Morning 5–12, afternoon 12–17, evening 17–22, night 22–5. */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/** The hour (0–23) of an instant in a zone. */
export function hourInZone(iso: string, timeZone: string): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(iso));
    return Number(hour) % 24;
  } catch {
    return new Date(iso).getUTCHours();
  }
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

/** The leading template's share of the window's exports, when it is 20%
 * or more: the digest's second clause. Numbers only; copy belongs to the
 * rendering. */
export interface TemplateShare {
  templateId: string;
  name: string;
  percent: number;
}

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
  /** The current window's first and last day keys (YYYY-MM-DD), in the
   * workspace's zone: the digest's and the trend's dates. */
  window: { start: string; end: string };
  /** The weekday (0 = Monday) and part of day with the most exports in the
   * current window; null with no exports. Earliest wins a tie. */
  busiestSlot: { weekday: number; part: DayPart } | null;
  kpis: {
    exports: InsightKpi;
    opens: InsightKpi;
    posted: InsightKpi;
    activeMembers: InsightKpi;
  };
  /** Aligned current/previous series per metric: the trend. */
  series: {
    exports: TrendPoint[];
    opens: TrendPoint[];
    posted: TrendPoint[];
  };
  /** Top 5 by exports in the window; templates with zero exports never
   * appear (the card says "No exports in this range" instead). */
  topTemplates: TopTemplate[];
  templateShare: TemplateShare | null;
  templateRows: InsightTemplateRow[];
  /** Views and exports per public link in the CURRENT window. Only links
   * that produced an event appear — the page joins against the link list
   * (names, tokens) so quiet links still render with zeros. */
  linkCounts: LinkCount[];
}

export interface LinkCount {
  linkId: string;
  views: number;
  exports: number;
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

const platformsOf = (t: TemplateSchema): PlatformId[] =>
  classifySize(t.canvasWidth, t.canvasHeight).platforms;

/** The platforms the workspace's templates are sized for, in the fixed
 * platform order: the platform filter's options. */
export function platformsInUse(templates: TemplateSchema[]): PlatformId[] {
  const used = new Set(templates.flatMap(platformsOf));
  return PLATFORMS.map((p) => p.id).filter((id) => used.has(id));
}

/** Whether any filter is set. */
export const hasFilters = (f: InsightsFilters | undefined): boolean =>
  !!(f?.templateId || f?.member || f?.platform);

export function buildInsights(input: {
  events: InsightEvent[];
  templates: TemplateSchema[];
  range: InsightsRange;
  timeZone: string;
  filters?: InsightsFilters;
  now?: Date;
}): Insights {
  const { range, timeZone } = input;
  const filters = input.filters ?? {};
  const now = input.now ?? new Date();
  const { current, previous } = buildWindows(range, timeZone, now);

  // Filters narrow the events; they never redefine a count (§3). Templates
  // out of scope leave the CSV rows too, and a member filter narrows
  // Active members to that one person (Public links to none).
  const templates = input.templates.filter(
    (t) =>
      (!filters.templateId || t.id === filters.templateId) &&
      (!filters.platform || platformsOf(t).includes(filters.platform)),
  );
  const inScope = new Set(templates.map((t) => t.id));
  const scoped = !!(filters.templateId || filters.platform);
  const events = input.events.filter((e) => {
    if (scoped && !inScope.has(e.templateId)) return false;
    if (!filters.member) return true;
    if (filters.member === PUBLIC_MEMBER) return e.actor === "public";
    return e.actor === "member" && e.userId === filters.member;
  });
  const bucketCount = current.buckets.length;
  const zeros = () => new Array<number>(bucketCount).fill(0);
  const counts = {
    exports: { current: zeros(), previous: zeros() },
    opens: { current: zeros(), previous: zeros() },
    posted: { current: zeros(), previous: zeros() },
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

  /** Exports by weekday and part of day: the digest's busiest slot. */
  const slotCounts = new Map<string, number>();
  const countByLink = new Map<string, LinkCount>();

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
    }

    if (win !== "current") continue;

    const row = rowOf(e.templateId);
    if (e.action === "download") {
      row.exports += 1;
      if (e.actor === "public") row.publicDownloads += 1;
      const slot = `${weekdayOf(dayKey)}:${dayPartOf(hourInZone(e.createdAt, timeZone))}`;
      slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
    } else if (e.action === "open") {
      row.opens += 1;
    } else if (e.action === "share") {
      row.posted += 1;
    } else if (e.action === "bulk_export") {
      row.bulk += 1;
    }
    if (!row.lastUsedAt || e.createdAt > row.lastUsedAt) row.lastUsedAt = e.createdAt;

    if (e.linkId && (e.action === "open" || e.action === "download")) {
      let count = countByLink.get(e.linkId);
      if (!count) countByLink.set(e.linkId, (count = { linkId: e.linkId, views: 0, exports: 0 }));
      if (e.action === "open") count.views += 1;
      else count.exports += 1;
    }
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
  };

  const templateRows = [...rowByTemplate.values()].sort(
    (a, b) => b.exports - a.exports || b.opens - a.opens || a.name.localeCompare(b.name),
  );
  const topTemplates: TopTemplate[] = templateRows
    .filter((r) => r.exports > 0)
    .slice(0, 5)
    .map((r) => ({ templateId: r.templateId, name: r.name, exports: r.exports }));

  let templateShare: TemplateShare | null = null;
  if (totals.exports.current > 0 && topTemplates.length > 0) {
    const share = topTemplates[0].exports / totals.exports.current;
    if (share >= 0.2) {
      templateShare = {
        templateId: topTemplates[0].templateId,
        name: topTemplates[0].name,
        percent: Math.round(share * 100),
      };
    }
  }

  // Busiest slot: most exports, then the earliest weekday and part.
  const PART_ORDER: DayPart[] = ["morning", "afternoon", "evening", "night"];
  let busiestSlot: Insights["busiestSlot"] = null;
  let busiestCount = 0;
  for (let w = 0; w < 7; w++) {
    for (const part of PART_ORDER) {
      const n = slotCounts.get(`${w}:${part}`) ?? 0;
      if (n > busiestCount) {
        busiestCount = n;
        busiestSlot = { weekday: w, part };
      }
    }
  }

  return {
    window: { start: current.days[0], end: current.days[current.days.length - 1] },
    busiestSlot,
    kpis,
    series,
    topTemplates,
    templateShare,
    templateRows,
    linkCounts: [...countByLink.values()],
  };
}
