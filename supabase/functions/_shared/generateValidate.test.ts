import { describe, expect, it } from "vitest";
import {
  GenerateValidationError,
  buildRepairRequests,
  candidateFromRows,
  canvasForPlatform,
  classifyPlatforms,
  modelCandidates,
  orientationOf,
  validateFreestyle,
  validateGeneration,
  validateRepair,
  type CandidateField,
  type CandidateTemplate,
  type FreestyleContext,
  type GenerateModelOutput,
  type ProposedDesign,
  type ProposedDesignField,
  type ProposedGeneration,
} from "./generateValidate.ts";

const candidate = (
  id: string,
  fields: CandidateField[],
  extra: Partial<CandidateTemplate> = {},
): CandidateTemplate => ({
  id,
  name: `Template ${id}`,
  description: "A template.",
  category: "Hiring",
  tags: ["jobs"],
  canvasWidth: 1200,
  canvasHeight: 1200,
  orientation: "square",
  platforms: ["linkedin"],
  fields,
  ...extra,
});

const textField = (fieldKey: string, extra: Partial<CandidateField> = {}): CandidateField => ({
  fieldKey,
  label: fieldKey,
  type: "text",
  ...extra,
});

const proposed = (overrides: Partial<ProposedGeneration> = {}): ProposedGeneration => ({
  templateId: "t1",
  values: [{ fieldKey: "headline", value: "We are hiring a senior nurse practitioner" }],
  caption: "Join our Evanston clinic team.",
  why: "The hiring template matches a job announcement.",
  ...overrides,
});

const output = (proposals: ProposedGeneration[]): GenerateModelOutput => ({ proposals });

const LIBRARY = [
  candidate("t1", [
    textField("headline", { required: true, maxLength: 60 }),
    textField("details"),
    { fieldKey: "photo", label: "Headshot", type: "image", required: true },
    { fieldKey: "logo", label: "Logo", type: "image", static: true },
    textField("footer", { static: true }),
    { fieldKey: "dept", label: "Department", type: "select", options: ["Nursing", "Admin"] },
  ]),
  candidate("t2", [textField("quote", { maxLength: 120 })]),
  candidate("t3", [textField("title")]),
];

describe("a valid proposal passes through", () => {
  it("converts values to a map and reports the member's remaining image work", () => {
    const out = validateGeneration(output([proposed()]), LIBRARY, 3);
    expect(out.proposals).toHaveLength(1);
    const p = out.proposals[0];
    expect(p.templateId).toBe("t1");
    expect(p.templateName).toBe("Template t1");
    expect(p.values).toEqual({ headline: "We are hiring a senior nurse practitioner" });
    expect(p.caption).toBe("Join our Evanston clinic team.");
    expect(p.imageFieldsNeeded).toEqual([{ fieldKey: "photo", label: "Headshot", required: true }]);
  });

  it("accepts a select value that is one of the options", () => {
    const out = validateGeneration(
      output([
        proposed({
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "dept", value: "Nursing" },
          ],
        }),
      ]),
      LIBRARY,
      3,
    );
    expect(out.proposals[0].values.dept).toBe("Nursing");
  });
});

describe("rejection paths (retry with errors)", () => {
  const expectErrors = (proposals: ProposedGeneration[], needle: string) => {
    let thrown: unknown;
    try {
      validateGeneration(output(proposals), LIBRARY, 3);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GenerateValidationError);
    const errors = (thrown as GenerateValidationError).errors;
    expect(errors.some((e) => e.includes(needle))).toBe(true);
  };

  it("rejects an unknown templateId", () => {
    expectErrors([proposed({ templateId: "ghost" })], '"ghost"');
  });

  it("rejects an unknown fieldKey", () => {
    expectErrors(
      [
        proposed({
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "nope", value: "x" },
          ],
        }),
      ],
      '"nope" does not exist',
    );
  });

  it("rejects a write against a fixed text field", () => {
    expectErrors(
      [
        proposed({
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "footer", value: "x" },
          ],
        }),
      ],
      '"footer" is fixed',
    );
  });

  it("rejects a select value outside the options", () => {
    expectErrors(
      [
        proposed({
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "dept", value: "Surgery" },
          ],
        }),
      ],
      "not an option",
    );
  });

  it("rejects a value over maxLength instead of truncating", () => {
    expectErrors(
      [proposed({ values: [{ fieldKey: "headline", value: "x".repeat(61) }] })],
      "the limit is 60",
    );
  });

  it("rejects a proposal that leaves a required text field empty", () => {
    expectErrors(
      [proposed({ values: [{ fieldKey: "details", value: "some detail" }] })],
      "required",
    );
  });

  it("rejects an empty proposal list", () => {
    expectErrors([], "No usable proposals");
  });
});

