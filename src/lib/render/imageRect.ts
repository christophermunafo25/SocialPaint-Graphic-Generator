import type { ImageRect } from "../types";

/** Far enough for any real crop (an image ten times its box), small enough
 * that a bad row can't ask the browser for a gigantic layer. */
export const MAX_SPAN = 10;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** An image field's rect as the renderer may draw it, or null to fill the
 * box (today's behaviour). Read defensively, like effects: anything that
 * isn't a sane rect is ignored rather than drawn. */
export function readImageRect(raw: unknown): ImageRect | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!finite(r.x) || !finite(r.y) || !finite(r.width) || !finite(r.height)) return null;
  if (r.width <= 0 || r.height <= 0 || r.width > MAX_SPAN || r.height > MAX_SPAN) return null;
  if (Math.abs(r.x) > MAX_SPAN || Math.abs(r.y) > MAX_SPAN) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

/** The <img> placement for a rect, in percent of the box. */
export const imageRectStyle = (rect: ImageRect) => ({
  position: "absolute" as const,
  left: `${rect.x * 100}%`,
  top: `${rect.y * 100}%`,
  width: `${rect.width * 100}%`,
  height: `${rect.height * 100}%`,
  maxWidth: "none",
  maxHeight: "none",
});
