import { describe, expect, it } from "vitest";
import { sizeById } from "./platforms";
import { FALLBACK_COVER, coverFor, coverIds, hasCover } from "./sizeCovers";

describe("cover resolution", () => {
  it("resolves only real catalogue ids, so a misspelled filename fails here", () => {
    expect(coverIds().length).toBeGreaterThan(0);
    for (const id of coverIds()) {
      expect(sizeById(id), `src/assets/sizes/${id}.webp matches no SIZE_CATALOG id`).toBeDefined();
    }
  });

  it("returns each shipped cover's own image", () => {
    for (const id of coverIds()) {
      expect(hasCover(id)).toBe(true);
      expect(coverFor(id)).toMatch(new RegExp(`${id}\\.webp`));
    }
  });

  it("falls back to the twelfth cover for a size without its own", () => {
    expect(hasCover("not-a-size")).toBe(false);
    expect(coverFor("not-a-size")).toBe(FALLBACK_COVER);
    expect(FALLBACK_COVER).toMatch(/fallback\.webp/);
    expect(coverIds()).not.toContain("fallback");
  });
});