describe("image fields", () => {
  it("strips a value written into an image field with a warning, not an error", () => {
    const out = validateGeneration(
      output([
        proposed({
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "photo", value: "data:image/png;base64,AAAA" },
          ],
        }),
      ]),
      LIBRARY,
      3,
    );
    expect(out.proposals[0].values.photo).toBeUndefined();
    expect(out.warnings.some((w) => w.includes("photo"))).toBe(true);
  });

  it("also strips a value written into a fixed image field, as a fixed-field error", () => {
    let thrown: unknown;
    try {
      validateGeneration(
        output([
          proposed({
            values: [
              { fieldKey: "headline", value: "Now hiring" },
              { fieldKey: "logo", value: "data:image/png;base64,AAAA" },
            ],
          }),
        ]),
        LIBRARY,
        3,
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GenerateValidationError);
  });
});

describe("proposal set discipline", () => {
  it("clamps extra proposals to count with a warning", () => {
    const three = [
      proposed(),
      proposed({ templateId: "t2", values: [{ fieldKey: "quote", value: "Well said" }] }),
      proposed({ templateId: "t3", values: [{ fieldKey: "title", value: "A title" }] }),
    ];
    const out = validateGeneration(output(three), LIBRARY, 2);
    expect(out.proposals).toHaveLength(2);
    expect(out.warnings.some((w) => w.includes("keeping the first 2"))).toBe(true);
  });

  it("warns when proposals reuse a template and the library has alternatives", () => {
    const out = validateGeneration(output([proposed(), proposed()]), LIBRARY, 3);
    expect(out.warnings.some((w) => w.includes("same template"))).toBe(true);
  });

  it("does not warn about repeats when the library is too small to avoid them", () => {
    const tiny = [LIBRARY[0]];
    const out = validateGeneration(output([proposed(), proposed()]), tiny, 3);
    expect(out.warnings.some((w) => w.includes("same template"))).toBe(false);
  });
});

describe("candidate construction", () => {
  const templateRow = {
    id: "t9",
    name: "Hiring post",
    description: null,
    category: "Hiring",
    tags: ["jobs"],
    canvas_width: 1200,
    canvas_height: 627,
  };
  const fieldRows = [
    {
      field_key: "headline",
      label: "Headline",
      type: "text",
      is_static: null,
      required: true,
      max_length: 60,
      placeholder: "We're hiring a nurse",
      options: null,
    },
    {
      field_key: "footer",
      label: "Footer",
      type: "text",
      is_static: true,
      required: null,
      max_length: null,
      placeholder: null,
      options: null,
    },
    {
      field_key: "divider",
      label: "Divider",
      type: "shape",
      is_static: true,
      required: null,
      max_length: null,
      placeholder: null,
      options: null,
    },
  ];

  it("maps rows, keeps fixed fields flagged, and excludes shapes", () => {
    const c = candidateFromRows(templateRow, fieldRows);
    expect(c.fields.map((f) => f.fieldKey)).toEqual(["headline", "footer"]);
    expect(c.fields[0]).toMatchObject({ required: true, maxLength: 60 });
    expect(c.fields[1].static).toBe(true);
    expect(c.platforms).toEqual(["linkedin"]);
    expect(c.orientation).toBe("landscape");
  });

  it("modelCandidates hides fixed fields from the model entirely", () => {
    const view = modelCandidates([candidateFromRows(templateRow, fieldRows)]);
    expect(view[0].fields.map((f) => f.fieldKey)).toEqual(["headline"]);
    expect("static" in view[0].fields[0]).toBe(false);
  });
});

