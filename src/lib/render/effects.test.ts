import { describe, expect, it } from "vitest";
import type { FieldEffect } from "../types";
import {
  filterCss,
  innerShadowFrames,
  paintsBeyondBox,
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

describe("innerShadowFrames", () => {
  it("is empty without inner shadows, so nothing extra is drawn", () => {
    expect(innerShadowFrames([drop, blur, noise])).toEqual([]);
  });

  it("frames the box with a ring whose hole is the box moved by the offset", () => {
    // inner: x 0, y 1, blur 0, spread 2 -> ring = 0 + 0 + 1 + 2 + 4 = 7, outer = 5
    const [frame] = innerShadowFrames([inner]);
    expect(frame).toMatchObject({
      position: "absolute",
      left: "-5px",
      top: "-4px",
      width: "calc(100% + 10px)",
      height: "calc(100% + 10px)",
      border: "7px solid #FFFFFF40",
    });
    // The hole: left -5 + 7 = 2 = 0 + spread; top -4 + 7 = 3 = 1 + spread.
    expect(frame.filter).toBeUndefined(); // no blur, no filter
  });

  it("blurs at half the blur radius and keeps the hole's corners on the box's", () => {
    const soft = { type: "innerShadow", x: 0, y: 6, blur: 16, color: "#00000080" } as const;
    const [frame] = innerShadowFrames([soft], { tl: 20, tr: 20, br: 0, bl: 0 });
    expect(frame.filter).toBe("blur(8px)");
    // ring = 16 + 0 + 6 + 0 + 4 = 26: outer corners are the box's plus the ring.
    expect(frame.borderRadius).toBe("46px 46px 26px 26px");
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

describe("scaleEffects on stored JSON", () => {
  it("drops malformed entries instead of saving them back or throwing", () => {
    expect(scaleEffects([null, { type: "backgroundBlur", radius: 4 }, drop], 2)).toEqual([
      { ...drop, x: 16, y: 16, blur: 64 },
    ]);
    expect(scaleEffects({ not: "a list" }, 2)).toEqual([]);
  });
});

describe("paintsBeyondBox", () => {
  const base = { type: "shape" as const };

  it("is true for a drop shadow, a glow or a layer blur, which spill past the box", () => {
    expect(paintsBeyondBox({ ...base, effects: [drop] })).toBe(true);
    expect(paintsBeyondBox({ ...base, effects: [blur] })).toBe(true);
  });

  it("is false for inner shadows and grain, which stay inside", () => {
    expect(paintsBeyondBox({ ...base, effects: [inner, noise] })).toBe(false);
    expect(paintsBeyondBox(base)).toBe(false);
  });

  it("is true for a shape's center or outside stroke, false for inside or no stroke", () => {
    expect(paintsBeyondBox({ ...base, strokeColor: "#000000", strokeAlign: "outside" })).toBe(true);
    expect(paintsBeyondBox({ ...base, strokeColor: "#000000", strokeAlign: "center" })).toBe(true);
    expect(paintsBeyondBox({ ...base, strokeColor: "#000000" })).toBe(false);
    expect(paintsBeyondBox({ ...base, strokeAlign: "outside" })).toBe(false);
    expect(paintsBeyondBox({ type: "text", strokeColor: "#000000", strokeAlign: "outside" })).toBe(
      false,
    );
  });
});
