import { describe, expect, it } from "vitest";
import type { FieldEffect } from "@/lib/types";
import {
  effectKindsFor,
  effectSummary,
  joinColor,
  kindOf,
  moveEffect,
  newEffect,
  normalizeEffects,
  splitColor,
} from "./effectOps";

const rect = { kind: "field", field: { type: "shape", shape: "rect" } } as const;
const ellipse = { kind: "field", field: { type: "shape", shape: "ellipse" } } as const;
const text = { kind: "field", field: { type: "text" } } as const;
const image = { kind: "field", field: { type: "image" } } as const;

describe("effectKindsFor", () => {
  it("offers inner shadow only where the renderer paints it", () => {
    expect(effectKindsFor(rect)).toContain("innerShadow");
    expect(effectKindsFor(image)).toContain("innerShadow");
    expect(effectKindsFor(ellipse)).not.toContain("innerShadow");
    expect(effectKindsFor(text)).not.toContain("innerShadow");
  });

  it("gives the canvas grain and an inner shadow only", () => {
    expect(effectKindsFor({ kind: "canvas" })).toEqual(["noise", "innerShadow"]);
  });
});

describe("kindOf and newEffect", () => {
  it("reads a drop shadow with no offset as a glow", () => {
    expect(kindOf(newEffect("glow"))).toBe("glow");
    expect(kindOf(newEffect("dropShadow"))).toBe("dropShadow");
  });

  it("starts a glow in the accent it is given, at 60%", () => {
    expect(newEffect("glow", "#17ff7e")).toMatchObject({ color: "#17FF7E99", x: 0, y: 0 });
    expect(newEffect("glow", "not a color")).toMatchObject({ color: "#FFFFFF99" });
  });

  it("starts every kind as a valid, paintable effect", () => {
    for (const kind of ["dropShadow", "glow", "innerShadow", "layerBlur", "noise"] as const) {
      expect(normalizeEffects([newEffect(kind)], rect)).toHaveLength(1);
    }
  });
});

describe("colors", () => {
  it("splits and joins #RRGGBBAA", () => {
    expect(splitColor("#0000001A")).toEqual({ hex: "#000000", alpha: 10 });
    expect(splitColor("#17ff7e")).toEqual({ hex: "#17FF7E", alpha: 100 });
    expect(joinColor("#17FF7E", 60)).toBe("#17FF7E99");
    expect(joinColor("#000000", 150)).toBe("#000000FF");
  });
});

describe("effectSummary", () => {
  it("summarizes each kind the way its row shows it", () => {
    const drop: FieldEffect = { type: "dropShadow", x: 8, y: 8, blur: 32, color: "#0000001A" };
    expect(effectSummary(drop)).toBe("8, 8 · 32 · 10%");
    expect(effectSummary({ ...drop, x: 0, y: 0, color: "#17FF7ECC", blur: 40 })).toBe(
      "17FF7E · 40",
    );
    expect(effectSummary({ type: "layerBlur", radius: 8 })).toBe("8");
    expect(effectSummary({ type: "noise", color: "#FFFFFF1A", size: 0.5, density: 1 })).toBe(
      "White · 10% · 0.5",
    );
  });
});

describe("normalizeEffects", () => {
  it("clamps lengths to sane ranges", () => {
    const wild: FieldEffect[] = [
      { type: "dropShadow", x: 9000, y: -9000, blur: 900, color: "#00000080" },
      { type: "noise", color: "#FFFFFF1A", size: 0.1, density: 0.5 },
    ];
    expect(normalizeEffects(wild, rect)).toEqual([
      { type: "dropShadow", x: 500, y: -500, blur: 200, color: "#00000080" },
      { type: "noise", color: "#FFFFFF1A", size: 0.5, density: 0.5 },
    ]);
  });

  it("drops what the target can't paint and what isn't an effect", () => {
    const inner = newEffect("innerShadow");
    expect(normalizeEffects([inner, null, newEffect("layerBlur")], text)).toEqual([
      newEffect("layerBlur"),
    ]);
    expect(normalizeEffects([newEffect("dropShadow")], { kind: "canvas" })).toBeUndefined();
  });

  it("returns undefined for an empty list, so the field carries no key", () => {
    expect(normalizeEffects([], rect)).toBeUndefined();
    expect(normalizeEffects(undefined, rect)).toBeUndefined();
  });
});

describe("moveEffect", () => {
  const list = [newEffect("dropShadow"), newEffect("glow"), newEffect("noise")];
  it("moves one effect and keeps the rest in order", () => {
    expect(moveEffect(list, 0, 2).map(kindOf)).toEqual(["glow", "noise", "dropShadow"]);
    expect(moveEffect(list, 2, 0).map(kindOf)).toEqual(["noise", "dropShadow", "glow"]);
    expect(moveEffect(list, 1, 1)).toBe(list);
  });
});
