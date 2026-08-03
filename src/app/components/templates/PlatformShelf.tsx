import React from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import { shelfCardWidth, type TemplateGroup } from "@/lib/templates/groups";
import { TemplateCard } from "./TemplateCard";
import { useEdgeFade } from "./useEdgeFade";

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
  const { platform, templates } = group;
  const { ref, atStart, atEnd } = useEdgeFade<HTMLDivElement>([templates.length]);

  // Card width follows the shape, so a rail of stories isn't three times the
  // height of a rail of banners. The frame height follows from both.
  const cardW = shelfCardWidth(group.orientation);
  const [fw, fh] = group.frame.split("/").map((n) => Number(n.trim()));
  const railVars = {
    "--shelf-card-w": `${cardW}px`,
    "--shelf-frame-h": `${Math.round((cardW - 24) * (fh / fw))}px`,
  } as React.CSSProperties;

  /** Just under a full pane, so the card you were reading stays in view. */
  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="sp-shelf" aria-labelledby={`shelf-${group.id}`}>
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
          {templates.map((t) => (
            <div key={t.id} className="sp-shelf__item">
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
