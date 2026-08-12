import type { TemplateSchema } from "@/lib/types";
import {
  aspectRatioOf,
  classifySize,
  orientationOf,
  platformById,
  type Orientation,
  type PlatformId,
} from "./platforms";

export type ColorMode = "light" | "dark" | "mesh";

/** A published template as the Brand templates catalogue sees it: the stored
 *  schema plus everything derivable from it.
 *
 *  Every field here is either stored or computed from stored data. The spec's
 *  `layout` and `previewRef` are absent on purpose — nothing in
 *  `TemplateSchema` backs them, and a made-up layout name would show up in
 *  search results as if it meant something. */
export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  /** Primary platform (first of `platforms`) — icons and stable group ids. */
  platform: PlatformId;
  /** Every platform this size serves, display order. */
  platforms: PlatformId[];
  /** All platform names joined — "Instagram · Facebook · LinkedIn". */
  platformLabel: string;
  assetType: string;
  width: number;
  height: number;
  aspectRatio: string;
  orientation: Orientation;
  /** The admin's own classification: category first, then tags. */
  useCases: string[];
  /** Null when a background image makes the answer unknowable. */
  colorMode: ColorMode | null;
  textSlots: number;
  imageSlots: number;
  createdAt: string;
  /** The stored record, for rendering the live preview. */
  template: TemplateSchema;
}

/** Relative luminance, WCAG formula. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** Light or dark by the background's own luminance — derived, not guessed.
 *  Precedence matches the renderer: image → gradient → color → white. */
function colorModeOf(t: TemplateSchema): ColorMode | null {
  if (t.backgroundUrl) return null; // an image can be anything
  if (t.backgroundGradient?.stops?.length) return "mesh";
  const l = luminance(t.backgroundColor ?? "#ffffff");
  if (l === null) return null;
  return l > 0.5 ? "light" : "dark";
}

export function toCatalogTemplate(t: TemplateSchema): CatalogTemplate {
  const { platforms, assetType } = classifySize(t.canvasWidth, t.canvasHeight);
  const editable = t.fields.filter((f) => !f.static);
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    platform: platforms[0],
    platforms,
    platformLabel: platforms.map((p) => platformById(p).label).join(" · "),
    assetType,
    width: t.canvasWidth,
    height: t.canvasHeight,
    aspectRatio: aspectRatioOf(t.canvasWidth, t.canvasHeight),
    orientation: orientationOf(t.canvasWidth, t.canvasHeight),
    useCases: [t.category, ...t.tags].map((s) => s.trim()).filter(Boolean),
    colorMode: colorModeOf(t),
    textSlots: editable.filter((f) => f.type !== "image" && f.type !== "shape").length,
    imageSlots: editable.filter((f) => f.type === "image").length,
    createdAt: t.createdAt,
    template: t,
  };
}

/** "1080 × 1350 · 4:5" — the card's meta line. Uses ×, not x.
 *
 *  Orientation is deliberately absent: every card sits under a heading that
 *  already names it ("Instagram Vertical"), and repeating it here pushed the
 *  line past a landscape card's width and truncated the ratio. */
export function metaLine(t: CatalogTemplate): string {
  return `${t.width} × ${t.height} · ${t.aspectRatio}`;
}
