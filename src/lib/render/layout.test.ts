import { describe, expect, it } from "vitest";
import type { LayoutGroup, TemplateField } from "../types";
import type { LineMeasurer } from "./autoFit";
import {
  authoredRect,
  computeLayout,
  groupFieldKeys,
  outermostGroupOf,
  renderedText,
  topLevelGroups,
  wrapLines,
} from "./layout";

/** Deterministic fake glyphs: every character is half the font size wide.
 * The font size is parsed straight out of the canvas shorthand the engine
 * composes, so fitting and wrapping react to size changes exactly as a real
 * canvas context would. */
const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

let nextId = 0;
const mkField = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${nextId++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `field_${nextId}`,
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  lineHeight: 1, // integer math in fixtures unless a case says otherwise
  fontSizePx: 40,
  ...over,
});

const mkGroup = (over: Partial<LayoutGroup>): LayoutGroup => ({
  id: over.id ?? `g${nextId++}`,
  name: over.name ?? "Group",
  direction: "vertical",
  gap: 24,
  anchor: "start",
  align: "start",
  x: 100,
  y: 100,
  crossSize: 400,
  children: [],
  ...over,
});

const canvas = { canvasWidth: 1440, canvasHeight: 1440 };

const layout = (
  fields: TemplateField[],
  groups?: LayoutGroup[],
  values: Record<string, string> = {},
) => computeLayout({ fields, layoutGroups: groups, ...canvas }, values, null, measure);

describe("passthrough (no groups)", () => {
  it("returns authored rects untouched, center anchors normalized", () => {
    const plain = mkField({ fieldKey: "a", x: 10, y: 20, width: 300, height: 80 });
    const centered = mkField({
      fieldKey: "b",
      x: 500,
      y: 500,
      width: 200,
      height: 100,
      anchor: "center",
    });
    const r = layout([plain, centered]);
    expect(r.fieldRects.get(plain.id)).toEqual({ x: 10, y: 20, width: 300, height: 80 });
    expect(r.fieldRects.get(centered.id)).toEqual({ x: 400, y: 450, width: 200, height: 100 });
    expect(r.warnings).toEqual([]);
  });

  it("computes renderer-identical font sizes (fixedWidth measures, autoFit estimates)", () => {
    // 20 chars × 0.5 × 40px = 400 wide at base size; box is 300 → shrink.
    const fixed = mkField({ fieldKey: "fw", width: 300, fixedWidth: true });
    const r = layout([fixed], undefined, { fw: "abcdefghijklmnopqrst" });
    // floor(40 × 300/400) = 30
    expect(r.fontSizes.get(fixed.id)).toBe(30);
  });
});

describe("vertical stack", () => {
  const eyebrow = mkField({ fieldKey: "eyebrow", fontSizePx: 30, width: 300 });
  const headline = mkField({ fieldKey: "headline", type: "multiline", fontSizePx: 60, width: 400 });
  const group = mkGroup({ children: ["eyebrow", "headline"], x: 100, y: 200 });

  it("anchors top: first child at the anchor, gap exact, text hugged", () => {
    const r = layout([eyebrow, headline], [group], {
      eyebrow: "WE ARE HIRING",
      headline: "Senior Brand Designer", // 21 chars × 30 = 630 wide at 60px → wraps
    });
    const e = r.fieldRects.get(eyebrow.id)!;
    const h = r.fieldRects.get(headline.id)!;
    expect(e).toMatchObject({ x: 100, y: 200, width: 300, height: 30 });
    // gap holds exactly
    expect(h.y - (e.y + e.height)).toBe(24);
    // "Senior Brand Designer" at 60px: candidate widths — "Senior Brand" =
    // 12 × 30 = 360 ≤ 400, +" Designer" = 21 × 30 = 630 > 400 → 2 lines.
    expect(h.height).toBe(120);
  });

  it("a longer headline grows downward under anchor=start; the eyebrow holds", () => {
    const short = layout([eyebrow, headline], [group], { eyebrow: "HI", headline: "One" });
    const long = layout([eyebrow, headline], [group], {
      eyebrow: "HI",
      headline: "Principal Multidisciplinary Experience Designer Lead",
    });
    expect(short.fieldRects.get(eyebrow.id)).toEqual(long.fieldRects.get(eyebrow.id));
    const hs = short.fieldRects.get(headline.id)!;
    const hl = long.fieldRects.get(headline.id)!;
    expect(hs.y).toBe(hl.y); // headline TOP holds; growth is downward
    expect(hl.height).toBeGreaterThan(hs.height);
  });

  it("anchor=end holds the bottom edge; content grows upward", () => {
    const g = mkGroup({ children: ["eyebrow", "headline"], anchor: "end", x: 100, y: 800 });
    const short = layout([eyebrow, headline], [g], { eyebrow: "HI", headline: "One" });
    const long = layout([eyebrow, headline], [g], {
      eyebrow: "HI",
      headline: "Principal Multidisciplinary Experience Designer Lead",
    });
    const bottom = (r: ReturnType<typeof layout>) => {
      const h = r.fieldRects.get(headline.id)!;
      return h.y + h.height;
    };
    expect(bottom(short)).toBe(800);
    expect(bottom(long)).toBe(800);
    expect(long.fieldRects.get(eyebrow.id)!.y).toBeLessThan(short.fieldRects.get(eyebrow.id)!.y);
  });

  it("anchor=center pins the stack center", () => {
    const g = mkGroup({ children: ["eyebrow", "headline"], anchor: "center", x: 100, y: 500 });
    const r = layout([eyebrow, headline], [g], { eyebrow: "HI", headline: "One" });
    const rect = r.groupRects.get(g.id)!;
    expect(rect.y + rect.height / 2).toBe(500);
  });

  it("cross-axis alignment places children against the group box", () => {
    const narrow = mkField({ fieldKey: "n", width: 100, fontSizePx: 20 });
    const g = mkGroup({ children: ["n"], align: "center", x: 100, crossSize: 400 });
    const centered = layout([narrow], [g], { n: "x" }).fieldRects.get(narrow.id)!;
    expect(centered.x).toBe(250); // 100 + (400-100)/2
    const end = mkGroup({ ...g, align: "end" });
    expect(layout([narrow], [end], { n: "x" }).fieldRects.get(narrow.id)!.x).toBe(400);
  });

  it("images keep their authored main size and stack with the same gap", () => {
    const img = mkField({ fieldKey: "img", type: "image", width: 200, height: 150 });
    const g = mkGroup({ children: ["eyebrow", "img", "headline"], x: 0, y: 0, gap: 10 });
    const r = layout([eyebrow, img, headline], [g], { eyebrow: "HI", headline: "One" });
    const e = r.fieldRects.get(eyebrow.id)!;
    const i = r.fieldRects.get(img.id)!;
    const h = r.fieldRects.get(headline.id)!;
    expect(i.y).toBe(e.y + e.height + 10);
    expect(i.height).toBe(150);
    expect(h.y).toBe(i.y + 150 + 10);
  });
});

