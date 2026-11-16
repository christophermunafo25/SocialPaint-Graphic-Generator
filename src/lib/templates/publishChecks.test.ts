import { describe, expect, it } from "vitest";
import type { TemplateField } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { limitOverflows, limitSample } from "./publishChecks";

/** Deterministic fake glyphs, as measureProposal.test.ts: every character is
 * half the font size wide. */
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
  textSizing: "shrink",
  placeholder: "aaaaa",
  ...over,
});

const schema = (fields: TemplateField[]) => ({ fields, canvasWidth: 1440, canvasHeight: 1440 });

describe("limitSample", () => {
  it("repeats the placeholder to exactly the limit", () => {
    expect(limitSample(mkField({ placeholder: "Remote" }), 15)).toBe("Remote Remote R");
    expect(limitSample(mkField({ placeholder: "" }), 6)).toBe("Sample");
  });
});

describe("limitOverflows", () => {
  // 20px glyphs at size 40 in a 400px box: 20 characters at the set size,
  // 44 at the 18px floor on one line.
  it("names a field whose limit runs past its box", () => {
    const apply = mkField({ label: "Apply link", maxLength: 80 });
    const role = mkField({ label: "Role", maxLength: 30 });
    expect(limitOverflows(schema([apply, role]), {}, null, measure)).toEqual([
      { fieldId: apply.id, label: "Apply link", maxLength: 80 },
    ]);
  });

  it("leaves out fixed text, fields with no limit, and images", () => {
    const fixed = mkField({ static: true, maxLength: 200 });
    const open = mkField({ maxLength: undefined });
    const photo = mkField({ type: "image", maxLength: 200 });
    expect(limitOverflows(schema([fixed, open, photo]), {}, null, measure)).toEqual([]);
  });
});
