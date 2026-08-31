import { describe, expect, it } from "vitest";
import {
  cornerRadiusOf,
  opacityOf,
  transformOf,
  walk,
  warningStrings,
  type FigmaNode,
  type ImportWarning,
  type SuggestedField,
} from "./extract.ts";

const frame = { x: 100, y: 200, width: 1080, height: 1350 };

const run = (node: FigmaNode) => {
  const out: SuggestedField[] = [];
  const warnings: ImportWarning[] = [];
  walk(node, frame, out, warnings, new Set(), new Set());
  return { out, warnings, strings: warningStrings(warnings) };
};

// An 8° clockwise rotation in the renderer's convention:
// rotation = -atan2(m[1][0], m[0][0]) = 8 → m[1][0] = sin(-8°).
const DEG8: number[][] = [
  [Math.cos((8 * Math.PI) / 180), Math.sin((8 * Math.PI) / 180), 250],
  [-Math.sin((8 * Math.PI) / 180), Math.cos((8 * Math.PI) / 180), 400],
];

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
      static: true, // staticValue arrives after the caller renders the node
    });
    expect(warnings.some((w) => w.layer === "Portrait" && w.issue.includes("shadow"))).toBe(true);
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

  it("lifts nested text out of an image-filled card instead of baking it", () => {
    const { out } = run({
      id: "5:1",
      name: "Photo Card",
      type: "FRAME",
      absoluteBoundingBox: { x: 200, y: 300, width: 400, height: 500 },
      fills: [{ type: "IMAGE", imageRef: "card-photo", scaleMode: "FILL" }],
      children: [
        {
          id: "5:2",
          name: "Card Headline",
          type: "TEXT",
          characters: "Meet the team",
          absoluteBoundingBox: { x: 220, y: 700, width: 360, height: 40 },
          style: { fontFamily: "Inter", fontSize: 32 },
          fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
        },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "image", label: "Photo Card" });
    // The card's artwork must be the bare fill — a node render would bake
    // the lifted headline into the pixels twice.
    expect(out[0].fillImageRef).toBe("card-photo");
    expect(out[1]).toMatchObject({
      type: "text",
      label: "Card Headline",
      staticValue: "Meet the team",
    });
  });

  it("keeps an image container atomic when a mask child makes it a raster leaf", () => {
    const { out } = run({
      id: "6:1",
      name: "Masked Card",
      type: "FRAME",
      absoluteBoundingBox: { x: 200, y: 300, width: 400, height: 500 },
      fills: [{ type: "IMAGE", imageRef: "card-photo" }],
      children: [
        {
          id: "6:2",
          name: "Mask",
          type: "ELLIPSE",
          isMask: true,
          absoluteBoundingBox: { x: 200, y: 300, width: 400, height: 400 },
        },
        {
          id: "6:3",
          name: "Inside",
          type: "TEXT",
          characters: "hidden",
          absoluteBoundingBox: { x: 220, y: 700, width: 100, height: 20 },
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].fillImageRef).toBeUndefined();
  });
});

describe("text field extraction", () => {
  const headline: FigmaNode = {
    id: "2:1",
    name: "Headline",
    type: "TEXT",
    opacity: 0.5,
    characters: "I'm Attending!",
    absoluteBoundingBox: { x: 206, y: 417, width: 868, height: 165 },
    style: { fontFamily: "GC VANK", fontSize: 165, textAlignHorizontal: "CENTER" },
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
  };

  it("keeps the designed size (free sizing) and carries opacity", () => {
    const { out } = run(headline);
    expect(out[0]).toMatchObject({
      type: "text",
      // The designed size IS the size — shrink is the admin's opt-in.
      textSizing: "free",
      align: "center",
      colorHex: "#FFFFFF",
      opacity: 50,
      // Everything lands FIXED with its designed copy — the admin opts
      // elements IN to being member fields.
      static: true,
      staticValue: "I'm Attending!",
    });
  });

  it("lands rotated text at its true size, center-anchored, with the angle", () => {
    // The AABB of the rotated box — deliberately NOT the true 400×60.
    const { out } = run({
      ...headline,
      opacity: undefined,
      absoluteBoundingBox: { x: 250, y: 400, width: 404.5, height: 115.1 },
      relativeTransform: DEG8,
      size: { x: 400, y: 60 },
    });
    expect(out[0]).toMatchObject({
      rotation: 8,
      anchor: "center",
      width: 400,
      height: 60,
      // Center of the AABB, frame-relative — the rotation origin.
      x: Math.round(250 - 100 + 404.5 / 2),
      y: Math.round(400 - 200 + 115.1 / 2),
    });
  });

  it("reads italics, vertical alignment, pixel line height, and the PostScript name", () => {
    const { out } = run({
      ...headline,
      style: {
        fontFamily: "Raveo Display",
        fontPostScriptName: "RaveoDisplay-SemiBold",
        fontSize: 40,
        italic: true,
        textAlignVertical: "TOP",
        lineHeightPx: 48,
        lineHeightPercentFontSize: 999, // px form must win
      },
    });
    expect(out[0]).toMatchObject({
      fontStyle: "italic",
      verticalAlign: "top",
      lineHeight: 1.2,
      fontPostScriptName: "RaveoDisplay-SemiBold",
    });
  });

  it("bakes LOWER text case into the content", () => {
    const { out } = run({
      ...headline,
      characters: "SHOUTY THING",
      style: { fontSize: 40, textCase: "LOWER" },
    });
    expect(out[0].staticValue).toBe("shouty thing");
    expect(out[0].uppercase).toBeUndefined();
  });

  it("imports a linear-gradient text fill as textGradient", () => {
    const { out } = run({
      ...headline,
      fills: [
        {
          type: "GRADIENT_LINEAR",
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0 } },
            { position: 1, color: { r: 0, g: 0, b: 1 } },
          ],
          gradientHandlePositions: [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 },
          ],
        },
      ],
    });
    expect(out[0].colorHex).toBeUndefined();
    expect(out[0].textGradient).toMatchObject({
      angle: 90,
      stops: [
        { position: 0, color: "#FF0000" },
        { position: 1, color: "#0000FF" },
      ],
    });
  });

  it("warns (naming the layer) when character styling is mixed", () => {
    const { warnings } = run({
      ...headline,
      characterStyleOverrides: [0, 0, 0, 1, 1, 1],
    });
    expect(
      warnings.some((w) => w.layer === "Headline" && w.issue.includes("mixed text styling")),
    ).toBe(true);
  });
});