describe("horizontal stack", () => {
  it("hugs single-line text width on the main axis", () => {
    const a = mkField({ fieldKey: "a", fontSizePx: 20 });
    const b = mkField({ fieldKey: "b", fontSizePx: 20 });
    const g = mkGroup({
      direction: "horizontal",
      children: ["a", "b"],
      x: 50,
      y: 50,
      gap: 12,
      crossSize: 100,
    });
    const r = layout([a, b], [g], { a: "abcd", b: "xy" });
    const ra = r.fieldRects.get(a.id)!;
    const rb = r.fieldRects.get(b.id)!;
    expect(ra).toMatchObject({ x: 50, y: 50, width: 40 }); // 4 × 10
    expect(rb.x).toBe(50 + 40 + 12);
    expect(rb.width).toBe(20);
  });
});

describe("nesting", () => {
  it("lays out a vertical group inside a vertical group with its own gap", () => {
    const a = mkField({ fieldKey: "a", fontSizePx: 20 });
    const b = mkField({ fieldKey: "b", fontSizePx: 20 });
    const c = mkField({ fieldKey: "c", fontSizePx: 20 });
    const inner = mkGroup({ id: "inner", children: ["b", "c"], gap: 4, crossSize: 300 });
    const outer = mkGroup({
      id: "outer",
      children: ["a", "group:inner"],
      gap: 30,
      x: 0,
      y: 0,
      crossSize: 400,
    });
    const r = layout([a, b, c], [inner, outer], { a: "x", b: "x", c: "x" });
    const ra = r.fieldRects.get(a.id)!;
    const rb = r.fieldRects.get(b.id)!;
    const rc = r.fieldRects.get(c.id)!;
    expect(rb.y).toBe(ra.y + 20 + 30); // outer gap into the nested slot
    expect(rc.y).toBe(rb.y + 20 + 4); // inner gap between nested children
    expect(r.groupRects.get("inner")!.height).toBe(44);
    expect(topLevelGroups([inner, outer]).map((g) => g.id)).toEqual(["outer"]);
    expect(groupFieldKeys(outer, [inner, outer])).toEqual(["a", "b", "c"]);
    expect(outermostGroupOf("c", [inner, outer])?.id).toBe("outer");
  });

  it("maps axes for an orthogonal nested stack", () => {
    const a = mkField({ fieldKey: "a", fontSizePx: 20 });
    const b = mkField({ fieldKey: "b", fontSizePx: 20 });
    const row = mkGroup({
      id: "row",
      direction: "horizontal",
      children: ["a", "b"],
      gap: 8,
      crossSize: 60, // the row's HEIGHT
    });
    const col = mkGroup({ id: "col", children: ["group:row"], x: 0, y: 0, crossSize: 400 });
    const r = layout([a, b], [row, col], { a: "ab", b: "cd" });
    // The row occupies its crossSize (60) along the column's main axis.
    expect(r.groupRects.get("col")!.height).toBe(60);
    const ra = r.fieldRects.get(a.id)!;
    const rb = r.fieldRects.get(b.id)!;
    expect(ra.x).toBe(0);
    expect(rb.x).toBe(ra.x + 20 + 8);
    expect(ra.y).toBe(0);
  });

  it("survives a reference cycle with a warning instead of hanging", () => {
    const a = mkField({ fieldKey: "a" });
    const g1 = mkGroup({ id: "g1", children: ["a", "group:g2"] });
    const g2 = mkGroup({ id: "g2", children: ["group:g1"] });
    const r = layout([a], [g1, g2], { a: "x" });
    expect(r.warnings.some((w) => w.includes("circular"))).toBe(true);
  });
});

