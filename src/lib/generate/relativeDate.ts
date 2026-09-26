// The date and meta line on Recent and History cards (PROMPT.md §9.9):
// "Instagram, LinkedIn · Today" (the card joins chatMeta's two halves). Days are the member's own: date-fns works
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

/** A card's meta line in its two halves: the platform labels and the date.
 * The card draws them as "<platforms> · <date>", and when the line runs out
 * of room the platforms give way first, so the date (what makes Recent and
 * History useful) always shows. */
export interface ChatMeta {
  /** The chat's platform labels in the order given, joined with ", ". An
   * id this build does not know is skipped. Empty for none. */
  platforms: string;
  /** relativeDate of the chat's updatedAt. Empty when it does not parse. */
  date: string;
}

export function chatMeta(
  platforms: PlatformId[],
  updatedAt: string,
  now: Date = new Date(),
): ChatMeta {
  return {
    platforms: platforms.flatMap((id) => LABELS.get(id) ?? []).join(", "),
    date: relativeDate(updatedAt, now),
  };
}
