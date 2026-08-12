import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inspectFontBinary, stretchFromName, weightFromName } from "./fontInspect";

const fixture = (name: string): ArrayBuffer => {
  const path = fileURLToPath(new URL(`../../assets/fonts/neuething/${name}`, import.meta.url));
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe("inspectFontBinary — variable font", () => {
  const font = inspectFontBinary(fixture("NeuethingSans-variableVF.ttf"))!;

  it("reads the typographic family, not the filename", () => {
    expect(font.family).toBe("Neuething Sans");
  });

  it("surfaces every named instance as a selectable cut", () => {
    expect(font.cuts!.length).toBe(28);
  });

  it("maps instance names onto CSS weight/stretch slots", () => {
    const cut = font.cuts!.find((c) => c.name === "ExtraBold Expanded")!;
    expect(cut.weight).toBe(800);
    expect(cut.stretch).toBe("expanded");
    expect(cut.italic).toBe(false);
  });

  it("keeps the raw axis coordinates — custom ranges need variation settings", () => {
    const cut = font.cuts!.find((c) => c.name === "ExtraBold Expanded")!;
    expect(cut.axes).toEqual({ wght: 90, wdth: 74 });
  });

  it("covers all five width groups the family designs", () => {
    const stretches = new Set(font.cuts!.map((c) => c.stretch));
    expect([...stretches].sort()).toEqual(
      ["expanded", "extra-expanded", "normal", "semi-expanded", "ultra-expanded"].sort(),
    );
  });
});

describe("inspectFontBinary — static cut", () => {
  const font = inspectFontBinary(fixture("NeuethingSans-ExtraBoldExtraExpanded.otf"))!;

  it("reads family, true weight, and true width from the tables", () => {
    expect(font.family).toBe("Neuething Sans");
    expect(font.weight).toBe(800);
    expect(font.stretch).toBe("extra-expanded");
    expect(font.cuts).toBeUndefined();
  });
});

describe("inspectFontBinary — junk input", () => {
  it("rejects non-sfnt data instead of throwing", () => {
    expect(inspectFontBinary(new ArrayBuffer(4))).toBeNull();
    expect(
      inspectFontBinary(new TextEncoder().encode("not a font at all").buffer as ArrayBuffer),
    ).toBeNull();
  });
});

describe("name-token mapping", () => {
  it("orders compound tokens before their bare stems", () => {
    expect(weightFromName("ExtraBold Expanded")).toBe(800);
    expect(weightFromName("Bold")).toBe(700);
    expect(weightFromName("SemiBold Italic")).toBe(600);
    expect(stretchFromName("Black UltraExpanded")).toBe("ultra-expanded");
    expect(stretchFromName("Medium SemiExpanded")).toBe("semi-expanded");
    expect(stretchFromName("Regular")).toBeUndefined();
  });
});
