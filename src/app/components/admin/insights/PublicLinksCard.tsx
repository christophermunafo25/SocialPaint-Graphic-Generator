import React, { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { LinkCount } from "@/lib/insights/buildInsights";
import type { PublicLinkUsageRow } from "@/lib/types";
import { publicLinkUrl } from "@/lib/publicLink/route";
import { routeToUrl } from "../../../router";
import { useLinkClick } from "../brand/useLinkClick";
import { Button } from "../../primitives";
import { BarTrack } from "./BarTrack";

/** The rows the card shows; "View all" opens Settings › Sharing (D11). */
const CAP = 5;

/** Why Copy is off on a link made before tokens were stored. */
const NOT_COPYABLE =
  "Made before links could be copied. Use New address in Settings › Sharing to get one you can copy.";

/** Public links (13:1076): the active links by exports in the window, five
 * at most, each the link's name over its template, a bar of its exports,
 * Opens, Exports and Copy. Since migration 0033 the token is stored, so a
 * link copies its address; one made before 0033 has none (D1). */
export function PublicLinksCard({
  links,
  counts,
}: {
  /** Active (non-revoked) links, with names and tokens. */
  links: PublicLinkUsageRow[];
  /** Per-link counts for the current window, from buildInsights. */
  counts: LinkCount[];
}) {
  const linkTo = useLinkClick();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (linkId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(publicLinkUrl(window.location.origin, token));
    } catch (e) {
      // A denied write must not claim "Copied": the button stays put.
      console.warn("clipboard write failed", e);
      return;
    }
    setCopiedId(linkId);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiedId(null), 1600);
  };

  const countOf = new Map(counts.map((c) => [c.linkId, c]));
  const rows = links
    .map((l) => ({
      linkId: l.linkId,
      name: l.linkName || "Untitled link",
      templateName: l.templateName,
      token: l.token,
      opens: countOf.get(l.linkId)?.views ?? 0,
      exports: countOf.get(l.linkId)?.exports ?? 0,
    }))
    .sort((a, b) => b.exports - a.exports || b.opens - a.opens || a.name.localeCompare(b.name))
    .slice(0, CAP);
  const max = Math.max(1, ...rows.map((r) => r.exports));

  return (
    <section className="sp-in-card sp-in-links" aria-labelledby="sp-in-links-title">
      <div className="sp-in-card__head">
        <h2 id="sp-in-links-title" className="t-title-panel">
          Public links
        </h2>
        <a
          className="ui-ring t-label-m sp-in-link"
          href={routeToUrl({ name: "settings", section: "sharing" })}
          onClick={linkTo({ name: "settings", section: "sharing" })}
        >
          View all
        </a>
      </div>
      <table className="sp-in-links__table">
        <thead>
          <tr className="t-label-xs">
            <th scope="col">Link</th>
            <th scope="col" className="sp-in-links__bar">
              <span className="sr-only">Exports, as a bar</span>
            </th>
            <th scope="col">Opens</th>
            <th scope="col">Exports</th>
            <th scope="col">
              <span className="sr-only">Copy</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.linkId}>
              <td>
                <span className="sp-in-links__name">
                  <span className="t-caption-m">{row.name}</span>
                  <span className="t-label-xs sp-in-muted">{row.templateName}</span>
                </span>
              </td>
              <td className="sp-in-links__bar">
                <BarTrack value={row.exports} max={max} />
              </td>
              <td className="sp-in-links__num t-caption-m sp-in-muted">
                {row.opens.toLocaleString("en-US")}
              </td>
              <td className="sp-in-links__num t-label-s">{row.exports.toLocaleString("en-US")}</td>
              <td>
                <Button
                  kind="neutral"
                  size="sm"
                  icon={copiedId === row.linkId ? Check : Copy}
                  disabled={row.token === null}
                  title={row.token === null ? NOT_COPYABLE : undefined}
                  aria-label={`Copy the link for ${row.name}`}
                  onClick={() => {
                    if (row.token !== null) void copy(row.linkId, row.token);
                  }}
                >
                  {copiedId === row.linkId ? "Copied" : "Copy"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
