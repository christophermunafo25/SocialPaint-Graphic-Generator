import { describe, expect, it } from "vitest";
import { hasStrokePaths, readVector } from "./vector";

const line = {
  viewBox: [0, 0, 24, 24],
  paths: [{ d: "M5 12h14", paint: "stroke" }],
  stroke: { width: 2, cap: "round", join: "round" },
  source: { set: "lucide", name: "minus" },
};

describe("readVector", () => {
  it("keeps a well-formed vector as it is", () => {
    expect(readVector(line)).toEqual(line);
  });

  it("returns null when there is nothing to draw", () => {
    expect(readVector(undefined)).toBeNull();
    expect(readVector({ viewBox: [0, 0, 24, 24], paths: [] })).toBeNull();
    expect(readVector({ ...line, viewBox: [0, 0, 0, 24] })).toBeNull();
    expect(readVector({ ...line, viewBox: [0, 0, 24] })).toBeNull();
    expect(readVector({ ...line, paths: "M0 0" })).toBeNull();
  });

  it("never draws path data outside the path grammar", () => {
    const v = readVector({
      viewBox: [0, 0, 24, 24],
      paths: [{ d: 'M0 0"/><script>' }, { d: "url(#x)" }, { d: 7 }, null, { d: "M1 1L2 2z" }],
    });
    expect(v?.paths).toEqual([{ d: "M1 1L2 2z" }]);
  });

  it("stops drawing once the vector's path data passes its size cap", () => {
    const d = `M0 0${"l1 1".repeat(40_000)}`;
    const v = readVector({
      viewBox: [0, 0, 1, 1],
      paths: Array.from({ length: 10 }, () => ({ d })),
    });
    expect(v?.paths.length).toBe(3);
  });

  it("drops unknown paints, rules, colors and line styles", () => {
    const v = readVector({
      viewBox: [0, 0, 16, 16],
      paths: [{ d: "M0 0h1", paint: "glow", fillRule: "odd", colorHex: "red" }],
      stroke: { width: 1.5, cap: "pointy", join: "bevel" },
      source: { set: "phosphor", name: "x" },
    });
    expect(v).toEqual({
      viewBox: [0, 0, 16, 16],
      paths: [{ d: "M0 0h1" }],
      stroke: { width: 1.5, join: "bevel" },
    });
  });

  it("keeps a multi-color path's own color and fill rule", () => {
    const v = readVector({
      viewBox: [0, 0, 10, 10],
      paths: [{ d: "M0 0h10v10z", fillRule: "evenodd", colorHex: "#17FF7E" }],
    });
    expect(v?.paths[0]).toEqual({ d: "M0 0h10v10z", fillRule: "evenodd", colorHex: "#17FF7E" });
  });
});

describe("hasStrokePaths", () => {
  it("is true only when a path is drawn as a line", () => {
    expect(hasStrokePaths(readVector(line)!)).toBe(true);
    expect(hasStrokePaths({ viewBox: [0, 0, 1, 1], paths: [{ d: "M0 0" }] })).toBe(false);
  });
});
