import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import type { PlatformId } from "../templates/platforms";
import type { AssistantTurn, ChatDraft, ChatTurn, UserTurn } from "./chat";
import { deriveTryNext, indefiniteArticle, platformsAskedFor } from "./tryNext";

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

const schema = (fields: TemplateField[], width = 1080, height = 1350): TemplateSchema => ({
  id: "t",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: width,
  canvasHeight: height,
  backgroundUrl: "",
  fields,
  captionTemplate: "",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
});

const draft = (
  id: string,
  fields: TemplateField[] | null,
  values: Record<string, string>,
  canvas = { width: 1080, height: 1350 },
): ChatDraft => ({
  id,
  proposal: {
    templateId: `t-${id}`,
    templateName: id,
    values,
    caption: "",
    why: "",
    imageFieldsNeeded: [],
  },
  schema: fields ? schema(fields, canvas.width, canvas.height) : null,
  canvas,
  values,
});

const turn = (drafts: ChatDraft[], over: Partial<AssistantTurn> = {}): AssistantTurn => ({
  id: "a1",
  role: "assistant",
  createdAt: "2026-09-25T00:00:00Z",
  replyTo: "u1",
  phase: "done",
  step: 3,
  stepLabel: "Checking every line fits",
  status: "Here you go.",
  expected: drafts.length,
  drafts,
  pendingSlots: 0,
  warnings: [],
  ...over,
});

const INSTAGRAM = { width: 1080, height: 1350 };
const LINKEDIN = { width: 1200, height: 627 };
const FACEBOOK = { width: 1200, height: 630 };

/** The frame 05 turn: a 4:5 "Now hiring" and a 1.91:1 "Open role", both
 * with an empty Location. */
const hiringFields = [
  field({ fieldKey: "headline", label: "Headline" }),
  field({ fieldKey: "location", label: "Location" }),
  field({ fieldKey: "photo", label: "Photo", type: "image" }),
];
const frameTurn = turn([
  draft("now-hiring", hiringFields, { headline: "Now hiring" }, INSTAGRAM),
  draft("open-role", hiringFields, { headline: "Open role" }, LINKEDIN),
]);

