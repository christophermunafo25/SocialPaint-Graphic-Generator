import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema, TemplateVariant } from "@/lib/types";
import {
  applyVariant,
  applyVariantToFields,
  applyVariantToSchema,
  cloneVariant,
  ensureOneDefault,
  getVariant,
  hasVariants,
  nextVariantName,
  pruneVariants,
  removeVariant,
  resolveVariantBackground,
  retagVariants,
  unstyledKeys,
  unstyledVariantCount,
  variantByName,
} from "./variants";

let n = 0;
const mkField = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${n++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `k${n}`,
  type: "text",
  x: 100,
  y: 100,
  width: 400,
  height: 60,
  fontSizePx: 30,
  colorHex: "#111111",
  ...over,
});

const headline = mkField({ fieldKey: "headline", colorHex: "#111111" });
const logo = mkField({
  fieldKey: "logo",
  type: "image",
  static: true,
  staticValue: "ref:brand-assets/logo-dark.svg",
});
const photo = mkField({ fieldKey: "photo", type: "image" });

const green: TemplateVariant = {
  id: "v-green",
  name: "Green",
  isDefault: true,
  backgroundColor: "#0B3D2E",
  overrides: {
    headline: { colorHex: "#FFFFFF" },
    logo: { staticValue: "ref:brand-assets/logo-light.svg" },
  },
};
const blue: TemplateVariant = {
  id: "v-blue",
  name: "Dark / Blue",
  backgroundGradient: { angle: 90, stops: [{ position: 0, color: "#000" }] },
  overrides: { headline: { colorHex: "#9BD1FF", opacity: 90 }, photo: { hidden: true } },
};

const schema = (variants?: TemplateVariant[]): TemplateSchema => ({
  id: "t1",
  companyId: "c1",
  name: "Announcement",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  backgroundColor: "#F9F9F8",
  fields: [headline, logo, photo],
  captionTemplate: "{headline}",
  createdAt: "",
  updatedAt: "",
  ...(variants ? { variants } : {}),
});

describe("absent variants is a passthrough", () => {
  it("applyVariant returns the very same field object", () => {
    expect(applyVariant(headline, undefined)).toBe(headline);
  });

  it("applyVariantToSchema returns the very same schema object", () => {
    const s = schema();
    expect(applyVariantToSchema(s, "anything")).toBe(s);
    expect(applyVariantToSchema(s)).toBe(s);
  });

  it("getVariant is undefined and hasVariants is false", () => {
    expect(getVariant(schema(), "v-green")).toBeUndefined();
    expect(hasVariants(schema())).toBe(false);
    expect(hasVariants(schema([green]))).toBe(false); // one look is no choice
    expect(hasVariants(schema([green, blue]))).toBe(true);
  });

  it("a variation with no entry for a field leaves the field object untouched", () => {
    expect(applyVariant(photo, green)).toBe(photo);
  });
});

describe("getVariant", () => {
  const s = schema([blue, green]);
  it("returns the requested variation", () => {
    expect(getVariant(s, "v-blue")?.id).toBe("v-blue");
  });
  it("falls back to the default for a stale or missing id", () => {
    expect(getVariant(s, "deleted")?.id).toBe("v-green");
    expect(getVariant(s)?.id).toBe("v-green");
    expect(getVariant(s, null)?.id).toBe("v-green");
  });
  it("falls back to the first when nothing is flagged default", () => {
    expect(getVariant(schema([blue, { ...green, isDefault: undefined }]))?.id).toBe("v-blue");
  });
  it("matches by name for the bulk CSV, case-insensitively", () => {
    expect(variantByName(s, "dark / blue")?.id).toBe("v-blue");
    expect(variantByName(s, "  GREEN ")?.id).toBe("v-green");
    expect(variantByName(s, "purple")).toBeUndefined();
    expect(variantByName(s, "")).toBeUndefined();
  });
});

