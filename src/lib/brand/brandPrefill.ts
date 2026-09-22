// Pure mapping from a website extraction to the onboarding wizard's state.
// The wizard applies this to its palette step; the admin edits everything
// before finish() writes a byte.

import type { BrandColor } from "../types";
import type { ExtractedBrandColor } from "./brandFromWebsite";

const PALETTE_CAP = 12;

/** Merge extracted colors over the wizard's default palette. The first
 * extracted color of each role recolors the matching locked default entry
 * (and stamps the role, which the starter templates' accent ladder reads);
 * the rest append as new entries, roleless — each role belongs to at most
 * one color. Capped at the palette limit. */
export function mergeExtractedColors(
  defaults: BrandColor[],
  extracted: ExtractedBrandColor[],
): BrandColor[] {
  const out = defaults.map((c) => ({ ...c }));
  const claimed = new Set<string>();
  const leftovers: ExtractedBrandColor[] = [];

  for (const color of extracted) {
    if (claimed.has(color.role)) {
      leftovers.push(color);
      continue;
    }
    const target = out.find((c) => c.key === color.role);
    if (!target) {
      leftovers.push(color);
      continue;
    }
    claimed.add(color.role);
    target.hex = color.hex;
    target.role = color.role;
  }

  let n = 1;
  for (const color of leftovers) {
    if (out.length >= PALETTE_CAP) break;
    if (out.some((c) => c.hex.toLowerCase() === color.hex.toLowerCase())) continue;
    out.push({ key: `web-${n}`, name: color.name, hex: color.hex });
    n += 1;
  }
  return out;
}
