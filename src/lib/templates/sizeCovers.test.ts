import { describe, expect, it } from "vitest";
import { sizeById } from "./platforms";
import { coverFor, coverIds } from "./sizeCovers";

describe("cover resolution", () => {
  it("resolves only real catalogue ids, so a misspelled filename fails here", () => {
    expect(coverIds().length).toBeGreaterThan(0);
    for (const id of coverIds()) {
      expect(sizeById(id), `src/assets/sizes/${id}.webp matches no SIZE_CATALOG id`).toBeDefined();
    }
  });

  it("returns each shipped cover's own image", () => {
    for (const id of coverIds()) {
      expect(coverFor(id)).toMatch(new RegExp(`${id}\\.webp`));
    }
  });

  it("falls back to the twelfth cover for a size without its own", () => {
    const fallback = coverFor("not-a-size");
    expect(fallback).toMatch(/fallback\.webp/);
    expect(coverIds()).not.toContain("fallback");
    for (const id of coverIds()) expect(coverFor(id)).not.toBe(fallback);
  });
});
