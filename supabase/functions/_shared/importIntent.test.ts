import { describe, expect, it } from "vitest";
import { importFrame } from "./importFrame.ts";
import {
  MAX_ASKED,
  IntentProposalError,
  NO_MODEL_COST,
  applyIntentProposal,
  applyKitLogos,
  intentAsk,
  intentReport,
  intentTool,
  intentUserText,
  styleMismatch,
  type KitTypeStyle,
} from "./importIntent.ts";
import { portraitWithPlate, UNKEYED_NAMES } from "./intentFixtures.ts";
import type { ImportWarning, SuggestedField } from "./extract.ts";

const BRAND = {
  colors: [
    { key: "ink", name: "Ink", hex: "#0C3654" },
    { key: "peach", name: "Peach", hex: "#FFE0CF" },
  ],
  typeStyles: [] as KitTypeStyle[],
  catalog: [],
};

/** An import and the pass's view of it. */
function setup(names?: Parameters<typeof portraitWithPlate>[0]) {
  const frame = importFrame(portraitWithPlate(names));
  const ask = intentAsk(frame.fields, frame.intents);
  const elementOf = (label: string) => {
    const field = frame.fields.find((f) => f.label === label)!;
    return [...ask.fieldIdByElement].find(([, id]) => id === field.id)![0];
  };
  const apply = (proposal: unknown, brand = BRAND, mode: "template" | "elements" = "template") =>
    applyIntentProposal(proposal, {
      mode,
      fields: frame.fields,
      intents: frame.intents,
      ask,
      brand,
    });
  const field = (id: string) => frame.fields.find((f) => f.sourceNodeId === id)!;
  return { ...frame, ask, elementOf, apply, field };
}

const TEMPLATE = {
  name: "Doctor topic",
  description: "A question a doctor answers.",
  category: "Education",
  tags: ["topic"],
  captionTemplate: "{headline} {nobody}",
};

describe("what the model is asked", () => {
  it("asks about text and images, text first, and never about shapes", () => {
    const { ask } = setup();
    expect(ask.elements.map((e) => [e.sourceId, e.kind, e.layer])).toEqual([
      [
        "e1",
        "text",
        "headline · text · edit=member · max=32 · lines=3 · text=on-accent · align=left",
      ],
      ["e2", "text", "cta · pill · fill=card · edit=fixed"],
      ["e3", "image", "photo-fill · image · fit=cover · edit=member"],
      ["e4", "image", "logo · logo · variant=primary · surface=light · edit=fixed"],
    ]);
    expect(ask.skipped).toBe(0);
  });

  it("sends the copy, the type and what the layer declares, with rounded boxes", () => {
    const { ask } = setup();
    expect(ask.elements[0]).toMatchObject({
      text: "Is it time to drop the naps?",
      multiline: true,
      fontFamily: "Newsreader",
      fontSizePx: 88,
      x: 133,
      y: 855,
      declared: { role: "headline", kind: "text", edit: "member", max: 32, lines: 3 },
    });
    expect(ask.elements[1]).toMatchObject({
      plated: true,
      declared: { role: "cta", kind: "pill", edit: "member", max: 24 },
    });
  });

  it("declares nothing for an unkeyed frame", () => {
    const { ask } = setup({ names: UNKEYED_NAMES });
    expect(ask.elements.every((e) => e.declared === undefined)).toBe(true);
    expect(ask.elements[0].text).toBe("Is it time to drop the naps?");
  });

  it("asks about forty at most and counts the rest", () => {
    const base = importFrame(portraitWithPlate()).fields.find((f) => f.type === "multiline")!;
    const many: SuggestedField[] = Array.from({ length: MAX_ASKED + 5 }, (_, i) => ({
      ...base,
      id: `f${i}`,
      sourceNodeId: `n${i}`,
      fieldKey: `k${i}`,
      y: i,
    }));
    const ask = intentAsk(many, []);
    expect(ask.elements).toHaveLength(MAX_ASKED);
    expect(ask.skipped).toBe(5);
  });

  it("asks for template details only when a template lands", () => {
    expect(intentTool("template").input_schema.required).toContain("template");
    const elements = intentTool("elements");
    expect(elements.input_schema.required).not.toContain("template");
    expect(elements.input_schema.properties).not.toHaveProperty("template");
    const entry = intentTool("template").input_schema.properties.fields.items.properties;
    expect(Object.keys(entry)).not.toContain("maxLength");
    expect(Object.keys(entry)).not.toContain("box");
    expect(Object.keys(entry)).not.toContain("colorKey");
  });

  it("writes the request without geometry instructions for the model to follow", () => {
    const { ask } = setup();
    const text = intentUserText({
      mode: "elements",
      frameName: "P15",
      canvasWidth: 1080,
      canvasHeight: 1350,
      elements: ask.elements,
      brand: BRAND,
      hint: "For the clinic",
    });
    expect(text).toContain("Source: figma");
    expect(text).toContain('"sourceId":"e1"');
    expect(text).toContain("no template details");
    expect(text).toContain("Admin's note: For the clinic");
  });
});

