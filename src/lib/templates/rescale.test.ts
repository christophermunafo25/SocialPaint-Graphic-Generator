import { describe, expect, it } from "vitest";
import type { LayoutGroup, NewTemplateInput, TemplateField } from "../types";
import { rescaleTemplate, sameAspect } from "./rescale";

const baseField = (extra: Partial<TemplateField> = {}): TemplateField => ({
  id: "f1",
  label: "Headline",
  type: "text",
  fieldKey: "headline",
  x: 100,
  y: 200,
  width: 400,
  height: 120,
  ...extra,
});

const baseDraft = (extra: Partial<NewTemplateInput> = {}): NewTemplateInput => ({
  companyId: "c1",
  name: "T",
  description: "",
  category: "",
  tags: [],
  status: "draft",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  ...extra,
});

describe("sameAspect", () => {
  it("accepts a uniform scale and rejects an aspect change", () => {
    expect(sameAspect({ width: 1080, height: 1080 }, { width: 1440, height: 1440 })).toBe(true);
    expect(sameAspect({ width: 1080, height: 1080 }, { width: 1080, height: 1920 })).toBe(false);
  });

  it("tolerates rounding-sized deviation (0.5%)", () => {
    // 1200×627 → 2400×1251 is off by well under half a percent.
    expect(sameAspect({ width: 1200, height: 627 }, { width: 2400, height: 1251 })).toBe(true);
  });
});

describe("rescaleTemplate — uniform scale", () => {
  const draft = baseDraft({
    fields: [
      baseField({
        fontSizePx: 48,
        minFontSizePx: 24,
        letterSpacingPx: 1.5,
        lineHeight: 1.2,
        cornerRadius: { tl: 12, tr: 12, br: 12, bl: 12 },
      }),
    ],
  });
  const { draft: out, warnings } = rescaleTemplate(draft, { width: 1440, height: 1440 });
  const f = out.fields[0];

  it("multiplies every geometric property by 4/3 and rounds once", () => {
    expect(out.canvasWidth).toBe(1440);
    expect(out.canvasHeight).toBe(1440);
    expect(f.x).toBe(133); // 100 × 4/3 = 133.33 → rounded once at the end
    expect(f.y).toBe(267);
    expect(f.width).toBe(533);
    expect(f.height).toBe(160);
    expect(f.fontSizePx).toBe(64);
    expect(f.minFontSizePx).toBe(32);
    expect(f.letterSpacingPx).toBe(2);
    expect(f.cornerRadius).toEqual({ tl: 16, tr: 16, br: 16, bl: 16 });
  });

  it("never scales lineHeight — it is a multiplier, not a length", () => {
    expect(f.lineHeight).toBe(1.2);
  });

  it("emits no warnings for a uniform scale", () => {
    expect(warnings).toEqual([]);
  });

  it("leaves properties that were absent absent", () => {
    expect("textGradient" in f).toBe(false);
    expect(f.fontWeight).toBeUndefined();
  });
});

describe("rescaleTemplate — non-uniform scale", () => {
  it("scales type by min(sx, sy) so text never outgrows a narrowed box", () => {
    // 1080×1080 → 1080×1920: sx = 1, sy ≈ 1.78, min = 1.
    const draft = baseDraft({
      fields: [baseField({ fontSizePx: 48, letterSpacingPx: 1.5 })],
    });
    const { draft: out } = rescaleTemplate(draft, { width: 1080, height: 1920 });
    const f = out.fields[0];
    expect(f.x).toBe(100); // sx = 1
    expect(f.y).toBe(356); // 200 × 1920/1080
    expect(f.width).toBe(400);
    expect(f.height).toBe(213); // 120 × 16/9
    expect(f.fontSizePx).toBe(48); // min(sx, sy) = 1
    expect(f.letterSpacingPx).toBe(1.5);
  });

  it("keeps a rotated field proportional and warns, naming it", () => {
    const draft = baseDraft({ fields: [baseField({ rotation: 15 })] });
    const { draft: out, warnings } = rescaleTemplate(draft, { width: 1080, height: 1920 });
    const f = out.fields[0];
    // Box scaled by min(sx, sy) = 1 on BOTH axes; position still per-axis.
    expect(f.width).toBe(400);
    expect(f.height).toBe(120);
    expect(f.y).toBe(356);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("rotated");
    expect(warnings[0].message).toContain("Headline");
  });

  it("keeps an aspect-locked image field proportional and warns", () => {
    const draft = baseDraft({
      fields: [baseField({ type: "image", aspectRatio: 1, label: "Headshot" })],
    });
    const { draft: out, warnings } = rescaleTemplate(draft, { width: 1080, height: 1920 });
    expect(out.fields[0].width).toBe(400);
    expect(out.fields[0].height).toBe(120);
    expect(out.fields[0].aspectRatio).toBe(1); // the guardrail itself is untouched
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("aspect-locked");
    expect(warnings[0].message).toContain("Headshot");
  });

  it("keeps an ellipse proportional and warns; a rect stretches silently", () => {
    const draft = baseDraft({
      fields: [
        baseField({ id: "e", fieldKey: "e", label: "Dot", type: "shape", shape: "ellipse" }),
        baseField({ id: "r", fieldKey: "r", label: "Bar", type: "shape", shape: "rect" }),
      ],
    });
    const { draft: out, warnings } = rescaleTemplate(draft, { width: 1080, height: 1920 });
    expect(out.fields[0].height).toBe(120); // uniform (min = 1)
    expect(out.fields[1].height).toBe(213); // rects may stretch
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("shaped");
  });

  it("does not warn about rotated fields when the scale is uniform", () => {
    const draft = baseDraft({ fields: [baseField({ rotation: 15 })] });
    const { warnings } = rescaleTemplate(draft, { width: 1440, height: 1440 });
    expect(warnings).toEqual([]);
  });
});