describe("applyVariant", () => {
  it("override wins over the field value, and only the whitelisted keys move", () => {
    const merged = applyVariant(headline, green);
    expect(merged).not.toBe(headline);
    expect(merged.colorHex).toBe("#FFFFFF");
    // Everything structural is exactly the base.
    expect(merged.x).toBe(headline.x);
    expect(merged.fontSizePx).toBe(headline.fontSizePx);
    expect(merged.fieldKey).toBe("headline");
    expect(merged.id).toBe(headline.id);
  });

  it("a geometry key present in stored JSON is ignored rather than applied", () => {
    const tampered = {
      ...green,
      overrides: {
        headline: { colorHex: "#FFFFFF", x: 900, width: 10, fontSizePx: 4 } as never,
      },
    };
    const merged = applyVariant(headline, tampered);
    expect(merged.colorHex).toBe("#FFFFFF");
    expect(merged.x).toBe(100);
    expect(merged.width).toBe(400);
    expect(merged.fontSizePx).toBe(30);
  });

  it("swaps a fixed element's content but never a member field's", () => {
    expect(applyVariant(logo, green).staticValue).toBe("ref:brand-assets/logo-light.svg");
    const memberText = mkField({ fieldKey: "logo", static: false, staticValue: "keep" });
    expect(applyVariant(memberText, green).staticValue).toBe("keep");
  });

  it("a solid override clears the base gradient, so the solid actually paints", () => {
    const gradientBase = mkField({
      fieldKey: "headline",
      textGradient: { angle: 0, stops: [{ position: 0, color: "#f00" }] },
    });
    const merged = applyVariant(gradientBase, green);
    expect(merged.colorHex).toBe("#FFFFFF");
    expect(merged.textGradient).toBeUndefined();
  });

  it("applies opacity and type style bindings", () => {
    const merged = applyVariant(headline, blue);
    expect(merged.opacity).toBe(90);
    const rebound = applyVariant(headline, {
      ...blue,
      overrides: { headline: { typeStyleKey: "headline-on-dark" } },
    });
    expect(rebound.typeStyleKey).toBe("headline-on-dark");
  });
});

describe("applyVariantToFields / applyVariantToSchema", () => {
  it("drops hidden fields and keeps the rest in order", () => {
    const fields = applyVariantToFields([headline, logo, photo], blue);
    expect(fields.map((f) => f.fieldKey)).toEqual(["headline", "logo"]);
  });

  it("returns the same array when the variation changes nothing", () => {
    const fields = [photo];
    expect(applyVariantToFields(fields, green)).toBe(fields);
  });

  it("merges the background and leaves identity and dimensions alone", () => {
    const s = schema([green, blue]);
    const merged = applyVariantToSchema(s, "v-blue");
    expect(merged.id).toBe("t1");
    expect(merged.canvasWidth).toBe(1080);
    expect(merged.captionTemplate).toBe("{headline}");
    expect(merged.backgroundGradient).toEqual(blue.backgroundGradient);
    expect(merged.fields.find((f) => f.fieldKey === "headline")?.colorHex).toBe("#9BD1FF");
    expect(merged.fields.some((f) => f.fieldKey === "photo")).toBe(false);
    // The source is never mutated.
    expect(s.fields).toHaveLength(3);
    expect(s.backgroundColor).toBe("#F9F9F8");
  });
});

describe("resolveVariantBackground", () => {
  const base = {
    backgroundColor: "#F9F9F8",
    backgroundGradient: { angle: 45, stops: [{ position: 0, color: "#eee" }] },
    backgroundUrl: "ref:template-backgrounds/base.png",
  };
  it("passes the base through with no variation", () => {
    expect(resolveVariantBackground(base)).toEqual({
      color: "#F9F9F8",
      gradient: base.backgroundGradient,
      url: base.backgroundUrl,
    });
  });
  it("a colour-only variation asks for a solid: the base gradient goes", () => {
    const bg = resolveVariantBackground(base, green);
    expect(bg.color).toBe("#0B3D2E");
    expect(bg.gradient).toBeUndefined();
    expect(bg.url).toBe(base.backgroundUrl);
  });
  it("a variation that sets neither keeps the base pair, and can swap the image", () => {
    const bg = resolveVariantBackground(base, {
      id: "v",
      name: "Photo B",
      backgroundUrl: "ref:template-backgrounds/b.png",
      overrides: {},
    });
    expect(bg.color).toBe("#F9F9F8");
    expect(bg.gradient).toBe(base.backgroundGradient);
    expect(bg.url).toBe("ref:template-backgrounds/b.png");
  });
});

