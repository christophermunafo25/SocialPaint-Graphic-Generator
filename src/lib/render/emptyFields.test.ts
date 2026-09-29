import { describe, expect, it } from "vitest";
import type { LayoutGroup, TemplateField, TemplateSchema } from "../types";
import { DEFAULT_MIN_FONT_SIZE, fitTextWith, minFontSizeFor, type LineMeasurer } from "./autoFit";
import { computeLayout, type LayoutOptions } from "./layout";
import { isLeftOff, paintsNothing } from "./emptyFields";
import { measureProposal } from "../generate/measureProposal";
import { hiddenFieldKeys } from "../templates/variants";

/** Same fake glyphs as layout.test.ts: every character is half the font
 * size wide, parsed out of the canvas shorthand. */
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
  lineHeight: 1,
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
  groups: LayoutGroup[] | undefined,
  values: Record<string, string>,
  opts?: LayoutOptions,
) => computeLayout({ fields, layoutGroups: groups, ...canvas }, values, null, measure, opts);

describe("minFontSizeFor", () => {
  it("a relative floor is a share of the set size, rounded, never under 1px", () => {
    expect(minFontSizeFor({ minFontScale: 0.75 }, 48)).toBe(36);
    expect(minFontSizeFor({ minFontScale: 0.75 }, 45)).toBe(34);
    expect(minFontSizeFor({ minFontScale: 0.25 }, 2)).toBe(1);
  });

  it("the relative floor wins over an absolute one", () => {
    expect(minFontSizeFor({ minFontScale: 0.5, minFontSizePx: 30 }, 48)).toBe(24);
  });

  it("old templates keep their absolute floor, then 18px", () => {
    expect(minFontSizeFor({ minFontSizePx: 12 }, 48)).toBe(12);
    expect(minFontSizeFor({}, 48)).toBe(DEFAULT_MIN_FONT_SIZE);
  });
});

describe("fitting with a relative floor", () => {
  const box = { multiline: false, width: 600, height: 90, fontSizePx: 48 } as const;
  const long = "x".repeat(60); // 60 × 24 = 1440 wide at 48px: far too long

  it("shrink stops at 75% of the set size", () => {
    const fit = fitTextWith(measure, { ...box, textSizing: "shrink", minFontScale: 0.75 }, long);
    expect(fit.fontSizePx).toBe(36);
    expect(fit.overflows).toBe(true);
  });

  it("fill uses the same floor, measured from the set size", () => {
    const fit = fitTextWith(measure, { ...box, textSizing: "fill", minFontScale: 0.75 }, long);
    expect(fit.fontSizePx).toBe(36);
    expect(fit.overflows).toBe(true);
  });

  it("an old 18px floor and no floor at all fit exactly as before", () => {
    const withFloor = fitTextWith(
      measure,
      { ...box, textSizing: "shrink", minFontSizePx: 18 },
      long,
    );
    const without = fitTextWith(measure, { ...box, textSizing: "shrink" }, long);
    // 600 / (60 × 0.5) = 20px fits the width, above the 18px floor.
    expect(withFloor).toEqual({ fontSizePx: 20, overflows: false });
    expect(without).toEqual({ fontSizePx: 20, overflows: false });
  });

  it("the layout warning names the relative floor in px", () => {
    const f = mkField({
      fieldKey: "h",
      label: "Headline",
      width: 600,
      height: 90,
      fontSizePx: 48,
      textSizing: "shrink",
      minFontScale: 0.75,
    });
    const r = layout([f], undefined, { h: long });
    expect(r.fontSizes.get(f.id)).toBe(36);
    expect(r.warnings.some((w) => w.includes("Headline") && w.includes("(36px)"))).toBe(true);
  });
});

describe("a group's shrinkToFit honors the relative floor", () => {
  it("a grouped field with a 75% floor never drops below it", () => {
    const t1 = mkField({
      fieldKey: "t1",
      type: "multiline",
      fontSizePx: 100,
      minFontScale: 0.75,
      width: 400,
    });
    const g = mkGroup({ children: ["t1"], x: 0, y: 1300, shrinkToFit: true });
    const r = layout([t1], [g], { t1: "abcdef ghijk" });
    expect(r.fontSizes.get(t1.id)).toBe(75);
    expect(r.warnings.some((w) => w.includes("cannot shrink"))).toBe(true);
  });

  it("an old grouped field with only an 18px floor lands exactly where it did", () => {
    const t1 = mkField({ fieldKey: "t1", type: "multiline", fontSizePx: 100, minFontSizePx: 18 });
    const g = mkGroup({ children: ["t1"], x: 0, y: 1300, shrinkToFit: true });
    const r = layout([t1], [g], { t1: "abcdef ghijk" });
    // Pinned from the pre-change engine: 12 chars wrap to two 100px lines,
    // 140px below the anchor; one proportional step lands on 70px.
    expect(r.fontSizes.get(t1.id)).toBe(70);
    expect(r.fieldRects.get(t1.id)).toEqual({ x: 0, y: 1300, width: 400, height: 140 });
    expect(r.warnings).toEqual([]);
  });
});

