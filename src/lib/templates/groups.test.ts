import { describe, expect, it } from "vitest";
import type { TemplateSchema } from "@/lib/types";
import { toCatalogTemplate } from "./catalog";
import {
  buildGroups,
  buildPlatformFacets,
  buildShelves,
  groupId,
  groupIdsOf,
  servesPlatform,
} from "./groups";

let seq = 0;
const mk = (name: string, width: number, height: number): ReturnType<typeof toCatalogTemplate> => {
  seq += 1;
  const t: TemplateSchema = {
    id: `t${seq}`,
    companyId: "c1",
    name,
    description: "",
    category: "",
    tags: [],
    status: "published",
    canvasWidth: width,
    canvasHeight: height,
    backgroundUrl: "",
    fields: [],
    captionTemplate: "",
    createdAt: `2026-01-0${seq}T00:00:00.000Z`,
    updatedAt: `2026-01-0${seq}T00:00:00.000Z`,
  };
  return toCatalogTemplate(t);
};

describe("buildGroups — one platform per group", () => {
  // 1080×1350 serves Instagram, Facebook, AND LinkedIn.
  const portrait = mk("Portrait promo", 1080, 1350);
  const square = mk("Square post", 1080, 1080); // Instagram · Facebook
  const groups = buildGroups([portrait, square]);

  it("labels every group with exactly one platform", () => {
    for (const g of groups) {
      expect(g.label.startsWith(g.platform.label)).toBe(true);
      expect(g.label).not.toContain("·");
    }
  });

  it("puts a multi-platform template in each of its platforms' groups", () => {
    const holding = groups.filter((g) => g.templates.includes(portrait));
    expect(holding.map((g) => g.id).sort()).toEqual([
      "facebook-4-5",
      "instagram-4-5",
      "linkedin-4-5",
    ]);
    expect(holding.map((g) => g.label).sort()).toEqual([
      "Facebook Portrait",
      "Instagram Portrait",
      "LinkedIn Portrait",
    ]);
  });

  it("keeps groups in the fixed platform order", () => {
    // PLATFORMS order: linkedin, instagram, facebook, …
    expect(groups.map((g) => g.platform.id)).toEqual([
      "linkedin",
      "instagram",
      "instagram",
      "facebook",
      "facebook",
    ]);
  });

  it("groupIdsOf matches the built groups, so filtering needs no rebuild", () => {
    for (const g of groups) {
      for (const t of g.templates) expect(groupIdsOf(t)).toContain(g.id);
    }
    expect(groupIdsOf(square).sort()).toEqual(["facebook-1-1", "instagram-1-1"]);
  });

  it("keeps same-ratio sizes on DIFFERENT platforms apart", () => {
    // 1200×627 is LinkedIn-only; 1200×630 is Facebook (+ web). Both 1.91:1.
    const li = mk("LI banner", 1200, 627);
    const fb = mk("FB link", 1200, 630);
    const g = buildGroups([li, fb]);
    const linkedin = g.find((x) => x.id === "linkedin-1-91-1")!;
    const facebook = g.find((x) => x.id === "facebook-1-91-1")!;
    expect(linkedin.templates).toEqual([li]);
    expect(facebook.templates).toEqual([fb]);
  });

  describe("buildShelves — every template exactly once", () => {
    const shelves = buildShelves([portrait, square]);

    it("holds each template in exactly one section", () => {
      for (const t of [portrait, square]) {
        expect(shelves.filter((s) => s.templates.includes(t))).toHaveLength(1);
      }
    });

    it("labels a section with every platform its size serves", () => {
      const s = shelves.find((x) => x.templates.includes(portrait))!;
      expect(s.label).toBe("Instagram · Facebook · LinkedIn Portrait");
      // Shelved under the PRIMARY platform (first in the size's list).
      expect(s.platform.id).toBe("instagram");
    });

    it("keeps same-ratio platform sets apart", () => {
      const li = mk("LI banner", 1200, 627);
      const fb = mk("FB link", 1200, 630);
      const s = buildShelves([li, fb]);
      expect(s).toHaveLength(2);
      expect(s.map((x) => x.templates)).toEqual([[li], [fb]]); // PLATFORMS order: LinkedIn first
    });

    it("a shelf's primary chip covers everything the shelf holds", () => {
      // The View-all bridge: chip membership is inclusive, so the primary
      // platform's chip is always a superset of the section.
      for (const s of shelves) {
        const chip = buildGroups([portrait, square]).find(
          (g) => g.id === groupId(s.platform.id, s.aspectRatio),
        )!;
        for (const t of s.templates) expect(chip.templates).toContain(t);
      }
    });
  });

  it("disambiguates only when a platform holds two shapes of one orientation", () => {
    // Display ads holds two landscape shapes → labels carry the ratio.
    const rect = mk("Medium rectangle", 300, 250);
    const leader = mk("Leaderboard", 728, 90);
    const g = buildGroups([rect, leader]).filter((x) => x.platform.id === "display");
    expect(g.map((x) => x.label).sort()).toEqual([
      "Display ads Landscape (364:45)",
      "Display ads Landscape (6:5)",
    ]);
  });
});

describe("buildPlatformFacets — one chip per platform, every shape", () => {
  const pin = mk("Pin", 1000, 1500); // Pinterest only
  const square = mk("Square post", 1080, 1080); // Instagram · Facebook
  const portrait = mk("Portrait promo", 1080, 1350); // Instagram · Facebook · LinkedIn
  const facets = buildPlatformFacets([pin, square, portrait]);
  const count = (id: string) => facets.find((f) => f.platform.id === id)?.count;

  it("counts a multi-platform template in every one of its platforms' chips", () => {
    expect(count("instagram")).toBe(2);
    expect(count("facebook")).toBe(2);
    expect(count("linkedin")).toBe(1);
    expect(count("pinterest")).toBe(1);
    // Inclusive membership: the chip counts overshoot the catalogue total on
    // purpose — there is no primary platform to make the arithmetic tidy.
    expect(facets.reduce((n, f) => n + f.count, 0)).toBe(6);
  });

  it("orders chips by PLATFORMS — never by count or by input order", () => {
    expect(facets.map((f) => f.platform.id)).toEqual([
      "linkedin",
      "instagram",
      "facebook",
      "pinterest",
    ]);
  });

  it("gives a platform with no templates no chip", () => {
    expect(facets.some((f) => f.platform.id === "x")).toBe(false);
    expect(facets.some((f) => f.platform.id === "general")).toBe(false);
    expect(buildPlatformFacets([])).toEqual([]);
  });

  it("servesPlatform agrees with the counts", () => {
    for (const f of facets) {
      const members = [pin, square, portrait].filter((t) => servesPlatform(t, f.platform.id));
      expect(members).toHaveLength(f.count);
    }
    expect(servesPlatform(portrait, "linkedin")).toBe(true);
    expect(servesPlatform(square, "linkedin")).toBe(false);
  });
});
