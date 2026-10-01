import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import {
  PHOTO_ANSWER,
  checkAnswer,
  currentStep,
  interviewIntro,
  interviewMessage,
  interviewSteps,
  interviewTranscript,
  questionFor,
} from "./interview";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: over.fieldKey ?? "f",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  ...over,
});

const schema = (fields: TemplateField[], extra: Partial<TemplateSchema> = {}): TemplateSchema => ({
  id: "t-1",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields,
  captionTemplate: "",
  createdAt: "2026-09-29T00:00:00Z",
  updatedAt: "2026-09-29T00:00:00Z",
  ...extra,
});

const hiring = schema([
  field({ fieldKey: "tagline", label: "Tagline", optional: true }),
  field({ fieldKey: "role", label: "Job title", maxLength: 30, placeholder: "Senior designer" }),
  field({ fieldKey: "footer", label: "Footer", static: true }),
  field({ fieldKey: "photo", label: "Headshot", type: "image", optional: true }),
  field({
    fieldKey: "kind",
    label: "Contract",
    type: "select",
    options: ["Full time", "Part time"],
  }),
  field({ fieldKey: "about", label: "About the role", type: "multiline" }),
  field({ fieldKey: "bar", label: "Bar", type: "shape" }),
]);

describe("interviewSteps", () => {
  it("asks required fields first, then optional ones, each in form order", () => {
    expect(interviewSteps(hiring).map((s) => s.fieldKey)).toEqual([
      "role",
      "kind",
      "about",
      "tagline",
      "photo",
    ]);
  });

  it("leaves out fixed elements and shapes, and carries each field's limits", () => {
    const role = interviewSteps(hiring)[0];
    expect(role).toMatchObject({
      label: "Job title",
      type: "text",
      optional: false,
      maxLength: 30,
      placeholder: "Senior designer",
    });
    expect(interviewSteps(hiring)[1].options).toEqual(["Full time", "Part time"]);
  });

  it("asks for one photo however many image slots there are", () => {
    const two = schema([
      field({ fieldKey: "a", label: "Photo A", type: "image" }),
      field({ fieldKey: "b", label: "Photo B", type: "image" }),
    ]);
    expect(interviewSteps(two).map((s) => s.fieldKey)).toEqual(["a"]);
  });

  it("asks once for a key used by two boxes", () => {
    const twice = schema([field({ id: "1" }), field({ id: "2" })]);
    expect(interviewSteps(twice)).toHaveLength(1);
  });

  it("asks nothing of a template with no member fields", () => {
    expect(interviewSteps(schema([field({ static: true })]))).toEqual([]);
  });
});

describe("questionFor", () => {
  it.each([
    [{ label: "Job title", type: "text", optional: false }, "What should the job title say?"],
    [{ label: "Headline:", type: "multiline", optional: false }, "What should the headline say?"],
    [{ label: "CTA", type: "text", optional: false }, "What should the CTA say?"],
    [{ label: "Contract", type: "select", optional: false }, "Which contract?"],
    [
      { label: "About the role", type: "multiline", optional: false },
      'What goes in "About the role"?',
    ],
    [{ label: "Your name", type: "text", optional: false }, 'What goes in "Your name"?'],
    [
      { label: "Headshot", type: "image", optional: false },
      "Add a photo for the headshot. Attach it with the plus.",
    ],
    [
      { label: "Headshot", type: "image", optional: true },
      "Want to add a photo for the headshot? Attach it with the plus, or skip it.",
    ],
  ] as const)("%o asks %s", (step, q) => {
    expect(questionFor(step)).toBe(q);
  });
});

describe("currentStep", () => {
  const steps = interviewSteps(hiring);
  it("is the first step with no answer, a skip counting as one", () => {
    expect(currentStep(steps, {})?.fieldKey).toBe("role");
    expect(currentStep(steps, { role: "Designer", kind: "Full time" })?.fieldKey).toBe("about");
    expect(
      currentStep(steps, { role: "x", kind: "Full time", about: "y", tagline: null })?.fieldKey,
    ).toBe("photo");
  });
  it("is null once every step is answered", () => {
    expect(
      currentStep(steps, { role: "x", kind: "Full time", about: "y", tagline: null, photo: null }),
    ).toBeNull();
  });
});

