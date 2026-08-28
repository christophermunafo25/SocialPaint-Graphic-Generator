import { describe, expect, it } from "vitest";
import type { LayoutGroup, TemplateField } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { characterBudget, measureProposal } from "./measureProposal";
import { repairProposal } from "./repairProposal";
import { resolveFieldStyle } from "../brand/resolveStyle";

/** Deterministic fake glyphs, same convention as layout.test.ts: every
 * character is half the font size wide, with the size parsed straight out of
 * the shorthand the engine composes. */
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
  lineHeight: 1, // integer math in fixtures
  fontSizePx: 40,
  minFontSizePx: 18,
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

const schema = (fields: TemplateField[], layoutGroups?: LayoutGroup[]) => ({
  fields,
  layoutGroups,
  canvasWidth: 1440,
  canvasHeight: 1440,
});

// With 20px glyphs at size 40 in a 400px box: 20 chars fit at the set size,
// 44 fit at the 18px floor.
const shrinkField = (over: Partial<TemplateField> = {}) =>
  mkField({ fieldKey: "headline", textSizing: "shrink", ...over });

const words = (n: number) => Array(n).fill("aaaaa").join(" ");

describe("shrink mode", () => {
  it("classifies fits, shrinks acceptably, and overflows", () => {
    const fits = measureProposal(
      schema([shrinkField()]),
      { headline: "x".repeat(10) },
      null,
      measure,
    );
    expect(fits.fields[0].fit).toBe("fits");
    expect(fits.ok).toBe(true);

    const shrinks = measureProposal(
      schema([shrinkField()]),
      { headline: "x".repeat(30) },
      null,
      measure,
    );
    expect(shrinks.fields[0].fit).toBe("shrinks");
    expect(shrinks.ok).toBe(true);

    const over = measureProposal(
      schema([shrinkField()]),
      { headline: "x".repeat(50) },
      null,
      measure,
    );
    expect(over.fields[0].fit).toBe("overflows");
    expect(over.ok).toBe(false);
  });

  it("derives the character budget from measurement, with the safety margin", () => {
    const field = shrinkField();
    const value = "x".repeat(50);
    // 44 characters fit at the 18px floor; 90% of that is 39.
    const budget = characterBudget(
      schema([field]),
      { headline: value },
      null,
      measure,
      field,
      resolveFieldStyle(field, null),
      value,
    );
    expect(budget).toBe(39);
  });

  it("classifies a multiline box the same way", () => {
    const field = shrinkField({ fieldKey: "body", type: "multiline", height: 80 });
    expect(measureProposal(schema([field]), { body: words(2) }, null, measure).fields[0].fit).toBe(
      "fits",
    );
    expect(measureProposal(schema([field]), { body: words(9) }, null, measure).fields[0].fit).toBe(
      "shrinks",
    );
    const over = measureProposal(schema([field]), { body: words(60) }, null, measure);
    expect(over.fields[0].fit).toBe("overflows");
    expect(over.fields[0].characterBudget).toBeGreaterThan(0);
  });
});

describe("free mode", () => {
  it("flags a multiline box growing past its authored height", () => {
    const field = mkField({ fieldKey: "body", type: "multiline", height: 80 });
    // 2 lines of 40px fill the 80px box exactly; 3 lines grow past it.
    expect(measureProposal(schema([field]), { body: words(2) }, null, measure).fields[0].fit).toBe(
      "fits",
    );
    expect(measureProposal(schema([field]), { body: words(9) }, null, measure).fields[0].fit).toBe(
      "overflows",
    );
  });

  it("flags a single line wider than its box", () => {
    const field = mkField({ fieldKey: "name" });
    expect(
      measureProposal(schema([field]), { name: "x".repeat(10) }, null, measure).fields[0].fit,
    ).toBe("fits");
    expect(
      measureProposal(schema([field]), { name: "x".repeat(30) }, null, measure).fields[0].fit,
    ).toBe("overflows");
  });
});

