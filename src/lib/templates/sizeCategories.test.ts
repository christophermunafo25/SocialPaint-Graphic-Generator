import { describe, expect, it } from "vitest";
import { PLATFORMS, SIZE_CATALOG, sizeById } from "./platforms";
import {
  CATEGORIES,
  CATEGORY_OF_PLATFORM,
  categoriesPresent,
  platformsInCategory,
  sizeMatchesQuery,
  sizesFor,
} from "./sizeCategories";

const byId = (id: string) => {
  const size = sizeById(id);
  if (!size) throw new Error(`Not in the catalogue: ${id}`);
  return size;
};

/** The multi-platform proof case: Instagram, Facebook, AND LinkedIn. */
const portrait = byId("ig-portrait-1080x1350");

describe("the platform → category map", () => {
  it("maps every platform to exactly one known category", () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PLATFORMS) {
      expect(known.has(CATEGORY_OF_PLATFORM[p.id])).toBe(true);
    }
    // No orphan entries either: the map covers the platforms and nothing else.
    expect(Object.keys(CATEGORY_OF_PLATFORM).sort()).toEqual(PLATFORMS.map((p) => p.id).sort());
  });

  it("keeps the rail order the spec set", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      "social",
      "email",
      "display",
      "web",
      "print",
      "general",
    ]);
  });
});

describe("categoriesPresent", () => {
  it("yields every populated category for the full catalogue, in rail order", () => {
    expect(categoriesPresent(SIZE_CATALOG).map((c) => c.id)).toEqual([
      "social",
      "email",
      "display",
      "web",
      "general",
    ]);
  });

  it("drops the categories a workspace has emptied", () => {
    const displayOnly = SIZE_CATALOG.filter((s) => s.platforms.includes("display"));
    expect(categoriesPresent(displayOnly).map((c) => c.id)).toEqual(["display"]);
  });

  it("keeps a category alive through any one of its platforms", () => {
    // fb-link is facebook AND web: enabled alone it populates both rails.
    expect(categoriesPresent([byId("fb-link-1200x630")]).map((c) => c.id)).toEqual([
      "social",
      "web",
    ]);
  });

  it("is empty for an empty size list", () => {
    expect(categoriesPresent([])).toEqual([]);
  });
});

describe("platformsInCategory", () => {
  it("lists social platforms in PLATFORMS order with enabled-size counts", () => {
    const entries = platformsInCategory("social", SIZE_CATALOG);
    const order = PLATFORMS.map((p) => p.id);
    const ids = entries.map((e) => e.platform.id);
    expect([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(ids);
    // The catalogue ships no threads size, so no threads chip.
    expect(ids).not.toContain("threads");
    // Instagram's count is its own membership, not the category total.
    expect(entries.find((e) => e.platform.id === "instagram")?.count).toBe(4);
  });

  it("drops a platform once the workspace disables its last size", () => {
    const withoutPins = SIZE_CATALOG.filter((s) => !s.platforms.includes("pinterest"));
    const ids = platformsInCategory("social", withoutPins).map((e) => e.platform.id);
    expect(ids).not.toContain("pinterest");
  });
});

describe("sizesFor", () => {
  it("shows a multi-platform size under each of its platform chips", () => {
    for (const platform of ["instagram", "facebook", "linkedin"] as const) {
      expect(sizesFor("social", SIZE_CATALOG, platform)).toContain(portrait);
    }
  });

  it("shows each size once per filtered view, never duplicated", () => {
    for (const view of [
      sizesFor("social", SIZE_CATALOG),
      sizesFor("social", SIZE_CATALOG, "instagram"),
    ]) {
      expect(view.filter((s) => s.id === portrait.id)).toHaveLength(1);
    }
  });

  it("scopes the unfiltered view to the category", () => {
    const social = sizesFor("social", SIZE_CATALOG);
    expect(social.map((s) => s.id)).not.toContain("email-header-600x200");
    expect(sizesFor("email", SIZE_CATALOG).map((s) => s.id)).toEqual(["email-header-600x200"]);
  });
});

describe("sizeMatchesQuery", () => {
  it("matches dimensions in both notations", () => {
    expect(sizeMatchesQuery(portrait, "1080×1350")).toBe(true);
    expect(sizeMatchesQuery(portrait, "1080x1350")).toBe(true);
  });

  it("matches the named ratio", () => {
    expect(sizeMatchesQuery(portrait, "4:5")).toBe(true);
    expect(sizeMatchesQuery(byId("ig-story-1080x1920"), "9:16")).toBe(true);
  });

  it("matches the asset type", () => {
    expect(sizeMatchesQuery(portrait, "portrait")).toBe(true);
    expect(sizeMatchesQuery(byId("yt-thumbnail-1280x720"), "thumbnail")).toBe(true);
  });

  it("matches each platform label, case-insensitively", () => {
    for (const label of ["instagram", "Facebook", "LINKEDIN"]) {
      expect(sizeMatchesQuery(portrait, label)).toBe(true);
    }
    expect(sizeMatchesQuery(portrait, "youtube")).toBe(false);
  });

  it("ANDs tokens — narrowing, never widening", () => {
    expect(sizeMatchesQuery(portrait, "instagram portrait")).toBe(true);
    expect(sizeMatchesQuery(portrait, "instagram thumbnail")).toBe(false);
  });

  it("matches everything on an empty or blank query", () => {
    expect(sizeMatchesQuery(portrait, "")).toBe(true);
    expect(sizeMatchesQuery(portrait, "   ")).toBe(true);
  });
});
