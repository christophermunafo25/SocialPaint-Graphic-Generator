import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "@/lib/types";
import { diffLines, familyOf } from "./SizesDialog";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: over.fieldKey ?? "f",
  label: "Field",
  fieldKey: "f",
  type: "text",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  ...over,
});

const template = (over: Partial<TemplateSchema>): TemplateSchema =>
  ({
    id: "t",
    companyId: "co",
    name: "T",
    canvasWidth: 1080,
    canvasHeight: 1350,
    fields: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    ...over,
  }) as TemplateSchema;

describe("familyOf", () => {
  it("is the template alone without a family, else its family oldest first", () => {
    const a = template({ id: "a" });
    expect(familyOf(a, [a])).toEqual([a]);
    const b = template({ id: "b", familyId: "fam", createdAt: "2026-10-03T00:00:00.000Z" });
    const c = template({ id: "c", familyId: "fam", createdAt: "2026-10-02T00:00:00.000Z" });
    const other = template({ id: "d", familyId: "other" });
    expect(familyOf(b, [b, c, other]).map((t) => t.id)).toEqual(["c", "b"]);
  });
});

describe("diffLines", () => {
  it("names each member-facing difference in one line", () => {
    const from = template({
      fields: [
        field({ fieldKey: "headline", label: "Headline" }),
        field({ fieldKey: "subhead", label: "Subhead" }),
      ],
    });
    const to = template({
      fields: [
        field({ fieldKey: "headline", label: "Headline", type: "multiline" }),
        field({ fieldKey: "cta", label: "Call to action" }),
      ],
    });
    expect(diffLines(from, to)).toEqual([
      "No Subhead field",
      "Call to action is only in this size",
      "Headline is a different type",
    ]);
    expect(diffLines(from, from)).toEqual([]);
  });
});