describe("applying the answer", () => {
  it("keeps what the layer names decided, whatever the model says", () => {
    const s = setup();
    const before = structuredClone(s.fields);
    const out = s.apply({
      fields: [
        // The model calls the member headline Fixed and the fixed logo a
        // member field. Neither is its call.
        {
          sourceId: s.elementOf("Headline"),
          label: "Question",
          fieldKey: "question",
          type: "text",
          static: true,
        },
        {
          sourceId: s.elementOf("Logo"),
          label: "Clinic logo",
          fieldKey: "clinic_logo",
          type: "image",
          static: false,
        },
      ],
      template: TEMPLATE,
      rationale: [],
    });
    const headline = s.field("33:18");
    expect(headline).toMatchObject({ label: "Question", fieldKey: "question", type: "multiline" });
    expect(headline.static).toBeUndefined();
    expect(headline.maxLength).toBe(32);
    expect(s.field("33:19")).toMatchObject({ label: "Clinic logo", static: true });
    // Geometry and artwork are untouched.
    const geometry = (f: SuggestedField) => [f.x, f.y, f.width, f.height, f.align, f.staticValue];
    expect(s.fields.map(geometry)).toEqual(before.map(geometry));
    expect(s.fields.map((f) => f.id)).toEqual(before.map((f) => f.id));
    expect(out.formOrder).toEqual([
      headline.id,
      ...s.fields.filter((f) => !f.static && f.id !== headline.id).map((f) => f.id),
    ]);
  });

  it("lets the model open an unkeyed layer to members, by the builder's own rules", () => {
    const s = setup({ names: UNKEYED_NAMES });
    const out = s.apply({
      fields: [
        {
          sourceId: "e1",
          label: "Question for the doctor",
          fieldKey: "question",
          type: "multiline",
          static: false,
          placeholder: "Ignored",
        },
        { sourceId: "e2", label: "Button", fieldKey: "button", type: "text", static: true },
        { sourceId: "e3", label: "Photo", fieldKey: "photo", type: "image", static: false },
      ],
      template: { ...TEMPLATE, captionTemplate: "{question} {nobody}" },
      rationale: [
        { fieldKey: "question", why: "Changes per post." },
        { fieldKey: "missing", why: "No such field." },
      ],
    });
    const headline = s.field("33:18");
    expect(headline).toMatchObject({
      label: "Question for the doctor",
      fieldKey: "question",
      // The designer's copy stays as the sample.
      placeholder: "Is it time to drop the naps?",
      textSizing: "shrink",
    });
    expect(headline.static).toBeUndefined();
    expect(headline.staticValue).toBeUndefined();
    // The model proposes no limit; the browser measures one.
    expect(headline.maxLength).toBeUndefined();
    const photo = s.field("32:40");
    expect(photo.static).toBeUndefined();
    expect(photo.imageRect).toBeDefined();
    expect(s.fields.find((f) => f.plateColor)).toMatchObject({ label: "Button", static: true });
    // The logo wasn't named: it keeps its label and its key.
    expect(s.field("33:19")).toMatchObject({ label: "image 2", static: true });
    expect(out.formOrder).toEqual([headline.id, photo.id]);
    expect(out.rationale).toEqual([{ fieldKey: "question", why: "Changes per post." }]);
    expect(out.template).toMatchObject({ name: "Doctor topic", captionTemplate: "{question}" });
  });

  it("keeps every key unique across the frame", () => {
    const s = setup();
    s.apply({
      fields: [
        {
          sourceId: s.elementOf("Headline"),
          label: "Plate",
          fieldKey: "plate",
          type: "multiline",
          static: false,
        },
        {
          sourceId: s.elementOf("Call to action"),
          label: "Plate",
          fieldKey: "Not A Key",
          type: "text",
          static: false,
        },
      ],
      template: TEMPLATE,
      rationale: [],
    });
    const keys = s.fields.map((f) => f.fieldKey);
    expect(new Set(keys).size).toBe(keys.length);
    // The plate shape wasn't asked about, so its key was held first.
    expect(s.fields.find((f) => f.type === "shape")!.fieldKey).toBe("plate");
  });

  it("makes a member's single line a select and leaves the rest as the walk read them", () => {
    const s = setup();
    s.apply({
      fields: [
        {
          sourceId: s.elementOf("Call to action"),
          label: "Call to action",
          fieldKey: "cta",
          type: "select",
          static: false,
          options: ["Read the answer", " Book a visit ", ""],
        },
        {
          sourceId: s.elementOf("Headline"),
          label: "Headline",
          fieldKey: "headline",
          type: "select",
          static: false,
          options: ["A", "B"],
        },
        {
          sourceId: s.elementOf("Photo"),
          label: "Photo",
          fieldKey: "photo",
          type: "text",
          static: false,
        },
      ],
      template: TEMPLATE,
      rationale: [],
    });
    expect(s.fields.find((f) => f.fieldKey === "cta")).toMatchObject({
      type: "select",
      options: ["Read the answer", "Book a visit"],
    });
    expect(s.field("33:18").type).toBe("multiline");
    expect(s.field("32:40").type).toBe("image");
  });

  it("ignores entries that name nothing, and a second entry for the same element", () => {
    const s = setup();
    s.apply({
      fields: [
        { sourceId: "e99", label: "Ghost", fieldKey: "ghost", type: "text", static: false },
        { label: "No id", fieldKey: "none", type: "text", static: false },
        { sourceId: "e1", label: "First", fieldKey: "first", type: "multiline", static: false },
        { sourceId: "e1", label: "Second", fieldKey: "second", type: "multiline", static: false },
      ],
      template: TEMPLATE,
      rationale: [],
    });
    expect(s.field("33:18").label).toBe("First");
    expect(s.fields).toHaveLength(5);
  });

  it("refuses an answer that names no element, before changing anything", () => {
    const s = setup();
    const before = structuredClone(s.fields);
    expect(() => s.apply({ fields: "none" })).toThrow(IntentProposalError);
    expect(() => s.apply({ fields: [{ sourceId: "e99", label: "x" }] })).toThrow(
      IntentProposalError,
    );
    expect(() => s.apply(null)).toThrow(IntentProposalError);
    expect(s.fields).toEqual(before);
  });

  it("returns no template details for pasted elements", () => {
    const s = setup();
    const out = s.apply(
      {
        fields: [
          {
            sourceId: "e1",
            label: "Headline",
            fieldKey: "headline",
            type: "multiline",
            static: false,
          },
        ],
        template: TEMPLATE,
        rationale: [],
      },
      BRAND,
      "elements",
    );
    expect(out.template).toBeUndefined();
  });
});

