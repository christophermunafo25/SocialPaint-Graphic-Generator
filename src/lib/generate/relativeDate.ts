// The date and meta line on Recent and History cards (PROMPT.md §9.9):
// "Instagram, LinkedIn · Today". Days are the member's own: date-fns works
// in the browser's time zone, so "Today" means today where they sit.

import { format, isSameDay, isSameYear, isValid, parseISO, subDays } from "date-fns";
import { PLATFORMS, type PlatformId } from "../templates/platforms";

/** "Today", "Yesterday", "Sep 19" in the current year, "Sep 19, 2025"
 * otherwise. Empty for a timestamp that does not parse, so a card shows its
 * platforms rather than "Invalid Date". parseISO rather than Date.parse:
 * Postgres writes six fractional digits, which not every engine's Date
 * parser accepts. */
export function relativeDate(iso: string, now: Date = new Date()): string {
  const date = parseISO(iso);
  if (!isValid(date)) return "";
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, subDays(now, 1))) return "Yesterday";
  return format(date, isSameYear(date, now) ? "MMM d" : "MMM d, yyyy");
}

const LABELS = new Map(PLATFORMS.map((p) => [p.id, p.label]));

/** The chat's platform labels in the order given, joined with ", ", then
 * " · " and relativeDate. Either half is left out when empty, and an id this
 * build does not know is skipped. */
export function chatMeta(
  platforms: PlatformId[],
  updatedAt: string,
  now: Date = new Date(),
): string {
  const labels = platforms.flatMap((id) => LABELS.get(id) ?? []).join(", ");
  return [labels, relativeDate(updatedAt, now)].filter(Boolean).join(" · ");
}
