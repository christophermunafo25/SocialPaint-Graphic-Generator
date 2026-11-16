import { describe, expect, it } from "vitest";
import type { ImportIntentReport as ServerIntentReport } from "../../../supabase/functions/_shared/importIntent.ts";
import type { BrandKit, ImportIntentReport, TemplateField } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import {
  asSentence,
  correctCapTrim,
  importSummary,
  measureLimits,
  offPaletteIssue,
  prepareImport,
  templateNameFromFrame,
  type FaceMeasurer,
} from "./importPrepare";

/** Every glyph is half its font size wide, so widths are easy to read. */
const measure: LineMeasurer = (text, font) =>
  text.length * 0.5 * parseFloat(/(\d+(\.\d+)?)px/.exec(font)![1]);

const text = (over: Partial<TemplateField> = {}): TemplateField => ({
  id: "t1",
  label: "Headline",
  fieldKey: "headline",
  type: "multiline",
  x: 100,
  y: 200,
  width: 400,
  height: 300,
  fontFamily: "Newsreader",
  fontWeight: 500,
  fontSizePx: 100,
  lineHeight: 1,
  textSizing: "shrink",
  minFontScale: 0.5,
  placeholder: "One two three",
  ...over,
});

const CANVAS = { canvasWidth: 1000, canvasHeight: 1000 };

describe("correctCapTrim", () => {
  // A face that rises far above its capitals: ascent 0.74, descent 0.26.
  const serif: FaceMeasurer = () => ({ ascent: 0.74, descent: 0.26 });
  // One whose rise above the capitals equals its descent, as Inter's does.
  const even: FaceMeasurer = () => ({ ascent: 0.97, descent: 0.24 });
  const unloaded: FaceMeasurer = () => null;

  it("moves the box so the baseline sits where Figma had it", () => {
    // (58.6 + 26 - 74) / 2 = 5.3
    const [f] = correctCapTrim([text()], [{ fieldId: "t1", capHeight: 58.6 }], null, serif);
    expect(f).toMatchObject({ y: 205.3, height: 300 });
  });

  it("keeps the far edge of a band", () => {
    const down = correctCapTrim(
      [text()],
      [{ fieldId: "t1", capHeight: 58.6, band: "down" }],
      null,
      serif,
    )[0];
    expect(down).toMatchObject({ y: 205.3, height: 294.7 });
    expect(down.y + down.height).toBe(500);
    const up = correctCapTrim(
      [text()],
      [{ fieldId: "t1", capHeight: 58.6, band: "up" }],
      null,
      serif,
    )[0];
    expect(up).toMatchObject({ y: 200, height: 305.3 });
  });

  it("leaves a design that was already exact where it was", () => {
    // (73 + 24 - 97) / 2 = 0: under a pixel is rounding, not a correction.
    const fields = [text()];
    expect(correctCapTrim(fields, [{ fieldId: "t1", capHeight: 73 }], null, even)[0]).toBe(
      fields[0],
    );
  });

  it("leaves text in a face this workspace can't draw", () => {
    const fields = [text()];
    expect(
      correctCapTrim(fields, [{ fieldId: "t1", capHeight: 58.6 }], null, serif, ["Newsreader"])[0],
    ).toBe(fields[0]);
  });

  it("does nothing without the real face, or for a field that isn't listed", () => {
    const fields = [text()];
    expect(correctCapTrim(fields, [{ fieldId: "t1", capHeight: 58.6 }], null, unloaded)[0]).toBe(
      fields[0],
    );
    expect(correctCapTrim(fields, [{ fieldId: "other", capHeight: 58.6 }], null, serif)[0]).toBe(
      fields[0],
    );
  });
});

