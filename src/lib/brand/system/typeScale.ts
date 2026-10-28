// The type scale (brand-system Phase 5, D3): a text block's size from its
// role and the canvas, not a fixed pixel size. Pure. Each canvas shape has a
// body size and a floor; every other role is a multiple of the body, and the
// brand's one number, its ratio, sets how loud the headline is against the
// body. Sizes scale with the canvas's width, so a 2160-wide canvas doubles
// them.

import type { BrandKit, BrandTypeStyle, TypeRole } from "../../types";

export const TYPE_ROLES: readonly TypeRole[] = [
  "display",
  "headline",
  "subhead",
  "body",
  "label",
  "cta",
  "number",
];

export type CanvasShape = "feed" | "square" | "story" | "landscape";

/** Body size and the floor no text drops below, at 1080 wide (landscape at
 * its own 1200). */
export const BASE: Record<CanvasShape, { width: number; body: number; floor: number }> = {
  feed: { width: 1080, body: 36, floor: 32 },
  square: { width: 1080, body: 34, floor: 32 },
  story: { width: 1080, body: 40, floor: 32 },
  landscape: { width: 1200, body: 34, floor: 34 },
};

/** The headline is never under 2.8 times the body. */
export const MIN_RATIO = 2.8;
export const DEFAULT_RATIO = 2.9;
const MAX_RATIO = 5;

/** Which row of the table a canvas reads. */
export function canvasShape(width: number, height: number): CanvasShape {
  const aspect = width / Math.max(1, height);
  if (aspect >= 1.5) return "landscape";
  if (aspect <= 0.65) return "story";
  if (aspect >= 0.95) return "square";
  return "feed";
}

/** The brand's headline-over-body ratio, held to its range. */
export const brandRatio = (kit: BrandKit | null | undefined): number => {
  const r = kit?.system?.type?.ratio;
  return typeof r === "number" && Number.isFinite(r)
    ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, r))
    : DEFAULT_RATIO;
};

/** Every role's size in px for a canvas and a brand. */
export function typeScale(
  canvas: { width: number; height: number },
  kit?: BrandKit | null,
): Record<TypeRole, number> {
  const row = BASE[canvasShape(canvas.width, canvas.height)];
  const k = canvas.width / row.width;
  const body = row.body * k;
  const floor = row.floor * k;
  const headline = body * brandRatio(kit);
  const display = headline * 1.33;
  const size = (v: number) => Math.round(Math.max(floor, v));
  return {
    display: size(display),
    headline: size(headline),
    subhead: size(body * 1.5),
    body: size(body),
    label: size(floor),
    cta: size(body),
    number: size(display * 1.1),
  };
}

/** A style's tracking at a size: stored in px against the style's own size,
 * it keeps the same share of the size wherever the text lands, so tight
 * tracking on a 104px headline stays tight at 60px. */
export function trackingPx(
  style: Pick<BrandTypeStyle, "letterSpacingPx" | "fontSizePx">,
  size: number,
): number {
  const px = style.letterSpacingPx ?? 0;
  if (!px || !style.fontSizePx) return px;
  return Math.round((px / style.fontSizePx) * size * 100) / 100;
}
