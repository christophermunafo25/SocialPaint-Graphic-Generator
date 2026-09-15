import React, { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { LinkCount } from "@/lib/insights/buildInsights";
import type { PublicLinkUsageRow } from "@/lib/types";
import { publicLinkUrl } from "@/lib/publicLink/route";

/** name | views | exports | copy — the header row and every link row share
 * this template so the columns line up. The copy column is FIXED width:
 * header and rows are separate grids, and an `auto` column would collapse
 * to nothing on the header row and drag the number columns out of line. */
const ROW_COLUMNS = "minmax(0, 1fr) 64px 64px 104px";

const numCell: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--type-caption-size)",
  textAlign: "right",
};

/** Public links (CJ, 2026-09-15): each active link by NAME — never the URL
 * itself on screen — with its views and exports in the selected window and
 * a copy-to-clipboard button. The URL is rebuildable since migration 0033
 * stored the plaintext token; links minted before it can't be copied here
 * and say so (regenerating from the Share dialog mints a copyable one). */
export function PublicLinksCard({
  links,
  counts,
}: {
  /** Active (non-revoked) links, with names and tokens. */
  links: PublicLinkUsageRow[];
  /** Per-link counts for the current window, from buildInsights. */
  counts: LinkCount[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const copy = async (linkId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(publicLinkUrl(window.location.origin, token));
    } catch (e) {
      // A denied write (no user activation, restrictive browser) must not
      // claim "Copied" — the button simply stays put.
      console.warn("clipboard write failed", e);
      return;
    }
    setCopiedId(linkId);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiedId(null), 2000);
  };

  const countOf = new Map(counts.map((c) => [c.linkId, c]));
  const rows = links
    .map((l) => ({
      linkId: l.linkId,
      name: l.linkName || "Untitled link",
      token: l.token,
      views: countOf.get(l.linkId)?.views ?? 0,
      exports: countOf.get(l.linkId)?.exports ?? 0,
    }))
    .sort((a, b) => b.exports - a.exports || b.views - a.views || a.name.localeCompare(b.name));

  return (
    <div className="sp-card sp-card--content">
      <h2 className="sp-section-title">Public links</h2>
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: ROW_COLUMNS,
          columnGap: "var(--space-sm)",
          marginTop: "var(--space-xs)",
        }}
      >
        <span className="sp-eyebrow">Link</span>
        <span className="sp-eyebrow" style={{ textAlign: "right" }}>
          Views
        </span>
        <span className="sp-eyebrow" style={{ textAlign: "right" }}>
          Exports
        </span>
        <span aria-hidden />
      </div>
      {rows.map((row) => (
        <div
          key={row.linkId}
          className="grid items-center"
          style={{
            gridTemplateColumns: ROW_COLUMNS,
            columnGap: "var(--space-sm)",
            paddingBlock: "var(--space-2xs)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: "var(--type-label-size)",
              letterSpacing: "var(--type-label-track)",
              color: "var(--text-primary)",
            }}
          >
            {row.name}
          </span>
          <span style={{ ...numCell, color: "var(--text-secondary)" }}>{row.views}</span>
          <span style={{ ...numCell, color: "var(--text-primary)" }}>{row.exports}</span>
          <button
            className="sp-btn sp-btn-ghost"
            style={{ minHeight: 28, padding: "2px var(--space-2xs)", justifySelf: "end" }}
            disabled={row.token === null}
            title={
              row.token === null
                ? "Created before copyable links — regenerate it from the template's Share dialog to get a URL you can copy here."
                : undefined
            }
            aria-label={`Copy the link URL for ${row.name}`}
            onClick={() => {
              if (row.token !== null) void copy(row.linkId, row.token);
            }}
          >
            {copiedId === row.linkId ? (
              <Check style={{ width: 14, height: 14 }} />
            ) : (
              <Copy style={{ width: 14, height: 14 }} />
            )}
            {copiedId === row.linkId ? "Copied" : "Copy"}
          </button>
        </div>
      ))}
    </div>
  );
}
