import { describe, expect, it } from "vitest";
import type { TemplateField } from "../types";
import type { LineMeasurer } from "./autoFit";
import { fitTextWith, wrapLines } from "./autoFit";
import { computeLayout } from "./layout";

/** Deterministic fake glyphs, same convention as layout.test.ts: every
 * character is half the font size wide. */
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
  width: 600,
  height: 192,
  lineHeight: 1,
  fontSizePx: 48,
  ...over,
});

const canvas = { canvasWidth: 1440, canvasHeight: 1440 };
const layout = (fields: TemplateField[], values: Record<string, string> = {}) =>
  computeLayout({ fields, ...canvas }, values, null, measure);

// At 48px each char is 24px wide → 25 chars per line in a 600px box; the
// 192px box holds exactly 4 lines at lineHeight 1.
const words = "brand voice tools ship faster when every member can make the graphic themselves";
const entryOfLines = (n: number) => {
  // ~25 chars per line at 48px; build n lines' worth of words.
  let out = words;
  while (out.length < n * 25 - 12) out = `${out} ${words}`;
  return out.slice(0, n * 25 - 12).trimEnd();
};

describe("Free: the font size never changes; the box tracks content", () => {
  const cases: Array<[string, string]> = [
    ["empty", ""],
    ["one word", "hello"],
    ["one line", "twelve chars"],
    ["three lines", entryOfLines(3)],
    ["no spaces, must break", "x".repeat(60)],
    ["at maxLength", entryOfLines(6)],
  ];

  it("keeps the set size in all six cases and hugs the wrapped height", () => {
    for (const [, text] of cases) {
      const f = mkField({ type: "multiline", fieldKey: "m" });
      const r = layout([f], { m: text });
      expect(r.fontSizes.get(f.id)).toBe(48);
      const shown = text || f.label; // empty renders the label placeholder
      const lines = wrapLines(shown, 600, { lineHeight: 1 }, 48, measure).length;
      expect(r.fieldRects.get(f.id)!.height).toBe(lines * 48);
    }
  });

  it("grows down from top, up from bottom, both ways from middle", () => {
    // Authored box y=400 h=192; content = 2 lines = 96 tall.
    const text = entryOfLines(2);
    for (const [va, expectedY] of [
      ["top", 400],
      ["middle", 400 + (192 - 96) / 2],
      ["bottom", 400 + 192 - 96],
    ] as const) {
      const f = mkField({ type: "multiline", fieldKey: "m", y: 400, verticalAlign: va });
      const r = layout([f], { m: text });
      expect(r.fieldRects.get(f.id)!.y).toBe(expectedY);
      expect(r.fieldRects.get(f.id)!.height).toBe(96);
    }
  });

  it("keeps the authored width — free means free vertically only", () => {
    const f = mkField({ type: "multiline", fieldKey: "m" });
    const r = layout([f], { m: entryOfLines(5) });
    expect(r.fieldRects.get(f.id)!.width).toBe(600);
  });
});

describe("Shrink, single-line: width binds, degrades smoothly", () => {
  const fit = (text: string, width = 600) =>
    fitTextWith(
      measure,
      { multiline: false, width, height: 90, fontSizePx: 48, textSizing: "shrink" },
      text,
    );

  it("holds the set size until the text would escape", () => {
    expect(fit("short").fontSizePx).toBe(48); // 5×24=120 ≤ 600
    expect(fit("a".repeat(25)).fontSizePx).toBe(48); // exactly 600
  });

  it("shrinks exactly at the box edge, then smoothly", () => {
    const sizes = [26, 30, 40, 60].map((n) => fit("a".repeat(n)).fontSizePx);
    expect(sizes[0]).toBeLessThan(48);
    // Monotonic, gradual — never a collapse to the floor.
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    expect(sizes[1]).toBe(Math.floor((48 * 25) / 30)); // exact ratio fit
    expect(fit("a".repeat(60)).overflows).toBe(false); // 20px ≥ the 18 floor
  });

  it("floors at the minimum and flags the overflow", () => {
    const r = fit("a".repeat(120));
    expect(r.fontSizePx).toBe(18);
    expect(r.overflows).toBe(true);
  });
});