describe("robustness", () => {
  it("skips dangling field references with one warning", () => {
    const a = mkField({ fieldKey: "a", fontSizePx: 20 });
    const g = mkGroup({ children: ["a", "ghost"], x: 0, y: 0 });
    const r = layout([a], [g], { a: "x" });
    expect(r.fieldRects.get(a.id)!.y).toBe(0);
    expect(r.warnings.filter((w) => w.includes("ghost")).length).toBe(1);
  });

  it("first group wins a doubly-referenced field", () => {
    const a = mkField({ fieldKey: "a", fontSizePx: 20 });
    const g1 = mkGroup({ id: "g1", children: ["a"], x: 0, y: 0 });
    const g2 = mkGroup({ id: "g2", children: ["a"], x: 500, y: 500 });
    const r = layout([a], [g1, g2], { a: "x" });
    expect(r.fieldRects.get(a.id)!.y).toBe(0);
    expect(r.warnings.some((w) => w.includes("already belongs"))).toBe(true);
  });

  it("flags a group that outgrows the canvas", () => {
    const big = mkField({ fieldKey: "big", type: "image", width: 400, height: 900 });
    const g = mkGroup({ children: ["big"], x: 100, y: 1000 });
    const r = layout([big], [g]);
    expect(r.groupRects.get(g.id)!.overflows).toBe(true);
  });

  it("shrinkToFit drives text down to fit, floored at the autoFit minimum", () => {
    const t1 = mkField({
      fieldKey: "t1",
      type: "multiline",
      fontSizePx: 100,
      minFontSizePx: 10,
      width: 400,
    });
    const g = mkGroup({ children: ["t1"], x: 0, y: 1300, shrinkToFit: true });
    // 12 chars at 100px → 600 wide → wraps to 2 lines of 100px = 200 tall;
    // only 140px available below the anchor.
    const r = layout([t1], [g], { t1: "abcdef ghijk" });
    const rect = r.fieldRects.get(t1.id)!;
    expect(rect.y + rect.height).toBeLessThanOrEqual(1440);
    expect(r.fontSizes.get(t1.id)!).toBeLessThan(100);
    expect(r.fontSizes.get(t1.id)!).toBeGreaterThanOrEqual(10);
  });
});

describe("text semantics", () => {
  it("renders the exact text the renderer paints (static, placeholder, label)", () => {
    expect(renderedText(mkField({ static: true, staticValue: "Fixed" }), "typed")).toBe("Fixed");
    expect(renderedText(mkField({ static: true, label: "Logo" }), undefined)).toBe("Logo");
    expect(renderedText(mkField({ placeholder: "Type here" }), undefined)).toBe("Type here");
    expect(renderedText(mkField({ label: "Name" }), "Ada")).toBe("Ada");
  });

  it("wraps at explicit newlines and breaks overlong words", () => {
    const style = { lineHeight: 1 };
    expect(wrapLines("a b\nc", 1000, style, 20, measure)).toEqual(["a b", "c"]);
    // 30-char word at 20px → 300px wide, box 100 → chunks of ≤10 chars.
    const lines = wrapLines("abcdefghijklmnopqrstuvwxyzabcd", 100, style, 20, measure);
    expect(lines.length).toBe(3);
    expect(lines.join("")).toBe("abcdefghijklmnopqrstuvwxyzabcd");
  });

  it("letter spacing widens lines and forces earlier wraps", () => {
    const noSpacing = wrapLines("aa bb cc", 60, { lineHeight: 1 }, 20, measure);
    const spaced = wrapLines("aa bb cc", 60, { lineHeight: 1, letterSpacingPx: 10 }, 20, measure);
    expect(spaced.length).toBeGreaterThan(noSpacing.length);
  });

  it("normalizes center-anchored children through authoredRect", () => {
    const f = mkField({ x: 100, y: 100, width: 50, height: 20, anchor: "center" });
    expect(authoredRect(f)).toEqual({ x: 75, y: 90, width: 50, height: 20 });
  });
});
