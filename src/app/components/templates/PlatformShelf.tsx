import React, { useLayoutEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import type { TemplateGroup } from "@/lib/templates/groups";
import { TemplateCard } from "./TemplateCard";
import { useEdgeFade } from "./useEdgeFade";
import { revealIndex, useReveal } from "./useReveal";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * One platform's row: a horizontally snapping track of cards.
 *
 * The track itself is tabbable and carries the platform's name, so a keyboard
 * user can reach it and scroll with the arrow keys. The prev/next buttons are
 * a pointer convenience on top of that — hover-only, and hidden entirely on
 * touch, where the gesture already exists.
 */
export function PlatformShelf({
  group,
  onOpen,
  onViewAll,
}: {
  group: TemplateGroup;
  onOpen(template: CatalogTemplate): void;
  onViewAll(): void;
}) {
  const { templates } = group;
  const { ref, atStart, atEnd } = useEdgeFade<HTMLDivElement>([templates.length]);
  const revealRef = useReveal<HTMLElement>();

  // Card width is now fluid — CSS fits a fixed number of cards across the
  // track — so the frame height has to be measured rather than derived. The
  // arrows centre on it.
  const [frameH, setFrameH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const frame = ref.current?.querySelector<HTMLElement>(".sp-media-card__preview");
    if (!frame) return;
    const read = () => setFrameH(frame.getBoundingClientRect().height);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [templates.length, ref]);

  const railVars = (
    frameH ? { "--shelf-frame-h": `${Math.round(frameH)}px` } : {}
  ) as React.CSSProperties;

  /** Just under a full pane, so the card you were reading stays in view. */
  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section ref={revealRef} className="sp-shelf sp-reveal" aria-labelledby={`shelf-${group.id}`}>
      <div className="sp-shelf__header">
        <div>
          <h2 className="sp-shelf__title" id={`shelf-${group.id}`}>
            {group.label}
          </h2>
          <p className="sp-eyebrow">{plural(templates.length, "template")}</p>
        </div>
        <button type="button" className="sp-shelf__viewall" onClick={onViewAll}>
          View all
          <ArrowRight style={{ width: 14, height: 14 }} strokeWidth={1.5} />
        </button>
      </div>

      <div
        className="sp-railfade sp-shelf__rail"
        style={railVars}
        data-at-start={atStart || undefined}
        data-at-end={atEnd || undefined}
      >
        <button
          type="button"
          className="sp-shelf__arrow sp-shelf__arrow--prev"
          onClick={() => page(-1)}
          disabled={atStart}
          aria-label={`Scroll ${group.label} templates left`}
        >
          <ChevronLeft style={{ width: 18, height: 18 }} strokeWidth={1.5} />
        </button>

        <div
          ref={ref}
          className="sp-railfade__track sp-shelf__track"
          tabIndex={0}
          role="group"
          aria-label={`${group.label} templates`}
        >
          {templates.map((t, i) => (
            <div key={t.id} className="sp-shelf__item sp-reveal__item" style={revealIndex(i)}>
              <TemplateCard template={t} frame={group.frame} onOpen={onOpen} />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="sp-shelf__arrow sp-shelf__arrow--next"
          onClick={() => page(1)}
          disabled={atEnd}
          aria-label={`Scroll ${group.label} templates right`}
        >
          <ChevronRight style={{ width: 18, height: 18 }} strokeWidth={1.5} />
        </button>
      </div>
    </section>
  );
}
