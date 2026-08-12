import { describe, expect, it } from "vitest";
import type { TemplateSchema } from "@/lib/types";
import { toCatalogTemplate } from "./catalog";
import { applyAliases, buildSearchIndex, normalize, searchTemplates } from "./searchIndex";

let seq = 0;
const mk = (
  name: string,
  width: number,
  height: number,
  extra: Partial<TemplateSchema> = {},
): TemplateSchema => ({
  id: `t${++seq}`,
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
  ...extra,
});

/** Sizes are the seeded canvas_presets, plus one deliberately unseeded size
 *  to prove a custom canvas still indexes and searches. */
const TEMPLATES = [
  mk("Quote card — centered", 1200, 627, {
    description: "A short pull quote over a solid field.",
    category: "Announcement",
    tags: ["hiring"],
    backgroundColor: "#082C1E",
  }),
  mk("Stat card", 1080, 1080, {
    description: "One number, one line of context.",
    category: "Stat",
    backgroundColor: "#FFFFFF",
  }),
  mk("Story teaser", 1080, 1920, {
    description: "Vertical teaser for stories.",
    category: "Launch",
    tags: ["carousel"],
  }),
  mk("Event banner", 1200, 630, { category: "Event" }),
  mk("Team welcome", 1440, 1440, { category: "Welcome" }),
  mk("Portrait promo", 1080, 1350, { category: "Promo" }),
].map(toCatalogTemplate);

const index = buildSearchIndex(TEMPLATES);
const names = (q: string) => searchTemplates(index, q).map((t) => t.name);

describe("normalize", () => {
  it("flattens every separator between two numbers", () => {
    expect(normalize("1080x1350")).toBe("1080 1350");
    expect(normalize("1080 × 1350")).toBe("1080 1350");
    expect(normalize("1080X1350")).toBe("1080 1350");
    expect(normalize("1080 1350")).toBe("1080 1350");
  });

  it("flattens ratio separators to the same shape", () => {
    expect(normalize("4:5")).toBe("4 5");
    expect(normalize("4/5")).toBe("4 5");
    expect(normalize("9:16")).toBe("9 16");
  });

  it("leaves the standalone x platform token alone", () => {
    expect(normalize("X")).toBe("x");
    expect(normalize(" x ")).toBe("x");
  });

  it("is case and whitespace tolerant", () => {
    expect(normalize("  LinkedIn   CAROUSEL ")).toBe("linkedin carousel");
  });
});

describe("aliases", () => {
  it.each([
    ["ig", "instagram"],
    ["insta", "instagram"],
    ["fb", "facebook"],
    ["li", "linkedin"],
    ["linked in", "linkedin"],
    ["yt", "youtube"],
    ["shorts", "youtube"],
    ["twitter", "x"],
    ["tweet", "x"],
    ["tik tok", "tiktok"],
  ])("maps %s to %s", (alias, canonical) => {
    expect(applyAliases(normalize(alias))).toBe(canonical);
  });

  it("resolves the longest phrase first", () => {
    // "linked in" must not be eaten by the bare "li" rule.
    expect(applyAliases(normalize("linked in"))).toBe("linkedin");
  });

  it("only rewrites whole tokens", () => {
    expect(applyAliases(normalize("light"))).toBe("light");
    expect(applyAliases(normalize("fbi"))).toBe("fbi");
  });

  it("finds a platform through its alias", () => {
    expect(names("ig")).toEqual(expect.arrayContaining(["Stat card", "Story teaser"]));
    expect(names("li")).toContain("Quote card — centered");
    expect(names("fb")).toContain("Event banner");
  });
});

describe("dimension search", () => {
  it("matches every format of a full size", () => {
    for (const q of ["1080x1350", "1080 × 1350", "1080 1350", "1080X1350"]) {
      expect(names(q)).toEqual(["Portrait promo"]);
    }
  });

  it("matches a single dimension", () => {
    expect(names("1350")).toEqual(["Portrait promo"]);
    expect(names("1920")).toEqual(["Story teaser"]);
  });

  it("matches an unseeded custom size", () => {
    // 1080×1350 is not a canvas_presets row; it still has to be findable.
    expect(names("1080 1350")).toEqual(["Portrait promo"]);
  });

  it("matches by aspect ratio in any notation", () => {
    expect(names("9:16")).toContain("Story teaser");
    expect(names("9/16")).toContain("Story teaser");
  });

  it("matches by orientation", () => {
    expect(names("vertical")).toContain("Story teaser");
    expect(names("square")).toEqual(expect.arrayContaining(["Stat card", "Team welcome"]));
  });
});

describe("field coverage", () => {
  it("matches a use case tag", () => {
    expect(names("carousel")).toContain("Story teaser");
    expect(names("hiring")).toContain("Quote card — centered");
  });

  it("matches a description word", () => {
    expect(names("teaser")).toContain("Story teaser");
  });

  it("matches an asset type", () => {
    expect(names("story")).toContain("Story teaser");
  });

  it("matches a derived colour mode", () => {
    expect(names("dark")).toContain("Quote card — centered");
    expect(names("light")).toContain("Stat card");
  });

  it("matches on a prefix", () => {
    expect(names("carou")).toContain("Story teaser");
  });
});

describe("AND matching", () => {
  it("narrows rather than widens across tokens", () => {
    const broad = names("instagram");
    const narrow = names("instagram carousel");
    expect(broad.length).toBeGreaterThan(narrow.length);
    expect(narrow).toEqual(["Story teaser"]);
  });

  it("returns nothing when one token cannot match", () => {
    expect(names("linkedin swimming pool")).toEqual([]);
    expect(names("swimming pool")).toEqual([]);
  });

  it("composes an alias with another term", () => {
    expect(names("ig story")).toEqual(["Story teaser"]);
  });
});

describe("ranking", () => {
  it("puts an exact name match first", () => {
    expect(names("stat card")[0]).toBe("Stat card");
  });

  it("ranks a name hit above a description hit", () => {
    const results = names("teaser");
    expect(results[0]).toBe("Story teaser");
  });

  it("ranks a tag hit above a description-only hit", () => {
    const tagged = mk("Unrelated name", 1080, 1080, { tags: ["banner"] });
    const described = mk("Also unrelated", 1080, 1080, {
      description: "Mentions a banner in passing.",
    });
    const small = buildSearchIndex([tagged, described].map(toCatalogTemplate));
    expect(searchTemplates(small, "banner").map((t) => t.name)).toEqual([
      "Unrelated name",
      "Also unrelated",
    ]);
  });
});

describe("empty query", () => {
  it("returns everything, in index order", () => {
    expect(searchTemplates(index, "")).toHaveLength(TEMPLATES.length);
    expect(searchTemplates(index, "   ")).toHaveLength(TEMPLATES.length);
  });
});
