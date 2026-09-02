import {
  PLATFORMS,
  aspectRatioOf,
  platformById,
  type CanvasSize,
  type Platform,
  type PlatformId,
} from "./platforms";

/** The size gallery's category layer OVER PlatformId — a browsing rail, not
 *  a new field on the catalogue. SIZE_CATALOG stays the single source of
 *  dimension data; this module only says which rail section a platform's
 *  sizes browse under. */
export type SizeCategoryId = "social" | "email" | "display" | "web" | "print" | "general";

export interface SizeCategory {
  id: SizeCategoryId;
  /** Sentence case, per the DS content rules. */
  label: string;
}

/** Every platform belongs to exactly one category. The Record type makes a
 *  missing platform a compile error, and the colocated test holds the other
 *  direction: no platform may ever map to an unknown category. */
export const CATEGORY_OF_PLATFORM: Record<PlatformId, SizeCategoryId> = {
  linkedin: "social",
  instagram: "social",
  facebook: "social",
  x: "social",
  tiktok: "social",
  youtube: "social",
  pinterest: "social",
  threads: "social",
  email: "email",
  display: "display",
  web: "web",
  print: "print",
  general: "general",
};

/** Rail display order. Social first because the product is social-first —
 *  satisfied by DEFAULTING there, never by hiding the rest. The gallery
 *  appends its Custom size entry after these; custom is a mode, not a
 *  category with catalogue sizes, so it does not live here. */
export const CATEGORIES: SizeCategory[] = [
  { id: "social", label: "Social media" },
  { id: "email", label: "Email" },
  { id: "display", label: "Display ads" },
  { id: "web", label: "Web and Open Graph" },
  { id: "print", label: "Print" },
  { id: "general", label: "General" },
];

const inCategory = (size: CanvasSize, category: SizeCategoryId): boolean =>
  size.platforms.some((p) => CATEGORY_OF_PLATFORM[p] === category);

/** The categories the given (workspace-enabled) sizes actually populate, in
 *  rail order. A category with nothing in it does not render. */
export const categoriesPresent = (sizes: CanvasSize[]): SizeCategory[] =>
  CATEGORIES.filter((c) => sizes.some((s) => inCategory(s, c.id)));

/** The chip bar for one category: its platforms in PLATFORMS order — the
 *  deliberate shelf order, never by count — each with the number of enabled
 *  sizes it would show. Platforms with zero sizes are dropped rather than
 *  rendered as dead chips. */
export const platformsInCategory = (
  category: SizeCategoryId,
  sizes: CanvasSize[],
): Array<{ platform: Platform; count: number }> =>
  PLATFORMS.filter((p) => CATEGORY_OF_PLATFORM[p.id] === category)
    .map((platform) => ({
      platform,
      count: sizes.filter((s) => s.platforms.includes(platform.id)).length,
    }))
    .filter((entry) => entry.count > 0);

/** One filtered view of the grid. A multi-platform size appears under EACH
 *  of its platforms' chips — the catalogue's own behavior — but only once
 *  per view: the input list holds each size once and this never duplicates. */
export const sizesFor = (
  category: SizeCategoryId,
  sizes: CanvasSize[],
  platform: PlatformId | null = null,
): CanvasSize[] =>
  sizes.filter((s) => (platform ? s.platforms.includes(platform) : inCategory(s, category)));

/** Local search over the visible sizes: asset type, every platform label,
 *  the dimensions in both notations, and the named ratio. Tokens AND
 *  together, matching the catalogue search's narrowing behavior. This is a
 *  predicate over a dozen visible cards, not an index — searchIndex.ts
 *  indexes templates and is the wrong tool here. */
export const sizeMatchesQuery = (size: CanvasSize, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    size.assetType,
    ...size.platforms.map((p) => platformById(p).label),
    `${size.width}×${size.height}`,
    `${size.width}x${size.height}`,
    aspectRatioOf(size.width, size.height),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
};
