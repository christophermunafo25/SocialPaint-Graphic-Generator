import { describe, expect, it } from "vitest";
import { fillSwatchCss } from "./FillPicker";

/** The rule these guard: in the `background` shorthand a bare colour is only
 * legal in the FINAL layer. Anything earlier must be an image. Get it wrong
 * and the browser drops the whole declaration — the swatch paints EMPTY, not
 * wrong, which is why it went unnoticed until someone said "the preview does
 * not show for any element". */
describe("fillSwatchCss", () => {
  it("wraps a solid colour as an image layer", () => {
    expect(fillSwatchCss("#D9D9D9")).toMatch(/^linear-gradient\(#D9D9D9, #D9D9D9\), /);
  });

  it("never leaves a bare colour in front of another layer", () => {
    const css = fillSwatchCss("#D9D9D9");
    const firstLayer = css.slice(0, css.indexOf("), ") + 1);
    expect(firstLayer.startsWith("linear-gradient(")).toBe(true);
    expect(/^#|^rgb/.test(firstLayer)).toBe(false);
  });

  it("carries an eight-digit alpha hex through untouched", () => {
    expect(fillSwatchCss("#1A1F2666")).toContain("#1A1F2666, #1A1F2666");
  });

  it("layers a gradient as it is, without wrapping it again", () => {
    const g = "linear-gradient(90deg, #000 0%, #FFF 100%)";
    const out = fillSwatchCss(g, true);
    expect(out.startsWith(g + ", ")).toBe(true);
    expect(out).not.toContain("linear-gradient(linear-gradient");
  });

  it("always ends on the checker, whose own final layer is the plate", () => {
    for (const css of [fillSwatchCss("#FFF"), fillSwatchCss("linear-gradient(#000, #FFF)", true)]) {
      expect(css).toContain("repeating-conic-gradient(");
      expect(css.endsWith("var(--bg-plate)")).toBe(true);
    }
  });
});
