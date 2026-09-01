import { describe, expect, it } from "vitest";
import type { LayoutGroup, NewTemplateInput, TemplateField } from "../types";
import { reflowTemplate, versionName } from "./reflow";
import { rescaleTemplate } from "./rescale";

const field = (extra: Partial<TemplateField> = {}): TemplateField => ({
  id: "f1",
  label: "Headline",
  type: "text",
  fieldKey: "headline",
  x: 60,
  y: 60,
  width: 300,
  height: 90,
  ...extra,
});

const draft = (extra: Partial<NewTemplateInput> = {}): NewTemplateInput => ({
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

// 1080×1080 → 1080×1920: sx = 1, sy = 16/9, u = 1. Sizes must not change;
// only placement does.
const STORY = { width: 1080, height: 1920 };

describe("reflowTemplate — anchor inference", () => {
  it("keeps a top-left field against the top-left, distance scaled by u", () => {
    // Center (210, 105) → fractions ~0.19, ~0.10 — start/start.
    const { draft: out } = reflowTemplate(draft({ fields: [field()] }), STORY);
    expect(out.fields[0]).toMatchObject({ x: 60, y: 60, width: 300, height: 90 });
  });

  it("keeps a bottom-right field's distance from the bottom-right", () => {
    // Box at (720, 900)–(1020, 990): center fractions ~0.81, ~0.88 — end/end.
    const f = field({ x: 720, y: 900 });
    const { draft: out } = reflowTemplate(draft({ fields: [f] }), STORY);
    // Right gap 60 and bottom gap 90 survive (u = 1); the bottom edge moved.
    expect(out.fields[0].x).toBe(720);
    expect(out.fields[0].y).toBe(1920 - 90 - 90);
  });

  it("keeps a centered field's center fraction", () => {
    const f = field({ x: 390, y: 495 }); // center exactly (540, 540)
    const { draft: out } = reflowTemplate(draft({ fields: [f] }), STORY);
    expect(out.fields[0].x).toBe(390); // horizontal center of 1080 unchanged
    expect(out.fields[0].y).toBe(960 - 45); // vertical center of 1920
  });

  it("honors anchor='center' fields (x/y are the box center)", () => {
    const f = field({ anchor: "center", x: 540, y: 540 });
    const { draft: out } = reflowTemplate(draft({ fields: [f] }), STORY);
    expect(out.fields[0].x).toBe(540);
    expect(out.fields[0].y).toBe(960);
  });

  it("never distorts: sizes scale by min(sx, sy) even for plain rects", () => {
    // 1080×1080 → 2160×1920: sx = 2, sy = 16/9, u = 16/9.
    const { draft: out } = reflowTemplate(draft({ fields: [field()] }), {
      width: 2160,
      height: 1920,
    });
    expect(out.fields[0].width).toBe(Math.round(300 * (16 / 9)));
    expect(out.fields[0].height).toBe(160);
  });

  it("scales type by u and leaves lineHeight alone", () => {
    const f = field({ fontSizePx: 45, letterSpacingPx: 1.5, lineHeight: 1.2 });
    const { draft: out } = reflowTemplate(draft({ fields: [f] }), {
      width: 2160,
      height: 1920, // u = 16/9
    });
    expect(out.fields[0].fontSizePx).toBe(80);
    expect(out.fields[0].letterSpacingPx).toBe(2.67);
    expect(out.fields[0].lineHeight).toBe(1.2);
  });
});

describe("reflowTemplate — warnings", () => {
  it("warns for every rotated and aspect-locked field, naming them", () => {
    const d = draft({
      fields: [
        field({ id: "a", fieldKey: "a", label: "Badge", rotation: 12 }),
        field({ id: "b", fieldKey: "b", label: "Headshot", type: "image", aspectRatio: 1 }),
        field({ id: "c", fieldKey: "c", label: "Plain" }),
      ],
    });
    const { warnings } = reflowTemplate(d, STORY);
    expect(warnings.map((w) => w.reason).sort()).toEqual(["aspect-locked", "rotated"]);
    expect(warnings.map((w) => w.fieldId).sort()).toEqual(["a", "b"]);
    expect(warnings[0].message).toContain("Badge");
  });

  it("emits no warnings for a same-aspect target", () => {
    const d = draft({ fields: [field({ rotation: 12 })] });
    const { warnings } = reflowTemplate(d, { width: 1440, height: 1440 });
    expect(warnings).toEqual([]);
  });
});

describe("reflowTemplate — same-aspect degrades to rescale", () => {
  it("returns exactly what rescaleTemplate returns", () => {
    const d = draft({
      fields: [field({ fontSizePx: 45, cornerRadius: { tl: 8, tr: 8, br: 8, bl: 8 } })],
    });
    const target = { width: 1440, height: 1440 };
    expect(reflowTemplate(d, target)).toEqual(rescaleTemplate(d, target));
  });
});

describe("reflowTemplate — layout groups", () => {
  const group = (extra: Partial<LayoutGroup> = {}): LayoutGroup => ({
    id: "g1",
    name: "Stack",
    direction: "vertical",
    gap: 24,
    anchor: "end",
    align: "center",
    x: 90,
    y: 1020, // bottom edge, 60 from the canvas bottom
    crossSize: 900,
    children: ["headline"],
    ...extra,
  });

  it("places a stack frame by its DECLARED main-axis anchor", () => {
    const d = draft({ fields: [field()], layoutGroups: [group()] });
    const { draft: out } = reflowTemplate(d, STORY);
    const g = out.layoutGroups![0];
    // anchor "end": the bottom-edge distance (60) survives at u = 1.
    expect(g.y).toBe(1920 - 60);
    // Cross axis: centered 900-wide frame stays centered.
    expect(g.x).toBe(90);
    expect(g.crossSize).toBe(900);
    expect(g.gap).toBe(24);
  });

  it("scales stack children's size but leaves placement to the layout", () => {
    const d = draft({ fields: [field()], layoutGroups: [group()] });
    const { draft: out } = reflowTemplate(d, { width: 2160, height: 1920 }); // u = 16/9
    // The child is stack-positioned; its box size scaled uniformly.
    expect(out.fields[0].width).toBe(Math.round(300 * (16 / 9)));
    expect(out.fields[0].height).toBe(160);
  });

  it("reflows free-group children individually, like ungrouped fields", () => {
    const d = draft({
      fields: [field({ x: 720, y: 900 })],
      layoutGroups: [group({ mode: "free" })],
    });
    const { draft: out } = reflowTemplate(d, STORY);
    // end/end inference applies — a free group's frame follows its children.
    expect(out.fields[0].y).toBe(1920 - 90 - 90);
  });
});

describe("versionName", () => {
  it("names from the size's meaning, first segment only", () => {
    expect(versionName("Hiring announcement", { width: 1080, height: 1920 })).toBe(
      "Hiring announcement — Story",
    );
    expect(versionName("Hiring announcement", { width: 1080, height: 1350 })).toBe(
      "Hiring announcement — Portrait post",
    );
  });

  it("falls back to dimensions for a size the catalogue doesn't know", () => {
    expect(versionName("Promo", { width: 999, height: 777 })).toBe("Promo — 999×777");
  });
});
