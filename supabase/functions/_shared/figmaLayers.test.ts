import { describe, expect, it } from "vitest";
import { decomposeFrame, type LayerNode } from "./figmaLayers.ts";

// Fixture modeled on the "AI Event Speaker" carousel frame: a cropped
// image-fill background, a glass info panel, a white card under a photo, a
// fade gradient painted OVER the photo, name texts above the fade, and a
// logo group painted last. Node ids mirror the real file for readability.
const box = (x: number, y: number, width: number, height: number) => ({
  x: x + 86,
  y: y + 78,
  width,
  height,
});

const text = (id: string, name: string, b: ReturnType<typeof box>): LayerNode => ({
  id,
  name,
  type: "TEXT",
  absoluteBoundingBox: b,
});

const frame: LayerNode = {
  id: "3:358",
  name: "AI Event Speaker",
  type: "FRAME",
  absoluteBoundingBox: box(0, 0, 1080, 1350),
  fills: [
    { type: "SOLID", color: { r: 1, g: 1, b: 1 } },
    {
      type: "IMAGE",
      imageRef: "bg-texture",
      scaleMode: "STRETCH",
      imageTransform: [
        [0.696, 0, 0.152],
        [0, 1, 0],
      ],
    },
  ],
  children: [
    { id: "3:465", name: "Vector", type: "VECTOR", absoluteBoundingBox: box(126, 367, 814, 589) },
    {
      id: "3:359",
      name: "Portrait Background",
      type: "GROUP",
      absoluteBoundingBox: box(654, 593, 357, 581),
      children: [
        {
          id: "3:360",
          name: "Portrait Frame",
          type: "RECTANGLE",
          absoluteBoundingBox: box(654, 593, 357, 581),
          fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 0.1 } }],
        },
      ],
    },
    {
      id: "3:361",
      name: "Portrait Container",
      type: "RECTANGLE",
      absoluteBoundingBox: box(71, 547, 541, 748),
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    },
    {
      id: "3:362",
      name: "portrait photo",
      type: "RECTANGLE",
      absoluteBoundingBox: box(84, 559, 515, 724),
      fills: [{ type: "IMAGE", imageRef: "photo" }],
    },
    text("3:363", "I'm Attending!", box(106, 217, 868, 165)),
    {
      id: "3:374",
      name: "Date Container",
      type: "GROUP",
      absoluteBoundingBox: box(694, 648, 246, 77),
      children: [
        text("3:375", "11/15/26 - 11/16/26", box(694, 690, 246, 39)),
        text("3:376", "Date:", box(694, 648, 70, 24)),
      ],
    },
    {
      id: "3:386",
      name: "Button Container",
      type: "GROUP",
      absoluteBoundingBox: box(664, 1080, 338, 85),
      effects: [{ type: "DROP_SHADOW" }],
      children: [
        {
          id: "3:387",
          name: "Button Background",
          type: "RECTANGLE",
          absoluteBoundingBox: box(664, 1080, 338, 85),
          fills: [
            {
              type: "GRADIENT_LINEAR",
              gradientStops: [
                { position: 0, color: { r: 0, g: 1, b: 0.6 } },
                { position: 1, color: { r: 0.71, g: 1, b: 0.42 } },
              ],
              gradientHandlePositions: [
                { x: 0, y: 1 },
                { x: 1, y: 0 },
              ],
            },
          ],
        },
        text("3:388", "Join Me!", box(664, 1090, 338, 66)),
      ],
    },
    {
      id: "3:389",
      name: "Portrait Border",
      type: "RECTANGLE",
      absoluteBoundingBox: box(84, 993, 515, 290),
      fills: [
        {
          type: "GRADIENT_LINEAR",
          gradientStops: [
            { position: 0, color: { r: 0.03, g: 0.03, b: 0.03, a: 0 } },
            { position: 1, color: { r: 0.03, g: 0.03, b: 0.03 } },
          ],
          gradientHandlePositions: [
            { x: 0.5, y: 0 },
            { x: 0.5, y: 1 },
          ],
        },
      ],
    },
    text("3:393", "First Name", box(108, 1162, 323, 27)),
    text("3:394", "Last Name", box(108, 1194, 323, 72)),
    {
      id: "3:466",
      name: "Logo",
      type: "GROUP",
      absoluteBoundingBox: box(365, 87, 353, 83),
      children: [],
    },
  ],
};

// Excluded in walk (paint) order: photo, headline, date value, date label,
// join-me text, first name, last name.
const excluded = ["3:362", "3:363", "3:375", "3:376", "3:388", "3:393", "3:394"];

