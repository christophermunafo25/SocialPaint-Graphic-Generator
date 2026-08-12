import { describe, expect, it } from "vitest";
import { GOOGLE_FONTS } from "@/lib/render/fonts";
import {
  GOOGLE_FAMILY_AXES,
  customFamilyStyles,
  familyStyles,
  nearestStyle,
  parseStyleKey,
  styleGroups,
  styleKey,
  styleName,
  toFontStyle,
  weightName,
  type FontStyle,
} from "@/lib/render/fontCatalog";

const style = (
  weight: number,
  italic = false,
  stretch: FontStyle["stretch"] = "normal",
): FontStyle => ({
  weight,
  italic,
  stretch,
});

const fontAsset = (name: string, metadata: Record<string, unknown>) =>
  ({ kind: "font" as const, name, metadata }) as Parameters<typeof customFamilyStyles>[0][number];

describe("the Google table covers the curated list", () => {
  // A family added to GOOGLE_FONTS without a table row would fall through to
  // the unverified guess. That is safe, but it is not what anyone intends.
  it("has a row for every curated family", () => {
    const missing = GOOGLE_FONTS.filter((f) => !(f in GOOGLE_FAMILY_AXES));
    expect(missing).toEqual([]);
  });

  it("has no rows for families the app does not offer", () => {
    const extra = Object.keys(GOOGLE_FAMILY_AXES).filter(
      (f) => !(GOOGLE_FONTS as readonly string[]).includes(f),
    );
    expect(extra).toEqual([]);
  });
});

describe("style lists come from real metadata, not a 100-900 ladder", () => {
  it("offers Bebas Neue exactly one style", () => {
    // Bebas Neue ships a single 400 face. The old control offered nine weights;
    // eight of them rendered a synthesized face and broke the export embed.
    const { styles, source } = familyStyles("Bebas Neue");
    expect(source).toBe("google");
    expect(styles.map(styleName)).toEqual(["Regular"]);
  });

  it("offers no italic for families that have none", () => {
    // css2 answers 400 — not a fallback — for `Oswald:ital,wght@1,400`.
    for (const family of ["Oswald", "Manrope", "Outfit", "Roboto Slab", "Sora", "Space Grotesk"]) {
      expect(familyStyles(family).styles.some((s) => s.italic)).toBe(false);
    }
  });

  it("skips the weights Lato does not ship", () => {
    const weights = [...new Set(familyStyles("Lato").styles.map((s) => s.weight))];
    expect(weights).toEqual([100, 300, 400, 700, 900]);
  });

  it("stops Cabin at 700 and Playfair Display at 400", () => {
    const cabin = familyStyles("Cabin").styles.map((s) => s.weight);
    expect(Math.max(...cabin)).toBe(700);
    const playfair = familyStyles("Playfair Display").styles.map((s) => s.weight);
    expect(Math.min(...playfair)).toBe(400);
  });

  it("carries DM Sans past 900 because it genuinely reaches 1000", () => {
    expect(familyStyles("DM Sans").styles.some((s) => s.weight === 1000)).toBe(true);
  });

  it("offers width styles only where the wdth axis reaches them", () => {
    // Archivo's axis is 62-125: Expanded exists, UltraExpanded (200) does not.
    const archivo = new Set(familyStyles("Archivo").styles.map((s) => s.stretch));
    expect(archivo.has("expanded")).toBe(true);
    expect(archivo.has("ultra-expanded")).toBe(false);
    // Merriweather's max is 112, so semi-expanded at 112.5 is out of range.
    const merriweather = new Set(familyStyles("Merriweather").styles.map((s) => s.stretch));
    expect(merriweather.has("semi-condensed")).toBe(true);
    expect(merriweather.has("semi-expanded")).toBe(false);
    // No width axis at all.
    expect([...new Set(familyStyles("Inter").styles.map((s) => s.stretch))]).toEqual(["normal"]);
  });
});

describe("uploaded families offer exactly what has a file behind it", () => {
  it("groups assets by family and lists only uploaded styles", () => {
    const assets = [
      fontAsset("NeuethingSans-Regular.woff2", {
        family: "Neuething Sans",
        weight: 400,
        style: "normal",
      }),
      fontAsset("NeuethingSans-Bold.woff2", {
        family: "Neuething Sans",
        weight: 700,
        style: "normal",
      }),
      fontAsset("NeuethingSans-BoldItalic.woff2", {
        family: "Neuething Sans",
        weight: 700,
        style: "italic",
      }),
      fontAsset("OtherFace-Regular.woff2", { family: "Other Face", weight: 400 }),
    ];
    const { styles, source, verified } = familyStyles("Neuething Sans", assets);
    expect(source).toBe("custom");
    expect(verified).toBe(true);
    expect(styles.map(styleName)).toEqual(["Regular", "Bold", "Bold Italic"]);
  });

  it("wins over the Google table when the names collide", () => {
    const assets = [fontAsset("Roboto-Regular.woff2", { family: "Roboto", weight: 400 })];
    const { source, styles } = familyStyles("Roboto", assets);
    expect(source).toBe("custom");
    expect(styles).toHaveLength(1);
  });

  it("falls back to the filename for the family, matching registerCustomFont", () => {
    const map = customFamilyStyles([fontAsset("HouseGrotesk.woff2", {})]);
    expect([...map.keys()]).toEqual(["HouseGrotesk"]);
  });

  it("dedupes two files uploaded for the same style", () => {
    const map = customFamilyStyles([
      fontAsset("a.woff2", { family: "Dup", weight: 400 }),
      fontAsset("b.woff2", { family: "Dup", weight: 400 }),
    ]);
    expect(map.get("Dup")).toHaveLength(1);
  });
});