describe("deriveTryNext", () => {
  it("reproduces frame 05: a field, a platform, a layout, in that order", () => {
    expect(deriveTryNext(frameTurn, { paletteSize: 4 })).toEqual([
      { kind: "fillField", label: "Add a location", draftId: "now-hiring", fieldKey: "location" },
      { kind: "platform", label: "Make a Facebook version", platform: "facebook" },
      { kind: "layout", label: "Try another layout" },
    ]);
  });

  it("offers another layout only with a palette color", () => {
    const actions = deriveTryNext(frameTurn, { paletteSize: 0 });
    expect(actions.map((a) => a.kind)).toEqual(["fillField", "platform"]);
  });

  it("offers nothing for a turn that is not done, or has no drafts", () => {
    for (const phase of ["asking", "measuring", "stopped", "error"] as const) {
      expect(deriveTryNext({ ...frameTurn, phase }, { paletteSize: 4 })).toEqual([]);
    }
    expect(deriveTryNext(turn([]), { paletteSize: 4 })).toEqual([]);
  });

  describe("rule 1: an empty field", () => {
    const only = (drafts: ChatDraft[]) =>
      deriveTryNext(turn(drafts), { paletteSize: 0 }).filter((a) => a.kind === "fillField");

    it("takes the first empty member text field in form order across the drafts", () => {
      const a = [field({ fieldKey: "headline" }), field({ fieldKey: "date", label: "Date" })];
      const b = [
        field({ fieldKey: "venue", label: "Venue" }),
        field({ fieldKey: "details", label: "Description", type: "multiline" }),
      ];
      expect(only([draft("a", a, { headline: "Hi" }), draft("b", b, { venue: "Hall" })])).toEqual([
        { kind: "fillField", label: "Add a date", draftId: "a", fieldKey: "date" },
      ]);
      // With the first draft full, the second draft's multiline field.
      expect(
        only([draft("a", a, { headline: "Hi", date: "Friday" }), draft("b", b, { venue: "Hall" })]),
      ).toEqual([
        { kind: "fillField", label: "Add a description", draftId: "b", fieldKey: "details" },
      ]);
    });

    it("skips images, selects, fixed text and shapes", () => {
      const fields = [
        field({ fieldKey: "photo", label: "Photo", type: "image" }),
        field({ fieldKey: "dept", label: "Department", type: "select", options: ["A", "B"] }),
        field({ fieldKey: "tagline", label: "Tagline", static: true, staticValue: "" }),
        field({ fieldKey: "bar", label: "Bar", type: "shape", static: true }),
      ];
      expect(only([draft("a", fields, {})])).toEqual([]);
    });

    it("counts whitespace as empty", () => {
      expect(only([draft("a", [field({ label: "Event" })], { headline: "  \n" })])).toEqual([
        { kind: "fillField", label: "Add an event", draftId: "a", fieldKey: "headline" },
      ]);
    });

    it("skips a field another draft already fills, by key or by label", () => {
      const byKey = [
        draft("a", hiringFields, {}),
        draft("b", hiringFields, { location: "Chicago" }),
      ];
      expect(only(byKey)[0]).toMatchObject({ fieldKey: "headline" });
      expect(only(byKey.map((d) => ({ ...d, values: { ...d.values, headline: "Hi" } })))).toEqual(
        [],
      );
      // Different keys, one label ("Location" and "location:" normalize alike).
      const a = [field({ fieldKey: "location", label: "Location" })];
      const b = [field({ fieldKey: "city", label: "location:" })];
      expect(only([draft("a", a, {}), draft("b", b, { city: "Chicago" })])).toEqual([]);
      expect(only([draft("a", a, {}), draft("b", b, {})])).toEqual([
        { kind: "fillField", label: "Add a location", draftId: "a", fieldKey: "location" },
      ]);
    });

    it("skips a field with no letter or digit to name it by", () => {
      const a = [field({ fieldKey: "a1", label: "\u2014" }), field({ fieldKey: "x", label: "X" })];
      expect(only([draft("a", a, {})])).toEqual([
        { kind: "fillField", label: "Add an x", draftId: "a", fieldKey: "x" },
      ]);
      // A nameless field elsewhere never links to a named one.
      const b = [field({ fieldKey: "b1", label: "\u2014" })];
      expect(only([draft("b", b, { b1: "filled" }), draft("a", a, {})])).toEqual([
        { kind: "fillField", label: "Add an x", draftId: "a", fieldKey: "x" },
      ]);
    });

    it("skips a field with a blank label, and drafts whose template is gone", () => {
      expect(only([draft("a", [field({ label: "   " })], {})])).toEqual([]);
      expect(only([draft("gone", null, {}), draft("b", hiringFields, { headline: "Hi" })])).toEqual(
        [{ kind: "fillField", label: "Add a location", draftId: "b", fieldKey: "location" }],
      );
    });

    it("lowercases the label and collapses its spaces", () => {
      expect(only([draft("a", [field({ label: "  Event   Location " })], {})])[0].label).toBe(
        "Add an event location",
      );
      expect(only([draft("a", [field({ label: "Hourly Rate" })], {})])[0].label).toBe(
        "Add an hourly rate",
      );
      expect(only([draft("a", [field({ label: "RSVP link" })], {})])[0].label).toBe(
        "Add an rsvp link",
      );
    });
  });

  describe("rule 2: another platform", () => {
    const platformOf = (...canvases: Array<{ width: number; height: number }>) =>
      deriveTryNext(
        turn(canvases.map((c, i) => draft(`d${i}`, [field({})], { headline: "Hi" }, c))),
        { paletteSize: 0 },
      );

    it("offers the first of Facebook, Instagram and LinkedIn no draft is for", () => {
      expect(platformOf(INSTAGRAM)).toEqual([
        { kind: "platform", label: "Make a Facebook version", platform: "facebook" },
      ]);
      expect(platformOf(FACEBOOK, LINKEDIN)).toEqual([
        { kind: "platform", label: "Make an Instagram version", platform: "instagram" },
      ]);
      expect(platformOf(FACEBOOK, INSTAGRAM)).toEqual([
        { kind: "platform", label: "Make a LinkedIn version", platform: "linkedin" },
      ]);
    });

    it("goes by each draft's primary platform (1080 x 1350 is Instagram)", () => {
      // The portrait size also serves Facebook and LinkedIn, but the draft
      // is the Instagram one: frame 05 still offers a Facebook version.
      expect(platformOf(INSTAGRAM, LINKEDIN)[0]).toMatchObject({ platform: "facebook" });
    });

    it("offers none when all three are covered, and counts gone templates by their canvas", () => {
      expect(platformOf(FACEBOOK, INSTAGRAM, LINKEDIN)).toEqual([]);
      const gone = draft("gone", null, {}, FACEBOOK);
      const actions = deriveTryNext(turn([gone]), { paletteSize: 0 });
      expect(actions).toEqual([
        { kind: "platform", label: "Make an Instagram version", platform: "instagram" },
      ]);
    });

    it("treats a size with no platform as covering none", () => {
      expect(platformOf({ width: 1440, height: 1440 })[0]).toMatchObject({ platform: "facebook" });
    });

    // "Make a Facebook version" can come back as the same 1080 x 1350
    // draft (the server takes every size a platform uses), which is the
    // Instagram one by its primary platform.
    const answer = turn([draft("fb", [field({})], { headline: "Hi" }, INSTAGRAM)]);
    const onlyPlatform = (asked: PlatformId[]) =>
      deriveTryNext(answer, { paletteSize: 0, askedPlatforms: new Set(asked) });

    it("never offers a platform the chat has already asked for", () => {
      expect(onlyPlatform(["facebook"])).toEqual([
        { kind: "platform", label: "Make a LinkedIn version", platform: "linkedin" },
      ]);
      expect(onlyPlatform(["facebook", "linkedin"])).toEqual([]);
      expect(onlyPlatform([])).toEqual([
        { kind: "platform", label: "Make a Facebook version", platform: "facebook" },
      ]);
    });
  });

  it("never offers more than three", () => {
    const actions = deriveTryNext(frameTurn, { paletteSize: 12 });
    expect(actions).toHaveLength(3);
  });
});

