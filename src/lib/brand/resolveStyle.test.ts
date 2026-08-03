import { describe, expect, it } from "vitest";
import {
  isStyleLocked,
  lockedProperties,
  resolveFieldStyle,
  ruleSentences,
} from "@/lib/brand/resolveStyle";
import type { BrandKit, BrandTypeStyle, TemplateField } from "@/lib/types";

/** A field exactly as templates saved before fontStyle/fontStretch existed:
 * a numeric weight and nothing else about the face. */
const legacyField: TemplateField = {
  id: "f1",
  label: "Name",
  type: "text",
  fieldKey: "name",
  x: 100,
  y: 200,
  width: 800,
  height: 120,
  fontFamily: "Montserrat",
  fontWeight: 700,
  fontSizePx: 64,
  align: "center",
  uppercase: true,
  letterSpacingPx: 1.5,
  lineHeight: 1.1,
};

const kit: BrandKit = {
  id: "k1",
  companyId: "c1",
  colors: [{ key: "text", name: "Ink", hex: "#1A1F26" }],
  typeStyles: [],
  guidelines: [],
};

const withStyles = (typeStyles: BrandTypeStyle[]): BrandKit => ({ ...kit, typeStyles });

describe("a legacy field resolves identically", () => {
  it("produces the same values it did before the schema grew", () => {
    // Every property the renderer, autoFit and the export embed read, spelled
    // out. If any of these drifts, existing templates stop rendering as saved.
    const resolved = resolveFieldStyle(legacyField, null);
    expect(resolved.fontFamily).toBe("Montserrat");
    expect(resolved.fontWeight).toBe(700);
    expect(resolved.fontSizePx).toBe(64);
    expect(resolved.uppercase).toBe(true);
    expect(resolved.letterSpacingPx).toBe(1.5);
    expect(resolved.lineHeight).toBe(1.1);
  });

  it("leaves the new properties undefined rather than defaulting them", () => {
    // Undefined is what makes the change additive: the renderer omits the CSS
    // property entirely, so the browser picks the same face as before. A
    // literal "normal" would be equivalent in CSS but would start persisting
    // rows that used to be null.
    const resolved = resolveFieldStyle(legacyField, null);
    expect(resolved.fontStyle).toBeUndefined();
    expect(resolved.fontStretch).toBeUndefined();
    expect("fontStyle" in resolved).toBe(true); // present as a key, absent as a value
  });

  it("resolves the same with a kit that has no type styles", () => {
    expect(resolveFieldStyle(legacyField, kit)).toEqual(resolveFieldStyle(legacyField, null));
  });

  it("locks nothing extra for a style that predates the new properties", () => {
    const legacyStyle: BrandTypeStyle = {
      key: "heading",
      name: "Heading",
      font: { source: "google", family: "Montserrat" },
      weight: 700,
    };
    expect([...lockedProperties(legacyStyle)].sort()).toEqual(["fontFamily", "weight"]);
  });
});

describe("a bound type style carries the full face", () => {
  const style: BrandTypeStyle = {
    key: "heading",
    name: "Heading",
    font: { source: "custom", family: "Neuething Sans" },
    weight: 700,
    fontStyle: "italic",
    fontStretch: "expanded",
  };

  it("overrides the field's own values", () => {
    const field: TemplateField = { ...legacyField, typeStyleKey: "heading" };
    const resolved = resolveFieldStyle(field, withStyles([style]));
    expect(resolved.fontFamily).toBe("Neuething Sans");
    expect(resolved.fontWeight).toBe(700);
    expect(resolved.fontStyle).toBe("italic");
    expect(resolved.fontStretch).toBe("expanded");
  });

  it("falls through to the field where the style is silent", () => {
    const partial: BrandTypeStyle = { key: "heading", name: "Heading", weight: 500 };
    const field: TemplateField = {
      ...legacyField,
      fontFamily: "Archivo", // has both a width axis and italic
      typeStyleKey: "heading",
      fontStyle: "italic",
      fontStretch: "condensed",
    };
    const resolved = resolveFieldStyle(field, withStyles([partial]));
    expect(resolved.fontWeight).toBe(500); // style wins
    expect(resolved.fontStyle).toBe("italic"); // field survives
    expect(resolved.fontStretch).toBe("condensed");
  });

  it("locks the new controls", () => {
    const locked = lockedProperties(style);
    expect(locked.has("fontStyle")).toBe(true);
    expect(locked.has("fontStretch")).toBe(true);
  });
});