describe("measureLimits", () => {
  const run = (
    field: TemplateField,
    limits: Array<{ fieldId: string; max?: number; lines?: number }> = [],
    others: TemplateField[] = [],
  ) => measureLimits([field, ...others], { limits, kit: null, measure, ...CANVAS });

  it("measures a member field's limit at its shrink floor", () => {
    // Floor 50px: 25px a glyph, 16 to a 400px line, 6 lines in 300px.
    const { fields, issues } = run(text());
    expect(fields[0].maxLength).toBeGreaterThan(60);
    expect(fields[0].maxLength).toBeLessThan(96);
    expect(issues).toEqual([]);
  });

  it("holds the limit inside the lines a layer names", () => {
    const open = run(text()).fields[0].maxLength!;
    const two = run(text(), [{ fieldId: "t1", lines: 2 }]).fields[0].maxLength!;
    expect(two).toBeLessThan(open);
    expect(two).toBeLessThanOrEqual(32);
    expect(two).toBeGreaterThan(16);
  });

  it("keeps a keyed max that fits", () => {
    const { fields, issues } = run(text(), [{ fieldId: "t1", max: 20, lines: 2 }]);
    expect(fields[0].maxLength).toBe(20);
    expect(issues).toEqual([]);
  });

  it("lowers a keyed max that can't fit, and says so", () => {
    const { fields, issues } = run(text(), [{ fieldId: "t1", max: 200, lines: 2 }]);
    const fitted = fields[0].maxLength!;
    expect(fitted).toBeLessThan(200);
    expect(issues).toEqual([
      {
        layer: "Headline",
        nodeId: "",
        issue: `max=200 doesn't fit 2 lines here; ${fitted} does.`,
        severity: "info",
      },
    ]);
  });

  it("leaves fixed text, images and unmeasurable faces alone", () => {
    const fixed = text({ static: true });
    expect(run(fixed).fields[0]).toBe(fixed);
    const image = text({ type: "image" });
    expect(run(image).fields[0]).toBe(image);
    const field = text({ maxLength: 12 });
    const out = measureLimits([field], {
      limits: [],
      kit: null,
      measure,
      ...CANVAS,
      missingFonts: ["Newsreader"],
    });
    expect(out.fields[0]).toBe(field);
  });

  it("gives a pill the room to the next element, at its designed size", () => {
    const pill = text({
      id: "p1",
      type: "text",
      label: "Call to action",
      x: 100,
      y: 800,
      width: 200,
      height: 60,
      fontSizePx: 20,
      plateColor: "#FFFFFF",
      platePaddingX: 20,
      align: "left",
    });
    const logo = text({ id: "l1", type: "image", x: 600, y: 800, width: 100, height: 60 });
    const plate = text({
      id: "s1",
      type: "shape",
      static: true,
      x: 50,
      y: 700,
      width: 900,
      height: 250,
    });
    // To the logo, less a gap as wide as its padding, is 480px; less 40 of
    // padding, 10px a glyph: 44 fit, 39 kept.
    const out = run(pill, [], [logo, plate]);
    expect(out.fields[0].maxLength).toBe(39);
    // Alone, it runs to the margin it keeps from the left: 800 - 40 = 760.
    expect(run(pill, [], [plate]).fields[0].maxLength).toBe(68);
    // A keyed max under that still wins.
    expect(run(pill, [{ fieldId: "p1", max: 24 }], [logo]).fields[0].maxLength).toBe(24);
  });
});

describe("measureLimits, more", () => {
  const limitOf = (field: TemplateField, lines?: number) =>
    measureLimits([field], {
      limits: lines ? [{ fieldId: field.id, lines }] : [],
      kit: null,
      measure,
      ...CANVAS,
    }).fields[0].maxLength!;

  it("measures a field with no floor of its own at three quarters of its size", () => {
    const none = limitOf(text({ minFontScale: undefined }), 2);
    expect(none).toBe(limitOf(text({ minFontScale: 0.75 }), 2));
    // Measured where it may really shrink to, the limit would be far higher.
    expect(none).toBeLessThan(limitOf(text({ minFontScale: 0.25 }), 2));
    // The field itself still shrinks as far as it did.
    const out = measureLimits([text({ minFontScale: undefined })], {
      limits: [],
      kit: null,
      measure,
      ...CANVAS,
    });
    expect(out.fields[0].minFontScale).toBeUndefined();
  });

  const pill = (over: Partial<TemplateField> = {}) =>
    text({
      id: "p1",
      type: "text",
      label: "Call to action",
      x: 100,
      y: 800,
      width: 200,
      height: 60,
      fontSizePx: 20,
      plateColor: "#FFFFFF",
      platePaddingX: 20,
      align: "left",
      ...over,
    });

  it("grows a centred pill both ways, to the margin the content keeps", () => {
    const centred = pill({ x: 450, width: 100, align: "center" });
    // Alone there is nothing to go by: it keeps its own width, 60px of copy.
    expect(limitOf(centred)).toBe(5);
    // A headline keeps 100px from the edges: the pill may run 100 to 900,
    // which is 760px of copy.
    const headline = text({ id: "h1", x: 100, y: 200, width: 800, height: 300 });
    const out = measureLimits([centred, headline], { limits: [], kit: null, measure, ...CANVAS });
    expect(out.fields[0].maxLength).toBe(68);
  });

  it("sees what is already on the canvas when a layer is pasted", () => {
    const logo = text({ id: "l1", type: "image", x: 600, y: 800, width: 100, height: 60 });
    const out = measureLimits([pill()], {
      limits: [],
      kit: null,
      measure,
      ...CANVAS,
      context: [logo],
    });
    expect(out.fields[0].maxLength).toBe(39);
  });
});

describe("templateNameFromFrame", () => {
  it("leaves out a library frame's code and the layout it describes", () => {
    expect(templateNameFromFrame("P15 · Doctor topic · Portrait with plate")).toBe("Doctor topic");
    expect(templateNameFromFrame("P01 · Announcement · Circle photo / v2")).toBe("Announcement");
  });

  it("keeps any other name as it is", () => {
    expect(templateNameFromFrame("Feature Highlight Post / Light / Green")).toBe(
      "Feature Highlight Post / Light / Green",
    );
    expect(templateNameFromFrame("Hero · Light")).toBe("Hero · Light");
    expect(templateNameFromFrame(" sp-auth-panel ")).toBe("sp-auth-panel");
    expect(templateNameFromFrame("")).toBe("");
  });
});

