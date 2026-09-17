import { describe, expect, it } from "vitest";
import type { TemplateField } from "@/lib/types";
import { cornerRadiusCss, plateRadiusCss } from "./SchemaRenderer";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: "f1",
  label: "Pill",
  fieldKey: "pill",
  type: "text",
  x: 0,
  y: 0,
  width: 220,
  height: 64,
  plateColor: "#082E17",
  ...over,
});

describe("plateRadiusCss", () => {
  it("renders the pill default when cornerRadius is unset", () => {
    // 9999px clamps to half the plate's height in CSS — a true pill at any
    // text length, which is why the default is over-large rather than a
    // computed height/2 (the plate's height is content-determined).
    expect(plateRadiusCss(field({}))).toBe("9999px");
  });

  it("renders an authored per-corner value as authored", () => {
    expect(plateRadiusCss(field({ cornerRadius: { tl: 4, tr: 8, br: 12, bl: 16 } }))).toBe(
      "4px 8px 12px 16px",
    );
  });

  it("renders all-zero corners as a square plate, NOT the pill default", () => {
    // This is the one place all-zero must survive — cornerRadiusCss
    // collapses it to undefined, which for a plate would mean "pill".
    expect(plateRadiusCss(field({ cornerRadius: { tl: 0, tr: 0, br: 0, bl: 0 } }))).toBe(
      "0px 0px 0px 0px",
    );
    expect(cornerRadiusCss(field({ cornerRadius: { tl: 0, tr: 0, br: 0, bl: 0 } }))).toBe(
      undefined,
    );
  });

  it("scales with the export's scale factor like cornerRadiusCss", () => {
    expect(plateRadiusCss(field({ cornerRadius: { tl: 10, tr: 10, br: 10, bl: 10 } }), 2)).toBe(
      "20px 20px 20px 20px",
    );
  });
});
