import { describe, expect, it } from "vitest";
import type { BrandKit, TemplateField, TemplateSchema } from "../types";
import { designTypeFloor, relaxDesignFit, withFields } from "./designFit";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: "f1",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  x: 80,
  y: 80,
  width: 900,
  height: 200,
  fontSizePx: 96,
  textSizing: "shrink",
  minFontScale: 0.6,
  ...over,
});

const schema = (fields: TemplateField[], canvasWidth = 1080): TemplateSchema => ({
  id: "freestyle-1",
  companyId: "co-1",
  name: "Bold",
  description: "",
  category: "",
  tags: [],
  status: "draft",
  canvasWidth,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields,
  captionTemplate: "",
  createdAt: "",
  updatedAt: "",
});

describe("designTypeFloor", () => {
  it("is 14px at 1080 wide and scales with the canvas", () => {
    expect(designTypeFloor(1080)).toBe(14);
    expect(designTypeFloor(1440)).toBeCloseTo(18.67, 2);
  });
});

describe("relaxDesignFit", () => {
  it("lowers an overflowing shrink field's floor to the type floor", () => {
    const out = relaxDesignFit(schema([field({})]), ["headline"], null);
    // 14 / 96 is under the lowest relaxed floor, so it stops at 0.3.
    expect(out?.fields[0].minFontScale).toBe(0.3);
  });

  it("keeps small text at the type floor, never under it", () => {
    const out = relaxDesignFit(schema([field({ fontSizePx: 28 })]), ["headline"], null);
    expect(out?.fields[0].minFontScale).toBe(0.5);
  });

  it("leaves fields that fit, fields that do not shrink, and floors already low", () => {
    const fits = field({ fieldKey: "body" });
    const free = field({ fieldKey: "free", textSizing: "free" });
    const low = field({ fieldKey: "low", minFontScale: 0.2 });
    expect(relaxDesignFit(schema([fits, free, low]), ["free", "low"], null)).toBeNull();
  });

  it("reads the size and sizing a bound type style locks", () => {
    const kit: BrandKit = {
      id: "k",
      companyId: "co-1",
      colors: [],
      guidelines: [],
      typeStyles: [{ key: "display", name: "Display", fontSizePx: 140, textSizing: "free" }],
    };
    const bound = field({ typeStyleKey: "display" });
    expect(relaxDesignFit(schema([bound]), ["headline"], kit)).toBeNull();
    const sized: BrandKit = {
      ...kit,
      typeStyles: [{ key: "display", name: "Display", fontSizePx: 28 }],
    };
    expect(relaxDesignFit(schema([bound]), ["headline"], sized)?.fields[0].minFontScale).toBe(0.5);
  });
});

describe("withFields", () => {
  it("swaps a design's fields for the relaxed schema's", () => {
    const relaxed = schema([field({ minFontScale: 0.3 })]);
    const design = {
      name: "Bold",
      canvasWidth: 1080,
      canvasHeight: 1350,
      captionTemplate: "",
      fields: [field({})],
    };
    expect(withFields(design, relaxed).fields[0].minFontScale).toBe(0.3);
    expect(design.fields[0].minFontScale).toBe(0.6);
  });
});
