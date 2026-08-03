import React from "react";

/** Skeleton geometry matches a real card — square frame, title line, meta
 *  line — so the layout doesn't jump when the data lands. A shelf of these
 *  rather than a spinner: the shape of what's coming is itself information. */
function SkeletonCard() {
  return (
    <div className="sp-card sp-media-card sp-skeleton-card" aria-hidden>
      <div className="sp-media-card__preview sp-skeleton__block" />
      <div className="sp-template-card__meta">
        <span className="sp-template-card__text">
          <span className="sp-skeleton__line sp-skeleton__block" style={{ width: "70%" }} />
          <span
            className="sp-skeleton__line sp-skeleton__block"
            style={{ width: "45%", marginTop: 6, height: 10 }}
          />
        </span>
      </div>
    </div>
  );
}

/** One shelf's worth of loading state. */
export function TemplateShelfSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <section className="sp-shelf" aria-busy="true" aria-label="Loading templates">
      <div className="sp-shelf__header">
        <div>
          <span
            className="sp-skeleton__line sp-skeleton__block"
            style={{ width: 160, height: 18 }}
          />
          <span
            className="sp-skeleton__line sp-skeleton__block"
            style={{ width: 90, height: 10, marginTop: "var(--space-2xs)" }}
          />
        </div>
      </div>
      <div className="sp-shelf__rail">
        <div className="sp-railfade__track sp-shelf__track">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="sp-shelf__item">
              <SkeletonCard />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
