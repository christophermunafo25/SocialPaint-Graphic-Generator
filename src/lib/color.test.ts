import { describe, expect, it } from "vitest";
import { parseColorInput } from "./color";

describe("parseColorInput", () => {
  it("accepts #RRGGBB and normalises case", () => {
    expect(parseColorInput("#17ff7e")).toBe("#17FF7E");
    expect(parseColorInput("#17FF7E")).toBe("#17FF7E");
  });

  it("accepts bare RRGGBB", () => {
    expect(parseColorInput("ff3627")).toBe("#FF3627");
  });

  it("expands #RGB and bare RGB", () => {
    expect(parseColorInput("#1af")).toBe("#11AAFF");
    expect(parseColorInput("1af")).toBe("#11AAFF");
  });

  it("accepts rgb() with any spacing", () => {
    expect(parseColorInput("rgb(23, 255, 126)")).toBe("#17FF7E");
    expect(parseColorInput("rgb(23,255,126)")).toBe("#17FF7E");
    expect(parseColorInput("rgb( 23 , 255 , 126 )")).toBe("#17FF7E");
    expect(parseColorInput("RGB(0, 0, 0)")).toBe("#000000");
  });

  it("trims surrounding whitespace", () => {
    expect(parseColorInput("  #17FF7E  ")).toBe("#17FF7E");
  });

  it("rejects out-of-range rgb channels", () => {
    expect(parseColorInput("rgb(256, 0, 0)")).toBeNull();
    expect(parseColorInput("rgb(0, 999, 0)")).toBeNull();
  });

  it("rejects everything else", () => {
    expect(parseColorInput("")).toBeNull();
    expect(parseColorInput("#17FF7")).toBeNull();
    expect(parseColorInput("#17FF7E00")).toBeNull();
    expect(parseColorInput("rgb(1, 2)")).toBeNull();
    expect(parseColorInput("rgba(1, 2, 3, 0.5)")).toBeNull();
    expect(parseColorInput("hsl(120, 50%, 50%)")).toBeNull();
    expect(parseColorInput("Slime")).toBeNull();
  });
});
