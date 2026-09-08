import { describe, expect, it } from "vitest";
import type { BrandKit, TemplateField, TemplateVariant } from "@/lib/types";
import { variantContrastWarnings } from "./variantContrast";

let n = 0;
const text = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${n++}`,
  label: over.label ?? "Wordmark",
  fieldKey: over.fieldKey ?? `k${n}`,
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 60,
  fontSizePx: 18,
  colorHex: "#111111",
  ...over,
});

const wordmark = text({ fieldKey: "wordmark", label: "Wordmark" });
const light: TemplateVariant = {
  id: "light",
  name: "Light",
  backgroundColor: "#F9F9F8",
  overrides: { wordmark: { colorHex: "#FFFFFF" } },
};
const dark: TemplateVariant = {
  id: "dark",
  name: "Dark",
  backgroundColor: "#101010",
  overrides: { wordmark: { colorHex: "#FFFFFF" } },
};

const schema = (variants: TemplateVariant[] | undefined, fields = [wordmark]) => ({
  fields,
  variants,
  backgroundColor: "#FFFFFF",
  backgroundGradient: undefined,
  backgroundUrl: "",
});

describe("variantContrastWarnings", () => {
  it("is silent on a single-variant template", () => {
    expect(variantContrastWarnings(schema(undefined), null)).toEqual([]);
  });

  it("catches the corpus failure: white on #F9F9F8", () => {
    const warnings = variantContrastWarnings(schema([light, dark]), null);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].variantId).toBe("light");
    expect(warnings[0].fieldKey).toBe("wordmark");
    expect(warnings[0].ratio).toBeCloseTo(1.03, 1);
    expect(warnings[0].required).toBe(4.5);
    expect(warnings[0].message).toContain("Light");
  });

  it("uses the 3:1 floor at 24px and over", () => {
    const grey = text({ fieldKey: "grey", label: "Grey", fontSizePx: 30, colorHex: "#111111" });
    const v: TemplateVariant = {
      id: "v",
      name: "Mid",
      backgroundColor: "#FFFFFF",
      overrides: { grey: { colorHex: "#767676" } }, // ≈4.54:1
    };
    expect(variantContrastWarnings(schema([v], [grey]), null)).toEqual([]);
    const small = { ...grey, fontSizePx: 16 };
    expect(variantContrastWarnings(schema([v], [small]), null)).toEqual([]); // 4.54 ≥ 4.5
    const between = { ...v, overrides: { grey: { colorHex: "#8A8A8A" } } }; // ≈3.4:1
    expect(variantContrastWarnings(schema([between], [small]), null)).toHaveLength(1);
    expect(variantContrastWarnings(schema([between], [grey]), null)).toEqual([]); // large text
  });

  it("skips hidden fields, image backdrops, and non-text elements", () => {
    const hidden = { ...light, overrides: { wordmark: { colorHex: "#FFFFFF", hidden: true } } };
    expect(variantContrastWarnings(schema([hidden]), null)).toEqual([]);
    expect(
      variantContrastWarnings({ ...schema([light]), backgroundUrl: "ref:bg.png" }, null),
    ).toEqual([]);
    const shape = text({ fieldKey: "wordmark", type: "shape", static: true });
    expect(variantContrastWarnings(schema([light], [shape]), null)).toEqual([]);
  });

  it("checks a gradient background stop by stop and reports the worst", () => {
    const v: TemplateVariant = {
      id: "g",
      name: "Fade",
      backgroundGradient: {
        angle: 0,
        stops: [
          { position: 0, color: "#000000" },
          { position: 1, color: "#FFFFFF" },
        ],
      },
      overrides: { wordmark: { colorHex: "#FFFFFF" } },
    };
    const w = variantContrastWarnings(schema([v]), null);
    expect(w).toHaveLength(1);
    expect(w[0].ratio).toBe(1);
  });

  it("resolves a bound type style's palette colour against the kit", () => {
    const kit = {
      colors: [{ key: "paper", name: "Paper", hex: "#F9F9F8" }],
      typeStyles: [{ key: "wordmark-style", name: "Wordmark", colorKey: "paper" }],
    } as unknown as BrandKit;
    const v: TemplateVariant = {
      id: "v",
      name: "Bound",
      backgroundColor: "#FFFFFF",
      overrides: { wordmark: { typeStyleKey: "wordmark-style" } },
    };
    const w = variantContrastWarnings(schema([v]), kit);
    expect(w).toHaveLength(1);
    expect(w[0].ratio).toBeLessThan(1.1);
  });

  it("composites element opacity before measuring", () => {
    const v: TemplateVariant = {
      id: "v",
      name: "Faint",
      backgroundColor: "#FFFFFF",
      overrides: { wordmark: { colorHex: "#000000", opacity: 20 } },
    };
    expect(variantContrastWarnings(schema([v]), null)).toHaveLength(1);
  });
});