describe("repair requests", () => {
  const candidateT1 = LIBRARY[0];

  it("clamps the client's budget under the field's own maxLength", () => {
    const { requests, errors } = buildRepairRequests(candidateT1, [
      { fieldKey: "headline", value: "x".repeat(80), characterBudget: 500 },
    ]);
    expect(errors).toEqual([]);
    // The client's budget only ever tightens: headline's maxLength is 60.
    expect(requests[0].characterBudget).toBe(60);
  });

  it("refuses unknown, fixed, and non-text targets", () => {
    const { errors } = buildRepairRequests(candidateT1, [
      { fieldKey: "ghost", value: "x", characterBudget: 10 },
      { fieldKey: "footer", value: "x", characterBudget: 10 },
      { fieldKey: "photo", value: "x", characterBudget: 10 },
      { fieldKey: "dept", value: "x", characterBudget: 10 },
    ]);
    expect(errors).toHaveLength(4);
  });

  it("accepts a full rewrite within budget", () => {
    const { requests } = buildRepairRequests(candidateT1, [
      { fieldKey: "headline", value: "x".repeat(80), characterBudget: 40 },
    ]);
    const out = validateRepair(
      { values: [{ fieldKey: "headline", value: "Now hiring" }] },
      requests,
    );
    expect(out.values).toEqual({ headline: "Now hiring" });
  });

  const expectRepairErrors = (
    output: Parameters<typeof validateRepair>[0],
    requests: Parameters<typeof validateRepair>[1],
    needle: string,
  ) => {
    let thrown: unknown;
    try {
      validateRepair(output, requests);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GenerateValidationError);
    expect((thrown as GenerateValidationError).errors.some((e) => e.includes(needle))).toBe(true);
  };

  const oneRequest = [{ fieldKey: "headline", value: "x".repeat(80), characterBudget: 40 }];

  it("rejects a rewrite over its budget", () => {
    expectRepairErrors(
      { values: [{ fieldKey: "headline", value: "x".repeat(41) }] },
      oneRequest,
      "the budget is 40",
    );
  });

  it("rejects a rewrite for a field that was not asked for", () => {
    expectRepairErrors(
      {
        values: [
          { fieldKey: "headline", value: "Now hiring" },
          { fieldKey: "details", value: "extra" },
        ],
      },
      oneRequest,
      "not asked for",
    );
  });

  it("rejects a round that skips a requested field", () => {
    expectRepairErrors({ values: [] }, oneRequest, "not rewritten");
  });

  it("rejects an empty rewrite", () => {
    expectRepairErrors({ values: [{ fieldKey: "headline", value: "   " }] }, oneRequest, "empty");
  });
});

