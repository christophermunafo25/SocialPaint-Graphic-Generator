import type { PublicLinkUsageRow, UsageAction } from "../types";

/** The join behind the per-link breakdown, kept pure so the counting rules
 * are testable without a database.
 *
 * Two inputs rather than one embedded query: a link with no traffic yet has
 * no events to embed, and it still has to appear — "created it, nobody has
 * opened it" is one of the more useful things this table can tell an admin,
 * and an inner join would silently drop exactly that row.
 */

export interface LinkEvent {
  linkId: string;
  action: UsageAction;
  createdAt: string;
}

export interface LinkRecord {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  revokedAt: string | null;
  createdAt: string;
}

export function joinLinkUsage(links: LinkRecord[], events: LinkEvent[]): PublicLinkUsageRow[] {
  const byLink = new Map<string, PublicLinkUsageRow>(
    links.map((l) => [
      l.id,
      {
        linkId: l.id,
        linkName: l.name,
        templateId: l.templateId,
        templateName: l.templateName,
        opens: 0,
        downloads: 0,
        lastUsedAt: null,
        revokedAt: l.revokedAt,
      },
    ]),
  );

  for (const event of events) {
    const row = byLink.get(event.linkId);
    // An event whose link has since been deleted: usage_events.link_id is
    // set to null on delete, so this is belt and braces. The event still
    // counts toward its template's totals — only the per-link attribution
    // is gone, which is the correct outcome rather than inventing a row for
    // a link that no longer exists.
    if (!row) continue;
    if (event.action === "open") row.opens += 1;
    else row.downloads += 1;
    if (!row.lastUsedAt || event.createdAt > row.lastUsedAt) row.lastUsedAt = event.createdAt;
  }

  // Busiest first, then by exports, then newest — so the link that is
  // working leads, and an untouched one sorts to the bottom rather than
  // floating on alphabetical luck.
  return [...byLink.values()].sort(
    (a, b) =>
      b.downloads - a.downloads ||
      b.opens - a.opens ||
      (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
  );
}
