import React from "react";
import type { InsightFinding, InsightsRange } from "@/lib/insights/buildInsights";
import { routeToUrl, useRouter, type Route } from "../../../router";
import { useLinkClick } from "../brand/useLinkClick";

/** The aggregator's findings plus the page-joined one: a non-revoked
 * public link that has never been opened (getPublicLinkUsage), appended
 * only while fewer than four of the higher rules apply. */
export type PageFinding = InsightFinding | { kind: "unopenedLinks"; count: number };

/** Each dot is the accent of the SERIES the finding is about — identity,
 * never severity; the sentence carries the meaning. */
const FINDING_DOT: Record<PageFinding["kind"], string> = {
  templateShare: "var(--viz-series-1)",
  inactiveMembers: "var(--viz-series-2)",
  postingSlipped: "var(--viz-series-5)",
  unusedTemplates: "var(--viz-series-4)",
  unopenedLinks: "var(--viz-series-2)",
};

function sentenceOf(finding: PageFinding, rangeLabel: string): string {
  switch (finding.kind) {
    case "templateShare":
      return `${finding.name} drove ${finding.percent}% of exports.`;
    case "inactiveMembers":
      return finding.count === 1
        ? `1 member hasn't made anything in ${rangeLabel}.`
        : `${finding.count} members haven't made anything in ${rangeLabel}.`;
    case "postingSlipped":
      return `Posts to LinkedIn slipped ${finding.percent}% while exports grew.`;
    case "unusedTemplates":
      return finding.count === 1
        ? `1 template wasn't used in the last ${rangeLabel}.`
        : `${finding.count} templates weren't used in the last ${rangeLabel}.`;
    case "unopenedLinks":
      return finding.count === 1
        ? `1 public link hasn't been opened.`
        : `${finding.count} public links haven't been opened.`;
  }
}

/** Worth taking a look (Figma 106:2): up to four findings in hairline
 * columns, each a plain sentence with a quiet action — no stripes, no
 * severity colour. */
export function FindingsCard({
  findings,
  rangeLabel,
  range,
  error,
}: {
  findings: PageFinding[];
  rangeLabel: string;
  /** The current range URL param, so Compare keeps the window. */
  range?: InsightsRange;
  /** Templates or people failed — the rules can't all be evaluated. */
  error?: { retry: () => void };
}) {
  const { navigate } = useRouter();
  const linkTo = useLinkClick();

  const actionOf = (finding: PageFinding): { label: string; route: Route; replace?: boolean } => {
    switch (finding.kind) {
      case "templateShare":
        return {
          label: "View template",
          route: { name: "builder", templateId: finding.templateId },
        };
      case "inactiveMembers":
        return { label: "See who", route: { name: "people" } };
      case "postingSlipped":
        // A metric change, like the tabs: replace, so Back leaves Insights.
        return {
          label: "Compare",
          route: { name: "dashboard", range, metric: "posted" },
          replace: true,
        };
      case "unusedTemplates":
      case "unopenedLinks":
        return { label: "Review", route: { name: "adminTemplates" } };
    }
  };

  return (
    <div className="sp-card sp-card--content">
      <h2 className="sp-section-title">Worth taking a look</h2>
      {error ? (
        <div
          className="flex items-center justify-center"
          style={{ gap: "var(--space-xs)", minHeight: 72 }}
        >
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
            We couldn't load this.
          </p>
          <button className="sp-btn sp-btn-ghost" onClick={error.retry}>
            Try again
          </button>
        </div>
      ) : findings.length === 0 ? (
        <p
          style={{
            fontSize: "var(--type-label-size)",
            color: "var(--text-muted)",
            marginTop: "var(--space-sm)",
          }}
        >
          Nothing stands out this period.
        </p>
      ) : (
        <ul className="sp-insights-findings">
          {findings.map((finding) => {
            const action = actionOf(finding);
            return (
              <li
                key={finding.kind}
                className="flex flex-col items-start"
                style={{ gap: "var(--space-2xs)" }}
              >
                <span className="flex items-start" style={{ gap: "var(--space-2xs)" }}>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "var(--radius-pill)",
                      background: FINDING_DOT[finding.kind],
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 400,
                      fontSize: "var(--type-label-size)",
                      lineHeight: "var(--type-label-lh)" as React.CSSProperties["lineHeight"],
                      letterSpacing: "var(--type-label-track)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {sentenceOf(finding, rangeLabel)}
                  </span>
                </span>
                <a
                  className="sp-btn sp-btn-ghost"
                  // A link, not a toolbar button: the ghost recipe at the
                  // 24px interactive floor, so four findings still fit the
                  // one-screen budget (D1).
                  style={{ minHeight: 24, padding: "2px var(--space-2xs)", marginLeft: -8 }}
                  href={routeToUrl(action.route)}
                  onClick={
                    action.replace
                      ? (e) => {
                          if (e.defaultPrevented || e.button !== 0) return;
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                          e.preventDefault();
                          navigate(action.route, { replace: true });
                        }
                      : linkTo(action.route)
                  }
                >
                  {action.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