describe("platformsAskedFor", () => {
  const user = (over: Partial<UserTurn>): UserTurn => ({
    id: "u",
    role: "user",
    text: "",
    createdAt: "2026-09-25T00:00:00Z",
    variations: 1,
    intent: "followUp",
    ...over,
  });

  const answer = (replyTo: string, over: Partial<AssistantTurn> = {}) =>
    turn([draft(`d-${replyTo}`, hiringFields, {}, FACEBOOK)], {
      id: `a-${replyTo}`,
      replyTo,
      ...over,
    });

  it("collects the answered platform runs' hints, and nothing else", () => {
    const turns: ChatTurn[] = [
      user({ id: "u1", intent: "brief", platformHint: "instagram" }),
      answer("u1"),
      user({
        id: "u2",
        intent: "platform",
        platformHint: "facebook",
        text: "Make a Facebook version",
      }),
      answer("u2"),
      user({
        id: "u3",
        intent: "freestyle",
        platformHint: "instagram",
        text: "Try another layout",
      }),
      answer("u3"),
      user({
        id: "u4",
        intent: "platform",
        platformHint: "linkedin",
        text: "Make a LinkedIn version",
      }),
      answer("u4"),
      user({ id: "u5", intent: "followUp", platformHint: "x" }),
      answer("u5"),
    ];
    expect([...platformsAskedFor(turns)]).toEqual(["facebook", "linkedin"]);
    expect(platformsAskedFor([]).size).toBe(0);
  });

  it("leaves a platform on offer when its run was stopped, failed or came back empty", () => {
    const ask = (id: string) =>
      user({ id, intent: "platform", platformHint: "linkedin", text: "Make a LinkedIn version" });
    const unanswered: AssistantTurn[] = [
      answer("u1", { phase: "stopped", drafts: [] }),
      answer("u1", { phase: "error", drafts: [], error: "Too many requests." }),
      answer("u1", { phase: "done", drafts: [] }),
      answer("u1", { phase: "measuring" }),
    ];
    for (const reply of unanswered) {
      expect(platformsAskedFor([ask("u1"), reply]).size).toBe(0);
    }
    // Asked again after a stop, and answered this time.
    const turns: ChatTurn[] = [
      ask("u1"),
      answer("u1", { phase: "stopped", drafts: [] }),
      ask("u2"),
      answer("u2"),
    ];
    expect([...platformsAskedFor(turns)]).toEqual(["linkedin"]);
    // Try again on the stopped turn, answered by a new turn to the same message.
    const retried: ChatTurn[] = [
      ask("u1"),
      answer("u1", { phase: "error", drafts: [] }),
      answer("u1", { id: "a-u1-retry" }),
    ];
    expect([...platformsAskedFor(retried)]).toEqual(["linkedin"]);
  });

  it("keeps an asked, answered platform off the row", () => {
    const asked = platformsAskedFor([
      user({ id: "u1", intent: "platform", platformHint: "facebook" }),
      answer("u1"),
    ]);
    const actions = deriveTryNext(frameTurn, { paletteSize: 0, askedPlatforms: asked });
    expect(actions.filter((a) => a.kind === "platform")).toEqual([]);
  });
});