describe("rescaleTemplate — layout groups", () => {
  const group = (extra: Partial<LayoutGroup> = {}): LayoutGroup => ({
    id: "g1",
    name: "Stack",
    direction: "vertical",
    gap: 24,
    anchor: "start",
    align: "center",
    x: 90,
    y: 180,
    crossSize: 600,
    children: ["headline"],
    ...extra,
  });

  it("scales gap on the main axis and crossSize on the cross axis", () => {
    // 1080×1080 → 2160×1080: sx = 2, sy = 1.
    const draft = baseDraft({
      fields: [baseField()],
      layoutGroups: [
        group(),
        group({ id: "g2", direction: "horizontal", children: ["group:g1"] }),
      ],
    });
    const { draft: out } = rescaleTemplate(draft, { width: 2160, height: 1080 });
    const [v, hz] = out.layoutGroups!;
    // Vertical: gap runs along y (sy = 1), crossSize across x (sx = 2).
    expect(v.gap).toBe(24);
    expect(v.crossSize).toBe(1200);
    expect(v.x).toBe(180);
    expect(v.y).toBe(180);
    // Horizontal, including one nesting another: axes swap.
    expect(hz.gap).toBe(48);
    expect(hz.crossSize).toBe(600);
    // Non-geometry survives verbatim.
    expect(hz.children).toEqual(["group:g1"]);
  });

  it("leaves a draft with no groups without a layoutGroups key", () => {
    const { draft: out } = rescaleTemplate(baseDraft({ fields: [baseField()] }), {
      width: 1440,
      height: 1440,
    });
    expect("layoutGroups" in out).toBe(false);
  });
});

describe("rescaleTemplate — completeness", () => {
  /** EVERY TemplateField property, so adding one without deciding whether it
   * scales fails here at compile time (`Required<TemplateField>` stops
   * compiling) — the next person gets a build error, not a silent bug. */
  const fullField: Required<TemplateField> = {
    id: "f1",
    label: "Everything",
    type: "text",
    fieldKey: "everything",
    x: 100,
    y: 200,
    width: 400,
    height: 120,
    rotation: 0, // 0 keeps the scale per-axis; rotation itself must not scale
    flipX: false,
    flipY: false,
    anchor: "topLeft",
    zIndex: 3,
    static: false,
    staticValue: "",
    cornerRadius: { tl: 8, tr: 8, br: 8, bl: 8 },
    opacity: 80,
    shape: "rect",
    sourceNodeId: "1:2",
    typeStyleKey: "heading",
    fontFamily: "Inter",
    fontWeight: 700,
    fontStyle: "normal",
    fontStretch: "normal",
    fontSizePx: 48,
    minFontSizePx: 24,
    colorHex: "#112233",
    textGradient: { angle: 90, stops: [{ position: 0, color: "#000000" }] },
    align: "left",
    verticalAlign: "top",
    uppercase: false,
    letterSpacingPx: 2,
    lineHeight: 1.4,
    maxLength: 60,
    textSizing: "shrink",
    objectFit: "cover",
    aspectRatio: 1.5,
    options: ["a"],
    placeholder: "Type here",
    required: true,
  };

  /** The px-length properties that MUST change under a 2× scale. */
  const MUST_SCALE: Array<keyof TemplateField> = [
    "x",
    "y",
    "width",
    "height",
    "fontSizePx",
    "minFontSizePx",
    "letterSpacingPx",
    "cornerRadius",
  ];

  it("scales every geometric property and nothing else", () => {
    const draft = baseDraft({ fields: [fullField] });
    const { draft: out } = rescaleTemplate(draft, { width: 2160, height: 2160 });
    const f = out.fields[0];
    for (const key of MUST_SCALE) {
      expect(f[key], `expected ${key} to scale`).not.toEqual(fullField[key]);
    }
    for (const key of Object.keys(fullField) as Array<keyof TemplateField>) {
      if (MUST_SCALE.includes(key)) continue;
      expect(f[key], `expected ${key} to survive unchanged`).toEqual(fullField[key]);
    }
    expect(f.cornerRadius).toEqual({ tl: 16, tr: 16, br: 16, bl: 16 });
  });

  it("2.1's exact factors: type and radii by min(sx, sy), boxes per axis", () => {
    // rotation 0, type "text", shape "rect": none of the uniform-only cases
    // apply, so the box scales per axis while type scales by min(sx, sy).
    const draft = baseDraft({ fields: [{ ...fullField }] });
    const { draft: out } = rescaleTemplate(draft, { width: 2160, height: 1080 }); // sx 2, sy 1
    const f = out.fields[0];
    expect(f.x).toBe(200);
    expect(f.y).toBe(200);
    expect(f.width).toBe(800);
    expect(f.height).toBe(120);
    expect(f.fontSizePx).toBe(48); // min(2, 1) = 1
    expect(f.letterSpacingPx).toBe(2);
    expect(f.cornerRadius).toEqual({ tl: 8, tr: 8, br: 8, bl: 8 });
    expect(f.lineHeight).toBe(1.4);
  });
});
