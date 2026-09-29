import { describe, expect, it } from "vitest";
import { mergeCaption } from "./caption";
import type { TemplateField, TemplateSchema } from "./types";

const field = (fieldKey: string, extra: Partial<TemplateField> = {}): TemplateField => ({
  id: fieldKey,
  label: fieldKey,
  fieldKey,
  type: "text",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  ...extra,
});

const schema = (captionTemplate: string, fields: TemplateField[]): TemplateSchema =>
  ({ captionTemplate, fields }) as unknown as TemplateSchema;

describe("mergeCaption", () => {
  const fields = [field("role"), field("city", { optional: true })];

  it("fills tags from values", () => {
    expect(
      mergeCaption(schema("Hiring a {role} in {city}.", fields), { role: "Chef", city: "Austin" }),
    ).toBe("Hiring a Chef in Austin.");
  });

  it("keeps the readable blank for an empty required field", () => {
    expect(mergeCaption(schema("Hiring a {role}.", fields), {})).toBe("Hiring a ____.");
  });

  it("leaves an empty optional field out and tidies the doubled space", () => {
    expect(mergeCaption(schema("Now hiring {city} today", fields), {})).toBe("Now hiring today");
    expect(mergeCaption(schema("Now hiring\n{city}\nApply", fields), {})).toBe(
      "Now hiring\n\nApply",
    );
    expect(mergeCaption(schema("Hiring {city}", fields), {})).toBe("Hiring");
  });

  it("does not touch spacing the admin wrote when nothing was left out", () => {
    expect(mergeCaption(schema("A  {role}  line", fields), { role: "Chef" })).toBe("A  Chef  line");
  });
});