describe("empty member fields", () => {
  const headline = () => mkField({ fieldKey: "headline", y: 0 });
  const city = () => mkField({ fieldKey: "city", optional: true });
  const link = () => mkField({ fieldKey: "link" });

  it("isLeftOff: only an empty optional member field, only outside placeholder mode", () => {
    const opt = city();
    expect(isLeftOff(opt, "", "placeholder")).toBe(false);
    expect(isLeftOff(opt, undefined, undefined)).toBe(false);
    expect(isLeftOff(opt, "", "hideOptional")).toBe(true);
    expect(isLeftOff(opt, "", "chat")).toBe(true);
    expect(isLeftOff(opt, "Austin", "chat")).toBe(false);
    expect(isLeftOff(link(), "", "chat")).toBe(false);
    expect(isLeftOff({ ...opt, static: true }, "", "chat")).toBe(false);
  });

  it("paintsNothing: an empty required member field, in a chat only", () => {
    expect(paintsNothing(link(), "", "chat")).toBe(true);
    expect(paintsNothing(link(), "", "hideOptional")).toBe(false);
    expect(paintsNothing(link(), "x", "chat")).toBe(false);
    expect(paintsNothing({ ...link(), static: true }, "", "chat")).toBe(false);
  });

  it("an empty optional field is neither measured nor placed, and its stack closes up", () => {
    const h = headline();
    const c = city();
    const l = link();
    const g = mkGroup({ children: ["headline", "city", "link"], x: 0, y: 0 });
    const values = { headline: "Hi", link: "x.com" };

    const today = layout([h, c, l], [g], values);
    expect(today.fieldRects.has(c.id)).toBe(true);

    const r = layout([h, c, l], [g], values, { emptyFields: "hideOptional" });
    expect(r.fieldRects.has(c.id)).toBe(false);
    expect(r.fontSizes.has(c.id)).toBe(false);
    // headline (40) + gap (24) → link starts at 64, where city used to sit.
    expect(r.fieldRects.get(l.id)!.y).toBe(64);
    expect(r.warnings).toEqual([]);
  });

  it("under chat an empty required field keeps its placeholder-sized slot", () => {
    const h = headline();
    const l = { ...link(), placeholder: "Apply link" };
    const g = mkGroup({ children: ["headline", "link"], x: 0, y: 0 });
    const r = layout([h, l], [g], { headline: "Hi" }, { emptyFields: "chat" });
    expect(r.fieldRects.get(l.id)).toEqual(
      layout([h, l], [g], { headline: "Hi" }).fieldRects.get(l.id),
    );
  });

  it("a field the look hides is skipped silently; a true dangling ref still warns", () => {
    const h = headline();
    const g = mkGroup({ children: ["headline", "photo", "ghost"], x: 0, y: 0 });
    const r = layout([h], [g], { headline: "Hi" }, { hiddenKeys: new Set(["photo"]) });
    expect(r.warnings.some((w) => w.includes('"photo"'))).toBe(false);
    expect(r.warnings.filter((w) => w.includes('"ghost"')).length).toBe(1);
  });

  it("hiddenFieldKeys reads the look's hidden overrides", () => {
    const schema: Pick<TemplateSchema, "variants"> = {
      variants: [
        { id: "a", name: "Light", overrides: {} },
        {
          id: "b",
          name: "Dark",
          overrides: { photo: { hidden: true }, headline: { opacity: 50 } },
        },
      ],
    };
    expect([...hiddenFieldKeys(schema, "b")]).toEqual(["photo"]);
    expect(hiddenFieldKeys(schema, "a").size).toBe(0);
    expect(hiddenFieldKeys({}, "b").size).toBe(0);
  });

  it("measureProposal measures a stack the way the surface paints it", () => {
    // Two lines fit the canvas only once the empty optional line is left off.
    const h = mkField({ fieldKey: "headline", height: 600, type: "image" });
    const c = mkField({ fieldKey: "city", optional: true, placeholder: "City" });
    const b = mkField({ fieldKey: "body" });
    const g = mkGroup({ children: ["headline", "city", "body"], x: 0, y: 700 });
    const schema = { fields: [h, c, b], layoutGroups: [g], ...canvas };
    const values = { body: "Now hiring" };
    // 700 + 600 + 24 + 40 + 24 + 40 = 1428 fits; with city's slot it is 1492.
    expect(measureProposal(schema, values, null, measure).ok).toBe(true);
    const tall = { ...schema, fields: [{ ...h, height: 660 }, c, b] };
    expect(measureProposal(tall, values, null, measure).ok).toBe(false);
    expect(measureProposal(tall, values, null, measure, { emptyFields: "hideOptional" }).ok).toBe(
      true,
    );
  });
});