describe("Shrink, multiline: the box height binds, wrapped at the box width", () => {
  const fit = (text: string, over: Partial<Parameters<typeof fitTextWith>[1]> = {}) =>
    fitTextWith(
      measure,
      {
        multiline: true,
        width: 600,
        height: 192,
        fontSizePx: 48,
        lineHeight: 1,
        textSizing: "shrink",
        ...over,
      },
      text,
    );

  it("holds the set size while the wrapped block fits — including a FULL box", () => {
    for (const n of [1, 2, 3, 4]) {
      const r = fit(entryOfLines(n));
      expect(r.fontSizePx).toBe(48);
      expect(r.overflows).toBe(false);
    }
  });

  it("five lines: steps down a little and fills without spilling", () => {
    const text = entryOfLines(5);
    const r = fit(text);
    expect(r.fontSizePx).toBeLessThan(48);
    expect(r.fontSizePx).toBeGreaterThan(38); // a step, not a collapse
    const lines = wrapLines(text, 600, { lineHeight: 1 }, r.fontSizePx, measure).length;
    expect(lines * r.fontSizePx).toBeLessThanOrEqual(192);
  });

  it("degrades smoothly toward ten lines — never one jump to the floor", () => {
    const sizes = [5, 6, 7, 8, 10].map((n) => fit(entryOfLines(n)).fontSizePx);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
      expect(sizes[i]).toBeGreaterThanOrEqual(18);
    }
    expect(new Set(sizes).size).toBeGreaterThan(2); // gradual, distinct steps
  });

  it("content beyond the floor overflows visibly and warns", () => {
    const f = mkField({
      type: "multiline",
      fieldKey: "m",
      label: "Body",
      textSizing: "shrink",
      minFontSizePx: 18,
    });
    const text = entryOfLines(30);
    const direct = fit(text, { minFontSizePx: 18 });
    expect(direct.fontSizePx).toBe(18);
    expect(direct.overflows).toBe(true);
    const r = layout([f], { m: text });
    expect(r.warnings.some((w) => w.includes("Body") && w.includes("minimum"))).toBe(true);
    // The box itself never changes — no clipping happens at the rect level.
    expect(r.fieldRects.get(f.id)!.height).toBe(192);
  });

  it("the size at rest (empty entry) is the admin's set size", () => {
    expect(fit("").fontSizePx).toBe(48);
  });

  it("a single unbreakable word shrinks until it fits the width", () => {
    // 30 chars × 24px = 720 > 600 at 48px; fits whole at 40 (30 × 20 = 600).
    const r = fit("w".repeat(30));
    expect(r.fontSizePx).toBe(40);
    expect(r.overflows).toBe(false);
  });

  it("hard line breaks are respected by the fit", () => {
    // 8 short paragraphs: 8 lines even though each is narrow → must shrink
    // to 24px (8 × 24 = 192) despite tiny line widths.
    const r = fit(Array.from({ length: 8 }, (_, i) => `p${i}`).join("\n"));
    expect(r.fontSizePx).toBe(24);
  });

  it("empty lines occupy line boxes consistently in sizing and height", () => {
    const text = "a\n\nb"; // 3 line boxes
    expect(wrapLines(text, 600, {}, 48, measure)).toEqual(["a", "", "b"]);
    const r = fit(text);
    expect(r.fontSizePx).toBe(48); // 3 × 48 = 144 ≤ 192
    const five = fit("a\n\n\n\n\nb"); // 6 line boxes → must shrink to 32
    expect(five.fontSizePx).toBe(32);
  });

  it("uppercase and letter spacing participate in the measurement", () => {
    const plain = fit(entryOfLines(4));
    const spaced = fit(entryOfLines(4), { letterSpacingPx: 6 });
    expect(spaced.fontSizePx).toBeLessThan(plain.fontSizePx);
  });
});

describe("stacks: fixed boxes and hugging children coexist", () => {
  const mkGroup = (children: string[]) => ({
    id: "g1",
    name: "Group",
    mode: "stack" as const,
    direction: "vertical" as const,
    gap: 24,
    anchor: "start" as const,
    align: "start" as const,
    x: 100,
    y: 100,
    crossSize: 600,
    children,
  });

  it("a grouped multiline Shrink child contributes its fixed height", () => {
    const shrink = mkField({ type: "multiline", fieldKey: "s", textSizing: "shrink" });
    const after = mkField({ type: "text", fieldKey: "t", fontSizePx: 20 });
    const r = computeLayout(
      { fields: [shrink, after], layoutGroups: [mkGroup(["s", "t"])], ...canvas },
      { s: entryOfLines(2) }, // content would hug to 96 — the box stays 192
      null,
      measure,
    );
    expect(r.fieldRects.get(shrink.id)!.height).toBe(192);
    expect(r.fieldRects.get(after.id)!.y).toBe(100 + 192 + 24); // gap constant
  });

  it("a Free and a Shrink child in the same stack: both correct, gap constant", () => {
    const free = mkField({ type: "multiline", fieldKey: "fr" });
    const shrink = mkField({ type: "multiline", fieldKey: "sh", textSizing: "shrink" });
    const r = computeLayout(
      { fields: [free, shrink], layoutGroups: [mkGroup(["fr", "sh"])], ...canvas },
      { fr: entryOfLines(3), sh: entryOfLines(6) },
      null,
      measure,
    );
    const fr = r.fieldRects.get(free.id)!;
    const sh = r.fieldRects.get(shrink.id)!;
    expect(fr.height).toBe(3 * 48); // hugs at full size
    expect(r.fontSizes.get(free.id)).toBe(48);
    expect(sh.height).toBe(192); // fixed box
    expect(r.fontSizes.get(shrink.id)!).toBeLessThan(48); // shrank to fit it
    expect(sh.y - (fr.y + fr.height)).toBe(24);
  });
});

