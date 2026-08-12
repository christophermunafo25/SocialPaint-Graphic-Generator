import type { CatalogTemplate } from "./catalog";
import { PLATFORMS, type Orientation, type Platform } from "./platforms";

/** A shelf/chip unit: one platform at one shape. Grouping this far down is
 *  what lets a rail's frames all be the same ratio — a row of banners and a
 *  row of stories each sit evenly, instead of every card being letterboxed
 *  into a common square. */
export interface TemplateGroup {
  /** URL-safe, stable: "facebook-1-91x1". */
  id: string;
  platform: Platform;
  orientation: Orientation;
  /** The named ratio every template in the group shares, e.g. "4:5". */
  aspectRatio: string;
  /** "Facebook Landscape", disambiguated to "Instagram Portrait (3:4)" when
   *  a platform has two shapes that share an orientation. */
  label: string;
  /** Frame ratio for the group's cards, as a CSS aspect-ratio value. Taken
   *  from a real member so the frame matches the artwork it holds. */
  frame: string;
  templates: CatalogTemplate[];
}

const ORIENTATION_LABEL: Record<Orientation, string> = {
  landscape: "Landscape",
  square: "Square",
  portrait: "Portrait",
  vertical: "Vertical",
};

/** Within a platform, shapes run widest to tallest. Deliberate, not by count
 *  — the same platform reads the same way every visit. */
const ORIENTATION_ORDER: Orientation[] = ["landscape", "square", "portrait", "vertical"];

const slug = (s: string) =>
  s
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/** The group a template belongs to. Deriving this directly means a filter
 *  can be applied without rebuilding the groups off a filtered set — which
 *  would make a selected group vanish the moment a search excluded it. */
export const groupIdOf = (t: CatalogTemplate): string =>
  `${t.platforms.join("-")}-${slug(t.aspectRatio)}`;

/**
 * Build the catalogue's groups: platform order first (the fixed list), then
 * shape order within each platform. Empty combinations never appear.
 */
export function buildGroups(templates: CatalogTemplate[]): TemplateGroup[] {
  const buckets = new Map<string, CatalogTemplate[]>();
  for (const t of templates) {
    // The platform SET is part of the bucket: 1200×627 (LinkedIn) must not
    // merge with 1200×630 (Facebook) just because both are 1.91:1.
    const key = `${t.platforms.join("+")}|${t.aspectRatio}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(t);
    else buckets.set(key, [t]);
  }

  const groups: TemplateGroup[] = [];
  for (const platform of PLATFORMS) {
    // A bucket belongs to the shelf of its PRIMARY platform (first in the
    // list) — a shared size appears once, labelled with every platform.
    const mine = [...buckets.values()].filter((members) => members[0].platform === platform.id);

    mine.sort(
      (a, b) =>
        ORIENTATION_ORDER.indexOf(a[0].orientation) - ORIENTATION_ORDER.indexOf(b[0].orientation) ||
        b[0].width / b[0].height - a[0].width / a[0].height,
    );

    // A platform can hold two shapes that share an orientation (4:5 and 3:4
    // are both "Portrait"); only then does the label need the ratio.
    const orientationCounts = new Map<Orientation, number>();
    for (const members of mine) {
      orientationCounts.set(
        members[0].orientation,
        (orientationCounts.get(members[0].orientation) ?? 0) + 1,
      );
    }

    for (const members of mine) {
      const head = members[0];
      const base = `${head.platformLabel} ${ORIENTATION_LABEL[head.orientation]}`;
      const ambiguous = (orientationCounts.get(head.orientation) ?? 0) > 1;
      groups.push({
        id: groupIdOf(head),
        platform,
        orientation: head.orientation,
        aspectRatio: head.aspectRatio,
        label: ambiguous ? `${base} (${head.aspectRatio})` : base,
        frame: `${head.width} / ${head.height}`,
        templates: members,
      });
    }
  }
  return groups;
}
