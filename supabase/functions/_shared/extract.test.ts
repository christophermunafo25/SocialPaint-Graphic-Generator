import { describe, expect, it } from "vitest";
import { cornerRadiusOf, opacityOf, walk, type FigmaNode, type SuggestedField } from "./extract.ts";

const frame = { x: 100, y: 200, width: 1080, height: 1350 };

const run = (node: FigmaNode) => {
  const out: SuggestedField[] = [];
  const warnings: string[] = [];
  walk(node, frame, out, warnings, new Set(), new Set());
  return { out, warnings };
};

describe("image field extraction", () => {
  const photo: FigmaNode = {
    id: "1:1",
    name: "Portrait",
    type: "RECTANGLE",
    cornerRadius: 10,
    opacity: 0.8,
    effects: [{ type: "DROP_SHADOW" }],
    absoluteBoundingBox: { x: 184, y: 759, width: 515, height: 724 },
    fills: [{ type: "IMAGE" }],
  };

  it("imports rounded corners, opacity, and warns about baked effects", () => {
    const { out, warnings } = run(photo);
    expect(out[0]).toMatchObject({
      type: "image",
      x: 84,
      y: 559,
      cornerRadius: { tl: 10, tr: 10, br: 10, bl: 10 },
      opacity: 80,
    });
    expect(warnings.some((w) => w.includes("Portrait") && w.includes("shadow"))).toBe(true);
  });

  it("maps per-corner radii and omits the property when square", () => {
    expect(
      cornerRadiusOf({ ...photo, cornerRadius: undefined, rectangleCornerRadii: [10, 0, 10, 0] }),
    ).toEqual({ tl: 10, tr: 0, br: 10, bl: 0 });
    expect(cornerRadiusOf({ ...photo, cornerRadius: 0 })).toBeUndefined();
    expect(cornerRadiusOf({ ...photo, cornerRadius: undefined })).toBeUndefined();
  });

  it("imports opacity only when actually translucent", () => {
    expect(opacityOf({ ...photo, opacity: 1 })).toBeUndefined();
    expect(opacityOf({ ...photo, opacity: undefined })).toBeUndefined();
    expect(opacityOf({ ...photo, opacity: 0.455 })).toBe(46);
  });
});

describe("text field extraction", () => {
  it("keeps the measured-shrink default and carries opacity", () => {
    const { out } = run({
      id: "2:1",
      name: "Headline",
      type: "TEXT",
      opacity: 0.5,
      characters: "I'm Attending!",
      absoluteBoundingBox: { x: 206, y: 417, width: 868, height: 165 },
      style: { fontFamily: "GC VANK", fontSize: 165, textAlignHorizontal: "CENTER" },
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    });
    expect(out[0]).toMatchObject({
      type: "text",
      textSizing: "shrink",
      align: "center",
      colorHex: "#FFFFFF",
      opacity: 50,
    });
  });
});
