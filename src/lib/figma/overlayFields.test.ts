import { describe, expect, it } from "vitest";
import type { FigmaLayerUnit, TemplateField } from "../types";
import { assembleElementFields, gradientAngle, mergeOverlayFields, parseRgba } from "./overlayFields";

const mkImported = (n: number): TemplateField[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `f${i + 1}`,
    label: `Field ${i + 1}`,
    fieldKey: `field_${i + 1}`,
    type: "text" as const,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    zIndex: i + 1,
  }));

describe("parseRgba", () => {
  it("splits color and alpha", () => {
    expect(parseRgba("rgba(7, 7, 8, 0.500)")).toEqual({ hex: "#070708", alpha: 0.5 });
    expect(parseRgba("rgba(255, 255, 255, 1.000)")).toEqual({ hex: "#FFFFFF", alpha: 1 });
    expect(parseRgba("nonsense")).toEqual({ hex: "#111111", alpha: 1 });
  });
});

describe("gradientAngle", () => {
  it("maps Figma handles onto the CSS angle convention", () => {
    // Top → bottom paints downward: CSS 180deg.
    expect(gradientAngle([{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }], 100, 100)).toBe(180);
    // Bottom → top: CSS 0deg.
    expect(gradientAngle([{ x: 0.5, y: 1 }, { x: 0.5, y: 0 }], 100, 100)).toBe(0);
    // Left → right: CSS 90deg.
    expect(gradientAngle([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], 100, 100)).toBe(90);
  });
});

describe("overlayUnitsToFields", () => {
  const imported = mkImported(7);

  it("turns a node render above the 5th field into a static image between fields 5 and 6", () => {
    const units: FigmaLayerUnit[] = [
      { kind: "solid", x: 0, y: 0, width: 10, height: 10, color: "rgba(0,0,0,1)" }, // background
      {
        kind: "node",
        name: "Portrait Border",
        x: 84,
        y: 993,
        width: 515,
        height: 290,
        url: "https://storage/fade.png",
        afterExcluded: 5,
      },
    ];
    const fields = mergeOverlayFields(units, imported, imported);
    expect(fields).toHaveLength(8);
    const fade = fields[7];
    expect(fade).toMatchObject({
      type: "image",
      static: true,
      staticValue: "https://storage/fade.png",
      x: 84,
      y: 993,
      label: "Portrait Border",
    });
    const zOf = (id: string) => fields.find((f) => f.id === id)!.zIndex!;
    expect(fade.zIndex!).toBeGreaterThan(zOf("f5"));
    expect(fade.zIndex!).toBeLessThan(zOf("f6"));
    // Integer z only — the z_index column is an int.
    for (const f of fields) expect(Number.isInteger(f.zIndex)).toBe(true);
  });

  it("maps solid and gradient overlays to static shapes", () => {
    const units: FigmaLayerUnit[] = [
      {
        kind: "solid",
        name: "Scrim",
        x: 1,
        y: 2,
        width: 3,
        height: 4,
        color: "rgba(7, 7, 8, 0.4)",
        afterExcluded: 1,
      },
      {
        kind: "gradient",
        name: "Fade",
        x: 0,
        y: 0,
        width: 100,
        height: 200,
        stops: [
          { position: 0, color: "rgba(7, 7, 8, 0.000)" },
          { position: 1, color: "rgba(7, 7, 8, 1.000)" },
        ],
        handles: [
          { x: 0.5, y: 0 },
          { x: 0.5, y: 1 },
        ],
        afterExcluded: 1,
      },
    ];
    const all = mergeOverlayFields(units, imported, imported);
    const fields = all.slice(imported.length);
    expect(fields[0]).toMatchObject({
      type: "shape",
      shape: "rect",
      static: true,
      colorHex: "#070708",
      opacity: 40,
    });
    expect(fields[1].textGradient).toMatchObject({ angle: 180 });
    // Both above field 1, in paint order, below field 2 — integers only.
    const zOf = (id: string) => all.find((f) => f.id === id)!.zIndex!;
    expect(fields[0].zIndex!).toBeLessThan(fields[1].zIndex!);
    expect(fields[1].zIndex!).toBeLessThan(zOf("f2"));
    for (const f of all) expect(Number.isInteger(f.zIndex)).toBe(true);
  });

  it("ignores units without an order mark and clamps out-of-range anchors", () => {
    const units: FigmaLayerUnit[] = [
      { kind: "solid", x: 0, y: 0, width: 1, height: 1, color: "rgba(0,0,0,1)" },
      {
        kind: "solid",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        color: "rgba(0,0,0,1)",
        afterExcluded: 99,
      },
    ];
    const all = mergeOverlayFields(units, imported, imported);
    expect(all).toHaveLength(8);
    const overlay = all[7];
    const zOf = (id: string) => all.find((f) => f.id === id)!.zIndex!;
    expect(overlay.zIndex!).toBeGreaterThan(zOf("f7"));
  });
});

describe("assembleElementFields", () => {
  const payload = {
    elementWidth: 200,
    elementHeight: 100,
    fields: [
      {
        id: "t1",
        label: "Button label",
        fieldKey: "button_label",
        type: "text" as const,
        static: true,
        staticValue: "Join me!",
        x: 20,
        y: 30,
        width: 160,
        height: 40,
      },
    ],
    units: [
      // Paints BEFORE the text (afterExcluded 0): the button plate.
      {
        kind: "gradient" as const,
        name: "Plate",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        stops: [
          { position: 0, color: "rgba(0, 255, 153, 1.000)" },
          { position: 1, color: "rgba(181, 255, 106, 1.000)" },
        ],
        handles: [
          { x: 0, y: 1 },
          { x: 1, y: 0 },
        ],
      },
      // Paints AFTER the text: a shine overlay.
      {
        kind: "node" as const,
        name: "Shine",
        x: 0,
        y: 0,
        width: 200,
        height: 30,
        url: "https://storage/shine.png",
        afterExcluded: 1,
      },
    ],
  };

  it("reassembles exact paint order, centered at the point, above the draft", () => {
    const existing = mkImported(2); // z 1..2
    const out = assembleElementFields(payload, { x: 500, y: 500 }, existing, {
      width: 1000,
      height: 1000,
    });
    expect(out.map((f) => f.label)).toEqual(["Plate", "Button label", "Shine"]);
    // Centered: element origin at (400, 450); child offsets preserved.
    expect(out[0]).toMatchObject({ x: 400, y: 450 });
    expect(out[1]).toMatchObject({ x: 420, y: 480 });
    // z stacks above everything existing, in sequence order.
    expect(out[0].zIndex).toBe(3);
    expect(out[1].zIndex).toBe(4);
    expect(out[2].zIndex).toBe(5);
    // All fixed; the text keeps its designed copy.
    expect(out.every((f) => f.static)).toBe(true);
    expect(out[1].staticValue).toBe("Join me!");
  });

  it("clamps the landing so the element stays on the canvas", () => {
    const out = assembleElementFields(payload, { x: 0, y: 0 }, [], {
      width: 1000,
      height: 1000,
    });
    expect(out[0].x).toBe(0);
    expect(out[0].y).toBe(0);
  });
});
