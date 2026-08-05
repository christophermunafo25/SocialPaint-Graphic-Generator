import { describe, expect, it } from "vitest";
import { logoFieldFromAsset } from "./fieldOps";
import type { TemplateField } from "@/lib/types";

const asset = {
  id: "asset-1",
  name: "SocialPaint-Primary.png",
  url: "https://cdn.example.com/logo.png",
};
const canvas = { width: 1440, height: 1440 };
const center = { x: 720, y: 720 };

describe("logoFieldFromAsset", () => {
  it("always defaults to contain — a logo never crops", () => {
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], canvas);
    expect(f.objectFit).toBe("contain");
  });

  it("lands fixed with the artwork as its static value", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.type).toBe("image");
    expect(f.static).toBe(true);
    expect(f.staticValue).toBe(asset.url);
  });

  it("sizes the box to the artwork's aspect ratio (landscape)", () => {
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], canvas);
    expect(f.width).toBe(360);
    expect(f.height).toBe(180);
    expect(f.aspectRatio).toBe(2);
  });

  it("sizes the box to the artwork's aspect ratio (portrait)", () => {
    const f = logoFieldFromAsset(asset, { width: 300, height: 600 }, center, [], canvas);
    expect(f.width).toBe(180);
    expect(f.height).toBe(360);
  });

  it("falls back to a square box when the natural size is unknown", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.width).toBe(360);
    expect(f.height).toBe(360);
    expect(f.aspectRatio).toBeUndefined();
  });

  it("clamps into a small canvas without distorting the ratio", () => {
    const small = { width: 200, height: 400 };
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], small);
    expect(f.width).toBeLessThanOrEqual(small.width);
    expect(f.height).toBeLessThanOrEqual(small.height);
    expect(f.width / f.height).toBeCloseTo(2, 1);
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeGreaterThanOrEqual(0);
  });

  it("centers on the drop point, clamped inside the canvas", () => {
    const f = logoFieldFromAsset(asset, { width: 400, height: 400 }, { x: 0, y: 0 }, [], canvas);
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
  });

  it("labels from the asset filename, deduplicated against existing fields", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.label).toBe("SocialPaint-Primary");
    const existing = [{ ...f }] as TemplateField[];
    const f2 = logoFieldFromAsset(asset, null, center, existing, canvas);
    expect(f2.label).toBe("SocialPaint-Primary copy");
  });
});
