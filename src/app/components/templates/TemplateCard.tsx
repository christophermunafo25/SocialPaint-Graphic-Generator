import React from "react";
import { ArrowRight } from "lucide-react";
import { metaLine, type CatalogTemplate } from "@/lib/templates/catalog";
import { platformById } from "@/lib/templates/platforms";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** Up to two, per the spec — a third starts competing with the meta line. */
const MAX_TAGS = 2;

/**
 * One card, used by both the shelves and the grid. There is no second card
 * design.
 *
 * The whole card is the control. The circular arrow is `aria-hidden`
 * decoration over that single button rather than a nested control, so a
 * screen reader gets one clearly-named target per card and the keyboard gets
 * one stop.
 */
export function TemplateCard({
  template,
  frame,
  showTags = false,
  onOpen,
}: {
  template: CatalogTemplate;
  /** The group's frame ratio as a CSS aspect-ratio, e.g. "1200 / 627". Every
   *  card in a group shares it, which is what keeps a row even. Omit for a
   *  square frame. */
  frame?: string;
  /** Grid view only — shelves stay calm. */
  showTags?: boolean;
  onOpen(template: CatalogTemplate): void;
}) {
  const { Icon } = platformById(template.platform);
  const tags = template.useCases.slice(0, MAX_TAGS);

  return (
    <button
      type="button"
      className="sp-card sp-media-card sp-template-card"
      onClick={() => onOpen(template)}
      aria-label={`${template.name} — ${template.platformLabel}, ${template.width} by ${template.height}`}
    >
      <div
        className="sp-media-card__preview"
        style={frame ? ({ "--frame-ratio": frame } as React.CSSProperties) : undefined}
      >
        {/* Contain, never crop. Inside a group the frame already matches the
            artwork, so this is normally an exact fit; it only does visible
            work for the odd template whose pixels round to the group's named
            ratio without matching it exactly. */}
        <div
          style={{
            aspectRatio: `${template.width} / ${template.height}`,
            ...(template.width / template.height >= 1
              ? { width: "100%" }
              : { height: "100%" }),
          }}
        >
          <TemplateThumbnail template={template.template} />
        </div>
      </div>

      <div className="sp-template-card__meta">
        <span className="sp-template-card__text">
          <span className="sp-template-card__title" title={template.name}>
            {template.name}
          </span>
          <span className="sp-template-card__metaline">
            <Icon className="sp-template-card__platformicon" strokeWidth={1.5} aria-hidden />
            {metaLine(template)}
          </span>
          {showTags && tags.length > 0 && (
            <span className="sp-template-card__tags">
              {tags.map((tag) => (
                <span key={tag} className="sp-tag">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="sp-template-card__go" aria-hidden>
          <ArrowRight style={{ width: 15, height: 15 }} strokeWidth={1.5} />
        </span>
      </div>
    </button>
  );
}
