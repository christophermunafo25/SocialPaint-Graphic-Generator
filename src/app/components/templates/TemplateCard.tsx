import React, { useEffect, useMemo, useState } from "react";
import type { CatalogTemplate } from "@/lib/templates/catalog";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** How long each variation shows while the card steps through them. */
const LOOK_STEP_MS = 1000;

/** The card's size line, as the frames write it: "1080 × 1350", plus
 * " · 3 variations" when the template has more than one (decision 8: the
 * interface calls looks variations). While the card steps through its
 * variations, the showing one's name takes the count's place (CJ,
 * 2026-11-25). */
export function cardMeta(template: CatalogTemplate, showing?: string): string {
  const variations = template.template.variants?.length ?? 0;
  const size = `${template.width} × ${template.height}`;
  if (variations <= 1) return size;
  return `${size} · ${showing ?? `${variations} variations`}`;
}

/**
 * The library's template card (new brand, 2308:4): the preview, then the
 * name over its size line. Shelves, result grids and the one grid share
 * it. Nothing is drawn over the template (CJ, 2026-11-25: no go arrow and
 * no variation tag).
 *
 * The whole card is one button that opens the fill page, so a screen
 * reader hears one named target per card and the keyboard has one stop.
 * It carries its template's id, so the library can hand focus back to it
 * when the layout around it changes.
 *
 * In the library's one grid, `fit` draws the preview as the Template
 * Builder list's well: square and sunken, with the template fitted 12 in
 * at its own ratio, so a grid of mixed shapes keeps even rows.
 *
 * A template with several variations shows them off while the pointer (or
 * focus) rests on the card: the preview steps through every one, one a
 * second, the size line naming the one showing in place of the count, and
 * it settles back on the default and the count when attention moves on
 * (judgement call 4). Under reduced motion it stays on the default.
 */
export function TemplateCard({
  template,
  frame,
  fit = false,
  onOpen,
}: {
  template: CatalogTemplate;
  /** The group's frame ratio as a CSS aspect-ratio, e.g. "1200 / 627".
   *  Every card in a group shares it, which keeps a row even. */
  frame?: string;
  /** The square well the one grid draws, the template fitted 12 in. */
  fit?: boolean;
  onOpen(template: CatalogTemplate): void;
}) {
  const looks = useMemo(() => template.template.variants ?? [], [template.template.variants]);
  const multiLook = looks.length > 1;
  const landscape = template.width / template.height >= 1;

  const [attended, setAttended] = useState(false);
  const [lookIndex, setLookIndex] = useState<number | null>(null);
  useEffect(() => {
    // Under reduced motion the card holds its first variation (RULES.md
    // section 6).
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!attended || !multiLook || still) {
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

  return (
    <button
      type="button"
      className="ui-reset ui-ring sp-tcard"
      data-template-id={template.id}
      onClick={() => onOpen(template)}
      onMouseEnter={() => setAttended(true)}
      onMouseLeave={() => setAttended(false)}
      onFocus={() => setAttended(true)}
      onBlur={() => setAttended(false)}
      aria-label={`${template.name}, ${template.platformLabel}, ${template.width} by ${template.height}${
        multiLook ? `, ${looks.length} variations` : ""
      }`}
    >
      {fit ? (
        <span className="sp-tcard__frame" data-fit>
          <span
            className="sp-tcard__art"
            style={{ "--fit-ratio": template.width / template.height } as React.CSSProperties}
          >
            {/* 1px of overscan: the renderer's contain rounds a hair short
                of the box. */}
            <span className="sp-tcard__overscan">
              <TemplateThumbnail template={template.template} variantId={shownLook?.id} />
            </span>
          </span>
        </span>
      ) : (
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
        </span>
      )}

      <span className="sp-tcard__meta">
        <span className="sp-tcard__text">
          <span className="t-label-m sp-tcard__title" title={template.name}>
            {template.name}
          </span>
          <span className="t-caption-m sp-tcard__size">{cardMeta(template, shownLook?.name)}</span>
        </span>
      </span>
    </button>
  );
}
