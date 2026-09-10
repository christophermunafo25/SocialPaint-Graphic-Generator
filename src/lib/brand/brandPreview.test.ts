import { describe, expect, it } from "vitest";
import type { BrandColor, TemplateField } from "@/lib/types";
import { readableOn } from "@/lib/color";
import { DEFAULT_PALETTE } from "@/lib/theme";
import {
  BRAND_PREVIEW_ARTBOARD,
  buildBrandPreviewSchema,
  resolvePreviewColors,
  type BrandPreviewInput,
} from "./brandPreview";

const color = (key: string, hex: string): BrandColor => ({ key, name: key, hex });

const hexOf = (key: string): string => DEFAULT_PALETTE.find((c) => c.key === key)!.hex;

const baseInput = (overrides: Partial<BrandPreviewInput> = {}): BrandPreviewInput => ({
  colors: DEFAULT_PALETTE,
  headingFamily: "Montserrat",
  bodyFamily: "Inter",
  companyName: "Acme Health",
  photoUrl: "blob:preview-photo",
  ...overrides,
});

const fieldByKey = (fields: TemplateField[], key: string): TemplateField | undefined =>
  fields.find((f) => f.fieldKey === key);

describe("resolvePreviewColors", () => {
  it("resolves the default palette to primary as dark and background as light", () => {
    const resolved = resolvePreviewColors(DEFAULT_PALETTE);
    expect(resolved.dark).toBe(hexOf("primary"));
    expect(resolved.light).toBe(hexOf("background"));
  });

  it("falls back to the lowest-luminance color when primary is pale", () => {
    const resolved = resolvePreviewColors([
      color("primary", "#F2D16B"),
      color("secondary", "#E7EAEF"),
      color("accent", "#C9A227"),
      color("text", "#1A1F26"),
      color("background", "#F6F7F9"),
    ]);
    expect(resolved.dark).toBe("#1A1F26");
  });

  it("uses the highest-luminance color as light when no background key exists", () => {
    const resolved = resolvePreviewColors([
      color("primary", "#2F3B4C"),
      color("custom_1", "#FDFBF4"),
      color("text", "#1A1F26"),
    ]);
    expect(resolved.light).toBe("#FDFBF4");
  });

  it("returns the default palette values for an empty palette", () => {
    const resolved = resolvePreviewColors([]);
    expect(resolved.dark).toBe(hexOf("primary"));
    expect(resolved.light).toBe(hexOf("background"));
    expect(resolved.accent).toBe(hexOf("accent"));
  });

  it("keeps dark and light distinct for a one-color palette", () => {
    const resolved = resolvePreviewColors([color("primary", "#4A6FA5")]);
    expect(resolved.dark).not.toBe(resolved.light);
  });

  it("chooses a legible ink when the text color fails 4.5:1 against light", () => {
    const resolved = resolvePreviewColors([
      color("text", "#999999"),
      color("background", "#F6F7F9"),
    ]);
    expect(resolved.ink).toBe(readableOn("#F6F7F9"));
  });

  it("sets onAccent to readableOn(accent)", () => {
    const accent = "#0B3D2E";
    const resolved = resolvePreviewColors([color("accent", accent)]);
    expect(resolved.onAccent).toBe(readableOn(accent));
  });
});

describe("buildBrandPreviewSchema", () => {
  it("swaps between the logo field and the company-name field", () => {
    const withLogo = buildBrandPreviewSchema(baseInput({ logoUrl: "blob:logo" }));
    const logo = withLogo.fields.find((f) => f.label === "Logo");
    expect(logo?.type).toBe("image");
    expect(logo?.staticValue).toBe("blob:logo");
    expect(fieldByKey(withLogo.fields, "company_name")).toBeUndefined();

    const withoutLogo = buildBrandPreviewSchema(baseInput());
    expect(withoutLogo.fields.find((f) => f.label === "Logo")).toBeUndefined();
    const name = fieldByKey(withoutLogo.fields, "company_name");
    expect(name?.type).toBe("text");
    expect(name?.staticValue).toBe("Acme Health");
  });

  it("sets the input families with the designed weights, sizes, and floors", () => {
    const schema = buildBrandPreviewSchema(
      baseInput({ headingFamily: "Bebas Neue", bodyFamily: "Playfair Display" }),
    );
    const headline = fieldByKey(schema.fields, "headline")!;
    expect(headline.fontFamily).toBe("Bebas Neue");
    expect(headline.fontWeight).toBe(600);
    expect(headline.fontSizePx).toBe(130);
    expect(headline.minFontSizePx).toBe(72);
    expect(headline.textSizing).toBe("shrink");

    const subcopy = fieldByKey(schema.fields, "subcopy")!;
    expect(subcopy.fontFamily).toBe("Playfair Display");
    expect(subcopy.fontWeight).toBe(500);
    expect(subcopy.fontSizePx).toBe(30);
    expect(subcopy.minFontSizePx).toBe(22);
    expect(subcopy.textSizing).toBe("shrink");
  });

  it("keeps every field box inside the artboard", () => {
    for (const logoUrl of [undefined, "blob:logo"]) {
      const schema = buildBrandPreviewSchema(baseInput({ logoUrl }));
      for (const f of schema.fields) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.x + f.width).toBeLessThanOrEqual(BRAND_PREVIEW_ARTBOARD.width);
        expect(f.y + f.height).toBeLessThanOrEqual(BRAND_PREVIEW_ARTBOARD.height);
      }
    }
  });

  it("assigns a unique zIndex to every field", () => {
    for (const logoUrl of [undefined, "blob:logo"]) {
      const schema = buildBrandPreviewSchema(baseInput({ logoUrl }));
      const zs = schema.fields.map((f) => f.zIndex);
      expect(new Set(zs).size).toBe(zs.length);
      expect(zs.every((z) => typeof z === "number")).toBe(true);
    }
  });
});
