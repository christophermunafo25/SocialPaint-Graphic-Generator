import { describe, expect, it } from "vitest";
import type { TemplateField } from "../types";
import { autoMap, fillableFields, rowToValues, starterCsv } from "./mapping";

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
  ...over,
});

describe("fillableFields", () => {
  it("keeps member-editable text, multiline, and select fields", () => {
    const fields = [
      mkField({ fieldKey: "headline", type: "text" }),
      mkField({ fieldKey: "body", type: "multiline" }),
      mkField({ fieldKey: "city", type: "select", options: ["Chicago"] }),
    ];
    expect(fillableFields({ fields }).map((f) => f.fieldKey)).toEqual(["headline", "body", "city"]);
  });

  it("drops image fields, shapes, and anything static", () => {
    const fields = [
      mkField({ fieldKey: "photo", type: "image" }),
      mkField({ fieldKey: "bar", type: "shape", static: true }),
      mkField({ fieldKey: "brand", type: "text", static: true, staticValue: "SocialPaint" }),
      mkField({ fieldKey: "headline", type: "text" }),
    ];
    expect(fillableFields({ fields }).map((f) => f.fieldKey)).toEqual(["headline"]);
  });
});

describe("autoMap", () => {
  const fields = [
    mkField({ fieldKey: "speaker_name", label: "Speaker name" }),
    mkField({ fieldKey: "talk_title", label: "Talk title" }),
    mkField({ fieldKey: "city", label: "City" }),
  ];

  it("matches an exact field key", () => {
    expect(autoMap(["talk_title"], fields)).toEqual(["talk_title"]);
  });

  it("matches a label regardless of case", () => {
    expect(autoMap(["SPEAKER NAME", "city"], fields)).toEqual(["speaker_name", "city"]);
  });

  it("matches a normalized header against the key and the label", () => {
    expect(autoMap(["Speaker-Name", "Talk  Title!", "  CITY  "], fields)).toEqual([
      "speaker_name",
      "talk_title",
      "city",
    ]);
  });

  it("maps unmatched columns to null and never guesses by position", () => {
    expect(autoMap(["Email", "Phone", "Speaker name"], fields)).toEqual([
      null,
      null,
      "speaker_name",
    ]);
  });

  it("claims each field at most once", () => {
    // All three match at the label tier or below; only the first claims it.
    expect(autoMap(["City", "CITY", "City!"], fields)).toEqual(["city", null, null]);
  });

  it("lets an exact key match win over an earlier column's normalized match", () => {
    // Column 0 would normalize to "city"; column 1 IS the key. The stricter
    // match claims the field even though it comes later in the file.
    expect(autoMap(["City!", "city"], fields)).toEqual([null, "city"]);
  });

  it("does not fuzzy-match on spelling distance", () => {
    expect(autoMap(["Speaker nmae", "Titel"], fields)).toEqual([null, null]);
  });

  it("ignores an empty header", () => {
    expect(autoMap(["", "   "], fields)).toEqual([null, null]);
  });
});

describe("rowToValues", () => {
  it("produces plain string values keyed by field", () => {
    expect(rowToValues(["Ada", "ignored", "London"], ["name", null, "city"])).toEqual({
      name: "Ada",
      city: "London",
    });
  });

  it("keeps a cell exactly as typed", () => {
    expect(rowToValues([" 42 ", "chicago"], ["count", "city"])).toEqual({
      count: " 42 ",
      city: "chicago",
    });
  });

  it("fills a missing cell with an empty string", () => {
    expect(rowToValues(["Ada"], ["name", "city"])).toEqual({ name: "Ada", city: "" });
  });

  it("lets the leftmost column win when two map to one field", () => {
    expect(rowToValues(["first", "second"], ["name", "name"])).toEqual({ name: "first" });
  });
});

describe("starterCsv", () => {
  it("writes every fillable label as a header and placeholders as the one row", () => {
    const fields = [
      mkField({ fieldKey: "name", label: "Speaker name", placeholder: "Ada Lovelace" }),
      mkField({ fieldKey: "photo", label: "Photo", type: "image" }),
      mkField({ fieldKey: "talk", label: "Talk, title", placeholder: 'On "engines"' }),
      mkField({ fieldKey: "city", label: "City", type: "select", options: ["Chicago"] }),
    ];
    expect(starterCsv({ fields })).toBe(
      'Speaker name,"Talk, title",City\r\nAda Lovelace,"On ""engines""",\r\n',
    );
  });

  it("round-trips through parseCsv and autoMap with every column matched", async () => {
    const { parseCsv } = await import("./csv");
    // Placeholders give the one row content; a starter whose fields have
    // none is a header over a blank row, and blank rows are dropped.
    const fields = [
      mkField({ fieldKey: "speaker_name", label: "Speaker name", placeholder: "Ada" }),
      mkField({ fieldKey: "talk_title", label: "Talk title" }),
    ];
    const parsed = parseCsv(starterCsv({ fields }));
    expect(parsed.rows).toEqual([["Ada", ""]]);
    expect(autoMap(parsed.headers, fields)).toEqual(["speaker_name", "talk_title"]);
  });
});

describe("the look column", () => {
  const fields = [mkField({ fieldKey: "name", label: "Name" })];
  const variants = [
    { id: "v1", name: "Green", isDefault: true, overrides: {} },
    { id: "v2", name: "Dark / Blue", overrides: {} },
  ];

  it("maps a variant/variation/look header only when asked to", async () => {
    const { VARIANT_COLUMN } = await import("./mapping");
    expect(autoMap(["Name", "Look"], fields, { variants: true })).toEqual(["name", VARIANT_COLUMN]);
    expect(autoMap(["variation", "name"], fields, { variants: true })).toEqual([
      VARIANT_COLUMN,
      "name",
    ]);
    // A single-variant template has no look to choose: the column is ignored.
    expect(autoMap(["Name", "Look"], fields)).toEqual(["name", null]);
  });

  it("never lets the look column into the values", async () => {
    const { VARIANT_COLUMN, rowVariantName } = await import("./mapping");
    const map = ["name", VARIANT_COLUMN];
    expect(rowToValues(["Ada", "Green"], map)).toEqual({ name: "Ada" });
    expect(rowVariantName(["Ada", " Green "], map)).toBe("Green");
    expect(rowVariantName(["Ada"], ["name"])).toBe("");
  });

  it("adds a Look column to the starter, pre-filled with the default", () => {
    expect(starterCsv({ fields, variants })).toBe("Name,Look\r\n,Green\r\n");
    expect(starterCsv({ fields, variants: [variants[0]] })).toBe("Name\r\n\r\n");
  });
});
