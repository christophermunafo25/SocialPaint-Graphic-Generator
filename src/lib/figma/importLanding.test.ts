import { describe, expect, it } from "vitest";
import type { TemplateField } from "../types";
import { gradientOf } from "../../../supabase/functions/_shared/extract.ts";
import { stackImported } from "./importLanding";
import { radialGeometryOf } from "./overlayFields";

const field = (id: string, zIndex?: number): TemplateField => ({
  id,
  label: id,
  fieldKey: id,
  type: "text",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  zIndex,
});

describe("stackImported", () => {
  it("keys each field against the draft and stacks it above everything there", () => {
    const existing = [field("a", 4), field("b", 2)];
    const out = stackImported([field("c"), field("d")], existing, (f, taken) =>
      taken.some((t) => t.fieldKey === f.fieldKey) ? `${f.fieldKey}_2` : f.fieldKey,
    );
    expect(out.map((f) => f.zIndex)).toEqual([5, 6]);
    expect(out.map((f) => f.fieldKey)).toEqual(["c", "d"]);
  });

  it("re-keys a clash with the draft or with an earlier import", () => {
    const keyFor = (f: TemplateField, taken: TemplateField[]) =>
      taken.some((t) => t.fieldKey === f.fieldKey) ? `${f.fieldKey}_2` : f.fieldKey;
    const out = stackImported([field("a"), field("x"), field("x")], [field("a", 0)], keyFor);
    expect(out.map((f) => f.fieldKey)).toEqual(["a_2", "x", "x_2"]);
  });
});

describe("radialGeometryOf", () => {
  it("agrees with the importer's radial mapping", () => {
    const handles = [
      { x: 0.3, y: 0.6 },
      { x: 0.8, y: 0.6 },
      { x: 0.3, y: 0.9 },
    ];
    const shared = gradientOf(
      {
        type: "GRADIENT_RADIAL",
        gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0 } }],
        gradientHandlePositions: handles,
      },
      320,
      180,
      () => undefined,
    );
    expect(radialGeometryOf(handles, 320, 180)).toEqual({
      center: shared!.center,
      radius: shared!.radius,
    });
  });
});