describe("type styles", () => {
  const exact: KitTypeStyle = {
    key: "heading",
    name: "Heading",
    font: { family: "Newsreader" },
    weight: 500,
    fontSizePx: 88,
    letterSpacingPx: -2.2,
    lineHeight: 1.05,
    colorKey: "ink",
  };
  const propose = (style: KitTypeStyle) => {
    const s = setup();
    const out = s.apply(
      {
        fields: [
          {
            sourceId: "e1",
            label: "Headline",
            fieldKey: "headline",
            type: "multiline",
            static: false,
            typeStyleKey: style.key,
          },
        ],
        template: TEMPLATE,
        rationale: [],
      },
      { ...BRAND, typeStyles: [style] },
    );
    return { field: s.field("33:18") as SuggestedField & { typeStyleKey?: string }, out };
  };

  it("binds a style the layer is drawn in exactly", () => {
    const { field, out } = propose(exact);
    expect(field.typeStyleKey).toBe("heading");
    expect(out.issues).toEqual([]);
  });

  it("leaves a merely similar style unbound and says so", () => {
    const { field, out } = propose({ ...exact, fontSizePx: 100 });
    expect(field.typeStyleKey).toBeUndefined();
    expect(out.issues).toEqual([
      {
        layer: "Headline",
        nodeId: "33:18",
        issue: "close to the Heading style but not the same, so it isn't bound.",
        severity: "info",
      },
    ]);
  });

  it("ignores a style the kit doesn't have", () => {
    const s = setup();
    const out = s.apply({
      fields: [
        {
          sourceId: "e1",
          label: "Headline",
          fieldKey: "headline",
          type: "multiline",
          static: false,
          typeStyleKey: "nope",
        },
      ],
      template: TEMPLATE,
      rationale: [],
    });
    expect((s.field("33:18") as { typeStyleKey?: string }).typeStyleKey).toBeUndefined();
    expect(out.issues).toEqual([]);
  });

  it("names the first property that differs", () => {
    const field = setup().field("33:18");
    const hex = new Map([["ink", "#0C3654"]]);
    expect(styleMismatch(exact, field, hex)).toBeNull();
    expect(styleMismatch({ ...exact, font: { family: "Inter" } }, field, hex)).toBe("font");
    expect(styleMismatch({ ...exact, weight: 600 }, field, hex)).toBe("weight");
    expect(styleMismatch({ ...exact, fontStyle: "italic" }, field, hex)).toBe("italic");
    expect(styleMismatch({ ...exact, fontStretch: "expanded" }, field, hex)).toBe("width");
    expect(styleMismatch({ ...exact, uppercase: true }, field, hex)).toBe("case");
    expect(styleMismatch({ ...exact, letterSpacingPx: 0 }, field, hex)).toBe("letter spacing");
    expect(styleMismatch({ ...exact, lineHeight: 1.2 }, field, hex)).toBe("line height");
    expect(
      styleMismatch({ ...exact, colorKey: "peach" }, field, new Map([["peach", "#FFE0CF"]])),
    ).toBe("color");
    expect(styleMismatch({ ...exact, textSizing: "fill" }, field, hex)).toBe("sizing");
    // Within rounding.
    expect(
      styleMismatch({ ...exact, fontSizePx: 88.4, letterSpacingPx: -2 }, field, hex),
    ).toBeNull();
  });
});