describe("checkAnswer", () => {
  const [role, kind, about] = interviewSteps(hiring);
  it("trims, and folds a single-line answer's spaces", () => {
    expect(checkAnswer(role, "  Senior   designer ")).toEqual({
      ok: true,
      value: "Senior designer",
    });
  });
  it("keeps a multiline answer's line breaks", () => {
    expect(checkAnswer(about, "Line one\nLine two\n")).toEqual({
      ok: true,
      value: "Line one\nLine two",
    });
  });
  it("refuses an empty answer", () => {
    expect(checkAnswer(role, "   ")).toEqual({ ok: false, error: "Type an answer first." });
  });
  it("refuses an answer past the field's limit, saying how long it is", () => {
    expect(checkAnswer(role, "x".repeat(31))).toEqual({
      ok: false,
      error: "Keep it to 30 characters. That's 31.",
    });
  });
  it("matches a select's option without regard to case, in the option's spelling", () => {
    expect(checkAnswer(kind, "part TIME")).toEqual({ ok: true, value: "Part time" });
    expect(checkAnswer(kind, "Freelance")).toEqual({
      ok: false,
      error: "Choose one of the options.",
    });
  });
});

describe("interviewIntro", () => {
  it("counts the questions and says when the last ones are optional", () => {
    expect(interviewIntro("Now hiring", interviewSteps(hiring))).toBe(
      "Let's fill in Now hiring. I've got 5 questions for you. The last ones are optional.",
    );
    expect(interviewIntro("Promo", interviewSteps(schema([field({})])))).toBe(
      "Let's fill in Promo. I've got one question for you.",
    );
  });
});

describe("interviewMessage", () => {
  const steps = interviewSteps(hiring);
  const answers = {
    role: "Senior designer",
    kind: "Full time",
    about: "Lead our brand work.",
    tagline: null,
    photo: PHOTO_ANSWER,
  };

  it("sends text answers as details, in the order asked, and lists the skips", () => {
    const m = interviewMessage(steps, answers);
    expect(m.details).toEqual([
      { fieldKey: "role", label: "Job title", value: "Senior designer" },
      { fieldKey: "kind", label: "Contract", value: "Full time" },
      { fieldKey: "about", label: "About the role", value: "Lead our brand work." },
    ]);
    expect(m.skipped).toEqual(["tagline"]);
    expect(m.text).toBe(
      "Job title: Senior designer\nContract: Full time\nAbout the role: Lead our brand work.",
    );
  });

  it("never sends the photo step as a detail", () => {
    expect(interviewMessage(steps, answers).details.some((d) => d.fieldKey === "photo")).toBe(
      false,
    );
  });

  it("still has a brief when nothing was typed", () => {
    expect(interviewMessage([], {}).text).toBe("Build it as it is.");
  });
});

describe("interviewTranscript", () => {
  const steps = interviewSteps(hiring);
  it("rebuilds the questions and answers from the sent message", () => {
    const pairs = interviewTranscript(steps, {
      details: [
        { fieldKey: "role", label: "Job title", value: "Senior designer" },
        { fieldKey: "kind", label: "Contract", value: "Full time" },
        { fieldKey: "about", label: "About the role", value: "Lead." },
      ],
      skipped: ["tagline"],
      hadPhoto: true,
    });
    expect(pairs.map((p) => [p.step.fieldKey, p.answer])).toEqual([
      ["role", "Senior designer"],
      ["kind", "Full time"],
      ["about", "Lead."],
      ["tagline", null],
      ["photo", PHOTO_ANSWER],
    ]);
  });

  it("leaves out steps the message says nothing about", () => {
    const pairs = interviewTranscript(steps, {
      details: [{ fieldKey: "role", label: "Job title", value: "Designer" }],
      skipped: [],
      hadPhoto: false,
    });
    expect(pairs.map((p) => p.step.fieldKey)).toEqual(["role"]);
  });
});
