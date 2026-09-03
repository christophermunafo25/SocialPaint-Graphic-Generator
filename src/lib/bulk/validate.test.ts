import { describe, expect, it } from "vitest";
import type { TemplateField } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { checkRows } from "./validate";

/** Deterministic fake glyphs, same convention as layout.test.ts and
 * measureProposal.test.ts: every character is half the font size wide, with
 * the size parsed straight out of the shorthand the engine composes. */
const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

let nextId = 0;
const mkField = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${nextId++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `field_${nextId}`,
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  lineHeight: 1,
  fontSizePx: 40,
  minFontSizePx: 18,
  ...over,
});

const schema = (fields: TemplateField[]) => ({
  fields,
  layoutGroups: undefined,
  canvasWidth: 1440,
  canvasHeight: 1440,
});

// With 20px glyphs at size 40 in a 400px box: 20 chars fit at the set size,
// 44 fit at the 18px floor.
const headline = (over: Partial<TemplateField> = {}) =>
  mkField({ fieldKey: "headline", label: "Headline", textSizing: "shrink", ...over });
const name = (over: Partial<TemplateField> = {}) =>
  mkField({ fieldKey: "name", label: "Name", ...over });

describe("checkRows", () => {
  it("passes a row with nothing wrong", () => {
    const out = checkRows(
      schema([name(), headline()]),
      null,
      [["Ada", "Short"]],
      ["name", "headline"],
      measure,
    );
    expect(out).toEqual([
      { index: 0, values: { name: "Ada", headline: "Short" }, problems: [], ok: true },
    ]);
  });

  it("reports a required field that is empty or whitespace", () => {
    const out = checkRows(
      schema([name({ required: true })]),
      null,
      [[""], ["   "], ["Ada"]],
      ["name"],
      measure,
    );
    expect(out.map((r) => r.ok)).toEqual([false, false, true]);
    expect(out[0].problems).toEqual([
      { kind: "missing_required", fieldKey: "name", label: "Name" },
    ]);
  });

  it("reports a required field the map never filled", () => {
    const out = checkRows(schema([name({ required: true })]), null, [["x"]], [null], measure);
    expect(out[0].problems[0].kind).toBe("missing_required");
  });

  it("reports maxLength with the actual and allowed counts", () => {
    const out = checkRows(schema([name({ maxLength: 5 })]), null, [["Augusta"]], ["name"], measure);
    expect(out[0].problems).toEqual([
      { kind: "too_long", fieldKey: "name", label: "Name", max: 5, actual: 7 },
    ]);
  });

  it("rewrites a select value to the canonical option when only the case differs", () => {
    const city = mkField({
      fieldKey: "city",
      label: "City",
      type: "select",
      options: ["Chicago", "New York"],
    });
    const out = checkRows(schema([city]), null, [["chicago"], [" NEW YORK "]], ["city"], measure);
    expect(out[0].ok).toBe(true);
    expect(out[0].values.city).toBe("Chicago");
    expect(out[1].values.city).toBe("New York");
  });

  it("reports a select value that is not an option", () => {
    const city = mkField({
      fieldKey: "city",
      label: "City",
      type: "select",
      options: ["Chicago", "New York"],
    });
    const out = checkRows(schema([city]), null, [["Boston"]], ["city"], measure);
    expect(out[0].problems).toEqual([
      { kind: "not_an_option", fieldKey: "city", label: "City", options: ["Chicago", "New York"] },
    ]);
  });

  it("leaves an empty select value alone (required is the check for that)", () => {
    const city = mkField({ fieldKey: "city", type: "select", options: ["Chicago"] });
    const out = checkRows(schema([city]), null, [[""]], ["city"], measure);
    expect(out[0].ok).toBe(true);
  });

  it("does not report a value that shrinks to fit", () => {
    const out = checkRows(schema([headline()]), null, [["x".repeat(30)]], ["headline"], measure);
    expect(out[0].ok).toBe(true);
  });

  it("reports overflow with the measured character budget", () => {
    const out = checkRows(schema([headline()]), null, [["x".repeat(60)]], ["headline"], measure);
    expect(out[0].ok).toBe(false);
    expect(out[0].problems).toHaveLength(1);
    const p = out[0].problems[0];
    expect(p.kind).toBe("overflows");
    expect(p).toMatchObject({ fieldKey: "headline", label: "Headline" });
    // 44 fit at the floor; the budget backs off by the repair margin.
    expect(p.kind === "overflows" && p.characterBudget).toBe(39);
  });

  it("collects every problem on a row rather than stopping at the first", () => {
    const out = checkRows(
      schema([name({ required: true }), headline({ maxLength: 10 })]),
      null,
      [["", "x".repeat(60)]],
      ["name", "headline"],
      measure,
    );
    expect(out[0].problems.map((p) => p.kind)).toEqual([
      "missing_required",
      "too_long",
      "overflows",
    ]);
  });

  it("keeps every input row, in order, with its index", () => {
    const out = checkRows(
      schema([name()]),
      null,
      [["Ada"], ["Grace"], ["Katherine"]],
      ["name"],
      measure,
    );
    expect(out.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  // The Gate 2 worked example: a three-row CSV against a two-field schema
  // where row two overflows.
  it("worked example: three rows, two fields, row two overflows", () => {
    const rows = [
      ["Ada Lovelace", "Analytical engines"],
      ["Grace Hopper", "A compiler for every machine and a bug for every log book"],
      ["Katherine Johnson", "Orbital mechanics"],
    ];
    const out = checkRows(schema([name(), headline()]), null, rows, ["name", "headline"], measure);
    expect(out.map((r) => r.ok)).toEqual([true, false, true]);
    expect(out[1].problems).toEqual([
      { kind: "overflows", fieldKey: "headline", label: "Headline", characterBudget: 39 },
    ]);
  });
});
