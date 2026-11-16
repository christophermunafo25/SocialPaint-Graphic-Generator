/** The usage line under a template in the Template Builder list (new brand,
 * 328:1944): a published template's downloads ("128 downloads", or "Not
 * used yet"), and a draft's last edit ("Edited 2 hours ago"). Empty for a
 * published template while its usage is still loading or failed to load,
 * so the line never claims "Not used yet" before it knows. */
export function builderUsageLine(
  template: { status: "draft" | "published"; updatedAt: string },
  downloads: number | null,
  now: Date = new Date(),
): string {
  if (template.status === "published") {
    if (downloads === null) return "";
    return downloads > 0 ? `${downloads} download${downloads === 1 ? "" : "s"}` : "Not used yet";
  }
  const ago = editedAgo(template.updatedAt, now);
  return ago ? `Edited ${ago}` : "";
}

const MINUTE = 60_000;

/** How long ago an edit was, in the list's words: "just now", "5 minutes
 * ago", "2 hours ago" the same day, "yesterday" the calendar day before,
 * "3 days ago" within the week, and the date ("Sep 30") past that. */
export function editedAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const days = calendarDaysBetween(then, now);
  if (days === 0) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Whole calendar days from `a` to `b` in local time (0 on the same day). */
function calendarDaysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / (24 * 60 * MINUTE));
}
