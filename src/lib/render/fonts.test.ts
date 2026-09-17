import { describe, expect, it } from "vitest";
import { unavailableFamilies } from "./fonts";
import type { TemplateField } from "../types";

const text = (fontFamily?: string): TemplateField => ({
  id: "f1",
  label: "T",
  fieldKey: "t",
  type: "text",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  fontFamily,
});

const uploaded = (family: string) => ({ metadata: { family } });

describe("unavailableFamilies (candidates, not verdicts)", () => {
  it("passes curated Google families and uploaded brand fonts", () => {
    expect(unavailableFamilies([text("Inter")], [])).toEqual([]);
    expect(unavailableFamilies([text("GC VANK")], [uploaded("GC VANK")])).toEqual([]);
    expect(unavailableFamilies([text(undefined)], [])).toEqual([]);
  });

  it("lists uncurated families as candidates for the probe", () => {
    // A REAL Google family that Brand Studio's curated list doesn't carry —
    // the probe (verifyMissingFamilies) is what decides it is available;
    // treating this candidate list as the verdict is the bug that baked
    // headlines into the background.
    expect(unavailableFamilies([text("Bricolage Grotesque")], [])).toEqual(["Bricolage Grotesque"]);
  });
});
