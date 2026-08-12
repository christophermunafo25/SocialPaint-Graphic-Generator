import { describe, expect, it } from "vitest";
import type { ExtractionResult } from "./extract.ts";
import {
  AutobuildValidationError,
  validateProposal,
  type ModelProposal,
  type ProposedField,
} from "./autobuildValidate.ts";

const element = (
  sourceId: string,
  kind: "text" | "image" | "shape" = "text",
  extra: Partial<ExtractionResult["elements"][number]> = {},
) => ({
  sourceId,
  kind,
  x: 100,
  y: 200,
  width: 800,
  height: 120,
  ...extra,
});

const extraction = (elements: ExtractionResult["elements"]): ExtractionResult => ({
  backgroundUrl: "https://example.test/bg.png",
  canvasWidth: 1440,
  canvasHeight: 1440,
  elements,
  warnings: [],
});

const field = (overrides: Partial<ProposedField>): ProposedField => ({
  sourceId: "1:10",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  ...overrides,
});

const proposal = (
  fields: ProposedField[],
  template: Partial<ModelProposal["template"]> = {},
): ModelProposal => ({
  fields,
  template: {
    name: "Work anniversary post",
    description: "Celebrate a milestone.",
    category: "Celebrations",
    tags: ["anniversary"],
    captionTemplate: "Congrats {headline}!",
    ...template,
  },
  rationale: [],
});

const brand = { typeStyleKeys: ["heading", "body"], colorKeys: ["primary", "text"] };