describe("indefiniteArticle", () => {
  const cases: Array<[string, "a" | "an"]> = [
    // First letters.
    ["location", "a"],
    ["Location", "a"],
    ["event", "an"],
    ["Instagram", "an"],
    ["Facebook", "a"],
    ["LinkedIn URL", "a"],
    ["yearly report", "a"],
    // A silent h.
    ["hour", "an"],
    ["Hourly rate", "an"],
    ["honest review", "an"],
    ["honorary title", "an"],
    ["heir", "an"],
    ["headline", "a"],
    ["host", "a"],
    // A vowel said as a consonant.
    ["university", "a"],
    ["unique code", "a"],
    ["unit number", "a"],
    ["uniform", "a"],
    ["user name", "a"],
    ["usual time", "a"],
    ["utility bill", "a"],
    ["European office", "a"],
    ["euro price", "a"],
    ["one-day event", "a"],
    ["once-a-year sale", "a"],
    ["url", "a"],
    // ...and the words that keep the vowel.
    ["uninvited guest", "an"],
    ["unimportant note", "an"],
    ["unidentified", "an"],
    ["update", "an"],
    ["upcoming date", "an"],
    ["urgent notice", "an"],
    ["usher", "an"],
    ["onerous task", "an"],
    ["open role", "an"],
    // Letters and acronyms, by the letter's name.
    ["X handle", "an"],
    ["x-ray", "an"],
    ["A/B test", "an"],
    ["e-mail", "an"],
    ["U-turn", "a"],
    ["FAQ link", "an"],
    ["HR contact", "an"],
    ["MBA program", "an"],
    ["SEO title", "an"],
    ["URL slug", "a"],
    ["CTA", "a"],
    ["RSVP", "an"],
    ["HR", "an"],
    ["US office", "a"],
    ["EU office", "an"],
    ["iPhone case", "an"],
    // A label typed in capitals reads as a word.
    ["LOCATION", "a"],
    ["NAME", "a"],
    ["EVENT DATE", "an"],
    ["HOUR", "an"],
    ["URL", "a"],
    // Numbers, said aloud.
    ["8-week course", "an"],
    ["80s night", "an"],
    ["11 tips", "an"],
    ["11th anniversary", "an"],
    ["18 holes", "an"],
    ["11,000 members", "an"],
    ["1 day", "a"],
    ["110 seats", "a"],
    ["$5 gift card", "a"],
    // Leading marks are skipped; nothing at all reads "a".
    ['"Open" sign', "an"],
    ["(optional) note", "an"],
    ["", "a"],
    ["\u2014", "a"],
  ];

  it.each(cases)("%s takes %s", (phrase, article) => {
    expect(indefiniteArticle(phrase)).toBe(article);
  });
});
