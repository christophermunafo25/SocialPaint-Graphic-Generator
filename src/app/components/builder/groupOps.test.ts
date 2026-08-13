import { describe, expect, it } from "vitest";
import type { LayoutGroup, TemplateField } from "@/lib/types";
import type { LineMeasurer } from "@/lib/render/autoFit";
import { computeLayout } from "@/lib/render/layout";
import {
  conversionShift,
  deriveFreeGroup,
  deriveGroup,
  fieldIdsInGroups,
  groupIdsWithin,
  renameKeyInGroups,
  stripFieldsFromGroups,
  toFreeGroup,
  toStackGroup,
  ungroup,
} from "./groupOps";

const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

let n = 0;
const mkField = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${n++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `k${n}`,
  type: "text",
  x: 100,
  y: 100,
  width: 400,
  height: 60,
  lineHeight: 1,
  fontSizePx: 30,
  verticalAlign: "top",
  ...over,
});

const canvas = { canvasWidth: 1440, canvasHeight: 1440 };
const layoutOf = (fields: TemplateField[], groups?: LayoutGroup[]) =>
  computeLayout({ fields, layoutGroups: groups, ...canvas }, {}, null, measure);

describe("deriveGroup", () => {
  // Two top-aligned text blocks: content tops at y=100 and y=184 (hugged
  // heights: 30px line at the top of each 60px box → visual gap 54... with
  // verticalAlign top, extents are y=100 h=30 and y=184 h=30 → gap 54).
  const a = mkField({ fieldKey: "a", y: 100, label: "A", placeholder: "aa" });
  const b = mkField({ fieldKey: "b", y: 184, label: "B", placeholder: "bb" });

  it("derives order, gap, anchor, and alignment from what is on the canvas", () => {
    const layout = layoutOf([a, b]);
    const g = deriveGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout,
      kit: null,
      measure,
    })!;
    expect(g.children).toEqual(["a", "b"]);
    expect(g.anchor).toBe("start");
    expect(g.y).toBe(100); // first child's visual top
    expect(g.gap).toBe(54); // 184 - (100 + 30)
    expect(g.align).toBe("start"); // both at x=100
    expect(g.crossSize).toBe(400);
  });

  it("grouping is visually lossless: rects before == rects after", () => {
    const before = layoutOf([a, b]);
    const g = deriveGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout: before,
      kit: null,
      measure,
    })!;
    const after = layoutOf([a, b], [g]);
    // Text hugs after grouping: the VISUAL block (content) must not move.
    // With verticalAlign top, content top == box top, so rect.y is directly
    // comparable; height becomes the hugged 30.
    expect(after.fieldRects.get(a.id)!.y).toBe(100);
    expect(after.fieldRects.get(b.id)!.y).toBe(184);
    expect(after.fieldRects.get(a.id)!.x).toBe(100);
  });

  it("refuses fields already in a group and undersized selections", () => {
    const layout = layoutOf([a, b]);
    const existing: LayoutGroup = {
      id: "g1",
      name: "G",
      direction: "vertical",
      gap: 10,
      anchor: "start",
      align: "start",
      x: 0,
      y: 0,
      crossSize: 100,
      children: ["a"],
    };
    expect(
      deriveGroup({
        fields: [a, b],
        groups: [existing],
        fieldIds: [a.id, b.id],
        groupIds: [],
        layout,
        kit: null,
        measure,
      }),
    ).toBeNull();
    expect(
      deriveGroup({
        fields: [a],
        groups: [],
        fieldIds: [a.id],
        groupIds: [],
        layout,
        kit: null,
        measure,
      }),
    ).toBeNull();
  });

  it("nests a selected group as a child", () => {
    const c = mkField({ fieldKey: "c", y: 400 });
    const inner: LayoutGroup = {
      id: "inner",
      name: "Inner",
      direction: "vertical",
      gap: 10,
      anchor: "start",
      align: "start",
      x: 100,
      y: 100,
      crossSize: 400,
      children: ["a", "b"],
    };
    const layout = layoutOf([a, b, c], [inner]);
    const g = deriveGroup({
      fields: [a, b, c],
      groups: [inner],
      fieldIds: [c.id],
      groupIds: ["inner"],
      layout,
      kit: null,
      measure,
    })!;
    expect(g.children).toEqual(["group:inner", "c"]);
  });
});

