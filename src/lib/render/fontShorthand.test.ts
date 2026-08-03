import { describe, expect, it } from "vitest";
import { canvasFontShorthand } from "@/lib/render/autoFit";
import { googleAxisQuery } from "@/lib/render/fonts";
import { toFontStyle, type FontStyle } from "@/lib/render/fontCatalog";

const face = (weight: number, italic = false, stretch: FontStyle["stretch"] = "normal"): FontStyle => ({
  weight,
  italic,
  stretch,
});

describe("the canvas font shorthand composes in the correct order", () => {
  it("puts style, weight and stretch before the size and the family last", () => {
    expect(
      canvasFontShorthand({
        fontStyle: "italic",
        fontWeight: 700,
        fontStretch: "expanded",
        fontSizePx: 45,
        fontFamily: "Archivo",
      }),
    ).toBe('italic 700 expanded 45px "Archivo", sans-serif');
  });

  it("never emits a percentage, which would invalidate the whole shorthand", () => {
    // `italic 700 125% 45px X` is rejected outright by the canvas, leaving the
    // context on its previous font — a silent revert to the wrong face.
    const shorthand = canvasFontShorthand({
      fontStretch: "ultra-expanded",
      fontSizePx: 45,
      fontFamily: "Neuething Sans",
    });
    expect(shorthand).not.toMatch(/%/);
    expect(shorthand).toBe('400 ultra-expanded 45px "Neuething Sans", sans-serif');
  });

  it("drops a stretch value that is not a real keyword", () => {
    expect(canvasFontShorthand({ fontStretch: "125%", fontSizePx: 45, fontFamily: "X" })).toBe(
      '400 45px "X", sans-serif',
    );
    expect(canvasFontShorthand({ fontStretch: "sideways", fontSizePx: 45 })).toBe("400 45px sans-serif");
  });

  it("omits normal stretch and upright style rather than spelling them out", () => {
    expect(
      canvasFontShorthand({
        fontStyle: "normal",
        fontWeight: 500,
        fontStretch: "normal",
        fontSizePx: 32,
        fontFamily: "Inter",
      }),
    ).toBe('500 32px "Inter", sans-serif');
  });

  it("composes a legacy field exactly as it did before the schema grew", () => {
    // The old line was `${fontWeight ?? 400} ${size}px ${family}`. A field
    // carrying only fontWeight must still produce that string, character for
    // character, or every auto-fit measurement shifts.
    expect(
      canvasFontShorthand({ fontWeight: 700, fontSizePx: 45, fontFamily: "Montserrat" }),
    ).toBe('700 45px "Montserrat", sans-serif');
    expect(canvasFontShorthand({ fontSizePx: 45, fontFamily: "Montserrat" })).toBe(
      '400 45px "Montserrat", sans-serif',
    );
    expect(canvasFontShorthand({ fontSizePx: 45 })).toBe("400 45px sans-serif");
  });

  it("builds the same string from a catalogue style", () => {
    const style = toFontStyle(700, "italic", "condensed");
    expect(
      canvasFontShorthand({
        fontWeight: style.weight,
        fontStyle: style.italic ? "italic" : "normal",
        fontStretch: style.stretch,
        fontSizePx: 45,
        fontFamily: "Roboto",
      }),
    ).toBe('italic 700 condensed 45px "Roboto", sans-serif');
  });
});

describe("the css2 axis query", () => {
  it("asks for weights alone when nothing else varies", () => {
    expect(googleAxisQuery([face(400), face(700)])).toBe("wght@400;700");
  });

  it("names axes alphabetically and gives every tuple a value for each", () => {
    expect(googleAxisQuery([face(400), face(700, true)])).toBe("ital,wght@0,400;1,700");
    expect(googleAxisQuery([face(700, false, "condensed")])).toBe("wdth,wght@75,700");
    expect(googleAxisQuery([face(400, true, "expanded")])).toBe("ital,wdth,wght@1,125,400");
  });

  it("sorts tuples ascending, which css2 requires", () => {
    expect(googleAxisQuery([face(900), face(100), face(400)])).toBe("wght@100;400;900");
    expect(googleAxisQuery([face(700, true), face(400, false), face(400, true)])).toBe(
      "ital,wght@0,400;1,400;1,700",
    );
  });

  it("sends width as the percentage the API expects, not the stored keyword", () => {
    const q = googleAxisQuery([face(400, false, "extra-condensed")]);
    expect(q).toBe("wdth,wght@62.5,400");
    expect(q).not.toMatch(/extra-condensed/);
  });

  it("dedupes repeated faces", () => {
    expect(googleAxisQuery([face(400), face(400), face(700)])).toBe("wght@400;700");
  });
});
