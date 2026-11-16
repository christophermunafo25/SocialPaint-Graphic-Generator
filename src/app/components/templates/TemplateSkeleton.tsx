import React from "react";
import { Skeleton } from "../primitives";

/** The library's loading state (new look): a shelf of cards in the new
 *  card's shape, its preview and lines as sunken bones. Not drawn in the
 *  file; built from the card itself so nothing jumps when the data lands. */
export function LibraryShelfSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <section className="sp-lib-shelf" aria-busy="true" aria-label="Loading templates">
      <div className="sp-lib-shelf__header">
        <Skeleton width={240} height={17} />
      </div>
      <div className="sp-lib-rail">
        <div className="sp-lib-rail__track sp-lib-shelf__track">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="sp-lib-shelf__item" aria-hidden>
              <div className="sp-tcard">
                <div className="sp-tcard__frame" />
                <span className="sp-tcard__meta">
                  <span className="sp-tcard__text">
                    <Skeleton width="70%" height={15} />
                    <Skeleton width="45%" height={12} />
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
