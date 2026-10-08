// The Insights digest (PHASE-8.md §9 D5): a heading, the window's dates and
// one sentence, built from the numbers buildInsights already returns, under
// the findings' rule: numbers only, no adjectives. The window comes from
// RANGE_LABEL, so the copy holds for every range, not only a month.

import type { DayPart, Insights, InsightsFilters, InsightsRange } from "./buildInsights";
import { hasFilters, PUBLIC_MEMBER, RANGE_LABEL } from "./buildInsights";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PART_PLURAL: Record<DayPart, string> = {
  morning: "mornings",
  afternoon: "afternoons",
  evening: "evenings",
  night: "nights",
};

const count = (n: number): string => n.toLocaleString("en-US");

/** "Aug 17 to Sep 15"; across a new year, "Dec 20, 2025 to Jan 18, 2026";
 * on 12 months, "Oct 2025 to Oct 2026". */
export function windowDates(window: Insights["window"], range: InsightsRange): string {
  const date = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const start = date(window.start);
  const end = date(window.end);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  if (range === "12m") {
    return `${fmt(start, { month: "short", year: "numeric" })} to ${fmt(end, { month: "short", year: "numeric" })}`;
  }
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    const full = { month: "short", day: "numeric", year: "numeric" } as const;
    return `${fmt(start, full)} to ${fmt(end, full)}`;
  }
  const short = { month: "short", day: "numeric" } as const;
  return `${fmt(start, short)} to ${fmt(end, short)}`;
}

/** "Your last 30 days in brief". */
export const digestHeading = (range: InsightsRange): string =>
  `Your last ${RANGE_LABEL[range]} in brief`;

/**
 * One sentence, in three parts, each only when its numbers exist:
 *  - the exports and how they moved against the previous window;
 *  - the template behind 20% or more of them (templateShare);
 *  - the weekday and part of day with the most exports.
 * "Your team exported 1,128 graphics, 18% more than the previous 30 days.
 * Product launch drove 22% of them, and Tuesday mornings were the busiest."
 * The subject follows the member filter ("Jordan Lee", "Public link
 * visitors"), and a template filter drops the share: one template is all
 * of them.
 */
export function digestSentence(
  insights: Insights,
  range: InsightsRange,
  filters: InsightsFilters = {},
  /** The filtered member's name, when the filter is one member. */
  memberName?: string,
): string {
  const filtered = hasFilters(filters);
  const exports = insights.kpis.exports;
  const window = RANGE_LABEL[range];
  if (exports.current === 0) {
    return filtered ? "No exports match these filters." : `No exports in the last ${window}.`;
  }
  const graphics = `${count(exports.current)} ${exports.current === 1 ? "graphic" : "graphics"}`;
  const { change } = exports;
  const movement =
    change.direction === "new"
      ? `, none in the previous ${window}`
      : change.direction === "flat"
        ? `, the same as the previous ${window}`
        : `, ${change.percent}% ${change.direction === "up" ? "more" : "fewer"} than the previous ${window}`;
  const subject =
    filters.member === PUBLIC_MEMBER
      ? "Public link visitors"
      : filters.member && memberName
        ? memberName
        : "Your team";
  const first = `${subject} exported ${graphics}${movement}.`;

  const share = filters.templateId ? null : insights.templateShare;
  const slot = insights.busiestSlot;
  const busiest = slot ? `${WEEKDAYS[slot.weekday]} ${PART_PLURAL[slot.part]}` : null;
  if (share && busiest) {
    return `${first} ${share.name} drove ${share.percent}% of them, and ${busiest} were the busiest.`;
  }
  if (share) {
    return `${first} ${share.name} drove ${share.percent}% of them.`;
  }
  return busiest ? `${first} ${busiest} were the busiest.` : first;
}
