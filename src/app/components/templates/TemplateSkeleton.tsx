import React from "react";

/** Skeleton geometry matches a real card — square frame, title line, meta
 *  line — so the layout doesn't jump when the data lands. A shelf of these
 *  rather than a spinner: the shape of what's coming is itself information. */
export function SkeletonCard() {
  return (
    <div className="sp-card sp-media-card sp-skeleton-card" aria-hidden>
      <div className="sp-media-card__preview sp-skeleton__block" />
      <div className="sp-template-card__meta">
        <span className="sp-template-card__text">
          <span className="sp-skeleton__line sp-skeleton__block" style={{ width: "70%" }} />
          <span
            className="sp-skeleton__line sp-skeleton__block"
            style={{ width: "45%", height: 10 }}
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
      {/* The title line only: the count eyebrow it used to stand in for is
          gone from the real shelf (2026-09-25). */}
      <div className="sp-shelf__header">
        <span className="sp-skeleton__line sp-skeleton__block" style={{ width: 160, height: 18 }} />
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
