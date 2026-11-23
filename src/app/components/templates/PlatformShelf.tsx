import React from "react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import type { TemplateGroup } from "@/lib/templates/groups";
import { TemplateCard } from "./TemplateCard";
import { useEdgeFade } from "./useEdgeFade";

/**
 * One shelf of the library (6010:2084): its title and View all, over a
 * horizontally scrolling rail of 302 cards that fades out at the right
 * edge, the next card cut off.
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
        <h2 className="t-label-xs" id={`shelf-${group.id}`}>
          {group.label}
        </h2>
        {/* View all (6010:2087): the Small Ghost button with its label in
            Label/XS, underlined. */}
        <button
          type="button"
          className="ui-reset ui-fill ui-ring ui-btn sp-lib-viewall"
          data-kind="ghost"
          data-size="sm"
          onClick={onViewAll}
        >
          <span className="t-label-xs">View all</span>
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
