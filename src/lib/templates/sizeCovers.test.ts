import { describe, expect, it } from "vitest";
import { sizeById } from "./platforms";
import { coverFor, coverIds } from "./sizeCovers";

describe("cover resolution", () => {
  it("resolves only real catalogue ids — a misspelled filename fails here", () => {
    for (const id of coverIds()) {
      expect(sizeById(id), `src/assets/sizes/${id}.svg matches no SIZE_CATALOG id`).toBeDefined();
    }
  });

  it("returns markup for every shipped cover and undefined otherwise", () => {
    for (const id of coverIds()) {
      expect(coverFor(id)).toContain("<svg");
    }
    expect(coverFor("not-a-size")).toBeUndefined();
  });
});
