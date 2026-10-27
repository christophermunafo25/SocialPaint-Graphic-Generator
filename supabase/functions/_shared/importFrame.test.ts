import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FigmaNode, ImportWarning } from "./extract.ts";
import { fillRefsOf, importFrame, landImageAssets, maskIdsOf, renderIdsOf } from "./importFrame.ts";

/** A saved fidelity frame (scripts/fidelity/goldens.mjs fetch). */
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

describe("importFrame", () => {
  it("walks a template frame's children, never the frame itself", () => {
    const root = savedFrame("feature-highlight", "62:1210");
    const { fields } = importFrame(root);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.some((f) => f.sourceNodeId === root.id)).toBe(false);
  });

  it("lands a masked photo as its own fill, positioned inside the mask", () => {
    const { fields } = importFrame(savedFrame("feature-highlight", "62:1210"));
    const photo = fields.find((f) => f.label === "Mask group")!;
    expect(photo).toMatchObject({
      type: "image",
      x: 254,
      y: 482,
      width: 826,
      height: 787,
      // image 9, the top layer, at (-47, -16) and 1234 x 820 inside the mask
      fillImageRef: "d0a0cebeaac28c66eac802c112c13765264237a8",
      maskNodeId: "62:1214",
    });
    expect(photo.imageRect!.x).toBeCloseTo(-47 / 826, 3);
    expect(photo.imageRect!.y).toBeCloseTo(-16 / 787, 3);
    expect(photo.imageRect!.width).toBeCloseTo(1234 / 826, 3);
    expect(photo.imageRect!.height).toBeCloseTo(820 / 787, 3);
  });

  it("carries the frame's grain onto the canvas and the composer's depth onto its shape", () => {
    const { fields, canvasEffects } = importFrame(savedFrame("gtm-composer", "200:208"));
    expect(canvasEffects).toEqual([
      { type: "noise", color: "#FFFFFF1A", size: 0.5, density: 1, seed: 1 },
    ]);
    expect(fields.find((f) => f.label === "Composer")).toMatchObject({
      type: "shape",
      strokeColor: "#FFFFFF40",
      strokeWidthPx: 5,
      strokeAlign: "outside",
      effects: [{ type: "dropShadow", x: 8, y: 8, blur: 32, color: "#0000001A" }],
    });
    // Every icon and button is a vector now, not a render.
    expect(fields.filter((f) => f.type === "icon").map((f) => f.label)).toEqual([
      "Attach button",
      "chevron",
      "Decrease",
      "Increase",
      "Send button",
    ]);
  });

  it("says so when a frame has nothing to lift", () => {
    const root: FigmaNode = {
      id: "1:1",
      name: "Empty",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [],
    };
    const { fields, warnings } = importFrame(root);
    expect(fields).toEqual([]);
    expect(warnings[0].severity).toBe("info");
  });
});

describe("landImageAssets", () => {
  const image = (over: Record<string, unknown>) =>
    ({
      id: "f",
      label: "Photo",
      fieldKey: "photo",
      type: "image",
      sourceNodeId: "2:2",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      static: true,
      ...over,
    }) as ReturnType<typeof importFrame>["fields"][number];

  it("lands the bare fill when the children were lifted, the render otherwise", async () => {
    const withFill = image({ id: "a", fillImageRef: "ref1" });
    const plain = image({ id: "b", sourceNodeId: "3:3" });
    const fields = [withFill, plain];
    expect(fillRefsOf(fields)).toEqual(["ref1"]);
    const fills = { ref1: "fill.png" };
    expect(renderIdsOf(fields, fills)).toEqual(["3:3"]);
    const warnings: ImportWarning[] = [];
    await landImageAssets(
      fields,
      { fills, renders: { "3:3": "render.png" }, masks: {} },
      async (url) => `hosted/${url}`,
      warnings,
    );
    expect(withFill.staticValue).toBe("hosted/fill.png");
    expect(withFill.fillImageRef).toBeUndefined();
    expect(plain.staticValue).toBe("hosted/render.png");
    expect(warnings).toEqual([]);
  });

  it("falls back to the render for an unresolved fill, and empties a field with nothing", async () => {
    const unresolved = image({ id: "a", fillImageRef: "gone" });
    const empty = image({ id: "b", sourceNodeId: "4:4" });
    const fields = [unresolved, empty];
    expect(renderIdsOf(fields, {})).toEqual(["2:2", "4:4"]);
    const warnings: ImportWarning[] = [];
    await landImageAssets(
      fields,
      { fills: {}, renders: { "2:2": "render.png" }, masks: {} },
      async (url) => url,
      warnings,
    );
    expect(unresolved.staticValue).toBe("render.png");
    expect(empty.static).toBeUndefined();
    expect(warnings.map((w) => w.severity)).toEqual(["degraded", "degraded"]);
  });

  it("gives a masked field its mask render and strips the request", async () => {
    const masked = image({ maskNodeId: "5:5" });
    expect(maskIdsOf([masked])).toEqual(["5:5"]);
    await landImageAssets(
      [masked],
      { fills: {}, renders: { "2:2": "group.png" }, masks: { "5:5": "mask.png" } },
      async (url) => url,
      [],
    );
    expect(masked.maskUrl).toBe("mask.png");
    expect(masked.maskNodeId).toBeUndefined();
  });
});