describe("the kit's logo", () => {
  const run = (kitLogos: { light?: string; dark?: string }, names?: object) => {
    const frame = importFrame(portraitWithPlate({ names }));
    const logo = frame.fields.find((f) => f.sourceNodeId === "33:19")!;
    logo.staticValue = "template-backgrounds/co/elements/1-0.png";
    logo.imageRect = { x: 0, y: 0, width: 1, height: 1 };
    const issues: ImportWarning[] = [];
    applyKitLogos(frame.fields, frame.intents, kitLogos, issues);
    return { logo, issues };
  };

  it("swaps a keyed primary logo for the kit's, contained", () => {
    const { logo, issues } = run({ light: "brand-assets/co/logo/light.svg" });
    expect(logo).toMatchObject({
      staticValue: "brand-assets/co/logo/light.svg",
      objectFit: "contain",
      static: true,
    });
    expect(logo.imageRect).toBeUndefined();
    expect(issues.map((i) => i.issue)).toEqual(["swapped for your light primary logo."]);
  });

  it("keeps the Figma artwork when the kit has none for that surface", () => {
    const { logo, issues } = run({ dark: "brand-assets/co/logo/dark.svg" });
    expect(logo.staticValue).toBe("template-backgrounds/co/elements/1-0.png");
    expect(issues.map((i) => i.issue)).toEqual([
      "Brand Studio has no light primary logo, so the Figma artwork stays.",
    ]);
  });

  it("leaves a logo that names no surface, or another variant, alone", () => {
    const kit = { light: "brand-assets/co/logo/light.svg" };
    expect(run(kit, { logo: "logo · logo · variant=primary" }).issues).toEqual([]);
    expect(run(kit, { logo: "logo · logo · variant=mark · surface=light" }).issues).toEqual([]);
    expect(run(kit, { logo: "image 2" }).issues).toEqual([]);
  });
});

describe("the report", () => {
  it("counts the keys, lists colour roles and limits, and carries the cost", () => {
    const frame = importFrame(portraitWithPlate());
    const report = intentReport({
      fields: frame.fields,
      intents: frame.intents,
      parse: frame.parse,
      capTrim: frame.capTrim,
      filledBy: "keys",
      cost: NO_MODEL_COST,
    });
    const id = (label: string) => frame.fields.find((f) => f.label === label)!.id;
    expect(report).toMatchObject({
      filledBy: "keys",
      layers: 10,
      keyed: 6,
      unknown: [],
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      modelMs: 0,
    });
    expect(report.roles).toEqual([
      { fieldKey: "plate", fill: "accent" },
      { fieldKey: "headline", text: "on-accent" },
      { fieldKey: "call_to_action", fill: "card", text: "on-card" },
    ]);
    expect(report.limits).toEqual([
      { fieldId: id("Headline"), max: 32, lines: 3 },
      { fieldId: id("Call to action"), max: 24 },
    ]);
    // The headline's layer is cap-trimmed and took its band downward. The
    // pill's text is trimmed too, but a pill is placed from its container.
    expect(report.capTrim).toEqual([{ fieldId: id("Headline"), capHeight: 58.6, band: "down" }]);
    // Paint order when no form order was given.
    expect(report.formOrder).toEqual([id("Photo"), id("Headline"), id("Call to action")]);
  });
});