describe("asSentence", () => {
  it("starts an issue with a capital", () => {
    expect(asSentence("these colors aren't in your palette.")).toBe(
      "These colors aren't in your palette.",
    );
    expect(asSentence("")).toBe("");
  });
});

describe("offPaletteIssue", () => {
  const kit = (allowOffPalette: boolean | undefined) =>
    ({
      id: "k",
      companyId: "c",
      colors: [{ key: "ink", name: "Ink", hex: "#0C3654" }],
      typeStyles: [],
      guidelines: [],
      allowOffPalette,
    }) as BrandKit;
  const fields = [
    text({ colorHex: "#0C3654" }),
    text({ id: "t2", colorHex: "#f7bfa0", plateColor: "#FFE0CF" }),
    text({ id: "t3", type: "image", colorHex: "#123456" }),
  ];

  it("names the colours a kit that holds its palette would repaint, once", () => {
    expect(offPaletteIssue(fields, kit(false), "P15")).toEqual({
      layer: "P15",
      nodeId: "",
      issue:
        "these colors aren't in your palette and will show as the nearest one: #F7BFA0, #FFE0CF.",
      severity: "degraded",
    });
    expect(
      offPaletteIssue([fields[0], text({ id: "t4", colorHex: "#FF0000" })], kit(false), "P15")!
        .issue,
    ).toBe("this color isn't in your palette and will show as the nearest one: #FF0000.");
  });

  it("says nothing when every colour passes or the kit allows any", () => {
    expect(offPaletteIssue([fields[0]], kit(false), "P15")).toBeNull();
    expect(offPaletteIssue(fields, kit(true), "P15")).toBeNull();
    expect(offPaletteIssue(fields, kit(undefined), "P15")).toBeNull();
    expect(offPaletteIssue(fields, null, "P15")).toBeNull();
  });
});

describe("prepareImport", () => {
  it("measures the limit in the box the cap trim left", () => {
    const out = prepareImport([text()], {
      intent: {
        filledBy: "keys",
        layers: 1,
        keyed: 1,
        unknown: [],
        roles: [],
        limits: [{ fieldId: "t1", max: 32, lines: 3 }],
        capTrim: [{ fieldId: "t1", capHeight: 58.6, band: "down" }],
        formOrder: ["t1"],
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        modelMs: 0,
      },
      kit: null,
      measure,
      faces: () => ({ ascent: 0.74, descent: 0.26 }),
      ...CANVAS,
      layer: "P15",
    });
    expect(out.fields[0]).toMatchObject({ y: 205.3, height: 294.7, maxLength: 32 });
    expect(out.issues).toEqual([]);
  });

  it("changes nothing an import without a report needs changed", () => {
    const fixed = text({ static: true });
    const out = prepareImport([fixed], {
      kit: null,
      measure,
      faces: () => null,
      ...CANVAS,
      layer: "x",
    });
    expect(out).toEqual({ fields: [fixed], issues: [] });
  });
});

describe("importSummary", () => {
  const f = (label: string, over: Partial<TemplateField> = {}) =>
    text({ id: label, label, ...over });

  it("names what members fill in, in form order", () => {
    expect(
      importSummary(
        [
          f("Headline"),
          f("Call to action"),
          f("Photo", { type: "image" }),
          f("Plate", { type: "shape", static: true }),
          f("Logo", { type: "image", static: true }),
        ],
        "imported",
      ),
    ).toBe("5 elements imported. Members fill in 3: Headline, Call to action and Photo.");
    expect(
      importSummary(
        [f("Headline"), f("Plate", { static: true }), f("Rule", { static: true })],
        "pasted",
      ),
    ).toBe("3 elements pasted from Figma. Members fill in 1: Headline.");
    expect(importSummary([f("Headline"), f("Photo")], "imported")).toBe(
      "2 elements imported. Members fill in 2: Headline and Photo.",
    );
  });

  it("says so when everything is fixed", () => {
    expect(importSummary([f("Plate", { static: true })], "imported")).toBe(
      "1 element imported, all fixed.",
    );
    expect(importSummary([f("A", { static: true }), f("B", { type: "shape" })], "pasted")).toBe(
      "2 elements pasted from Figma, all fixed.",
    );
  });

  it("counts the names past four", () => {
    expect(
      importSummary(
        ["A", "B", "C", "D", "E", "F"].map((l) => f(l)),
        "imported",
      ),
    ).toBe("6 elements imported. Members fill in 6: A, B, C, D and 2 more.");
  });
});

describe("the intent report", () => {
  it("is declared the same on both sides of the function boundary", () => {
    // The functions can't import from src, so the report's shape is written
    // twice. These two assignments stop the typecheck when they drift apart.
    const fromServer = (report: ServerIntentReport): ImportIntentReport => report;
    const toServer = (report: ImportIntentReport): ServerIntentReport => report;
    expect([fromServer, toServer]).toHaveLength(2);
  });
});