describe("freestyle designs", () => {
  const ctx: FreestyleContext = {
    canvasWidth: 1200,
    canvasHeight: 1200,
    palette: [
      { key: "primary", hex: "#2f3b4c" },
      { key: "paper", hex: "#f4f1ea" },
    ],
    typeStyleKeys: ["heading", "body"],
  };

  const designField = (over: Partial<ProposedDesignField> = {}): ProposedDesignField => ({
    label: "Headline",
    fieldKey: "headline",
    type: "text",
    value: "Now hiring in Evanston",
    box: { x: 100, y: 100, width: 1000, height: 200 },
    ...over,
  });

  const design = (over: Partial<ProposedDesign> = {}): ProposedDesign => ({
    name: "Hiring card",
    backgroundColorKey: "paper",
    fields: [
      designField(),
      designField({ label: "Details", fieldKey: "details", value: "Starts in October" }),
    ],
    caption: "We're hiring in Evanston.",
    why: "A clean announcement layout.",
    ...over,
  });

  it("resolves palette keys to hexes and pre-fills editable values", () => {
    const out = validateFreestyle({ proposals: [design()] }, ctx, 3);
    const d = out.designs[0];
    expect(d.backgroundColor).toBe("#f4f1ea");
    expect(d.canvasWidth).toBe(1200);
    expect(d.values).toEqual({
      headline: "Now hiring in Evanston",
      details: "Starts in October",
    });
    // Text is shrink-sized so length can never escape the model's box.
    expect(d.fields.every((f) => f.type !== "text" || f.textSizing === "shrink")).toBe(true);
  });

  it("clamps geometry to the canvas and drops unusable boxes", () => {
    const out = validateFreestyle(
      {
        proposals: [
          design({
            fields: [
              designField({ box: { x: 1000, y: 100, width: 900, height: 200 } }),
              designField({
                label: "Sliver",
                fieldKey: "sliver",
                box: { x: 0, y: 0, width: 4, height: 4 },
              }),
              designField({ label: "Details", fieldKey: "details", value: "x" }),
            ],
          }),
        ],
      },
      ctx,
      3,
    );
    const d = out.designs[0];
    expect(d.fields.find((f) => f.fieldKey === "headline")?.width).toBe(200);
    expect(d.fields.some((f) => f.fieldKey === "sliver")).toBe(false);
    expect(out.warnings.some((w) => w.includes("Sliver"))).toBe(true);
  });

  it("drops shapes without a real palette color and unbinds unknown type styles", () => {
    const out = validateFreestyle(
      {
        proposals: [
          design({
            fields: [
              designField({ typeStyleKey: "display" }),
              designField({ label: "Details", fieldKey: "details", value: "x" }),
              designField({
                label: "Block",
                fieldKey: "block",
                type: "shape",
                shape: "rect",
                colorKey: "neon",
              }),
            ],
          }),
        ],
      },
      ctx,
      3,
    );
    const d = out.designs[0];
    expect(d.fields.find((f) => f.fieldKey === "headline")?.typeStyleKey).toBeUndefined();
    expect(d.fields.some((f) => f.type === "shape")).toBe(false);
  });

  it("keeps a valid shape, fixed, filled from the palette", () => {
    const out = validateFreestyle(
      {
        proposals: [
          design({
            fields: [
              designField({
                label: "Block",
                fieldKey: "block",
                type: "shape",
                shape: "rect",
                colorKey: "primary",
                box: { x: 0, y: 0, width: 1200, height: 1200 },
              }),
              designField(),
              designField({ label: "Details", fieldKey: "details", value: "x" }),
            ],
          }),
        ],
      },
      ctx,
      3,
    );
    const shape = out.designs[0].fields.find((f) => f.type === "shape");
    expect(shape).toMatchObject({ static: true, colorHex: "#2f3b4c", width: 1200 });
  });

  it("forces image slots member-editable — the model cannot supply artwork", () => {
    const out = validateFreestyle(
      {
        proposals: [
          design({
            fields: [
              designField(),
              designField({ label: "Photo", fieldKey: "photo", type: "image", static: true }),
            ],
          }),
        ],
      },
      ctx,
      3,
    );
    const photo = out.designs[0].fields.find((f) => f.type === "image");
    expect(photo?.static).toBeUndefined();
    expect(out.designs[0].imageFieldsNeeded).toEqual([
      { fieldKey: "photo", label: "Photo", required: false },
    ]);
  });

  it("keeps caption tags for editable fields, strips the rest, and resolves for display", () => {
    const out = validateFreestyle(
      { proposals: [design({ caption: "We're hiring: {headline} {ghost}" })] },
      ctx,
      3,
    );
    const d = out.designs[0];
    expect(d.captionTemplate).toBe("We're hiring: {headline}");
    expect(d.caption).toBe("We're hiring: Now hiring in Evanston");
    expect(out.warnings.some((w) => w.includes("{ghost}"))).toBe(true);
  });

  it("rejects a design with too little left after validation", () => {
    let thrown: unknown;
    try {
      validateFreestyle(
        { proposals: [design({ fields: [designField({ static: true, value: "" })] })] },
        ctx,
        3,
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GenerateValidationError);
  });

  it("picks the canvas from the platform, falling back to the neutral square", () => {
    expect(canvasForPlatform("linkedin")).toEqual({ width: 1080, height: 1350 });
    expect(canvasForPlatform(undefined)).toEqual({ width: 1440, height: 1440 });
    expect(canvasForPlatform("print")).toEqual({ width: 1440, height: 1440 });
  });
});

describe("size classification", () => {
  it("matches known sizes exactly and falls back to general", () => {
    expect(classifyPlatforms(1080, 1350)).toEqual(["instagram", "facebook", "linkedin"]);
    expect(classifyPlatforms(1081, 1350)).toEqual(["general"]);
    expect(orientationOf(1080, 1920)).toBe("vertical");
    expect(orientationOf(1440, 1440)).toBe("square");
  });
});
