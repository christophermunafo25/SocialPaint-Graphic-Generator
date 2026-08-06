import React from "react";
import { ArrowRight } from "lucide-react";
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
 * user can reach it and scroll with the arrow keys; pointers swipe or
 * trackpad-scroll. The edge fade is the only overflow cue — no arrow chrome.
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
        data-at-start={atStart || undefined}
        data-at-end={atEnd || undefined}
      >
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
      </div>
    </section>
  );
}
