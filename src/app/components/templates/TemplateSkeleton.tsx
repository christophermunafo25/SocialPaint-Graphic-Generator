import React from "react";
import { Bone } from "../Skeleton";

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

/** The library's loading state (new look): a shelf of cards in the new
 *  card's shape, its preview and lines as sunken bones. Not drawn in the
 *  file; built from the card itself so nothing jumps when the data lands. */
export function LibraryShelfSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <section className="sp-lib-shelf" aria-busy="true" aria-label="Loading templates">
      <div className="sp-lib-shelf__header">
        <Bone w={240} h={17} tone="var(--surface-sunken)" />
      </div>
      <div className="sp-lib-rail">
        <div className="sp-lib-rail__track sp-lib-shelf__track">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="sp-lib-shelf__item" aria-hidden>
              <div className="sp-tcard">
                <div className="sp-tcard__preview">
                  <div className="sp-tcard__frame" />
                </div>
                <span className="sp-tcard__meta">
                  <span className="sp-tcard__text">
                    <Bone w="70%" h={15} tone="var(--surface-sunken)" />
                    <Bone w="45%" h={12} tone="var(--surface-sunken)" />
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
