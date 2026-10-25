import { describe, expect, it } from "vitest";
import type { FieldEffect } from "../types";
import {
  boxShadowCss,
  filterCss,
  noiseEffects,
  readEffects,
  readStrokeAlign,
  scaleEffects,
} from "./effects";

const drop: FieldEffect = { type: "dropShadow", x: 8, y: 8, blur: 32, color: "#0000001A" };
const inner: FieldEffect = {
  type: "innerShadow",
  x: 0,
  y: 1,
  blur: 0,
  spread: 2,
  color: "#FFFFFF40",
};
const blur: FieldEffect = { type: "layerBlur", radius: 8 };
const noise: FieldEffect = { type: "noise", color: "#FFFFFF1A", size: 0.5, density: 1, seed: 7 };

describe("readEffects", () => {
  it("keeps every well-formed effect in order", () => {
    expect(readEffects([drop, inner, blur, noise])).toEqual([drop, inner, blur, noise]);
  });

  it("reads absent, null and non-arrays as no effects", () => {
    expect(readEffects(undefined)).toEqual([]);
    expect(readEffects(null)).toEqual([]);
    expect(readEffects({ type: "dropShadow" })).toEqual([]);
  });

  it("drops malformed entries and keeps the rest", () => {
    const stored = [
      { type: "dropShadow", x: 1, y: 1, blur: 4, color: "black" }, // not hex
      { type: "dropShadow", x: 1, y: 1, blur: -4, color: "#000000" }, // negative blur
      { type: "backgroundBlur", radius: 4 }, // not a Phase 1 type
      { type: "noise", color: "#FFFFFF", size: 0, density: 1 }, // zero grain
      { type: "noise", color: "#FFFFFF", size: 1, density: 2 }, // density over 1
      "dropShadow",
      drop,
    ];
    expect(readEffects(stored)).toEqual([drop]);
  });

  it("carries only the keys an effect has", () => {
    expect(readEffects([{ ...drop, extra: true }])).toEqual([drop]);
  });
});

describe("readStrokeAlign", () => {
  it("defaults anything unknown to inside, today's stroke", () => {
    expect(readStrokeAlign(undefined)).toBe("inside");
    expect(readStrokeAlign("sideways")).toBe("inside");
    expect(readStrokeAlign("outside")).toBe("outside");
    expect(readStrokeAlign("center")).toBe("center");
  });
});

describe("boxShadowCss", () => {
  it("is undefined with nothing to paint, so the element takes today's path", () => {
    expect(boxShadowCss([])).toBeUndefined();
    expect(boxShadowCss([blur, noise])).toBeUndefined();
  });

  it("paints Figma's bottom-to-top list with CSS's top-first order", () => {
    expect(boxShadowCss([drop, inner])).toBe(
      "inset 0px 1px 0px 2px #FFFFFF40, 8px 8px 32px 0px #0000001A",
    );
  });
});

describe("filterCss", () => {
  it("draws drop shadows with box-shadow's blur radius and halves the layer blur", () => {
    expect(filterCss([drop, blur])).toBe("drop-shadow(8px 8px 32px #0000001A) blur(4px)");
  });

  it("skips inner shadows, which a filter can't express", () => {
    expect(filterCss([inner])).toBeUndefined();
  });

  it("returns only the blur when shadows paint elsewhere", () => {
    expect(filterCss([drop, blur], false)).toBe("blur(4px)");
    expect(filterCss([drop], false)).toBeUndefined();
  });
});

describe("noiseEffects", () => {
  it("picks the noise layers in order", () => {
    expect(noiseEffects([drop, noise, blur])).toEqual([noise]);
  });
});

describe("scaleEffects", () => {
  it("scales lengths and leaves colors, density and seeds", () => {
    expect(scaleEffects([drop, inner, blur, noise], 2)).toEqual([
      { ...drop, x: 16, y: 16, blur: 64 },
      { ...inner, x: 0, y: 2, blur: 0, spread: 4 },
      { type: "layerBlur", radius: 16 },
      { ...noise, size: 1 },
    ]);
  });

  it("adds no spread to a shadow that had none", () => {
    expect("spread" in scaleEffects([drop], 2)[0]).toBe(false);
  });
});
