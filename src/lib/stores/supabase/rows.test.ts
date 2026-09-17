import { describe, expect, it } from "vitest";
import type { TemplateField } from "../../types";
import { fieldToRow, toTemplateField, type TemplateFieldRow } from "./rows";

/** Field → row → field must be identity for everything the row can carry —
 * the column-by-column mappers are the one place a new property can silently
 * fall out of persistence. */
const roundTrip = (f: TemplateField): TemplateField =>
  toTemplateField({ id: f.id, ...fieldToRow("t1", f, 0) } as TemplateFieldRow);

describe("template field row mapping", () => {
  const shape: TemplateField = {
    id: "f1",
    label: "Card",
    fieldKey: "card",
    type: "shape",
    shape: "rect",
    x: 10,
    y: 20,
    width: 300,
    height: 200,
    colorHex: "#082E17",
    cornerRadius: { tl: 12, tr: 12, br: 12, bl: 12 },
    static: true,
    required: false,
  };

  it("round-trips stroke properties", () => {
    const stroked = { ...shape, strokeColor: "#9CFF4A", strokeWidthPx: 3 };
    expect(roundTrip(stroked)).toMatchObject({ strokeColor: "#9CFF4A", strokeWidthPx: 3 });
  });

  it("keeps absent stroke properties absent", () => {
    const back = roundTrip(shape);
    expect(back.strokeColor).toBeUndefined();
    expect(back.strokeWidthPx).toBeUndefined();
  });

  it("round-trips plate properties on text fields", () => {
    const plated: TemplateField = {
      ...shape,
      type: "text",
      shape: undefined,
      plateColor: "#082E17",
      platePaddingX: 24,
      platePaddingY: 12,
    };
    expect(roundTrip(plated)).toMatchObject({
      plateColor: "#082E17",
      platePaddingX: 24,
      platePaddingY: 12,
    });
    const bare = roundTrip(shape);
    expect(bare.plateColor).toBeUndefined();
    expect(bare.platePaddingX).toBeUndefined();
    expect(bare.platePaddingY).toBeUndefined();
  });

  it("coerces numeric columns Postgres returns as strings", () => {
    const row = { id: "f1", ...fieldToRow("t1", shape, 0) } as TemplateFieldRow;
    // Postgres `numeric` arrives as a string through the JS client.
    (row as unknown as Record<string, unknown>).stroke_width_px = "2.5";
    (row as unknown as Record<string, unknown>).stroke_color = "#111111";
    (row as unknown as Record<string, unknown>).plate_padding_x = "24";
    (row as unknown as Record<string, unknown>).plate_padding_y = "12.5";
    const back = toTemplateField(row);
    expect(back.strokeWidthPx).toBe(2.5);
    expect(typeof back.strokeWidthPx).toBe("number");
    expect(back.platePaddingX).toBe(24);
    expect(back.platePaddingY).toBe(12.5);
  });
});
