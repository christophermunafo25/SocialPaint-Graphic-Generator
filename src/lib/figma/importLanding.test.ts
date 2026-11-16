import { describe, expect, it } from "vitest";
import type { TemplateField } from "../types";
import { gradientOf } from "../../../supabase/functions/_shared/extract.ts";
import { inFormOrder, landOnTop, stackImported } from "./importLanding";
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

describe("inFormOrder", () => {
  it("puts the named fields first, in form order, without moving anything on the canvas", () => {
    const keep = (f: TemplateField) => f.fieldKey;
    // Paint order: photo, plate, headline, cta. Form order: headline, cta, photo.
    const painted = stackImported(
      [field("photo"), field("plate"), field("headline"), field("cta")],
      [field("a", 3)],
      keep,
    );
    // stackImported keeps paint order, which the recompose relies on.
    expect(painted.map((f) => f.id)).toEqual(["photo", "plate", "headline", "cta"]);
    const form = inFormOrder(painted, ["headline", "cta", "photo", "gone"]);
    expect(form.map((f) => f.id)).toEqual(["headline", "cta", "photo", "plate"]);
    // Each field keeps the layer it arrived on.
    expect(Object.fromEntries(form.map((f) => [f.id, f.zIndex]))).toEqual({
      photo: 4,
      plate: 5,
      headline: 6,
      cta: 7,
    });
    expect(inFormOrder(painted, []).map((f) => f.id)).toEqual(painted.map((f) => f.id));
    expect(inFormOrder(painted)).toBe(painted);
  });
});

describe("landOnTop", () => {
  it("re-keys a clash and lifts the group above what was added meanwhile", () => {
    // Keyed and stacked against a draft whose top was 2; meanwhile the admin
    // added "headline" at 5.
    const incoming = [
      { ...field("h", 3), fieldKey: "headline", label: "Headline" },
      { ...field("c", 4), fieldKey: "cta", label: "Cta" },
    ];
    const existing = [field("a", 2), { ...field("x", 5), fieldKey: "headline" }];
    const out = landOnTop(incoming, existing);
    expect(out.map((f) => f.fieldKey)).toEqual(["headline_2", "cta"]);
    expect(out.map((f) => f.zIndex)).toEqual([6, 7]);
    expect(out.map((f) => f.id)).toEqual(["h", "c"]);
  });

  it("changes nothing when the draft didn't move", () => {
    const incoming = [field("h", 3), field("c", 4)];
    const out = landOnTop(incoming, [field("a", 2)]);
    expect(out).toEqual(incoming);
  });
});