describe("unknown families", () => {
  it("offer a conservative pair and admit they are unverified", () => {
    const { styles, source, verified } = familyStyles("Some Imported Face");
    expect(source).toBe("unknown");
    expect(verified).toBe(false);
    expect(styles.map(styleName)).toEqual(["Regular", "Bold"]);
  });

  it("keep the weight the field already carries", () => {
    const { styles } = familyStyles("Some Imported Face", [], style(300));
    expect(styles.map(styleName)).toEqual(["Light", "Regular", "Bold"]);
  });

  it("do not duplicate a carried weight that is already in the pair", () => {
    const { styles } = familyStyles("Some Imported Face", [], style(700));
    expect(styles).toHaveLength(2);
  });
});

describe("style names read the way Figma writes them", () => {
  it("names weights", () => {
    expect(styleName(style(400))).toBe("Regular");
    expect(styleName(style(500))).toBe("Medium");
    expect(styleName(style(600))).toBe("SemiBold");
    expect(styleName(style(700))).toBe("Bold");
    expect(styleName(style(900))).toBe("Black");
  });

  it("drops the implied Regular", () => {
    expect(styleName(style(400, true))).toBe("Italic");
    expect(styleName(style(400, false, "expanded"))).toBe("Expanded");
  });

  it("combines weight, width and italic in Figma's order", () => {
    expect(styleName(style(700, true))).toBe("Bold Italic");
    expect(styleName(style(700, false, "expanded"))).toBe("Bold Expanded");
    expect(styleName(style(500, false, "ultra-expanded"))).toBe("Medium UltraExpanded");
    expect(styleName(style(700, true, "condensed"))).toBe("Bold Condensed Italic");
  });

  it("takes the nearest name for an off-ladder variable weight", () => {
    expect(weightName(350)).toBe("Light");
    expect(weightName(680)).toBe("Bold");
    // An exact tie resolves to the lighter name — the same rule nearestStyle uses.
    expect(weightName(650)).toBe("SemiBold");
  });

  it("round-trips through the option key", () => {
    const s = style(600, true, "semi-condensed");
    expect(parseStyleKey(styleKey(s))).toEqual(s);
    expect(parseStyleKey("garbage")).toBeUndefined();
  });
});

describe("changing family maps to the nearest style, never a reset", () => {
  const inter = familyStyles("Inter").styles;
  const cabin = familyStyles("Cabin").styles;
  const bebas = familyStyles("Bebas Neue").styles;
  const oswald = familyStyles("Oswald").styles;

  it("keeps the same weight when the new family has it", () => {
    expect(nearestStyle(style(700), cabin)).toEqual(style(700));
  });

  it("takes the closest weight when it does not", () => {
    // Cabin stops at 700 — 900 has to come down, not reset to Regular.
    expect(nearestStyle(style(900), cabin)).toEqual(style(700));
    // Lato has no 500; 400 and 600 are absent too, so 400 is nearest.
    expect(nearestStyle(style(500), familyStyles("Lato").styles)).toEqual(style(400));
  });

  it("preserves italic where the new family has it", () => {
    expect(nearestStyle(style(700, true), inter)).toEqual(style(700, true));
  });

  it("drops italic where the new family has none", () => {
    expect(nearestStyle(style(700, true), oswald)).toEqual(style(700, false));
  });

  it("collapses to the only face a single-style family has", () => {
    expect(nearestStyle(style(700, true), bebas)).toEqual(style(400));
  });

  it("preserves width where it exists and falls back to normal where it does not", () => {
    const archivo = familyStyles("Archivo").styles;
    expect(nearestStyle(style(700, false, "expanded"), archivo)).toEqual(
      style(700, false, "expanded"),
    );
    // Inter has no width axis at all.
    expect(nearestStyle(style(700, false, "expanded"), inter)).toEqual(style(700));
  });

  it("resolves a tie toward the lighter face", () => {
    const styles = [style(400), style(600)];
    expect(nearestStyle(style(500), styles)).toEqual(style(400));
  });

  it("returns nothing for an empty list rather than inventing a style", () => {
    expect(nearestStyle(style(400), [])).toBeUndefined();
  });
});

describe("grouping for the picker", () => {
  it("leaves a family with one width ungrouped", () => {
    const groups = styleGroups(familyStyles("Inter").styles);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("");
  });

  it("splits a width-axis family into labelled groups, narrow to wide", () => {
    const groups = styleGroups(familyStyles("Roboto").styles);
    expect(groups.map((g) => g.label)).toEqual(["Condensed", "SemiCondensed", "Normal"]);
  });
});

describe("reading a legacy field", () => {
  it("treats absent style and stretch as normal", () => {
    expect(toFontStyle(700)).toEqual(style(700));
    expect(toFontStyle(undefined)).toEqual(style(400));
  });

  it("ignores a stretch value that is not a real keyword", () => {
    expect(toFontStyle(400, "normal", "sideways")).toEqual(style(400));
  });
});
