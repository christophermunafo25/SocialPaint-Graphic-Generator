import React, { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "../primitives";

/** What the canvas is warning about, at the foot of the stage: the layout's
 * own checks (contrast, a group off the canvas, an effect cut off at the
 * edge) and, after Make another size, each field the new size moved. The
 * frames draw a clean stage, so this is a pill ("2 checks") that opens a
 * panel above it; the review after a new size opens on its own. */
export function StageChecks({
  checks,
  review,
  onShow,
  onDoneReviewing,
}: {
  checks: string[];
  review: Array<{ fieldId: string; message: string }> | null;
  /** Select the field a review line names. */
  onShow(fieldId: string): void;
  onDoneReviewing(): void;
}) {
  const reviewing = Boolean(review && review.length > 0);
  const [open, setOpen] = useState(reviewing);
  useEffect(() => {
    if (reviewing) setOpen(true);
  }, [reviewing]);
  const count = checks.length + (review?.length ?? 0);
  if (count === 0) return null;
  return (
    <div className="sp-stage-checks">
      {open && (
        <div className="sp-stage-checks__panel" role="region" aria-label="Checks">
          {review && review.length > 0 && (
            <section className="sp-stage-checks__group">
              <div className="sp-stage-checks__head">
                <h3 className="t-label-m">Check the new size</h3>
                <Button kind="ghost" size="sm" onClick={onDoneReviewing}>
                  Done reviewing
                </Button>
              </div>
              <ul>
                {review.map((w) => (
                  <li key={w.fieldId}>
                    <button
                      type="button"
                      className="ui-reset ui-ring t-body-s sp-stage-checks__item"
                      onClick={() => onShow(w.fieldId)}
                    >
                      {w.message}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {checks.length > 0 && (
            <ul className="sp-stage-checks__group">
              {checks.map((c, i) => (
                <li key={i} className="t-body-s">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Button
        kind="neutral"
        size="sm"
        icon={TriangleAlert}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {count === 1 ? "1 check" : `${count} checks`}
      </Button>
    </div>
  );
}
