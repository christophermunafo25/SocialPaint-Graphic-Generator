import React, { useEffect, useMemo, useState } from "react";
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

  // A template with several looks shows them off while the pointer (or
  // focus) rests on the card: the preview steps through every look, one a
  // second, and settles back on the default when attention moves on. The
  // swap is a repaint through the one renderer, not an animation, so it is
  // the same under reduced motion.
  const looks = useMemo(() => template.template.variants ?? [], [template.template.variants]);
  const multiLook = looks.length > 1;
  const [attended, setAttended] = useState(false);
  const [lookIndex, setLookIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!attended || !multiLook) {
      setLookIndex(null);
      return;
    }
    const start = Math.max(
      0,
      looks.findIndex((v) => v.isDefault),
    );
    setLookIndex((start + 1) % looks.length);
    const id = window.setInterval(
      () => setLookIndex((i) => ((i ?? start) + 1) % looks.length),
      1000,
    );
    return () => window.clearInterval(id);
  }, [attended, multiLook, looks]);
  const shownLook = lookIndex === null ? undefined : looks[lookIndex];

  return (
    <button
      type="button"
      className="sp-card sp-media-card sp-template-card"
      onClick={() => onOpen(template)}
      onMouseEnter={() => setAttended(true)}
      onMouseLeave={() => setAttended(false)}
      onFocus={() => setAttended(true)}
      onBlur={() => setAttended(false)}
      aria-label={`${template.name}, ${template.platformLabel}, ${template.width} by ${template.height}${
        multiLook ? `, ${looks.length} looks` : ""
      }`}
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
            ...(template.width / template.height >= 1 ? { width: "100%" } : { height: "100%" }),
          }}
        >
          <TemplateThumbnail template={template.template} variantId={shownLook?.id} />
        </div>
        {multiLook && (
          /* Which look is showing, and how many there are — dots, the way a
             carousel says it, plus the name while one is cycling. */
          <span
            aria-hidden
            className="flex items-center"
            style={{
              position: "absolute",
              left: 8,
              bottom: 8,
              gap: 4,
              padding: "3px 6px",
              borderRadius: "var(--radius-pill)",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 10,
              lineHeight: 1,
              pointerEvents: "none",
            }}
          >
            {looks.map((v, i) => {
              const on = shownLook
                ? i === lookIndex
                : Boolean(v.isDefault) || (i === 0 && !looks.some((x) => x.isDefault));
              return (
                <span
                  key={v.id}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: on ? "#fff" : "rgba(255,255,255,0.45)",
                  }}
                />
              );
            })}
            {shownLook && <span style={{ marginLeft: 3 }}>{shownLook.name}</span>}
          </span>
        )}
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
