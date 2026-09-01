import type { CatalogTemplate } from "./catalog";
import { PLATFORMS, type Orientation, type Platform, type PlatformId } from "./platforms";

/** A shelf/chip unit: ONE platform at one shape — never a platform list. A
 *  template that serves several platforms belongs to each platform's group,
 *  so a member can filter by just the platform they're posting to. Grouping
 *  down to the shape is what lets a rail's frames all be the same ratio — a
 *  row of banners and a row of stories each sit evenly, instead of every
 *  card being letterboxed into a common square. */
export interface TemplateGroup {
  /** URL-safe, stable: "facebook-1-91-1". */
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

/** The chip id for one platform at one shape — the shared vocabulary between
 *  the chip groups, the per-template membership list, and a shelf's
 *  "View all" target. */
export const groupId = (platform: PlatformId, aspectRatio: string): string =>
  `${platform}-${slug(aspectRatio)}`;

/** Every group a template belongs to — one per platform it serves. Deriving
 *  this directly means a filter can be applied without rebuilding the groups
 *  off a filtered set — which would make a selected group vanish the moment
 *  a search excluded it. */
export const groupIdsOf = (t: CatalogTemplate): string[] =>
  t.platforms.map((p) => groupId(p, t.aspectRatio));

/**
 * Build the catalogue's groups: platform order first (the fixed list), then
 * shape order within each platform. Empty combinations never appear.
 *
 * One group per PLATFORM per shape. A template that serves several platforms
 * joins each one's group — it shows on the Instagram shelf AND the LinkedIn
 * shelf, and either chip finds it. The chip label stays a single platform;
 * multi-platform membership lives on the template, not on the filter.
 */
export function buildGroups(templates: CatalogTemplate[]): TemplateGroup[] {
  // platform → named ratio → members. The named ratio keeps near-identical
  // dimensions together (1200×627 and 1200×630 are both "1.91:1") while the
  // platform axis keeps LinkedIn's and Facebook's shelves apart.
  const byPlatform = new Map<PlatformId, Map<string, CatalogTemplate[]>>();
  for (const t of templates) {
    for (const p of t.platforms) {
      let ratios = byPlatform.get(p);
      if (!ratios) byPlatform.set(p, (ratios = new Map()));
      const bucket = ratios.get(t.aspectRatio);
      if (bucket) bucket.push(t);
      else ratios.set(t.aspectRatio, [t]);
    }
  }

  const groups: TemplateGroup[] = [];
  for (const platform of PLATFORMS) {
    const mine = [...(byPlatform.get(platform.id)?.values() ?? [])];

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
      const base = `${platform.label} ${ORIENTATION_LABEL[head.orientation]}`;
      const ambiguous = (orientationCounts.get(head.orientation) ?? 0) > 1;
      groups.push({
        id: groupId(platform.id, head.aspectRatio),
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

/**
 * Build the browse/search SECTIONS: one per platform SET at one shape, so a
 * template appears exactly once, labelled with every platform it serves —
 * "Instagram · Facebook · LinkedIn Portrait". The section sits in the shelf
 * order of its PRIMARY platform (first in the size's list).
 *
 * This is deliberately the other half of `buildGroups`: the chips filter by
 * ONE platform (inclusive membership), the sections show each template ONCE
 * (exact-set membership). A section's "View all" bridges the two by
 * targeting its primary platform's chip.
 */
export function buildShelves(templates: CatalogTemplate[]): TemplateGroup[] {
  const buckets = new Map<string, CatalogTemplate[]>();
  for (const t of templates) {
    // The platform SET is part of the bucket: 1200×627 (LinkedIn) must not
    // merge with 1200×630 (Facebook) just because both are 1.91:1.
    const key = `${t.platforms.join("+")}|${t.aspectRatio}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(t);
    else buckets.set(key, [t]);
  }

  const shelves: TemplateGroup[] = [];
  for (const platform of PLATFORMS) {
    const mine = [...buckets.values()].filter((members) => members[0].platform === platform.id);

    mine.sort(
      (a, b) =>
        ORIENTATION_ORDER.indexOf(a[0].orientation) - ORIENTATION_ORDER.indexOf(b[0].orientation) ||
        b[0].width / b[0].height - a[0].width / a[0].height,
    );

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
      shelves.push({
        // Distinct id space from the chips ("instagram-facebook-4-5" vs
        // "instagram-4-5") — a shelf is never a filter target itself.
        id: `${head.platforms.join("-")}-${slug(head.aspectRatio)}`,
        platform,
        orientation: head.orientation,
        aspectRatio: head.aspectRatio,
        label: ambiguous ? `${base} (${head.aspectRatio})` : base,
        frame: `${head.width} / ${head.height}`,
        templates: members,
      });
    }
  }
  return shelves;
}
