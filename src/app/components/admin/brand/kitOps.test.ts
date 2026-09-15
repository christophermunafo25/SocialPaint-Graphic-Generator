import { describe, expect, it } from "vitest";
import type { BrandAsset, BrandColor } from "@/lib/types";
import type { KitShape } from "./kitPlumbing";
import {
  assignColorRole,
  dedupeColorKeys,
  logoSurfaces,
  mergeImportedColors,
  newCustomColor,
  primaryHandoffOnRemove,
  setLogoSurfaces,
  setPrimaryLogo,
} from "./kitOps";

const colors: BrandColor[] = [
  { key: "slime", name: "Slime", hex: "#17FF7E", role: "primary" },
  { key: "fire", name: "Fire", hex: "#FF3627" },
  { key: "lapis", name: "Lapis", hex: "#17D0FF", role: "accent" },
];

const logo = (id: string, surfaces?: Array<"dark" | "light">): BrandAsset => ({
  id,
  companyId: "c1",
  kind: "logo",
  name: `${id}.svg`,
  url: `blob:${id}`,
  metadata: surfaces ? { surfaces } : {},
  createdAt: "2026-09-15T00:00:00Z",
});

const kit = (patch: Partial<KitShape> = {}): KitShape => ({
  colors: [],
  typeStyles: [],
  guidelines: [],
  headingFont: { source: "google", family: "Montserrat" },
  bodyFont: { source: "google", family: "Inter" },
  allowStyleOverride: false,
  allowOffPalette: true,
  ...patch,
});

describe("assignColorRole", () => {
  it("moves a role from its current holder", () => {
    const next = assignColorRole(colors, "fire", "primary");
    expect(next.find((c) => c.key === "fire")?.role).toBe("primary");
    expect(next.find((c) => c.key === "slime")?.role).toBeUndefined();
    expect(next.find((c) => c.key === "lapis")?.role).toBe("accent");
  });

  it("clears a role with null", () => {
    const next = assignColorRole(colors, "slime", null);
    expect(next.find((c) => c.key === "slime")?.role).toBeUndefined();
    expect(next.filter((c) => c.role).length).toBe(1);
  });

  it("leaves other colors untouched when the role is free", () => {
    const next = assignColorRole(colors, "fire", "secondary");
    expect(next.find((c) => c.key === "slime")?.role).toBe("primary");
    expect(next.find((c) => c.key === "fire")?.role).toBe("secondary");
  });
});

describe("mergeImportedColors", () => {
  it("appends only new keys", () => {
    const next = mergeImportedColors(colors, [
      { key: "slime", name: "Dup", hex: "#000000" },
      { key: "violet", name: "Violet", hex: "#A66BFF" },
    ]);
    expect(next.length).toBe(4);
    expect(next.find((c) => c.key === "slime")?.name).toBe("Slime");
  });

  it("drops an imported role that conflicts with an existing one", () => {
    const next = mergeImportedColors(colors, [
      { key: "violet", name: "Violet", hex: "#A66BFF", role: "primary" },
    ]);
    expect(next.find((c) => c.key === "violet")?.role).toBeUndefined();
    expect(next.find((c) => c.key === "slime")?.role).toBe("primary");
  });

  it("keeps a non-conflicting imported role, once", () => {
    const next = mergeImportedColors(colors, [
      { key: "violet", name: "Violet", hex: "#A66BFF", role: "secondary" },
      { key: "rose", name: "Rose", hex: "#FF3DE1", role: "secondary" },
    ]);
    expect(next.find((c) => c.key === "violet")?.role).toBe("secondary");
    expect(next.find((c) => c.key === "rose")?.role).toBeUndefined();
  });

  it("returns the same array when nothing is new", () => {
    expect(mergeImportedColors(colors, [{ key: "slime", name: "S", hex: "#000000" }])).toBe(colors);
  });
});

describe("logoSurfaces", () => {
  it("reads absent metadata as both surfaces", () => {
    expect(logoSurfaces(logo("a"))).toEqual(["dark", "light"]);
  });

  it("reads stored surfaces in canonical order", () => {
    expect(logoSurfaces(logo("a", ["light", "dark"]))).toEqual(["dark", "light"]);
    expect(logoSurfaces(logo("a", ["light"]))).toEqual(["light"]);
  });
});

