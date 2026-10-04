import React from "react";
import { ArrowRight } from "lucide-react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import { PreviewOverlay, Tag } from "../primitives";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** Up to two: a third starts competing with the meta line. */
const MAX_TAGS = 2;

/** The card's size line, as the frames write it: "1080 × 1350", plus
 * " · 3 looks" when the template has more than one. */
export function cardMeta(template: CatalogTemplate): string {
  const looks = template.template.variants?.length ?? 0;
  const size = `${template.width} × ${template.height}`;
  return looks > 1 ? `${size} · ${looks} looks` : size;
}

/**
 * The library's template card (new look, 13:5776): the Result card's
 * anatomy (104:602) with the go arrow in place of Download. Shelves and
 * result grids share it.
 *
 * The whole card is one button that opens the fill page. On hover and on
 * keyboard focus the preview shows the drawn preview hover, the dim and
 * the Edit circle (PreviewOverlay), as part of the card's look: the circle
 * and the go arrow are aria-hidden, so a screen reader hears one named
 * target per card and the keyboard has one stop (PHASE-4.md §9 D6).
 */
export function TemplateCard({
  template,
  frame,
  showTags = false,
  onOpen,
}: {
  template: CatalogTemplate;
  /** The group's frame ratio as a CSS aspect-ratio, e.g. "1200 / 627".
   *  Every card in a group shares it, which keeps a row even. */
  frame?: string;
  /** Search results only (13:6511). */
  showTags?: boolean;
  onOpen(template: CatalogTemplate): void;
}) {
  const tags = template.useCases.slice(0, MAX_TAGS);
  const looks = template.template.variants?.length ?? 0;
  const landscape = template.width / template.height >= 1;

  return (
    <button
      type="button"
      className="ui-reset sp-tcard"
      onClick={() => onOpen(template)}
      aria-label={`${template.name}, ${template.platformLabel}, ${template.width} by ${template.height}${
        looks > 1 ? `, ${looks} looks` : ""
      }`}
    >
      <PreviewOverlay decorativeEdit className="sp-tcard__preview">
        <div
          className="sp-tcard__frame"
          style={frame ? ({ "--frame-ratio": frame } as React.CSSProperties) : undefined}
        >
          {/* Contain, never crop, with a 2px overscan the frame clips:
              sub-pixel contain rounding reads as a hairline seam around the
              artwork otherwise. */}
          <div
            style={{
              aspectRatio: `${template.width} / ${template.height}`,
              flexShrink: 0,
              ...(landscape ? { width: "calc(100% + 2px)" } : { height: "calc(100% + 2px)" }),
            }}
          >
            <TemplateThumbnail template={template.template} />
          </div>
        </div>
      </PreviewOverlay>

      <span className="sp-tcard__meta">
        <span className="sp-tcard__text">
          <span className="t-label-l sp-tcard__title" title={template.name}>
            {template.name}
          </span>
          <span className="t-caption-s sp-tcard__size">{cardMeta(template)}</span>
          {showTags && tags.length > 0 && (
            <span className="sp-tcard__tags">
              {tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </span>
          )}
        </span>
        <span className="ui-tint ui-iconbtn sp-tcard__go" data-variant="filled" aria-hidden>
          <ArrowRight size={16} className="ui-icon" />
        </span>
      </span>
    </button>
  );
}
