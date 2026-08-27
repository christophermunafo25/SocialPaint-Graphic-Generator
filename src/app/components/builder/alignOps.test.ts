import { describe, expect, it } from "vitest";
import { alignDeltas, boundsOf, distributeDeltas, type AlignBox } from "./alignOps";

const box = (key: string, x: number, y: number, width: number, height: number): AlignBox => ({
  key,
  x,
  y,
  width,
  height,
});

/** Apply a delta map on one axis and read the resulting low edges back. */
const applied = (boxes: AlignBox[], deltas: Map<string, number>, axis: "h" | "v") =>
  boxes.map((b) => ({
    key: b.key,
    lo: (axis === "h" ? b.x : b.y) + (deltas.get(b.key) ?? 0),
    size: axis === "h" ? b.width : b.height,
  }));

describe("boundsOf", () => {
  it("is null for an empty set", () => {
    expect(boundsOf([])).toBeNull();
  });

  it("spans every box", () => {
    const b = boundsOf([box("a", 10, 20, 100, 50), box("b", 200, 5, 40, 200)]);
    expect(b).toMatchObject({ x: 10, y: 5, width: 230, height: 200 });
  });
});

describe("alignDeltas", () => {
  const boxes = [box("a", 100, 0, 200, 40), box("b", 400, 0, 50, 40), box("c", 250, 0, 90, 40)];
  const bounds = boundsOf(boxes)!;

  it("aligns left edges to the bounds", () => {
    const out = applied(boxes, alignDeltas(boxes, "h", "start", bounds), "h");
    expect(out.every((o) => o.lo === bounds.x)).toBe(true);
  });

  it("aligns right edges to the bounds", () => {
    const out = applied(boxes, alignDeltas(boxes, "h", "end", bounds), "h");
    expect(out.every((o) => o.lo + o.size === bounds.x + bounds.width)).toBe(true);
  });

  it("centres on the bounds", () => {
    const out = applied(boxes, alignDeltas(boxes, "h", "center", bounds), "h");
    const centre = bounds.x + bounds.width / 2;
    expect(out.every((o) => o.lo + o.size / 2 === centre)).toBe(true);
  });

  it("aligns a single box against arbitrary bounds — the canvas case", () => {
    const one = [box("only", 700, 300, 400, 90)];
    const canvas = { x: 0, y: 0, width: 1440, height: 1440 };
    expect(alignDeltas(one, "h", "start", canvas).get("only")).toBe(-700);
    expect(alignDeltas(one, "h", "center", canvas).get("only")).toBe(-180);
    expect(alignDeltas(one, "h", "end", canvas).get("only")).toBe(340);
    expect(alignDeltas(one, "v", "end", canvas).get("only")).toBe(1050);
  });

  it("works the same on the vertical axis", () => {
    const out = applied(boxes, alignDeltas(boxes, "v", "start", bounds), "v");
    expect(out.every((o) => o.lo === bounds.y)).toBe(true);
  });

  it("reports nothing for a box already in place", () => {
    const out = alignDeltas(boxes, "h", "start", bounds);
    expect(out.has("a")).toBe(false); // "a" already sits on the left edge
    expect(out.has("b")).toBe(true);
  });
});

describe("distributeDeltas", () => {
  it("needs three boxes to mean anything", () => {
    const two = [box("a", 0, 0, 10, 10), box("b", 100, 0, 10, 10)];
    expect(distributeDeltas(two, "h").size).toBe(0);
  });

  it("leaves the outermost boxes where they are", () => {
    const boxes = [box("a", 0, 0, 100, 10), box("b", 130, 0, 20, 10), box("c", 400, 0, 50, 10)];
    const d = distributeDeltas(boxes, "h");
    expect(d.get("a")).toBeUndefined();
    expect(d.get("c")).toBeUndefined();
  });

  it("puts an equal GAP between boxes of different sizes", () => {
    const boxes = [box("a", 0, 0, 100, 10), box("b", 130, 0, 20, 10), box("c", 400, 0, 50, 10)];
    const out = applied(boxes, distributeDeltas(boxes, "h"), "h").sort((p, q) => p.lo - q.lo);
    const gaps = out.slice(1).map((o, i) => o.lo - (out[i].lo + out[i].size));
    // span 450, widths 170, two gaps of 140 each
    expect(gaps[0]).toBeCloseTo(140, 9);
    expect(gaps[1]).toBeCloseTo(140, 9);
  });

  it("distributes by position, not by the order it was handed the boxes", () => {
    const boxes = [box("c", 400, 0, 50, 10), box("a", 0, 0, 100, 10), box("b", 130, 0, 20, 10)];
    const out = applied(boxes, distributeDeltas(boxes, "h"), "h").sort((p, q) => p.lo - q.lo);
    expect(out.map((o) => o.key)).toEqual(["a", "b", "c"]);
  });

  it("keeps overlapping boxes evenly overlapped rather than pulling the ends in", () => {
    const boxes = [box("a", 0, 0, 100, 10), box("b", 10, 0, 100, 10), box("c", 20, 0, 100, 10)];
    const d = distributeDeltas(boxes, "h");
    expect(d.get("a")).toBeUndefined();
    expect(d.get("c")).toBeUndefined();
    const out = applied(boxes, d, "h").sort((p, q) => p.lo - q.lo);
    const gaps = out.slice(1).map((o, i) => o.lo - (out[i].lo + out[i].size));
    expect(gaps[0]).toBeCloseTo(gaps[1], 9);
    expect(gaps[0]).toBeLessThan(0);
  });

  it("works on the vertical axis", () => {
    const boxes = [box("a", 0, 0, 10, 40), box("b", 0, 50, 10, 20), box("c", 0, 300, 10, 60)];
    const out = applied(boxes, distributeDeltas(boxes, "v"), "v").sort((p, q) => p.lo - q.lo);
    const gaps = out.slice(1).map((o, i) => o.lo - (out[i].lo + out[i].size));
    expect(gaps[0]).toBeCloseTo(gaps[1], 9);
  });
});
