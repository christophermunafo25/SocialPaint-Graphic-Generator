import { describe, expect, it } from "vitest";
import { cropChoice, keepAlpha, parseHexInput } from "./inspectorValues";

describe("cropChoice", () => {
  it("is Box with no ratio, a preset's label on a preset, else Custom", () => {
    expect(cropChoice(undefined)).toBe("box");
    expect(cropChoice(1)).toBe("1:1");
    expect(cropChoice(4 / 3)).toBe("4:3");
    expect(cropChoice(1.333)).toBe("4:3");
    expect(cropChoice(1.91)).toBe("1.91:1");
    expect(cropChoice(2.5)).toBe("custom");
  });
});

describe("parseHexInput", () => {
  it("reads six or eight digits, with or without the #, in capitals", () => {
    expect(parseHexInput("ff8300")).toBe("#FF8300");
    expect(parseHexInput(" #ff830080 ")).toBe("#FF830080");
  });

  it("refuses anything else", () => {
    expect(parseHexInput("fff")).toBeNull();
    expect(parseHexInput("#ff83")).toBeNull();
    expect(parseHexInput("orange")).toBeNull();
  });
});

describe("keepAlpha", () => {
  it("keeps the alpha when six digits are typed over eight", () => {
    expect(keepAlpha("#112233", "#ffffff80")).toBe("#11223380");
  });

  it("takes the typed colour whole otherwise", () => {
    expect(keepAlpha("#11223344", "#ffffff80")).toBe("#11223344");
    expect(keepAlpha("#112233", "#ffffff")).toBe("#112233");
  });
});