describe("setLogoSurfaces", () => {
  it("rejects an empty set", () => {
    expect(setLogoSurfaces(logo("a"), [])).toBeNull();
  });

  it("normalises order", () => {
    expect(setLogoSurfaces(logo("a"), ["light", "dark"])).toEqual({
      surfaces: ["dark", "light"],
    });
  });
});

describe("setPrimaryLogo", () => {
  it("refuses a surface the logo does not show on", () => {
    expect(setPrimaryLogo(kit(), logo("a", ["light"]), "dark")).toBeNull();
  });

  it("sets the surface primary and keeps the legacy field on the dark primary", () => {
    const k = kit({ primaryLogoDarkAssetId: "old", primaryLogoLightAssetId: "old" });
    const patch = setPrimaryLogo(k, logo("a", ["light"]), "light");
    expect(patch).toEqual({
      primaryLogoDarkAssetId: "old",
      primaryLogoLightAssetId: "a",
      primaryLogoAssetId: "old",
    });
  });

  it("falls the legacy field back to light when there is no dark primary", () => {
    const patch = setPrimaryLogo(kit(), logo("a"), "light");
    expect(patch?.primaryLogoAssetId).toBe("a");
  });
});

describe("primaryHandoffOnRemove", () => {
  it("hands each surface to the next logo that shows there", () => {
    const k = kit({ primaryLogoDarkAssetId: "a", primaryLogoLightAssetId: "a" });
    const patch = primaryHandoffOnRemove(k, "a", [logo("b", ["light"]), logo("c", ["dark"])]);
    expect(patch).toEqual({
      primaryLogoDarkAssetId: "c",
      primaryLogoLightAssetId: "b",
      primaryLogoAssetId: "c",
    });
  });

  it("clears a surface with no eligible logo left", () => {
    const k = kit({ primaryLogoDarkAssetId: "a", primaryLogoLightAssetId: "b" });
    const patch = primaryHandoffOnRemove(k, "a", [logo("b", ["light"])]);
    expect(patch.primaryLogoDarkAssetId).toBeUndefined();
    expect(patch.primaryLogoLightAssetId).toBe("b");
    expect(patch.primaryLogoAssetId).toBe("b");
  });

  it("returns an empty patch when the removed logo was no primary", () => {
    const k = kit({ primaryLogoDarkAssetId: "a", primaryLogoLightAssetId: "a" });
    expect(primaryHandoffOnRemove(k, "x", [logo("a")])).toEqual({});
  });
});

describe("newCustomColor", () => {
  const custom = (n: number): BrandColor => ({
    key: `custom_${n}`,
    name: `Custom ${n}`,
    hex: "#888888",
  });

  it("counts up from the existing customs", () => {
    expect(newCustomColor([custom(1), custom(2)]).key).toBe("custom_3");
  });

  it("never mints a key the palette already holds after a removal", () => {
    // [custom_1, custom_2] minus custom_1: the count says 2 next, but
    // custom_2 is taken — the old generator duplicated it here.
    const fresh = newCustomColor([custom(2)]);
    expect(fresh.key).toBe("custom_3");
  });

  it("skips past a run of taken keys", () => {
    const fresh = newCustomColor([custom(2), custom(3)]);
    expect(fresh.key).toBe("custom_4");
  });
});

describe("dedupeColorKeys", () => {
  it("returns the same array when keys are unique", () => {
    expect(dedupeColorKeys(colors)).toBe(colors);
  });

  it("renames later duplicates, keeping the first untouched", () => {
    const dupes: BrandColor[] = [
      { key: "custom_2", name: "Fire", hex: "#FF3627" },
      { key: "custom_2", name: "Orchid", hex: "#30133D" },
    ];
    const healed = dedupeColorKeys(dupes);
    expect(healed[0]).toBe(dupes[0]);
    expect(healed[1].key).toBe("custom_2_2");
    expect(healed[1].name).toBe("Orchid");
  });

  it("steps around a suffix that already exists", () => {
    const healed = dedupeColorKeys([
      { key: "a", name: "1", hex: "#111111" },
      { key: "a_2", name: "2", hex: "#222222" },
      { key: "a", name: "3", hex: "#333333" },
    ]);
    expect(healed.map((c) => c.key)).toEqual(["a", "a_2", "a_3"]);
  });
});
