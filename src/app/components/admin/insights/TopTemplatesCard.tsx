import React from "react";
import type { TopTemplate } from "@/lib/insights/buildInsights";
import { routeToUrl } from "../../../router";
import { useLinkClick } from "../brand/useLinkClick";
import { Button } from "../../primitives";
import { BarTrack } from "./BarTrack";

/** Top templates (13:1036): five rows by exports, each the name and count
 * over its bar, the leader full width (D6). A row opens its template in
 * the builder; "View all" opens the template list (D11). */
export function TopTemplatesCard({
  templates,
  error,
}: {
  templates: TopTemplate[];
  /** The templates load failed: the card shows its own retry. */
  error?: { retry(): void };
}) {
  const linkTo = useLinkClick();
  const max = Math.max(1, ...templates.map((t) => t.exports));
  return (
    <section className="sp-in-card sp-in-top" aria-labelledby="sp-in-top-title">
      <div className="sp-in-card__head">
        <h2 id="sp-in-top-title" className="t-title-panel">
          Top templates
        </h2>
        <a
          className="ui-ring t-label-m sp-in-link"
          href={routeToUrl({ name: "adminTemplates" })}
          onClick={linkTo({ name: "adminTemplates" })}
        >
          View all
        </a>
      </div>
      {error ? (
        <div className="sp-in-empty">
          <p className="t-body-s sp-in-muted">We couldn't load this.</p>
          <Button kind="neutral" size="sm" onClick={error.retry}>
            Try again
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <p className="t-body-s sp-in-muted">No exports in this range.</p>
      ) : (
        <ul className="sp-in-top__rows">
          {templates.map((t) => (
            <li key={t.templateId}>
              <a
                className="ui-ring sp-in-top__row"
                href={routeToUrl({ name: "builder", templateId: t.templateId })}
                onClick={linkTo({ name: "builder", templateId: t.templateId })}
              >
                <span className="sp-in-top__line">
                  <span className="t-caption-m">{t.name}</span>
                  <span className="t-label-s">{t.exports.toLocaleString("en-US")}</span>
                </span>
                <BarTrack value={t.exports} max={max} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
