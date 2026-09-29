import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import { detailFieldsFor, detailKindOf, upsertDetail, type DetailTagValue } from "./details";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: over.fieldKey ?? "f",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  ...over,
});

const schema = (fields: TemplateField[], extra: Partial<TemplateSchema> = {}): TemplateSchema => ({
  id: "t-1",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields,
  captionTemplate: "",
  createdAt: "2026-09-29T00:00:00Z",
  updatedAt: "2026-09-29T00:00:00Z",
  ...extra,
});

describe("detailKindOf", () => {
  it.each([
    [{ label: "Button link", fieldKey: "apply_link" }, "link"],
    [{ label: "Website", fieldKey: "site" }, "link"],
    [{ label: "Where to apply", fieldKey: "cta" }, "link"],
    [{ label: "Page", fieldKey: "page_url" }, "link"],
    [{ label: "Date & time", fieldKey: "when" }, "date"],
    [{ label: "Deadline", fieldKey: "d" }, "date"],
    [{ label: "Starts", fieldKey: "start_time" }, "date"],
    [{ label: "Venue", fieldKey: "v" }, "place"],
    [{ label: "City", fieldKey: "c" }, "place"],
    [{ label: "Location", fieldKey: "loc" }, "place"],
    [{ label: "Role", fieldKey: "role" }, "text"],
    [{ label: "Headline", fieldKey: "headline" }, "text"],
    // Whole words only: "Applied science" names no link, "Timeline" no time.
    [{ label: "Timeline", fieldKey: "t" }, "text"],
  ] as const)("%o reads as %s", (f, kind) => {
    expect(detailKindOf(f)).toBe(kind);
  });
});

describe("detailFieldsFor", () => {
  const base = schema([
    field({ fieldKey: "role", label: "Role", maxLength: 40, placeholder: "Senior designer" }),
    field({ fieldKey: "footer", label: "Footer", static: true }),
    field({ fieldKey: "photo", label: "Photo", type: "image" }),
    field({ fieldKey: "divider", label: "Divider", type: "shape" }),
    field({ fieldKey: "apply_link", label: "Button link", optional: true }),
    field({ fieldKey: "type", label: "Type", type: "select", options: ["Full time", "Part time"] }),
    field({ fieldKey: "about", label: "About", type: "multiline" }),
  ]);

  it("lists member text, multiline and select fields in form order", () => {
    const rows = detailFieldsFor(base);
    expect(rows.map((r) => r.fieldKey)).toEqual(["role", "apply_link", "type", "about"]);
    expect(rows[0]).toEqual({
      fieldKey: "role",
      label: "Role",
      kind: "text",
      type: "text",
      optional: false,
      placeholder: "Senior designer",
      maxLength: 40,
    });
    expect(rows[1]).toMatchObject({ kind: "link", optional: true });
    expect(rows[2].options).toEqual(["Full time", "Part time"]);
  });

  it("leaves out a field the look hides", () => {
    const withLook = schema(base.fields, {
      variants: [
        { id: "v1", name: "Plain", isDefault: true, overrides: {} },
        { id: "v2", name: "No link", overrides: { apply_link: { hidden: true } } },
      ],
    });
    expect(detailFieldsFor(withLook, "v2").map((r) => r.fieldKey)).not.toContain("apply_link");
    expect(detailFieldsFor(withLook, "v1").map((r) => r.fieldKey)).toContain("apply_link");
  });
});

describe("upsertDetail", () => {
  const role = { fieldKey: "role", label: "Role", kind: "text" as const };
  const link = { fieldKey: "apply_link", label: "Button link", kind: "link" as const };

  it("appends, replaces in place, trims, and removes on blank", () => {
    let tags: DetailTagValue[] = [];
    tags = upsertDetail(tags, role, "  Creative Director ");
    tags = upsertDetail(tags, link, "socialpaint.ai/careers");
    expect(tags.map((t) => t.value)).toEqual(["Creative Director", "socialpaint.ai/careers"]);
    tags = upsertDetail(tags, role, "Art Director");
    expect(tags.map((t) => t.fieldKey)).toEqual(["role", "apply_link"]);
    expect(tags[0].value).toBe("Art Director");
    tags = upsertDetail(tags, role, "   ");
    expect(tags.map((t) => t.fieldKey)).toEqual(["apply_link"]);
  });
});