describe("shape field extraction", () => {
  it("lifts a rounded solid card as a shape field", () => {
    const { out } = run({
      id: "3:1",
      name: "Card",
      type: "RECTANGLE",
      cornerRadius: 24,
      absoluteBoundingBox: { x: 150, y: 250, width: 300, height: 180 },
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    });
    expect(out[0]).toMatchObject({
      type: "shape",
      shape: "rect",
      x: 50,
      y: 50,
      width: 300,
      height: 180,
      colorHex: "#FFFFFF",
      cornerRadius: { tl: 24, tr: 24, br: 24, bl: 24 },
      static: true,
    });
  });

  it("lifts ellipses, gradient fills, and folds alpha into opacity", () => {
    const { out } = run({
      id: "3:2",
      name: "Badge",
      type: "ELLIPSE",
      opacity: 0.5,
      absoluteBoundingBox: { x: 100, y: 200, width: 80, height: 80 },
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 0.5 }, opacity: 0.8 }],
    });
    expect(out[0]).toMatchObject({
      type: "shape",
      shape: "ellipse",
      colorHex: "#000000",
      opacity: 20,
    });
  });

  it("turns a LINE into a thin rect painted by its stroke", () => {
    const { out } = run({
      id: "3:3",
      name: "Divider",
      type: "LINE",
      strokeWeight: 4,
      absoluteBoundingBox: { x: 100, y: 500, width: 400, height: 0 },
      strokes: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    });
    expect(out[0]).toMatchObject({
      type: "shape",
      shape: "rect",
      y: 298, // centered on the zero-height line
      height: 4,
      colorHex: "#FF0000",
    });
  });

  it("leaves stroked or effected shapes in the plate (exact render beats a lossy lift)", () => {
    const stroked: FigmaNode = {
      id: "3:4",
      name: "Outlined",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
      strokes: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
      strokeWeight: 2,
    };
    expect(run(stroked).out).toHaveLength(0);
    expect(run({ ...stroked, strokes: [], effects: [{ type: "DROP_SHADOW" }] }).out).toHaveLength(
      0,
    );
  });

  it("carries rotation on shape fields", () => {
    const { out } = run({
      id: "3:5",
      name: "Tilted",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 200, y: 300, width: 120, height: 70 },
      relativeTransform: DEG8,
      size: { x: 110, y: 55 },
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    });
    expect(out[0]).toMatchObject({ rotation: 8, anchor: "center", width: 110, height: 55 });
  });
});

describe("raster leaves", () => {
  it("never lifts fields from inside a boolean operation", () => {
    const { out } = run({
      id: "4:1",
      name: "Cutout",
      type: "BOOLEAN_OPERATION",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [
        {
          id: "4:2",
          name: "operand",
          type: "TEXT",
          characters: "HOLE",
          absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    });
    expect(out).toHaveLength(0);
  });
});

describe("transformOf", () => {
  it("reads rotation from the matrix and true size from the node", () => {
    const t = transformOf({ relativeTransform: DEG8, size: { x: 400, y: 60 } });
    expect(t.rotation).toBeCloseTo(8, 5);
    expect(t.size).toEqual({ x: 400, y: 60 });
  });

  it("treats near-zero rotation as unrotated", () => {
    expect(
      transformOf({
        relativeTransform: [
          [1, 0, 10],
          [0, 1, 20],
        ],
        size: { x: 5, y: 5 },
      }).rotation,
    ).toBeUndefined();
    expect(transformOf({}).rotation).toBeUndefined();
  });
});