describe("grouped fields", () => {
  it("marks members of a canvas-overflowing stack even when each fits its own box", () => {
    const a = mkField({ fieldKey: "a" });
    const b = mkField({ fieldKey: "b" });
    // Two hugged single lines (40px each) plus the 24px gap from y=1400 runs
    // to 1504 on a 1440 canvas.
    const group = mkGroup({ children: ["a", "b"], y: 1400 });
    const out = measureProposal(schema([a, b], [group]), { a: "aaaa", b: "bbbb" }, null, measure);
    expect(out.fields.map((f) => f.fit)).toEqual(["overflows", "overflows"]);
    // A single line contributes a constant height to the stack, so no prefix
    // of either value can fix it — the honest budget is zero.
    expect(out.fields[0].characterBudget).toBe(0);
    expect(out.ok).toBe(false);
  });

  it("derives a group-aware budget when shortening genuinely frees space", () => {
    // A free multiline that fits its own 200px box at 3 lines (120px), but
    // whose stack starts at y=1340: 3 lines run to 1460, 2 lines to 1420.
    const story = mkField({ fieldKey: "story", type: "multiline", height: 200 });
    const group = mkGroup({ children: ["story"], y: 1340 });
    const value = words(9);
    const out = measureProposal(schema([story], [group]), { story: value }, null, measure);
    expect(out.fields[0].fit).toBe("overflows");
    expect(out.fields[0].characterBudget).toBeGreaterThan(0);
    expect(out.fields[0].characterBudget).toBeLessThan(value.length);
  });
});

describe("coverage boundaries", () => {
  it("measures only filled, member-editable text fields", () => {
    const out = measureProposal(
      schema([
        mkField({ fieldKey: "headline", textSizing: "shrink" }),
        mkField({ fieldKey: "empty" }),
        mkField({ fieldKey: "dept", type: "select", options: ["Nursing"] }),
        mkField({ fieldKey: "photo", type: "image" }),
        mkField({ fieldKey: "footer", static: true, staticValue: "x".repeat(80) }),
      ]),
      { headline: "Now hiring", dept: "Nursing", photo: "data:image/png;base64,AAAA" },
      null,
      measure,
    );
    expect(out.fields.map((f) => f.fieldKey)).toEqual(["headline"]);
  });
});

describe("the repair round", () => {
  const proposalOf = (value: string) => ({ templateId: "t1", values: { headline: value } });

  it("does not call repair when everything fits", async () => {
    let calls = 0;
    const out = await repairProposal(
      proposalOf("x".repeat(10)),
      schema([shrinkField()]),
      null,
      measure,
      async () => {
        calls++;
        return {};
      },
    );
    expect(out).toMatchObject({ ok: true, repaired: false });
    expect(calls).toBe(0);
  });

  it("fixes a synthetic overlong value in one round", async () => {
    const out = await repairProposal(
      proposalOf("x".repeat(50)),
      schema([shrinkField()]),
      null,
      measure,
      async (templateId, fields) => {
        expect(templateId).toBe("t1");
        expect(fields).toEqual([
          { fieldKey: "headline", value: "x".repeat(50), characterBudget: 39 },
        ]);
        return { headline: "x".repeat(20) };
      },
    );
    expect(out.ok).toBe(true);
    expect(out.repaired).toBe(true);
    expect(out.values.headline).toBe("x".repeat(20));
  });

  it("reports failure when the rewrite still overflows", async () => {
    const out = await repairProposal(
      proposalOf("x".repeat(50)),
      schema([shrinkField()]),
      null,
      measure,
      async () => ({ headline: "x".repeat(48) }),
    );
    expect(out.ok).toBe(false);
    expect(out.repaired).toBe(true);
  });

  it("reports failure when the repair call itself fails", async () => {
    const out = await repairProposal(
      proposalOf("x".repeat(50)),
      schema([shrinkField()]),
      null,
      measure,
      async () => {
        throw new Error("network");
      },
    );
    expect(out.ok).toBe(false);
    expect(out.values.headline).toBe("x".repeat(50));
  });
});
