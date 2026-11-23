import { describe, expect, it } from "vitest";
import type { BrandKit } from "../../types";
import { BASE, MIN_RATIO, TYPE_ROLES, canvasShape, trackingPx, typeScale } from "./typeScale";

const CANVASES = [
  { width: 1080, height: 1350 },
  { width: 1080, height: 1080 },
  { width: 1080, height: 1920 },
  { width: 1200, height: 627 },
  { width: 2160, height: 2700 },
  { width: 1000, height: 1500 },
];

const kitWith = (ratio: number): BrandKit => ({
  id: "k",
  companyId: "c",
  colors: [],
  typeStyles: [],
  guidelines: [],
  system: { version: 1, type: { ratio } },
});

describe("typeScale", () => {
  it("gives the approved feed sizes at the default ratio", () => {
    expect(typeScale({ width: 1080, height: 1350 })).toEqual({
      display: 139,
      headline: 104,
      subhead: 54,
      body: 36,
      label: 32,
      cta: 36,
      number: 153,
    });
  });

  it("keeps every role over the floor, and the headline 2.8 times the body, on every canvas", () => {
    for (const canvas of CANVASES) {
      for (const ratio of [1, 2.8, 4]) {
        const s = typeScale(canvas, kitWith(ratio));
        const row = BASE[canvasShape(canvas.width, canvas.height)];
        const floor = Math.round(row.floor * (canvas.width / row.width));
        for (const role of TYPE_ROLES) expect(s[role]).toBeGreaterThanOrEqual(floor);
        expect(s.headline / s.body).toBeGreaterThanOrEqual(MIN_RATIO - 0.05);
      }
    }
  });

  it("reads each canvas's own row and scales with width", () => {
    expect(canvasShape(1200, 627)).toBe("landscape");
    expect(canvasShape(1080, 1920)).toBe("story");
    expect(canvasShape(1080, 1080)).toBe("square");
    expect(typeScale({ width: 1200, height: 627 }).body).toBe(34);
    expect(typeScale({ width: 2160, height: 2700 }).body).toBe(72);
  });

  it("makes the headline louder as the brand's ratio grows", () => {
    const quiet = typeScale({ width: 1080, height: 1350 }, kitWith(2.8));
    const loud = typeScale({ width: 1080, height: 1350 }, kitWith(4));
    expect(loud.headline).toBeGreaterThan(quiet.headline);
    expect(loud.body).toBe(quiet.body);
  });
});

describe("trackingPx", () => {
  it("keeps tracking as a share of the size", () => {
    expect(trackingPx({ letterSpacingPx: -2, fontSizePx: 100 }, 50)).toBe(-1);
    expect(trackingPx({ letterSpacingPx: 1.5 }, 50)).toBe(1.5);
    expect(trackingPx({}, 50)).toBe(0);
  });
});