describe("proposals must reference real elements", () => {
  it("drops a proposal whose sourceId is absent from the extraction", () => {
    const out = validateProposal(
      proposal([field({}), field({ sourceId: "9:99", label: "Ghost", fieldKey: "ghost" })]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields.map((f) => f.fieldKey)).toEqual(["headline"]);
    expect(out.warnings.some((w) => w.includes("9:99"))).toBe(true);
  });

  it("drops a second claim on the same element", () => {
    const out = validateProposal(
      proposal([field({}), field({ label: "Again", fieldKey: "again" })]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields.filter((f) => f.sourceNodeId === "1:10")).toHaveLength(1);
  });
});

describe("fieldKey discipline", () => {
  it("re-slugs a duplicate fieldKey instead of dropping the field", () => {
    const out = validateProposal(
      proposal([field({}), field({ sourceId: "1:11", label: "Subtitle", fieldKey: "headline" })]),
      extraction([element("1:10"), element("1:11")]),
      brand,
      "figma",
    );
    const keys = out.fields.map((f) => f.fieldKey);
    expect(keys[0]).toBe("headline");
    expect(keys[1]).not.toBe("headline");
    expect(keys[1]).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
  });

  it("re-slugs invalid characters", () => {
    const out = validateProposal(
      proposal([field({ fieldKey: "Head Line!!" })]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields[0].fieldKey).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    expect(out.warnings.some((w) => w.includes("re-slugged"))).toBe(true);
  });
});

describe("brand bindings are dropped when unknown", () => {
  it("unbinds an unknown typeStyleKey", () => {
    const out = validateProposal(
      proposal([field({ typeStyleKey: "display" })]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields[0].typeStyleKey).toBeUndefined();
    expect(out.warnings.some((w) => w.includes("display"))).toBe(true);
  });

  it("keeps a known typeStyleKey", () => {
    const out = validateProposal(
      proposal([field({ typeStyleKey: "heading" })]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields[0].typeStyleKey).toBe("heading");
  });

  it("drops an unknown colorKey but keeps the extracted colorHex", () => {
    const out = validateProposal(
      proposal([field({ colorKey: "neon" })]),
      extraction([element("1:10", "text", { colorHex: "#003B71" })]),
      brand,
      "figma",
    );
    expect(out.fields[0].colorKey).toBeUndefined();
    expect(out.fields[0].colorHex).toBe("#003B71");
  });
});

describe("caption merge tags", () => {
  it("strips a dangling tag with a warning", () => {
    const out = validateProposal(
      proposal([field({})], { captionTemplate: "Meet {headline} at {venue} today" }),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.template.captionTemplate).toBe("Meet {headline} at today");
    expect(out.warnings.some((w) => w.includes("{venue}"))).toBe(true);
  });
});

describe("hard failures", () => {
  it("zero surviving fields throws, never succeeds", () => {
    expect(() =>
      validateProposal(proposal([field({ sourceId: "9:99" })]), extraction([]), brand, "figma"),
    ).toThrow(AutobuildValidationError);
  });
});

describe("geometry is the extractor's, never the model's", () => {
  it("copies geometry and typography verbatim from the extraction", () => {
    const out = validateProposal(
      // The model has no channel to send geometry on this path — a box is ignored.
      proposal([field({ box: { x: 1, y: 2, width: 3, height: 4 } })]),
      extraction([
        element("1:10", "text", {
          rotation: 8.37,
          fontFamily: "Inter",
          fontWeight: 700,
          fontSizePx: 46.18,
          colorHex: "#003B71",
          align: "center",
          lineHeight: 1.4,
        }),
      ]),
      brand,
      "figma",
    );
    const f = out.fields[0];
    expect([f.x, f.y, f.width, f.height]).toEqual([100, 200, 800, 120]);
    expect(f.rotation).toBe(8.37);
    expect(f.fontSizePx).toBe(46.18);
    expect(f.fontWeight).toBe(700);
    expect(f.colorHex).toBe("#003B71");
    expect(f.align).toBe("center");
  });
});

describe("the image path clamps hard", () => {
  const imgExtraction = extraction([]);

  it("clamps out-of-bounds boxes into the canvas", () => {
    const out = validateProposal(
      proposal([field({ sourceId: undefined, box: { x: -50, y: 1400, width: 600, height: 300 } })]),
      imgExtraction,
      brand,
      "image",
    );
    const f = out.fields[0];
    expect(f.x).toBe(0);
    expect(f.y).toBe(1400);
    expect(f.height).toBe(40); // clipped to the canvas edge
  });

  it("drops boxes under 8px on either axis", () => {
    expect(() =>
      validateProposal(
        proposal([field({ sourceId: undefined, box: { x: 10, y: 10, width: 4, height: 200 } })]),
        imgExtraction,
        brand,
        "image",
      ),
    ).toThrow(AutobuildValidationError); // it was the only field → zero survivors
  });

  it("drops boxes over 90% of the canvas area", () => {
    const out = validateProposal(
      proposal([
        field({ sourceId: undefined, box: { x: 0, y: 0, width: 1440, height: 1400 } }),
        field({
          sourceId: undefined,
          label: "Name",
          fieldKey: "name",
          box: { x: 10, y: 10, width: 400, height: 60 },
        }),
      ]),
      imgExtraction,
      brand,
      "image",
    );
    expect(out.fields).toHaveLength(1);
    expect(out.fields[0].fieldKey).toBe("name");
    expect(out.warnings.some((w) => w.includes("90%"))).toBe(true);
  });
});

describe("coverage — nothing the extractor found goes missing", () => {
  it("imports an unclaimed element as Fixed rather than losing it", () => {
    const out = validateProposal(
      proposal([field({})]),
      extraction([element("1:10"), element("1:11", "text", { text: "Legal disclaimer" })]),
      brand,
      "figma",
    );
    const synthesized = out.fields.find((f) => f.sourceNodeId === "1:11");
    expect(synthesized).toBeDefined();
    expect(synthesized!.static).toBe(true);
    expect(synthesized!.staticValue).toBe("Legal disclaimer");
  });

  it("never synthesizes fields for shapes", () => {
    const out = validateProposal(
      proposal([field({})]),
      extraction([element("1:10"), element("1:12", "shape")]),
      brand,
      "figma",
    );
    expect(out.fields.some((f) => f.sourceNodeId === "1:12")).toBe(false);
  });
});

describe("select and static rules", () => {
  it("select needs 1-12 options; empty demotes to text", () => {
    const out = validateProposal(
      proposal([field({ type: "select", options: [] })]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields[0].type).toBe("text");
  });

  it("caps select options at 12", () => {
    const out = validateProposal(
      proposal([
        field({ type: "select", options: Array.from({ length: 20 }, (_, i) => `Opt ${i}`) }),
      ]),
      extraction([element("1:10")]),
      brand,
      "figma",
    );
    expect(out.fields[0].options).toHaveLength(12);
  });

  it("a Fixed text field bakes the source text and drops member-input props", () => {
    const out = validateProposal(
      proposal([field({ static: true, required: true, maxLength: 40, placeholder: "unused" })]),
      extraction([element("1:10", "text", { text: "SocialPaint" })]),
      brand,
      "figma",
    );
    const f = out.fields[0];
    expect(f.static).toBe(true);
    expect(f.staticValue).toBe("SocialPaint");
    expect(f.required).toBeUndefined();
    expect(f.maxLength).toBeUndefined();
    expect(f.placeholder).toBeUndefined();
  });

  it("clamps maxLength into 1..2000", () => {
    const out = validateProposal(
      proposal([
        field({ maxLength: 99999 }),
        field({ sourceId: "1:11", label: "Sub", fieldKey: "sub", maxLength: 0 }),
      ]),
      extraction([element("1:10"), element("1:11")]),
      brand,
      "figma",
    );
    expect(out.fields[0].maxLength).toBe(2000);
    expect(out.fields[1].maxLength).toBe(1);
  });
});
