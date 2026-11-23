/** Values the inspector reads and writes, kept apart so they can be tested
 * without rendering it. */

/** Crop presets for a photo your team adds. "Box" crops to the box's own
 * shape (no ratio of its own); "Custom" is any other ratio, typed. */
export const CROP_RATIOS: Array<{ label: string; ratio: number }> = [
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "1.91:1", ratio: 1.91 },
];

/** The Crop select's choice for a stored ratio: "box" when there is none, a
 * preset's label when the ratio is one (to two decimals), else "custom". */
export function cropChoice(ratio: number | undefined): string {
  if (ratio === undefined) return "box";
  return CROP_RATIOS.find((r) => Math.abs(r.ratio - ratio) < 0.005)?.label ?? "custom";
}

/** A hex as typed: six or eight digits, with or without the #. Returns
 * #RRGGBB or #RRGGBBAA in capitals, or null when it is not a colour. */
export function parseHexInput(raw: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(raw.trim());
  return m ? `#${m[1].toUpperCase()}${m[2] ? m[2].toUpperCase() : ""}` : null;
}

/** A six-digit hex typed over an eight-digit colour keeps its alpha: the
 * row shows the colour, and the opacity beside it owns the alpha. */
export function keepAlpha(typed: string, current: string): string {
  return typed.length === 7 && current.length === 9
    ? typed + current.slice(7).toUpperCase()
    : typed;
}
