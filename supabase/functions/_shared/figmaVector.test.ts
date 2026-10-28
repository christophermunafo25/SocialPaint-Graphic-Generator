import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gradientOf, type FigmaNode } from "./extract.ts";
import { transformPath, vectorOf } from "./figmaVector.ts";

const savedFrame = (fixture: string, nodeId: string): FigmaNode => {
  const file = new URL(
    `../../../test/fidelity/fixtures/${fixture}/figma-node.json`,
    import.meta.url,
  );
  const body = JSON.parse(readFileSync(file, "utf8")) as {
    nodes: Record<string, { document: FigmaNode }>;
  };
  return body.nodes[nodeId].document;
};

const find = (node: FigmaNode, name: string): FigmaNode | undefined =>
  node.name === name
    ? node
    : (node.children ?? []).reduce<FigmaNode | undefined>(
        (hit, c) => hit ?? find(c, name),
        undefined,
      );

const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

describe("transformPath", () => {
  it("writes every command absolute, H and V as lines", () => {
    expect(transformPath("M1 2l3 4h5v6z", IDENTITY)).toBe("M1 2L4 6L9 6L9 12Z");
  });

  it("moves curves and implicit linetos by the matrix", () => {
    const shift: typeof IDENTITY = [1, 0, 0, 1, 10, 20];
    expect(transformPath("M0 0 5 5C1 1 2 2 3 3Q4 4 5 5", shift)).toBe(
      "M10 20L15 25C11 21 12 22 13 23Q14 24 15 25",
    );
    const double: typeof IDENTITY = [2, 0, 0, 2, 0, 0];
    expect(transformPath("M1 1L2 2", double)).toBe("M2 2L4 4");
  });

  it("refuses commands it can't move exactly", () => {
    expect(transformPath("M0 0A5 5 0 0 1 10 10", IDENTITY)).toBeNull();
    expect(transformPath("M0 0S1 1 2 2", IDENTITY)).toBeNull();
    expect(transformPath("", IDENTITY)).toBeNull();
  });
});

describe("vectorOf", () => {
  it("rebuilds a two-colour logo with each path's own colour", () => {
    const logo = find(savedFrame("feature-highlight", "62:1210"), "SocialPaint Logo")!;
    const art = vectorOf(logo)!;
    expect(art.colorHex).toBeUndefined();
    expect(new Set(art.vector.paths.map((p) => p.colorHex))).toEqual(
      new Set(["#272727", "#17FF7E"]),
    );
    expect(art.vector.viewBox[2]).toBeCloseTo(267, 0);
  });

  it("gives one-colour line icons the field colour, strokes as outlines", () => {
    const panel = savedFrame("gtm-composer", "200:208");
    const platform = find(panel, "Platform")!;
    const chevron = find(platform, "chevron")!;
    const art = vectorOf(chevron)!;
    expect(art.colorHex).toMatch(/^#[0-9A-F]{6}$/);
    expect(art.vector.paths.length).toBeGreaterThan(0);
    expect(art.vector.paths.every((p) => p.colorHex === undefined)).toBe(true);
  });

  it("stays raster for what a path list can't hold", () => {
    const square = (over: Partial<FigmaNode>): FigmaNode => ({
      id: "1:2",
      name: "Shape",
      type: "VECTOR",
      absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
      fillGeometry: [{ path: "M0 0L10 0L10 10Z" }],
      ...over,
    });
    const group = (child: FigmaNode): FigmaNode => ({
      id: "1:1",
      name: "Group",
      type: "GROUP",
      absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
      children: [child],
    });
    expect(vectorOf(group(square({})))).not.toBeNull();
    expect(vectorOf(group(square({ opacity: 0.5 })))).toBeNull();
    expect(vectorOf(group(square({ isMask: true })))).toBeNull();
    expect(vectorOf(group(square({ fills: [{ type: "IMAGE" }] })))).toBeNull();
    expect(
      vectorOf(group(square({ fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 0.5 } }] }))),
    ).toBeNull();
    expect(vectorOf(group(square({ fillGeometry: [{ path: "M0 0A1 1 0 0 1 2 2" }] })))).toBeNull();
  });
});

describe("gradientOf", () => {
  it("maps a radial's handles to its centre and radii", () => {
    const g = gradientOf(
      {
        type: "GRADIENT_RADIAL",
        gradientStops: [
          { position: 0, color: { r: 1, g: 1, b: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 0 } },
        ],
        gradientHandlePositions: [
          { x: 0.25, y: 0.5 },
          { x: 0.75, y: 0.5 },
          { x: 0.25, y: 0.75 },
        ],
      },
      200,
      100,
      () => undefined,
    );
    expect(g).toMatchObject({
      kind: "radial",
      center: { x: 0.25, y: 0.5 },
      radius: { x: 0.5, y: 0.25 },
    });
  });

  it("leaves angular gradients to the caller's fallback", () => {
    expect(
      gradientOf(
        { type: "GRADIENT_ANGULAR", gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0 } }] },
        10,
        10,
        () => undefined,
      ),
    ).toBeUndefined();
  });
});
