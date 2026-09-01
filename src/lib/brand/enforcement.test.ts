import { describe, expect, it } from "vitest";
import { clampToPalette, lockedProperties, resolveFieldStyle } from "./resolveStyle";
import type { BrandKit, TemplateField } from "../types";

const field: TemplateField = {
  id: "f1",
  label: "Headline",
  type: "text",
  fieldKey: "headline",
  x: 0,
  y: 0,
  width: 800,
  height: 120,
  typeStyleKey: "heading",
  fontSizePx: 40,
  uppercase: false,
  colorHex: "#123456",
};

const baseKit: BrandKit = {
  id: "k1",
  companyId: "c1",
  colors: [
    { key: "ink", name: "Ink", hex: "#000000" },
    { key: "volt", name: "Volt", hex: "#CCFF00" },
  ],
  typeStyles: [{ key: "heading", name: "Heading", fontSizePx: 64, uppercase: true }],
  guidelines: [],
};

describe("allow_style_override", () => {
  it("off (and absent): the bound style's properties win, as they always have", () => {
    const resolved = resolveFieldStyle(field, baseKit);
    expect(resolved.fontSizePx).toBe(64);
    expect(resolved.uppercase).toBe(true);
  });

  it("on: the field's own values win and the style fills only the gaps", () => {
    const kit = { ...baseKit, allowStyleOverride: true };
    const resolved = resolveFieldStyle({ ...field, uppercase: undefined }, kit);
    expect(resolved.fontSizePx).toBe(40); // field-defined → field wins
    expect(resolved.uppercase).toBe(true); // field silent → style fills it
  });

  it("on: a field with its own fill displaces the style's palette binding", () => {
    const kit: BrandKit = {
      ...baseKit,
      allowStyleOverride: true,
      typeStyles: [{ key: "heading", name: "Heading", colorKey: "ink" }],
    };
    expect(resolveFieldStyle(field, kit).colorKey).toBeUndefined();
    expect(resolveFieldStyle({ ...field, colorHex: undefined }, kit).colorKey).toBe("ink");
  });

  it("on: nothing is locked in the builder", () => {
    const style = baseKit.typeStyles[0];
    expect(lockedProperties(style, baseKit).size).toBeGreaterThan(0);
    expect(lockedProperties(style, { ...baseKit, allowStyleOverride: true }).size).toBe(0);
  });
});

describe("allow_off_palette", () => {
  it("on (and absent): any hex renders as authored", () => {
    expect(resolveFieldStyle(field, baseKit).colorHex).toBe("#123456");
  });

  it("off: an off-palette fill snaps to the nearest palette color", () => {
    const kit = { ...baseKit, allowOffPalette: false };
    // #123456 is much closer to Ink than to Volt.
    expect(resolveFieldStyle(field, kit).colorHex).toBe("#000000");
  });

  it("off: exact palette members pass through, whatever their case", () => {
    const kit = { ...baseKit, allowOffPalette: false };
    expect(clampToPalette("#ccff00", kit)).toBe("#ccff00");
    expect(clampToPalette("#CCFF00", kit)).toBe("#CCFF00");
  });

  it("off: gradient stops snap too, so a gradient cannot smuggle a color in", () => {
    const kit = { ...baseKit, allowOffPalette: false };
    const resolved = resolveFieldStyle(
      {
        ...field,
        colorHex: undefined,
        textGradient: {
          angle: 90,
          stops: [
            { position: 0, color: "#111111" },
            { position: 1, color: "#C0F010" },
          ],
        },
      },
      kit,
    );
    expect(resolved.textGradient?.stops.map((s) => s.color)).toEqual(["#000000", "#CCFF00"]);
  });

  it("off: an unparsable value is left alone rather than guessed at", () => {
    const kit = { ...baseKit, allowOffPalette: false };
    expect(clampToPalette("not-a-color", kit)).toBe("not-a-color");
  });
});
