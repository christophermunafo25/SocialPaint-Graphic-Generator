import { describe, expect, it } from "vitest";
import { imageRectStyle, readImageRect } from "./imageRect";

describe("readImageRect", () => {
  it("keeps a crop, including one past the box's edges", () => {
    const rect = { x: -0.057, y: -0.02, width: 1.494, height: 1.042 };
    expect(readImageRect(rect)).toEqual(rect);
  });

  it("ignores anything that isn't a sane rect", () => {
    expect(readImageRect(undefined)).toBeNull();
    expect(readImageRect({ x: 0, y: 0, width: 0, height: 1 })).toBeNull();
    expect(readImageRect({ x: 0, y: 0, width: 1 })).toBeNull();
    expect(readImageRect({ x: "0", y: 0, width: 1, height: 1 })).toBeNull();
    expect(readImageRect({ x: 0, y: 0, width: 1e6, height: 1 })).toBeNull();
    expect(readImageRect({ x: Number.NaN, y: 0, width: 1, height: 1 })).toBeNull();
  });
});

describe("imageRectStyle", () => {
  it("places the image in percent of the box", () => {
    expect(imageRectStyle({ x: -0.25, y: 0.5, width: 1.5, height: 1 })).toMatchObject({
      left: "-25%",
      top: "50%",
      width: "150%",
      height: "100%",
    });
  });
});
