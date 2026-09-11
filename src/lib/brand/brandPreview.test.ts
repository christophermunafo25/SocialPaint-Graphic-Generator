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

  it("derives the CTA fill from the palette when no accent key exists", () => {
    // Imported token palettes keep their own names — the most vivid color
    // that reads against the dark band becomes the pill.
    const resolved = resolvePreviewColors([
      color("brand_red", "#E24A4A"),
      color("paper", "#F4F4F4"),
      color("charcoal", "#333333"),
    ]);
    expect(resolved.accent).toBe("#E24A4A");
    expect(resolved.onAccent).toBe(readableOn("#E24A4A"));
  });

  it("falls back to an inverse light pill for a neutral palette with no accent key", () => {
    const resolved = resolvePreviewColors([
      color("paper", "#F4F4F4"),
      color("charcoal", "#333333"),
    ]);
    expect(resolved.accent).toBe(resolved.light);
  });

  it("never derives a CTA fill that dissolves into the dark band", () => {
    // The only vivid color is too close to the band — the pill must not
    // vanish into it, so the light surface steps in.
    const resolved = resolvePreviewColors([
      color("wine", "#7A1E1E"),
      color("paper", "#F4F4F4"),
      color("charcoal", "#333333"),
    ]);
    expect(resolved.accent).toBe(resolved.light);
  });

  it("never lets the fallback re-select a pale color the primary gate rejected", () => {
    const resolved = resolvePreviewColors([
      color("primary", "#F2D16B"),
      color("secondary", "#E7EAEF"),
      color("accent", "#FFF3C4"),
      color("text", "#FFFFFF"),
      color("background", "#F6F7F9"),
    ]);
    // Nothing in the palette clears 3:1 against the surface, so the default
    // primary steps in — the backdrop band must never dissolve.
    expect(resolved.dark).toBe(hexOf("primary"));
  });

  it("keeps dark distinct when primary duplicates the background hex", () => {
    const resolved = resolvePreviewColors([
      color("primary", "#F6F7F9"),
      color("background", "#F6F7F9"),
    ]);
    expect(resolved.dark).not.toBe(resolved.light);
    expect(resolved.dark).toBe(hexOf("primary"));
  });

  it("strips the alpha byte so a transparent text color cannot become ink", () => {
    const resolved = resolvePreviewColors([
      color("text", "#1A1F2600"),
      color("background", "#F6F7F9"),
    ]);
    expect(resolved.ink).toBe("#1A1F26");
  });

  it("expands 3-digit shorthand hexes instead of dropping them", () => {
    const resolved = resolvePreviewColors([color("primary", "#234"), color("background", "#FFF")]);
    expect(resolved.light).toBe("#FFFFFF");
    expect(resolved.dark).toBe("#223344");
  });

  it("keeps the outline in ink only while the ink is legible on dark", () => {
    // Default palette: ink #1A1F26 on dark #2F3B4C is ~1.5:1 — the ring must
    // switch to the contrast pick.
    const onDefault = resolvePreviewColors(DEFAULT_PALETTE);
    expect(onDefault.outline).toBe(readableOn(onDefault.dark));
    expect(onDefault.outline).not.toBe(onDefault.ink);
    // A mid-tone dark keeps the ink ring.
    const midTone = resolvePreviewColors([
      color("primary", "#777777"),
      color("background", "#FFFFFF"),
    ]);
    expect(midTone.outline).toBe(midTone.ink);
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

  it("bounds a long company name with an ellipsis", () => {
    const schema = buildBrandPreviewSchema(
      baseInput({ companyName: "Northwestern Memorial HealthCare Foundation" }),
    );
    const name = fieldByKey(schema.fields, "company_name")!;
    expect(name.staticValue!.length).toBeLessThanOrEqual(24);
    expect(name.staticValue!.endsWith("…")).toBe(true);
  });

  it("omits the identity element entirely for a blank company name with no logo", () => {
    const schema = buildBrandPreviewSchema(baseInput({ companyName: "  " }));
    expect(fieldByKey(schema.fields, "company_name")).toBeUndefined();
    expect(schema.fields.find((f) => f.label === "Logo")).toBeUndefined();
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