describe("ungroup", () => {
  it("freezes children at computed rects and drops the group", () => {
    const a = mkField({ fieldKey: "a", placeholder: "aa" });
    const b = mkField({ fieldKey: "b", placeholder: "bb" });
    const g: LayoutGroup = {
      id: "g",
      name: "G",
      direction: "vertical",
      gap: 24,
      anchor: "start",
      align: "start",
      x: 200,
      y: 300,
      crossSize: 400,
      children: ["a", "b"],
    };
    const layout = layoutOf([a, b], [g]);
    const { fields, groups } = ungroup(g, [a, b], [g], layout);
    expect(groups).toEqual([]);
    const fa = fields.find((f) => f.fieldKey === "a")!;
    const fb = fields.find((f) => f.fieldKey === "b")!;
    expect(fa).toMatchObject({ x: 200, y: 300, height: 30 });
    expect(fb.y).toBe(300 + 30 + 24);
    // Re-laying out the ungrouped fields reproduces the same rects.
    const after = layoutOf(fields);
    expect(after.fieldRects.get(fb.id)!.y).toBe(354);
  });

  it("promotes a nested group and re-anchors it in place", () => {
    const a = mkField({ fieldKey: "a", placeholder: "aa" });
    const b = mkField({ fieldKey: "b", placeholder: "bb" });
    const inner: LayoutGroup = {
      id: "inner",
      name: "Inner",
      direction: "vertical",
      gap: 8,
      anchor: "start",
      align: "start",
      x: 0,
      y: 0, // ignored while nested
      crossSize: 400,
      children: ["b"],
    };
    const outer: LayoutGroup = {
      id: "outer",
      name: "Outer",
      direction: "vertical",
      gap: 24,
      anchor: "start",
      align: "start",
      x: 200,
      y: 300,
      crossSize: 400,
      children: ["a", "group:inner"],
    };
    const layout = layoutOf([a, b], [inner, outer]);
    const innerRectBefore = layout.groupRects.get("inner")!;
    const { fields, groups } = ungroup(outer, [a, b], [inner, outer], layout);
    const promoted = groups.find((g) => g.id === "inner")!;
    expect(promoted.y).toBe(innerRectBefore.y);
    expect(promoted.x).toBe(innerRectBefore.x);
    // The promoted group lays out b exactly where it was.
    const after = layoutOf(fields, groups);
    expect(after.fieldRects.get(b.id)!.y).toBe(layout.fieldRects.get(b.id)!.y);
  });
});

describe("reference maintenance", () => {
  const base: LayoutGroup = {
    id: "g1",
    name: "G",
    direction: "vertical",
    gap: 10,
    anchor: "start",
    align: "start",
    x: 0,
    y: 0,
    crossSize: 100,
    children: ["a", "b"],
  };

  it("strips deleted fields and dissolves empty groups transitively", () => {
    const parent: LayoutGroup = { ...base, id: "p", children: ["group:g1", "c"] };
    const afterOne = stripFieldsFromGroups([base, parent], ["a"])!;
    expect(afterOne.find((g) => g.id === "g1")!.children).toEqual(["b"]);
    const afterAll = stripFieldsFromGroups([base, parent], ["a", "b", "c"]);
    expect(afterAll).toBeUndefined();
  });

  it("follows fieldKey renames", () => {
    const out = renameKeyInGroups([base], "a", "headline")!;
    expect(out[0].children).toEqual(["headline", "b"]);
  });

  it("expands group selections to member fields and nested group ids", () => {
    const fa = mkField({ fieldKey: "a" });
    const fb = mkField({ fieldKey: "b" });
    const parent: LayoutGroup = { ...base, id: "p", children: ["group:g1"] };
    expect(fieldIdsInGroups(["p"], [fa, fb], [base, parent]).sort()).toEqual([fa.id, fb.id].sort());
    expect(groupIdsWithin(["p"], [base, parent]).sort()).toEqual(["g1", "p"]);
  });
});

describe("deriveFreeGroup", () => {
  const a = mkField({ fieldKey: "a", x: 100, y: 100, label: "A", placeholder: "aa" });
  const b = mkField({ fieldKey: "b", x: 100, y: 184, label: "B", placeholder: "bb" });

  it("is pure membership: nothing moves, children ordered by position", () => {
    const before = layoutOf([a, b]);
    const g = deriveFreeGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout: before,
      kit: null,
      measure,
    })!;
    expect(g.mode).toBe("free");
    expect(g.children).toEqual(["a", "b"]);
    const after = layoutOf([a, b], [g]);
    expect(after.fieldRects.get(a.id)).toEqual(before.fieldRects.get(a.id));
    expect(after.fieldRects.get(b.id)).toEqual(before.fieldRects.get(b.id));
    expect(after.warnings).toEqual([]);
  });

  it("refuses undersized selections and already-grouped fields", () => {
    const layout = layoutOf([a, b]);
    const base = { fields: [a, b], groups: [], groupIds: [], layout, kit: null, measure };
    expect(deriveFreeGroup({ ...base, fieldIds: [a.id] })).toBeNull();
    const g = deriveFreeGroup({ ...base, fieldIds: [a.id, b.id] })!;
    expect(
      deriveFreeGroup({ ...base, groups: [g], fieldIds: [a.id, b.id] }),
    ).toBeNull();
  });
});

