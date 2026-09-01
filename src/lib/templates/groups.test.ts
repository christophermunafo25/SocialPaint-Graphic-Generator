import { describe, expect, it } from "vitest";
import type { TemplateSchema } from "@/lib/types";
import { toCatalogTemplate } from "./catalog";
import { buildGroups, groupIdsOf } from "./groups";

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