describe("field lifecycle", () => {
  it("rename rewrites override keys in every variation", () => {
    const out = retagVariants([green, blue], "headline", "title")!;
    expect(out[0].overrides.title).toEqual({ colorHex: "#FFFFFF" });
    expect(out[0].overrides.headline).toBeUndefined();
    expect(out[1].overrides.title).toEqual({ colorHex: "#9BD1FF", opacity: 90 });
    // Untouched keys survive, and the sources are not mutated.
    expect(out[0].overrides.logo).toBe(green.overrides.logo);
    expect(green.overrides.headline).toBeDefined();
  });

  it("rename is identity when nothing referenced the old key", () => {
    const vs = [green, blue];
    expect(retagVariants(vs, "nope", "still-nope")).toBe(vs);
    expect(retagVariants(vs, "headline", "headline")).toBe(vs);
    expect(retagVariants(undefined, "a", "b")).toBeUndefined();
  });

  it("prune drops orphan keys and nothing else", () => {
    const out = pruneVariants([green, blue], ["headline", "photo"])!;
    expect(Object.keys(out[0].overrides)).toEqual(["headline"]);
    expect(Object.keys(out[1].overrides).sort()).toEqual(["headline", "photo"]);
    expect(green.overrides.logo).toBeDefined(); // source untouched
  });

  it("prune is identity when every key is live", () => {
    const vs = [green, blue];
    expect(pruneVariants(vs, ["headline", "logo", "photo"])).toBe(vs);
  });
});

describe("builder helpers", () => {
  it("unstyledKeys lists fields with no entry in that variation", () => {
    expect(unstyledKeys(schema([green, blue]), green)).toEqual(["photo"]);
    expect(unstyledKeys(schema([green, blue]), blue)).toEqual(["logo"]);
  });

  it("unstyledVariantCount is zero on a single-variant template", () => {
    expect(unstyledVariantCount(schema(), "headline")).toBe(0);
    expect(unstyledVariantCount(schema([green]), "photo")).toBe(0);
    expect(unstyledVariantCount(schema([green, blue]), "photo")).toBe(1);
    expect(unstyledVariantCount(schema([green, blue]), "headline")).toBe(0);
  });

  it("removeVariant keeps exactly one default and returns undefined for the last", () => {
    expect(removeVariant([green, blue], "v-green")).toEqual([{ ...blue, isDefault: true }]);
    expect(removeVariant([green], "v-green")).toBeUndefined();
    expect(removeVariant(undefined, "v-green")).toBeUndefined();
  });

  it("ensureOneDefault keeps the first flag and clears the rest", () => {
    const out = ensureOneDefault([{ ...blue, isDefault: true }, green]);
    expect(out.map((v) => Boolean(v.isDefault))).toEqual([true, false]);
    expect(ensureOneDefault([blue]).map((v) => Boolean(v.isDefault))).toEqual([true]);
  });

  it("cloneVariant copies the look, never the identity or the default flag", () => {
    const copy = cloneVariant(green, "v-new", "Variation 3");
    expect(copy.id).toBe("v-new");
    expect(copy.name).toBe("Variation 3");
    expect(copy.isDefault).toBeUndefined();
    expect(copy.backgroundColor).toBe("#0B3D2E");
    expect(copy.overrides).toEqual(green.overrides);
    expect(copy.overrides.headline).not.toBe(green.overrides.headline);
    expect(cloneVariant(undefined, "v-first", "Variation 1")).toEqual({
      id: "v-first",
      name: "Variation 1",
      overrides: {},
    });
  });

  it("nextVariantName skips names already taken", () => {
    expect(nextVariantName(undefined)).toBe("Variation 1");
    expect(nextVariantName([green, blue])).toBe("Variation 3");
    expect(nextVariantName([{ ...green, name: "variation 2" }])).toBe("Variation 3");
  });
});