describe("the resolved face is one the family can actually draw", () => {
  // Preview, canvas measurement and the export embed all read this. Handing
  // them a weight the family lacks means the DOM synthesizes a fake bold while
  // the export embeds the real face — the two disagree, and the PNG is wrong.
  it("snaps a locked weight the family does not have", () => {
    const style: BrandTypeStyle = { key: "sub", name: "Subhead", weight: 700 };
    const field: TemplateField = { ...legacyField, fontFamily: "Bebas Neue", typeStyleKey: "sub" };
    // Bebas Neue ships exactly one 400 face.
    expect(resolveFieldStyle(field, withStyles([style])).fontWeight).toBe(400);
  });

  it("drops italic on a family that has none", () => {
    const field: TemplateField = { ...legacyField, fontFamily: "Oswald", fontStyle: "italic" };
    expect(resolveFieldStyle(field, null).fontStyle).toBe("normal");
  });

  it("drops a width the family has no axis for", () => {
    const field: TemplateField = { ...legacyField, fontFamily: "Montserrat", fontStretch: "condensed" };
    expect(resolveFieldStyle(field, null).fontStretch).toBe("normal");
  });

  it("keeps a width the family really reaches", () => {
    const field: TemplateField = { ...legacyField, fontFamily: "Archivo", fontStretch: "expanded" };
    expect(resolveFieldStyle(field, null).fontStretch).toBe("expanded");
  });

  it("leaves an unverified family exactly as authored", () => {
    // No table and no uploaded metadata — guessing here would be worse than
    // passing the author's value through.
    const field: TemplateField = { ...legacyField, fontFamily: "Neuething Sans", fontWeight: 850 };
    expect(resolveFieldStyle(field, null).fontWeight).toBe(850);
  });

  it("does not add values to a field that never set them", () => {
    const field: TemplateField = {
      ...legacyField,
      fontFamily: "Inter",
      fontWeight: undefined,
      fontStyle: undefined,
      fontStretch: undefined,
    };
    const resolved = resolveFieldStyle(field, null);
    expect(resolved.fontWeight).toBeUndefined();
    expect(resolved.fontStyle).toBeUndefined();
    expect(resolved.fontStretch).toBeUndefined();
  });

  it("leaves a weight the family does have untouched", () => {
    const field: TemplateField = { ...legacyField, fontFamily: "Montserrat", fontWeight: 700 };
    expect(resolveFieldStyle(field, null).fontWeight).toBe(700);
  });
});

describe("which controls the lock disables", () => {
  it("locks the style control when the font is bound", () => {
    const locked = lockedProperties({
      key: "h",
      name: "Heading",
      font: { source: "google", family: "Montserrat" },
    });
    expect(isStyleLocked(locked)).toBe(true);
  });

  it("locks the style control but not the family when only the weight is fixed", () => {
    const locked = lockedProperties({ key: "h", name: "Heading", weight: 700 });
    expect(isStyleLocked(locked)).toBe(true);
    expect(locked.has("fontFamily")).toBe(false);
  });

  it("leaves both free when the style fixes neither", () => {
    const locked = lockedProperties({ key: "h", name: "Heading", colorKey: "text" });
    expect(isStyleLocked(locked)).toBe(false);
  });
});

describe("rule sentences read as names, not raw values", () => {
  it("keeps the wording existing kits already show", () => {
    const rules = ruleSentences(
      {
        key: "heading",
        name: "Heading",
        font: { source: "google", family: "Montserrat" },
        weight: 700,
        colorKey: "text",
      },
      kit,
    );
    expect(rules[0]).toBe("Heading is always Montserrat Bold in Ink.");
  });

  it("names a full face the way Figma writes it", () => {
    const rules = ruleSentences(
      {
        key: "heading",
        name: "Heading",
        font: { source: "custom", family: "Neuething Sans" },
        weight: 700,
        fontStretch: "expanded",
      },
      kit,
    );
    expect(rules[0]).toBe("Heading is always Neuething Sans Bold Expanded.");
  });

  it("never exposes a numeric weight or a CSS keyword", () => {
    const rules = ruleSentences(
      {
        key: "heading",
        name: "Heading",
        font: { source: "custom", family: "Neuething Sans" },
        weight: 500,
        fontStyle: "italic",
        fontStretch: "ultra-expanded",
      },
      kit,
    );
    expect(rules[0]).toBe("Heading is always Neuething Sans Medium UltraExpanded Italic.");
    expect(rules[0]).not.toMatch(/500|ultra-expanded/);
  });

  it("explains a weight-only lock that used to have no sentence at all", () => {
    expect(ruleSentences({ key: "b", name: "Body", weight: 300 }, kit)).toEqual([
      "Body is always Light.",
    ]);
  });

  it("says nothing about the face when the style only binds the family", () => {
    const rules = ruleSentences(
      { key: "b", name: "Body", font: { source: "google", family: "Inter" } },
      kit,
    );
    expect(rules[0]).toBe("Body is always Inter.");
  });

  it("still emits the non-typographic rules unchanged", () => {
    const rules = ruleSentences(
      { key: "b", name: "Body", uppercase: true, fontSizePx: 32, maxLength: 120, autoFit: true },
      kit,
    );
    expect(rules).toEqual([
      "Body is always UPPERCASE.",
      "Body is fixed at 32px.",
      "Body never exceeds 120 characters.",
      "Body auto-shrinks to fit its box.",
    ]);
  });
});

describe("the shared weight naming changes some existing sentences", () => {
  // The old private ladder bucketed everything >= 700 to "Bold" and <= 300 to
  // "Light". The shared one names all ten steps, so these read differently now
  // — deliberately, and only for weights the old buckets got wrong.
  const named = (weight: number) =>
    ruleSentences(
      { key: "h", name: "H", font: { source: "google", family: "Inter" }, weight },
      kit,
    )[0];

  it("is unchanged for the common weights", () => {
    expect(named(400)).toBe("H is always Inter Regular.");
    expect(named(500)).toBe("H is always Inter Medium.");
    expect(named(600)).toBe("H is always Inter SemiBold.");
    expect(named(700)).toBe("H is always Inter Bold.");
  });

  it("is more precise at the ends", () => {
    expect(named(800)).toBe("H is always Inter ExtraBold.");
    expect(named(900)).toBe("H is always Inter Black.");
    expect(named(200)).toBe("H is always Inter ExtraLight.");
    expect(named(100)).toBe("H is always Inter Thin.");
  });
});
