import React from "react";
import type { TopTemplate } from "@/lib/insights/buildInsights";
import { routeToUrl } from "../../../router";
import { useLinkClick } from "../brand/useLinkClick";

/** Fully neutral by D6: the leader's bar is --viz-neutral-strong, the rest
 * --viz-neutral — rank is carried by order, width, and the name's text
 * colour, never by an accent. */
export function TopTemplatesCard({
  templates,
  error,
}: {
  templates: TopTemplate[];
  /** The templates load failed — the card shows its own retry row. */
  error?: { retry: () => void };
}) {
  const linkTo = useLinkClick();
  const max = Math.max(1, ...templates.map((t) => t.exports));
  return (
    <div className="sp-card sp-card--content flex flex-col" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between" style={{ gap: "var(--space-xs)" }}>
        <h2 className="sp-section-title">Top templates</h2>
        <a
          className="sp-btn sp-btn-ghost"
          href={routeToUrl({ name: "adminTemplates" })}
          onClick={linkTo({ name: "adminTemplates" })}
        >
          See all
        </a>
      </div>
      {error ? (
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ gap: "var(--space-2xs)", minHeight: 160 }}
        >
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
            We couldn't load this.
          </p>
          <button className="sp-btn sp-btn-ghost" onClick={error.retry}>
            Try again
          </button>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
            No exports in this range
          </p>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col justify-around"
          style={{ marginTop: "var(--space-2xs)" }}
        >
          {templates.map((t, i) => (
            <a
              key={t.templateId}
              className="block"
              href={routeToUrl({ name: "builder", templateId: t.templateId })}
              onClick={linkTo({ name: "builder", templateId: t.templateId })}
              style={{ paddingBlock: "var(--space-2xs)", minWidth: 0 }}
            >
              <span
                className="flex items-baseline justify-between"
                style={{ gap: "var(--space-xs)" }}
              >
                <span
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 400,
                    fontSize: "var(--type-label-size)",
                    letterSpacing: "var(--type-label-track)",
                    color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {t.name}
                </span>
                <span className="sp-eyebrow flex-shrink-0">{t.exports}</span>
              </span>
              <span
                aria-hidden
                className="block"
                style={{
                  height: 6,
                  marginTop: 6,
                  borderRadius: "var(--radius-pill)",
                  background: "var(--viz-track)",
                }}
              >
                <span
                  className="block"
                  style={{
                    height: "100%",
                    width: `${Math.max(2, (t.exports / max) * 100)}%`,
                    borderRadius: "var(--radius-pill)",
                    background: i === 0 ? "var(--viz-neutral-strong)" : "var(--viz-neutral)",
                  }}
                />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