describe("shrink respects BOTH axes", () => {
  const base = { multiline: false, lineHeight: 1, textSizing: "shrink" as const };

  it("shrinks a line that fits the width but not the height", () => {
    // 5 chars at 200px = 500px wide (fits 1000), but the line box is 200px
    // tall in a 60px box — it must come down to 60.
    const fit = fitTextWith(
      measure,
      { ...base, width: 1000, height: 60, fontSizePx: 200, minFontSizePx: 8 },
      "Tall!",
    );
    expect(fit.fontSizePx).toBeLessThanOrEqual(60);
    expect(fit.overflows).toBe(false);
  });

  it("still shrinks on width when height is generous", () => {
    // 40 chars at 48px = 960px, box 600 wide → must come down to ~30.
    const fit = fitTextWith(
      measure,
      { ...base, width: 600, height: 1000, fontSizePx: 48, minFontSizePx: 8 },
      "x".repeat(40),
    );
    expect(fit.fontSizePx).toBe(30);
  });

  it("never grows past the set size, however roomy the box", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 4000, height: 4000, fontSizePx: 48, minFontSizePx: 8 },
      "Hi",
    );
    expect(fit.fontSizePx).toBe(48);
  });

  it("reports overflow when even the floor cannot fit", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 10, height: 10, fontSizePx: 48, minFontSizePx: 20 },
      "far too long for this",
    );
    expect(fit.fontSizePx).toBe(20);
    expect(fit.overflows).toBe(true);
  });
});

describe("fill sizes text to the box", () => {
  const base = { multiline: false, lineHeight: 1, textSizing: "fill" as const };

  it("grows a short line well past its set size", () => {
    // "Hi" is 2 chars → width allows size 300 (2 * 0.5 * 300 = 300px);
    // height 200 is the binding constraint at lineHeight 1.
    const fit = fitTextWith(
      measure,
      { ...base, width: 300, height: 200, fontSizePx: 20, minFontSizePx: 8 },
      "Hi",
    );
    expect(fit.fontSizePx).toBe(200);
    expect(fit.overflows).toBe(false);
  });

  it("is bound by whichever axis runs out first", () => {
    // 10 chars: width 300 allows 60px (10 * 0.5 * 60 = 300); height allows 500.
    const fit = fitTextWith(
      measure,
      { ...base, width: 300, height: 500, fontSizePx: 20, minFontSizePx: 8 },
      "x".repeat(10),
    );
    expect(fit.fontSizePx).toBe(60);
  });

  it("shrinks as well as grows — long content still fits", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 300, height: 100, fontSizePx: 200, minFontSizePx: 8 },
      "x".repeat(50),
    );
    expect(fit.fontSizePx).toBe(12); // 50 * 0.5 * 12 = 300
    expect(fit.overflows).toBe(false);
  });

  it("honours the floor and reports overflow below it", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 50, height: 50, fontSizePx: 20, minFontSizePx: 30 },
      "x".repeat(20),
    );
    expect(fit.fontSizePx).toBe(30);
    expect(fit.overflows).toBe(true);
  });

  it("fills a multiline box by wrapping, not by overflowing", () => {
    const fit = fitTextWith(
      measure,
      {
        multiline: true,
        lineHeight: 1,
        textSizing: "fill",
        width: 600,
        height: 192,
        fontSizePx: 10,
        minFontSizePx: 8,
      },
      entryOfLines(4),
    );
    // Bigger than the set 10px, and the wrapped block still fits the box.
    expect(fit.fontSizePx).toBeGreaterThan(10);
    const lines = wrapLines(
      entryOfLines(4),
      600,
      { lineHeight: 1 },
      fit.fontSizePx,
      measure,
    ).length;
    expect(lines * fit.fontSizePx).toBeLessThanOrEqual(192);
  });

  it("keeps the box as drawn, unlike free", () => {
    const filled = mkField({
      fieldKey: "fill_me",
      textSizing: "fill",
      static: true,
      staticValue: "Hi",
    });
    const r = layout([filled]).fieldRects.get(filled.id)!;
    expect(r.height).toBe(192); // the authored box, not a hugged line
    expect(r.width).toBe(600);
  });
});