describe("decomposeFrame on the event-speaker shape", () => {
  const { units, warnings } = decomposeFrame(frame, excluded);

  it("keeps the frame's own fills as background, crop transform intact", () => {
    const [white, bg] = units;
    expect(white.kind).toBe("solid");
    expect(white.afterExcluded).toBeUndefined();
    expect(bg).toMatchObject({
      kind: "imageFill",
      url: "imageref:bg-texture",
      transform: [
        [0.696, 0, 0.152],
        [0, 1, 0],
      ],
    });
    expect(bg.afterExcluded).toBeUndefined();
    // STRETCH is exact now — no approximation warning for it.
    expect(warnings.some((w) => w.includes("STRETCH"))).toBe(false);
  });

  it("renders untouched subtrees as single node units in the background", () => {
    const nodeIds = units.filter((u) => u.kind === "node").map((u) => u.nodeId);
    expect(nodeIds).toContain("3:465"); // echo vector
    expect(nodeIds).toContain("3:359"); // glass panel group, whole
    expect(nodeIds).toContain("3:361"); // white card
    expect(nodeIds).toContain("3:387"); // button gradient (under its text)
    expect(nodeIds).toContain("3:466"); // logo
  });

  it("marks the fade gradient painted over the photo as above-excluded", () => {
    const fade = units.find((u) => u.name === "Portrait Border");
    expect(fade).toBeDefined();
    expect(fade!.kind).toBe("node"); // no excluded inside → node render
    // Painted after photo(1), headline(2), date(3,4), join-me(5) — it sits
    // directly above the 5th lifted field and below the name texts.
    expect(fade!.afterExcluded).toBe(5);
  });

  it("does not lift layers that never overlap a lifted element", () => {
    const logo = units.find((u) => u.nodeId === "3:466");
    const button = units.find((u) => u.nodeId === "3:387");
    expect(logo!.afterExcluded).toBeUndefined();
    expect(button!.afterExcluded).toBeUndefined();
  });

  it("warns about container effects it cannot reproduce", () => {
    expect(warnings.some((w) => w.includes("Button Container"))).toBe(true);
  });

  it("emits no units for excluded nodes themselves", () => {
    expect(units.some((u) => u.nodeId && excluded.includes(u.nodeId))).toBe(false);
  });
});

describe("decomposeFrame edge behavior", () => {
  it("still warns for genuinely approximate image scale modes", () => {
    const f: LayerNode = {
      id: "1:1",
      name: "Frame",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      fills: [{ type: "IMAGE", imageRef: "tile", scaleMode: "TILE" }],
      children: [
        {
          id: "1:2",
          name: "t",
          type: "TEXT",
          absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
    };
    const { warnings } = decomposeFrame(f, ["1:2"]);
    expect(warnings.some((w) => w.includes("TILE"))).toBe(true);
  });

  it("marks a container fill painted above an excluded sibling it overlaps", () => {
    const f: LayerNode = {
      id: "1:1",
      name: "Frame",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [
        {
          id: "1:2",
          name: "photo",
          type: "RECTANGLE",
          absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 },
        },
        {
          id: "1:3",
          name: "Scrim",
          type: "FRAME",
          absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 },
          fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 0.4 } }],
          children: [
            {
              id: "1:4",
              name: "caption",
              type: "TEXT",
              absoluteBoundingBox: { x: 12, y: 12, width: 20, height: 10 },
            },
          ],
        },
      ],
    };
    const { units } = decomposeFrame(f, ["1:2", "1:4"]);
    const scrim = units.find((u) => u.name === "Scrim");
    expect(scrim!.afterExcluded).toBe(1);
  });
});

describe("effects geometry", () => {
  const mk = (over: Partial<LayerNode>): LayerNode => ({
    id: "1:1",
    name: "Frame",
    type: "FRAME",
    absoluteBoundingBox: { x: 100, y: 100, width: 400, height: 400 },
    children: [
      {
        id: "1:2",
        name: "t",
        type: "TEXT",
        absoluteBoundingBox: { x: 110, y: 110, width: 50, height: 20 },
      },
      ...(over.children ?? []),
    ],
    ...over,
  });

  it("places a shadowed node at its render bounds, where the PNG paints", () => {
    // A pill with a drop shadow: layout box 200×50, render bounds spill
    // 30px on every side — Figma's PNG covers the spilled box.
    const frame = mk({
      children: [
        {
          id: "1:3",
          name: "Pill",
          type: "RECTANGLE",
          absoluteBoundingBox: { x: 200, y: 300, width: 200, height: 50 },
          absoluteRenderBounds: { x: 170, y: 270, width: 260, height: 110 },
          effects: [{ type: "DROP_SHADOW" }],
        },
      ],
    });
    const { units } = decomposeFrame(frame, ["1:2"]);
    const pill = units.find((u) => u.name === "Pill")!;
    expect(pill).toMatchObject({ x: 70, y: 170, width: 260, height: 110 });
  });

  it("warns when a rendered subtree contains a background blur", () => {
    const frame = mk({
      children: [
        {
          id: "1:4",
          name: "Glass Panel",
          type: "RECTANGLE",
          absoluteBoundingBox: { x: 120, y: 120, width: 100, height: 100 },
          effects: [{ type: "BACKGROUND_BLUR" }],
        },
      ],
    });
    const { warnings } = decomposeFrame(frame, ["1:2"]);
    expect(warnings.some((w) => w.includes("Glass Panel") && w.includes("frosted"))).toBe(true);
  });

  it("keeps layout-box placement when render bounds are absent", () => {
    const { units } = decomposeFrame(mk({}), ["1:2"]);
    expect(units.length).toBe(0); // only the excluded text — nothing else
  });
});
