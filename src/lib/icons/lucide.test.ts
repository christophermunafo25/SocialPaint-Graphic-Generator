import { describe, expect, it } from "vitest";
import { readVector } from "../render/vector";
import {
  elementToPath,
  iconNodeToVector,
  iconTitle,
  searchIconNames,
  withWeight,
  type LucideElement,
} from "./lucide";

describe("elementToPath", () => {
  it("keeps a path as it is", () => {
    expect(elementToPath(["path", { d: "M5 12h14" }])).toBe("M5 12h14");
  });

  it("draws a circle as two half arcs", () => {
    expect(elementToPath(["circle", { cx: "12", cy: "12", r: "10" }])).toBe(
      "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z",
    );
  });

  it("draws a rounded rect with corner arcs, and a square one without", () => {
    expect(elementToPath(["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }])).toBe(
      "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z",
    );
    expect(elementToPath(["rect", { x: "1", y: "1", width: "4", height: "2" }])).toBe(
      "M1 1h4v2h-4z",
    );
  });

  it("draws lines, polylines and polygons", () => {
    expect(elementToPath(["line", { x1: "1", y1: "2", x2: "3", y2: "4" }])).toBe("M1 2L3 4");
    expect(elementToPath(["polyline", { points: "12 6 12 12 16 14" }])).toBe("M12 6L12 12L16 14");
    expect(elementToPath(["polygon", { points: "0,0 4,0 2,3" }])).toBe("M0 0L4 0L2 3z");
  });

  it("skips what it can't read", () => {
    expect(elementToPath(["g", {}])).toBeNull();
    expect(elementToPath(["polyline", { points: "1" }])).toBeNull();
  });
});

describe("iconNodeToVector", () => {
  const clock: LucideElement[] = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "a" }],
    ["polyline", { points: "12 6 12 12 16 14", key: "b" }],
  ];

  it("makes a 24-unit line icon the renderer draws as is", () => {
    const v = iconNodeToVector("clock", clock);
    expect(v.viewBox).toEqual([0, 0, 24, 24]);
    expect(v.stroke).toEqual({ width: 2, cap: "round", join: "round" });
    expect(v.source).toEqual({ set: "lucide", name: "clock" });
    expect(v.paths.every((p) => p.paint === "stroke")).toBe(true);
    expect(readVector(v)).toEqual(v);
  });

  it("adds a fill path for an element Lucide fills", () => {
    const v = iconNodeToVector("dot", [
      ["circle", { cx: "12", cy: "12", r: "1", fill: "currentColor" }],
    ]);
    expect(v.paths.map((p) => p.paint ?? "fill")).toEqual(["fill", "stroke"]);
  });

  it("keeps the weight in range", () => {
    expect(iconNodeToVector("clock", clock, 9).stroke?.width).toBe(4);
    expect(withWeight(iconNodeToVector("clock", clock), 0.1).stroke?.width).toBe(0.5);
  });
});

describe("search and titles", () => {
  const names = ["arrow-right", "calendar", "map-pin", "pin", "spinner"];

  it("ranks names that start with the query first, then word starts, then any part", () => {
    expect(searchIconNames(names, "pin")).toEqual(["pin", "map-pin", "spinner"]);
    expect(searchIconNames(names, "arrow right")).toEqual(["arrow-right"]);
    expect(searchIconNames(names, " ")).toEqual(names);
    expect(searchIconNames(["calendar-1", "calendar"], "calendar")).toEqual([
      "calendar",
      "calendar-1",
    ]);
  });

  it("titles a name in sentence case", () => {
    expect(iconTitle("arrow-up-right")).toBe("Arrow up right");
  });
});
