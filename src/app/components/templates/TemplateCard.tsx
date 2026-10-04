import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import { Tag } from "../primitives";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** Up to two: a third starts competing with the meta line. */
const MAX_TAGS = 2;

/** How long each look shows while the card steps through them. */
const LOOK_STEP_MS = 1000;

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
 * The whole card is one button that opens the fill page; the go arrow is
 * aria-hidden, so a screen reader hears one named target per card and the
 * keyboard has one stop.
 *
 * A template with several looks shows them off while the pointer (or
 * focus) rests on the card: the preview steps through every look, one a
 * second, with dots and the look's name on an Overlay tag, and settles back
 * on the default when attention moves on (CJ, 2026-10-04, keeping today's
 * hover over the frame's dim and Edit circle). The swap is a repaint
 * through the one renderer, not an animation, so it is the same under
 * reduced motion.
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
  const looks = useMemo(() => template.template.variants ?? [], [template.template.variants]);
  const multiLook = looks.length > 1;
  const landscape = template.width / template.height >= 1;

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
      LOOK_STEP_MS,
    );
    return () => window.clearInterval(id);
  }, [attended, multiLook, looks]);
  const shownLook = lookIndex === null ? undefined : looks[lookIndex];
  const defaultIndex = Math.max(
    0,
    looks.findIndex((v) => v.isDefault),
  );

  return (
    <button
      type="button"
      className="ui-reset ui-ring sp-tcard"
      onClick={() => onOpen(template)}
      onMouseEnter={() => setAttended(true)}
      onMouseLeave={() => setAttended(false)}
      onFocus={() => setAttended(true)}
      onBlur={() => setAttended(false)}
      aria-label={`${template.name}, ${template.platformLabel}, ${template.width} by ${template.height}${
        multiLook ? `, ${looks.length} looks` : ""
      }`}
    >
      <span
        className="sp-tcard__frame"
        style={frame ? ({ "--frame-ratio": frame } as React.CSSProperties) : undefined}
      >
        {/* Contain, never crop, with a 2px overscan the frame clips:
            sub-pixel contain rounding reads as a hairline seam around the
            artwork otherwise. */}
        <span
          style={{
            display: "block",
            aspectRatio: `${template.width} / ${template.height}`,
            flexShrink: 0,
            ...(landscape ? { width: "calc(100% + 2px)" } : { height: "calc(100% + 2px)" }),
          }}
        >
          <TemplateThumbnail template={template.template} variantId={shownLook?.id} />
        </span>
        {multiLook && (
          // Which look is showing, and how many there are: dots, the way a
          // carousel says it, plus the name while the card steps through.
          <Tag kind="overlay" className="sp-tcard__looks" aria-hidden>
            <span className="sp-tcard__dots">
              {looks.map((v, i) => (
                <span
                  key={v.id}
                  className="sp-tcard__dot"
                  data-on={(lookIndex ?? defaultIndex) === i || undefined}
                />
              ))}
            </span>
            {shownLook && <span>{shownLook.name}</span>}
          </Tag>
        )}
      </span>

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
