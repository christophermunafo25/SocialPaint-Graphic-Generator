import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import { inUseMessage, templateAssetDependencies, templatesUsingSource } from "./assetUsage";

let n = 0;
const field = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${n++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `k${n}`,
  type: "text",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});

const schema = (over: Partial<TemplateSchema>): TemplateSchema => ({
  id: "t",
  companyId: "c",
  name: over.name ?? "Template",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: "",
  updatedAt: "",
  ...over,
});

const LOGO = "brand-assets/co/logo/orange.svg";

describe("templateAssetDependencies", () => {
  it("names the background, fixed images, and variation swaps, once each", () => {
    const t = schema({
      backgroundUrl: "template-backgrounds/co/bg.png",
      fields: [
        field({ fieldKey: "logo", label: "Logo", type: "image", static: true, staticValue: LOGO }),
        field({ fieldKey: "photo", type: "image", staticValue: LOGO }), // member slot: not a dependency
        field({
          fieldKey: "again",
          label: "Again",
          type: "image",
          static: true,
          staticValue: LOGO,
        }),
      ],
      variants: [
        {
          id: "v",
          name: "Dark",
          backgroundUrl: "template-backgrounds/co/dark.png",
          overrides: { logo: { staticValue: "brand-assets/co/logo/white.svg" } },
        },
      ],
    });
    expect(templateAssetDependencies(t).map((d) => [d.source, d.label])).toEqual([
      ["template-backgrounds/co/bg.png", "background"],
      [LOGO, "Logo"],
      ["template-backgrounds/co/dark.png", "Dark background"],
      ["brand-assets/co/logo/white.svg", "Dark · Logo"],
    ]);
  });

  it("ignores data URLs and external images", () => {
    const t = schema({
      backgroundUrl: "https://cdn.example.com/bg.png",
      fields: [field({ type: "image", static: true, staticValue: "data:image/png;base64,AAAA" })],
    });
    expect(templateAssetDependencies(t)).toEqual([]);
  });

  it("matches a legacy public URL to the same object as a reference", () => {
    const t = schema({
      fields: [
        field({
          label: "Logo",
          type: "image",
          static: true,
          staticValue:
            "https://x.supabase.co/storage/v1/object/public/brand-assets/co/logo/orange.svg",
        }),
      ],
    });
    expect(templatesUsingSource([t], LOGO)).toHaveLength(1);
  });
});

describe("templatesUsingSource", () => {
  const a = schema({
    name: "Tech Talk",
    fields: [field({ label: "Logo", type: "image", static: true, staticValue: LOGO })],
  });
  const b = schema({ name: "Hiring", fields: [field({ label: "Headline" })] });

  it("finds the templates that paint the object and where", () => {
    const uses = templatesUsingSource([a, b], LOGO);
    expect(uses.map((u) => u.template.name)).toEqual(["Tech Talk"]);
    expect(uses[0].labels).toEqual(["Logo"]);
  });

  it("is empty for an unused object or a non-reference", () => {
    expect(templatesUsingSource([a, b], "brand-assets/co/logo/other.svg")).toEqual([]);
    expect(templatesUsingSource([a, b], "data:image/png;base64,AAAA")).toEqual([]);
  });

  it("writes the refusal in the admin's terms", () => {
    expect(inUseMessage("orange.svg", templatesUsingSource([a], LOGO))).toBe(
      "“orange.svg” is on 1 template (Tech Talk). Replace it there first, then remove it.",
    );
  });
});