describe("direction inference (deriveGroup)", () => {
  it("side-by-side text derives a horizontal stack anchored at the painted run", () => {
    // 150-wide boxes at x=100 and x=260, same row. The PAINTED runs ("aa" at
    // 30px → 30 wide) separate cleanly on x and overlap fully on y.
    const a = mkField({ fieldKey: "a", x: 100, y: 100, width: 150, placeholder: "aa" });
    const b = mkField({ fieldKey: "b", x: 260, y: 100, width: 150, placeholder: "bb" });
    const before = layoutOf([a, b]);
    const g = deriveGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout: before,
      kit: null,
      measure,
    })!;
    expect(g.direction).toBe("horizontal");
    expect(g.children).toEqual(["a", "b"]);
    expect(g.anchor).toBe("start");
    expect(g.x).toBe(100); // first run's painted left edge
    expect(g.y).toBe(100); // top of the row (verticalAlign top)
    expect(g.gap).toBe(130); // 260 - (100 + 30)
    expect(g.align).toBe("start"); // tops line up
    expect(g.crossSize).toBe(30); // one 30px line
    // Losslessness: the painted runs stay exactly where they were.
    const after = layoutOf([a, b], [g]);
    expect(after.fieldRects.get(a.id)).toMatchObject({ x: 100, y: 100, width: 30 });
    expect(after.fieldRects.get(b.id)).toMatchObject({ x: 260, y: 100, width: 30 });
  });

  it("ambiguous overlap defaults to vertical", () => {
    const a = mkField({ fieldKey: "a", x: 100, y: 100, placeholder: "aaaaaaaaaa" });
    const b = mkField({ fieldKey: "b", x: 120, y: 110, placeholder: "bbbbbbbbbb" });
    const layout = layoutOf([a, b]);
    const g = deriveGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout,
      kit: null,
      measure,
    })!;
    expect(g.direction).toBe("vertical");
  });

  it("refuses a plain group as a stack member", () => {
    const a = mkField({ fieldKey: "a", x: 100, y: 100 });
    const b = mkField({ fieldKey: "b", x: 100, y: 200 });
    const c = mkField({ fieldKey: "c", x: 100, y: 400 });
    let layout = layoutOf([a, b, c]);
    const free = deriveFreeGroup({
      fields: [a, b, c],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout,
      kit: null,
      measure,
    })!;
    layout = layoutOf([a, b, c], [free]);
    expect(
      deriveGroup({
        fields: [a, b, c],
        groups: [free],
        fieldIds: [c.id],
        groupIds: [free.id],
        layout,
        kit: null,
        measure,
      }),
    ).toBeNull();
    // …while a plain group can nest it fine.
    expect(
      deriveFreeGroup({
        fields: [a, b, c],
        groups: [free],
        fieldIds: [c.id],
        groupIds: [free.id],
        layout,
        kit: null,
        measure,
      }),
    ).not.toBeNull();
  });
});

describe("mode conversion", () => {
  const a = mkField({ fieldKey: "a", x: 100, y: 100, label: "A", placeholder: "aa" });
  const b = mkField({ fieldKey: "b", x: 100, y: 184, label: "B", placeholder: "bb" });

  it("stack → free freezes children exactly (always lossless)", () => {
    const stack = deriveGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout: layoutOf([a, b]),
      kit: null,
      measure,
    })!;
    const before = layoutOf([a, b], [stack]);
    const res = toFreeGroup(stack, [a, b], [stack], before);
    const freed = res.groups.find((g) => g.id === stack.id)!;
    expect(freed.mode).toBe("free");
    expect(freed.children).toEqual(stack.children);
    const after = layoutOf(res.fields, res.groups);
    for (const f of res.fields) {
      expect(after.fieldRects.get(f.id)).toEqual(before.fieldRects.get(f.id));
    }
  });

  it("free → stack on an already-stacked arrangement converts without movement", () => {
    const layout = layoutOf([a, b]);
    const free = deriveFreeGroup({
      fields: [a, b],
      groups: [],
      fieldIds: [a.id, b.id],
      groupIds: [],
      layout,
      kit: null,
      measure,
    })!;
    const before = layoutOf([a, b], [free]);
    const stacked = toStackGroup(free, [a, b], [free], before, null, measure);
    expect(stacked.mode).toBe("stack");
    expect(stacked.direction).toBe("vertical");
    const after = layoutOf([a, b], [stacked]);
    expect(conversionShift(stacked, [a, b], before, after, null, measure)).toBeLessThanOrEqual(1);
    // The visual blocks hold: content tops at 100 and 184.
    expect(after.fieldRects.get(a.id)!.y).toBe(100);
    expect(after.fieldRects.get(b.id)!.y).toBe(184);
  });

  it("free → stack on a scattered arrangement reports a shift worth warning about", () => {
    const s1 = mkField({ fieldKey: "s1", x: 100, y: 100, placeholder: "aa" });
    const s2 = mkField({ fieldKey: "s2", x: 150, y: 120, placeholder: "bb" });
    const layout = layoutOf([s1, s2]);
    const free = deriveFreeGroup({
      fields: [s1, s2],
      groups: [],
      fieldIds: [s1.id, s2.id],
      groupIds: [],
      layout,
      kit: null,
      measure,
    })!;
    const before = layoutOf([s1, s2], [free]);
    const stacked = toStackGroup(free, [s1, s2], [free], before, null, measure);
    const after = layoutOf([s1, s2], [stacked]);
    expect(conversionShift(stacked, [s1, s2], before, after, null, measure)).toBeGreaterThan(2);
  });
});
