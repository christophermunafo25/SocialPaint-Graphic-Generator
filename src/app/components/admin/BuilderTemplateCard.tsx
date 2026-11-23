import React, { useId } from "react";
import type { TemplateSchema } from "@/lib/types";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { Badge, RowMenu, Skeleton, type RowMenuGroup } from "../primitives";

/**
 * A template in the Template Builder list (new brand, sp-template-card in
 * 328:1944): 8 around a square sunken well that fits the template at its
 * own ratio, then the meta row: the name in Label/M over its status Badge
 * and usage line in Caption/M, and the row menu (Ghost Small) at the end.
 * The well is the Edit button; the menu holds the rest (329:2206).
 */
export function BuilderTemplateCard({
  template,
  usage,
  menu,
  onOpen,
}: {
  template: TemplateSchema;
  /** builderUsageLine: downloads, or when a draft was edited. */
  usage: string;
  menu: RowMenuGroup[];
  onOpen(): void;
}) {
  const nameId = useId();
  const name = template.name.trim() || "Untitled template";
  const published = template.status === "published";
  return (
    <article className="sp-tbcard" aria-labelledby={nameId}>
      <button
        type="button"
        className="ui-reset ui-ring sp-tbcard__preview"
        aria-label={`Edit ${name}`}
        onClick={onOpen}
      >
        <span
          className="sp-tbcard__art"
          style={
            {
              "--fit-ratio": template.canvasWidth / template.canvasHeight,
            } as React.CSSProperties
          }
          aria-hidden
        >
          {/* 1px of overscan: the renderer's contain rounds a hair short of
              the box. */}
          <span className="sp-tbcard__overscan">
            <TemplateThumbnail template={template} />
          </span>
        </span>
      </button>
      <div className="sp-tbcard__meta">
        <div className="sp-tbcard__text">
          <h3 id={nameId} className="t-label-m sp-tbcard__name">
            {name}
          </h3>
          <div className="sp-tbcard__status">
            <Badge tone={published ? "positive" : "neutral"}>
              {published ? "Published" : "Draft"}
            </Badge>
            {usage && <span className="t-caption-m sp-tbcard__usage">{usage}</span>}
          </div>
        </div>
        <RowMenu groups={menu} label={`More actions for ${name}`} />
      </div>
    </article>
  );
}

/** A card while the list loads: the well and the meta row's name, badge and
 * usage as Skeletons, in the card's own boxes, so nothing moves when the
 * templates land. Decoration; the grid says it is busy. */
export function BuilderTemplateCardSkeleton() {
  return (
    <div className="sp-tbcard" aria-hidden>
      <span className="sp-tbcard__preview" data-loading />
      <div className="sp-tbcard__meta">
        <div className="sp-tbcard__text">
          <Skeleton width={128} height={10} />
          <div className="sp-tbcard__status">
            <Skeleton width={64} height={24} radius="full" />
            <Skeleton width={84} height={9} />
          </div>
        </div>
      </div>
    </div>
  );
}
