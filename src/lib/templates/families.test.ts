import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import { carryLook, carryValues, familySizeLabels, joinPlanFor, memberFieldDiff } from "./families";

const size = (canvasWidth: number, canvasHeight: number) => ({ canvasWidth, canvasHeight });

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: over.fieldKey ?? "f",
  label: over.label ?? over.fieldKey ?? "Field",
  fieldKey: "f",
  type: "text",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  ...over,
});

describe("familySizeLabels", () => {
  it("names a size by platform and ratio, or by its pixels", () => {
    expect(familySizeLabels([size(1080, 1350), size(1080, 1920), size(1440, 1440)])).toEqual([
      "Instagram · 4:5",
      "Instagram · 9:16",
      "1440 × 1440",
    ]);
  });

  it("reads a ratio-alike size no platform claims by its pixels", () => {
    expect(familySizeLabels([size(1080, 1350), size(1200, 1500)])).toEqual([
      "Instagram · 4:5",
      "1200 × 1500",
    ]);
  });
});

describe("carryValues", () => {
  const from = {
    fields: [
      field({ fieldKey: "headline" }),
      field({ fieldKey: "kind", type: "select", options: ["Talk", "Panel"] }),
      field({ fieldKey: "photo", type: "image" }),
    ],
  };

  it("keeps every value, including one the next size has no field for", () => {
    const to = { fields: [field({ fieldKey: "headline" })] };
    expect(carryValues({ headline: "Hi", photo: "blob:x" }, from, to)).toEqual({
      headline: "Hi",
      photo: "blob:x",
    });
  });

  it("leaves out a value the next size's field can't take", () => {
    const to = {
      fields: [
        field({ fieldKey: "headline", type: "image" }),
        field({ fieldKey: "kind", type: "select", options: ["Talk"] }),
      ],
    };
    expect(carryValues({ headline: "Hi", kind: "Panel" }, from, to)).toEqual({});
    expect(carryValues({ kind: "Talk" }, from, to)).toEqual({ kind: "Talk" });
  });
});

describe("carryLook", () => {
  const from = {
    variants: [
      { id: "dark", name: "Dark", isDefault: false },
      { id: "v2", name: "Green", isDefault: false },
    ],
  } as unknown as Pick<TemplateSchema, "variants">;

  it("keeps the id, then matches by name, else the default look", () => {
    const to = {
      variants: [
        { id: "dark", name: "Dark" },
        { id: "v9", name: "Green" },
      ],
    } as unknown as Pick<TemplateSchema, "variants">;
    expect(carryLook("dark", from, to)).toBe("dark");
    expect(carryLook("v2", from, to)).toBe("v9");
    expect(carryLook("v2", from, { variants: [] })).toBeNull();
    expect(carryLook(null, from, to)).toBeNull();
  });
});

describe("memberFieldDiff", () => {
  it("finds missing fields and changed types or options, ignoring Fixed elements", () => {
    const a = {
      fields: [
        field({ fieldKey: "headline" }),
        field({ fieldKey: "subhead" }),
        field({ fieldKey: "kind", type: "select", options: ["Talk"] }),
        field({ fieldKey: "logo", static: true }),
      ],
    };
    const b = {
      fields: [
        field({ fieldKey: "headline", type: "multiline" }),
        field({ fieldKey: "kind", type: "select", options: ["Talk", "Panel"] }),
        field({ fieldKey: "cta" }),
      ],
    };
    const diff = memberFieldDiff(a, b);
    expect(diff.onlyInA.map((f) => f.fieldKey)).toEqual(["subhead"]);
    expect(diff.onlyInB.map((f) => f.fieldKey)).toEqual(["cta"]);
    expect(diff.changed.map((c) => [c.field.fieldKey, c.reason])).toEqual([
      ["headline", "type"],
      ["kind", "options"],
    ]);
  });
});

describe("joinPlanFor", () => {
  const mint = () => "new-family";
  const source = { id: "s", canvasWidth: 1080, canvasHeight: 1350 };
  const saved = { id: "c", canvasWidth: 1080, canvasHeight: 1920 };

  it("gives a source without a family a new id, joined with the version", () => {
    expect(joinPlanFor(source, [], saved, mint)).toEqual({
      templateIds: ["s", "c"],
      familyId: "new-family",
    });
  });

  it("joins the version to the source's family", () => {
    const fam = [source];
    expect(joinPlanFor({ ...source, familyId: "fam" }, fam, saved, mint)).toEqual({
      templateIds: ["c"],
      familyId: "fam",
    });
  });

  it("leaves the version standalone at the source's size or a size the family has", () => {
    expect(joinPlanFor(source, [], { ...saved, canvasHeight: 1350 }, mint)).toBeNull();
    const fam = [source, { id: "t", canvasWidth: 1080, canvasHeight: 1920 }];
    expect(joinPlanFor({ ...source, familyId: "fam" }, fam, saved, mint)).toBeNull();
    expect(joinPlanFor(source, [], { ...saved, familyId: "other" }, mint)).toBeNull();
  });
});
