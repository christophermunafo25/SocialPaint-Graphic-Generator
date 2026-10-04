import React from "react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import type { TemplateGroup } from "@/lib/templates/groups";
import { TemplateCard } from "./TemplateCard";
import { useEdgeFade } from "./useEdgeFade";

/**
 * One shelf of the library (13:5776): its title and "View all", over a
 * horizontally scrolling rail of cards that fades out at the right edge.
 *
 * The rail itself is tabbable and carries the shelf's name, so a keyboard
 * user can reach it and scroll with the arrow keys; pointers swipe or
 * trackpad-scroll. The fade is the only overflow cue.
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

  return (
    <section className="sp-lib-shelf" aria-labelledby={`shelf-${group.id}`}>
      <div className="sp-lib-shelf__header">
        <h2 className="t-title-panel" id={`shelf-${group.id}`}>
          {group.label}
        </h2>
        <button
          type="button"
          className="ui-reset ui-ring t-label-m sp-lib-link"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>

      <div
        className="sp-lib-rail"
        data-at-start={atStart || undefined}
        data-at-end={atEnd || undefined}
      >
        <div
          ref={ref}
          className="ui-ring sp-lib-rail__track sp-lib-shelf__track"
          tabIndex={0}
          role="group"
          aria-label={`${group.label} templates`}
        >
          {templates.map((t) => (
            <div key={t.id} className="sp-lib-shelf__item">
              <TemplateCard template={t} frame={group.frame} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
