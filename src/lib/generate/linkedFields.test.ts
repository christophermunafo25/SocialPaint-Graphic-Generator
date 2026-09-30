import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrandKit, TemplateField, TemplateSchema } from "../types";
import { isRequiredField } from "../templates/fieldRules";
import type { AssistantTurn, ChatDraft, ChatPhoto } from "./chat";
import {
  buildLinkedFields,
  editsFor,
  findGroupForField,
  groupValue,
  inputField,
  linkedFillIn,
  labelKey,
  photoTargetsFor,
  sizeNames,
  sizeTitle,
  type LinkedEntry,
  type LinkedImageEntry,
  type LinkedTextGroup,
} from "./linkedFields";
import { deriveTryNext } from "./tryNext";

// The real isRequiredField, behind a spy, so a test can force requiredness
// independently of the optional flag.
vi.mock("../templates/fieldRules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../templates/fieldRules")>();
  return { ...actual, isRequiredField: vi.fn(actual.isRequiredField) };
});

const realRules =
  await vi.importActual<typeof import("../templates/fieldRules")>("../templates/fieldRules");

afterEach(() => {
  vi.mocked(isRequiredField).mockImplementation(realRules.isRequiredField);
});

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

const INSTAGRAM = { width: 1080, height: 1350 };
const STORY = { width: 1080, height: 1920 };
const LINKEDIN = { width: 1200, height: 627 };
const FACEBOOK = { width: 1200, height: 630 };
const CUSTOM = { width: 1000, height: 1000 };

const schema = (
  name: string,
  fields: TemplateField[],
  canvas: { width: number; height: number },
): TemplateSchema => ({
  id: `t-${name}`,
  companyId: "co-1",
  name,
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  backgroundUrl: "",
  fields,
  captionTemplate: "",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
});

/** A draft named `id` (its template's name too, unless `name` says). A
 * null `fields` is a draft whose template is gone. */
const draft = (
  id: string,
  fields: TemplateField[] | null,
  values: Record<string, string> = {},
  canvas = INSTAGRAM,
  name = id,
): ChatDraft => ({
  id,
  proposal: {
    templateId: `t-${id}`,
    templateName: name,
    values,
    caption: "",
    why: "",
    imageFieldsNeeded: [],
  },
  schema: fields ? schema(name, fields, canvas) : null,
  canvas,
  values,
});

const NO_PHOTO = { kit: null, photoTargets: {} };

const build = (drafts: ChatDraft[], opts: Parameters<typeof buildLinkedFields>[1] = NO_PHOTO) =>
  buildLinkedFields(drafts, opts);

const texts = (entries: LinkedEntry[]) =>
  entries.filter((e): e is LinkedTextGroup => e.kind === "text");

const images = (entries: LinkedEntry[]) =>
  entries.filter((e): e is LinkedImageEntry => e.kind === "image");

/** Each text group as its label and members, "draft.fieldKey". */
const shape = (entries: LinkedEntry[]) =>
  texts(entries).map((g) => ({
    label: g.label,
    members: g.members.map((m) => `${m.draftId}.${m.fieldKey}`),
  }));

describe("buildLinkedFields: grouping", () => {
  it("links the same fieldKey across drafts, labelled from the first", () => {
    const entries = build([
      draft("ig", [field({ fieldKey: "location", label: "Location" })], {}, INSTAGRAM),
      draft("li", [field({ fieldKey: "location", label: "Where" })], {}, LINKEDIN),
    ]);
    expect(shape(entries)).toEqual([
      { label: "Location", members: ["ig.location", "li.location"] },
    ]);
    expect(entries[0]).toMatchObject({ kind: "text", id: "text:ig:location", type: "text" });
  });

  it("links different keys whose labels read the same (lowercase, letters and digits)", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "event_date", label: "Event date" })]),
      draft("b", [field({ fieldKey: "when", label: "EVENT-DATE:" })]),
      draft("c", [field({ fieldKey: "datum", label: " event  Date " })]),
    ]);
    expect(shape(entries)).toEqual([
      { label: "Event date", members: ["a.event_date", "b.when", "c.datum"] },
    ]);
  });

  it("reads letters and digits beyond ASCII", () => {
    expect(labelKey("Día 2 (Café)")).toBe("día2café");
    const entries = build([
      draft("a", [field({ fieldKey: "a1", label: "Café" })]),
      draft("b", [field({ fieldKey: "b1", label: "café." })]),
      draft("c", [field({ fieldKey: "c1", label: "Cafe" })]),
    ]);
    expect(shape(entries).map((g) => g.members)).toEqual([["a.a1", "b.b1"], ["c.c1"]]);
  });

  it("never links two fields by a label with no letter or digit", () => {
    expect(labelKey(" — ")).toBe("");
    const entries = build([
      draft("a", [field({ fieldKey: "x", label: "—" })]),
      draft("b", [field({ fieldKey: "y", label: "..." })]),
      draft("c", [field({ fieldKey: "x", label: "" })]),
    ]);
    // The key still links a and c; b's punctuation label links nothing.
    expect(shape(entries).map((g) => g.members)).toEqual([["a.x", "c.x"], ["b.y"]]);
  });

  it("links through any member: a key a later member brought in counts", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "location", label: "Location" })]),
      draft("b", [field({ fieldKey: "venue", label: "Location" })]),
      draft("c", [field({ fieldKey: "venue", label: "Where" })]),
    ]);
    expect(shape(entries)).toEqual([
      { label: "Location", members: ["a.location", "b.venue", "c.venue"] },
    ]);
  });

  it("does not link selects whose options differ, even under one key", () => {
    const entries = build([
      draft("a", [
        field({
          fieldKey: "dept",
          label: "Department",
          type: "select",
          options: ["Design", "Ops"],
        }),
      ]),
      draft("b", [
        field({
          fieldKey: "dept",
          label: "Department",
          type: "select",
          options: ["Design", "Sales"],
        }),
      ]),
      draft("c", [
        field({
          fieldKey: "team",
          label: "Department",
          type: "select",
          options: ["Ops", "Design"],
        }),
      ]),
    ]);
    // Different options, and the same options in another order, stay apart.
    expect(shape(entries).map((g) => g.members)).toEqual([["a.dept"], ["b.dept"], ["c.team"]]);
  });

  it("links selects with identical option lists, keeping the options", () => {
    const options = ["Full time", "Part time"];
    const entries = build([
      draft("a", [field({ fieldKey: "kind", label: "Contract", type: "select", options })]),
      draft("b", [
        field({ fieldKey: "type", label: "contract", type: "select", options: [...options] }),
      ]),
    ]);
    const [group] = texts(entries);
    expect(group.members).toEqual([
      { draftId: "a", fieldKey: "kind" },
      { draftId: "b", fieldKey: "type" },
    ]);
    expect(group).toMatchObject({ type: "select", options });
    expect(group.maxLength).toBeUndefined();
  });

  it("links a select that joins a later select after a mismatched one", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "dept", type: "select", options: ["A", "B"] })]),
      draft("b", [field({ fieldKey: "dept", type: "select", options: ["C"] })]),
      draft("c", [field({ fieldKey: "dept", type: "select", options: ["C"] })]),
    ]);
    expect(shape(entries).map((g) => g.members)).toEqual([["a.dept"], ["b.dept", "c.dept"]]);
  });

  it("never links a select with a text field", () => {
    const entries = build([
      draft("a", [
        field({ fieldKey: "dept", label: "Department", type: "select", options: ["A"] }),
      ]),
      draft("b", [field({ fieldKey: "dept", label: "Department" })]),
    ]);
    expect(texts(entries).map((g) => g.type)).toEqual(["select", "text"]);
    expect(shape(entries).map((g) => g.members)).toEqual([["a.dept"], ["b.dept"]]);
  });

  it("links text with multiline, as multiline when any member is", () => {
    const text = [field({ fieldKey: "details", label: "Details" })];
    const multi = [field({ fieldKey: "details", label: "Details", type: "multiline" })];
    expect(texts(build([draft("a", text), draft("b", multi)]))[0].type).toBe("multiline");
    expect(texts(build([draft("a", multi), draft("b", text)]))[0].type).toBe("multiline");
    expect(texts(build([draft("a", text), draft("b", text)]))[0].type).toBe("text");
  });

  it("holds at most one field per draft: same-labelled fields of one template stay apart", () => {
    const twoNames = [
      field({ fieldKey: "name_1", label: "Name" }),
      field({ fieldKey: "name_2", label: "Name" }),
    ];
    const entries = build([draft("a", twoNames), draft("b", twoNames)]);
    expect(shape(entries)).toEqual([
      { label: "Name", members: ["a.name_1", "b.name_1"] },
      { label: "Name", members: ["a.name_2", "b.name_2"] },
    ]);
    // A later draft with one "Name" joins the first group only.
    const one = build([
      draft("a", twoNames),
      draft("c", [field({ fieldKey: "who", label: "name" })]),
    ]);
    expect(shape(one).map((g) => g.members)).toEqual([["a.name_1", "c.who"], ["a.name_2"]]);
  });

  it("matches a draft's keys before its labels", () => {
    // b's "headline" (labelled Subhead) links by key; its "title" field,
    // labelled Headline, would have taken the group by label first.
    const entries = build([
      draft("a", [field({ fieldKey: "headline", label: "Headline" })]),
      draft("b", [
        field({ fieldKey: "title", label: "Headline" }),
        field({ fieldKey: "headline", label: "Subhead" }),
      ]),
    ]);
    expect(shape(entries)).toEqual([
      { label: "Headline", members: ["a.headline", "b.headline"] },
      { label: "Headline", members: ["b.title"] },
    ]);
  });

  it("lists a repeated fieldKey in one draft once", () => {
    const entries = build([
      draft("a", [
        field({ fieldKey: "headline", label: "Headline" }),
        field({ id: "dup", fieldKey: "headline", label: "Headline again" }),
      ]),
    ]);
    expect(shape(entries)).toEqual([{ label: "Headline", members: ["a.headline"] }]);
  });

  it("lists a repeated image fieldKey in one draft once", () => {
    const entries = build([
      draft("a", [
        field({ fieldKey: "photo", label: "Photo", type: "image" }),
        field({ id: "dup", fieldKey: "photo", label: "Photo again", type: "image" }),
      ]),
    ]);
    expect(images(entries).map((e) => [e.id, e.label])).toEqual([["image:a:photo", "Photo"]]);
  });
});

describe("buildLinkedFields: order", () => {
  it("takes the first draft's form order, then fields only later drafts have, in theirs", () => {
    const entries = build([
      draft("a", [
        field({ fieldKey: "headline", label: "Headline" }),
        field({ fieldKey: "date", label: "Date" }),
      ]),
      draft("b", [
        field({ fieldKey: "venue", label: "Venue" }),
        field({ fieldKey: "date", label: "Date" }),
        field({ fieldKey: "cta", label: "Button" }),
        field({ fieldKey: "headline", label: "Headline" }),
      ]),
      draft("c", [
        field({ fieldKey: "hashtag", label: "Hashtag" }),
        field({ fieldKey: "cta", label: "Button" }),
      ]),
    ]);
    expect(shape(entries)).toEqual([
      { label: "Headline", members: ["a.headline", "b.headline"] },
      { label: "Date", members: ["a.date", "b.date"] },
      { label: "Venue", members: ["b.venue"] },
      { label: "Button", members: ["b.cta", "c.cta"] },
      { label: "Hashtag", members: ["c.hashtag"] },
    ]);
  });

  it("takes the placeholder of the first member that has one", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "location", label: "Location", placeholder: " " })]),
      draft("b", [field({ fieldKey: "location", label: "Location", placeholder: "Chicago, IL" })]),
      draft("c", [field({ fieldKey: "location", label: "Location", placeholder: "Austin, TX" })]),
    ]);
    expect(texts(entries)[0].placeholder).toBe("Chicago, IL");
    expect(texts(build([draft("a", [field({})])]))[0]).not.toHaveProperty("placeholder");
  });
});

describe("buildLinkedFields: what takes part", () => {
  it("leaves out fixed text, shapes and fixed images", () => {
    const entries = build([
      draft("a", [
        field({ fieldKey: "tagline", label: "Tagline", static: true, staticValue: "Since 1990" }),
        field({ fieldKey: "bar", label: "Bar", type: "shape", static: true }),
        field({ fieldKey: "logo", label: "Logo", type: "image", static: true }),
        field({ fieldKey: "headline", label: "Headline" }),
      ]),
    ]);
    expect(entries.map((e) => e.id)).toEqual(["text:a:headline"]);
  });

  it("leaves out fixed selects and fixed multiline text", () => {
    const entries = build([
      draft("a", [
        field({ fieldKey: "mode", label: "Mode", type: "select", options: ["A"], static: true }),
        field({ fieldKey: "legal", label: "Legal", type: "multiline", static: true }),
        field({ fieldKey: "headline", label: "Headline" }),
      ]),
      draft("b", [
        field({ fieldKey: "mode", label: "Mode", type: "select", options: ["A"] }),
        field({ fieldKey: "legal", label: "Legal", type: "multiline", static: true }),
      ]),
    ]);
    // b's member select stands alone: a's fixed one is not a member to link.
    expect(shape(entries)).toEqual([
      { label: "Headline", members: ["a.headline"] },
      { label: "Mode", members: ["b.mode"] },
    ]);
  });

  it("skips drafts whose template is gone", () => {
    const entries = build([
      draft("gone", null, { headline: "Old" }),
      draft("a", [
        field({ fieldKey: "headline" }),
        field({ fieldKey: "photo", label: "Photo", type: "image" }),
      ]),
    ]);
    expect(shape(entries)).toEqual([{ label: "Headline", members: ["a.headline"] }]);
    // One editable draft left: the slot needs no size in its label.
    expect(images(entries).map((e) => e.label)).toEqual(["Photo"]);
    expect(build([draft("gone", null)])).toEqual([]);
  });
});

describe("buildLinkedFields: required", () => {
  it("reads isRequiredField, not the legacy required flag", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "headline", required: false })]),
      draft("b", [field({ fieldKey: "headline", required: false })]),
    ]);
    // A member field is required unless marked optional, whatever the
    // legacy flag says.
    expect(texts(entries)[0].required).toBe(true);
  });

  it("reads the optional flag: a group is optional only when every member is", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "headline", optional: true })]),
      draft("b", [field({ fieldKey: "headline", optional: true })]),
    ]);
    expect(texts(entries)[0].required).toBe(false);
    const mixed = build([
      draft("a", [field({ fieldKey: "headline", optional: true })]),
      draft("b", [field({ fieldKey: "headline" })]),
    ]);
    expect(texts(mixed)[0].required).toBe(true);
  });

  it("is required when any member is, and optional when none is", () => {
    // Stand in for a codebase with optional fields: "optional" in the key.
    vi.mocked(isRequiredField).mockImplementation(
      (f) => realRules.isRequiredField(f) && !(f as TemplateField).fieldKey.includes("optional"),
    );
    const entries = build([
      draft("a", [
        field({ fieldKey: "optional_location", label: "Location" }),
        field({ fieldKey: "optional_note", label: "Note" }),
      ]),
      draft("b", [
        field({ fieldKey: "location", label: "Location" }),
        field({ fieldKey: "optional_note", label: "Note" }),
      ]),
    ]);
    expect(texts(entries).map((g) => [g.label, g.required])).toEqual([
      ["Location", true],
      ["Note", false],
    ]);
  });
});

describe("buildLinkedFields: maxLength", () => {
  const kit = (over: Partial<BrandKit> = {}): BrandKit => ({
    id: "kit",
    companyId: "co-1",
    colors: [],
    typeStyles: [{ key: "heading", name: "Heading", maxLength: 24 }],
    guidelines: [],
    ...over,
  });

  it("takes the smallest cap across the members", () => {
    const entries = build([
      draft("a", [field({ fieldKey: "headline", maxLength: 60 })]),
      draft("b", [field({ fieldKey: "headline", maxLength: 40 })]),
      draft("c", [field({ fieldKey: "headline" })]),
    ]);
    expect(texts(entries)[0].maxLength).toBe(40);
  });

  it("counts a brand type style's cap, as the fill page does", () => {
    const drafts = [
      draft("a", [field({ fieldKey: "headline", maxLength: 60, typeStyleKey: "heading" })]),
      draft("b", [field({ fieldKey: "headline", maxLength: 40 })]),
    ];
    expect(texts(build(drafts, { kit: kit(), photoTargets: {} }))[0].maxLength).toBe(24);
    // With overrides allowed, the field's own cap wins over its style's.
    const override = kit({ allowStyleOverride: true });
    expect(texts(build(drafts, { kit: override, photoTargets: {} }))[0].maxLength).toBe(40);
    // A style cap applies to a field with none of its own.
    const styledOnly = [draft("a", [field({ fieldKey: "headline", typeStyleKey: "heading" })])];
    expect(texts(build(styledOnly, { kit: kit(), photoTargets: {} }))[0].maxLength).toBe(24);
  });

  it("takes a style's cap over a smaller field cap while overrides are off", () => {
    const loose = kit({ typeStyles: [{ key: "heading", name: "Heading", maxLength: 80 }] });
    const drafts = [
      draft("a", [field({ fieldKey: "headline", maxLength: 40, typeStyleKey: "heading" })]),
    ];
    // The fill page enforces the style's 80, so the group does too.
    expect(texts(build(drafts, { kit: loose, photoTargets: {} }))[0].maxLength).toBe(80);
    // With overrides on, the field's own 40 is the rule.
    const override = { ...loose, allowStyleOverride: true };
    expect(texts(build(drafts, { kit: override, photoTargets: {} }))[0].maxLength).toBe(40);
  });

  it("ignores a style cap that is not positive", () => {
    const zero = kit({ typeStyles: [{ key: "heading", name: "Heading", maxLength: 0 }] });
    const drafts = [
      draft("a", [field({ fieldKey: "headline", maxLength: 40, typeStyleKey: "heading" })]),
      draft("b", [field({ fieldKey: "headline", maxLength: 60 })]),
    ];
    // a's effective cap is the style's 0, which is no cap; b's 60 remains.
    expect(texts(build(drafts, { kit: zero, photoTargets: {} }))[0].maxLength).toBe(60);
  });

  it("has no cap when no member has one, and ignores a cap that is not positive", () => {
    expect(texts(build([draft("a", [field({})])]))[0]).not.toHaveProperty("maxLength");
    const entries = build([
      draft("a", [field({ fieldKey: "headline", maxLength: 0 })]),
      draft("b", [field({ fieldKey: "headline", maxLength: 30 })]),
    ]);
    expect(texts(entries)[0].maxLength).toBe(30);
  });
});

describe("buildLinkedFields: image slots", () => {
  const slots = (over: Partial<TemplateField> = {}) => [
    field({ fieldKey: "headline", label: "Headline" }),
    field({ fieldKey: "photo", label: "Photo", type: "image", width: 800, height: 1000 }),
    field({ fieldKey: "headshot", label: "Headshot", type: "image", ...over }),
  ];

  it("lists every member slot after the text groups, in draft order", () => {
    const entries = build([
      draft("ig", slots(), {}, INSTAGRAM),
      draft("li", slots(), {}, LINKEDIN),
    ]);
    expect(entries.map((e) => [e.kind, e.label])).toEqual([
      ["text", "Headline"],
      ["image", "Photo · Instagram"],
      ["image", "Headshot · Instagram"],
      ["image", "Photo · LinkedIn"],
      ["image", "Headshot · LinkedIn"],
    ]);
    const [photo] = images(entries);
    expect(photo).toMatchObject({ id: "image:ig:photo", draftId: "ig" });
    // The slot comes as the template defines it: its own label and shape.
    expect(photo.field).toMatchObject({
      fieldKey: "photo",
      label: "Photo",
      width: 800,
      height: 1000,
    });
  });

  it("leaves out the slot each draft's photo fills", () => {
    const entries = build(
      [draft("ig", slots(), {}, INSTAGRAM), draft("li", slots(), {}, LINKEDIN)],
      {
        kit: null,
        photoTargets: { ig: "photo", li: "headshot" },
      },
    );
    expect(images(entries).map((e) => e.label)).toEqual([
      "Headshot · Instagram",
      "Photo · LinkedIn",
    ]);
  });

  it("keeps a slot listed once the member has filled it", () => {
    const entries = build([draft("ig", slots(), { headshot: "data:image/png;base64,AAAA" })]);
    expect(images(entries).map((e) => e.id)).toEqual(["image:ig:photo", "image:ig:headshot"]);
  });

  it("uses the plain label for a single draft", () => {
    const entries = build([draft("ig", slots())], { kit: null, photoTargets: { ig: "photo" } });
    expect(images(entries).map((e) => e.label)).toEqual(["Headshot"]);
  });

  it("names each size distinctly", () => {
    const photo = [field({ fieldKey: "photo", label: "Photo", type: "image" })];
    const labels = (drafts: ChatDraft[]) => images(build(drafts)).map((e) => e.label);

    // A size with no platform goes by its template name.
    expect(
      labels([draft("a", photo, {}, INSTAGRAM), draft("b", photo, {}, CUSTOM, "Poster")]),
    ).toEqual(["Photo · Instagram", "Photo · Poster"]);
    // Two sizes of one platform add their aspect ratios.
    expect(
      labels([
        draft("a", photo, {}, INSTAGRAM),
        draft("b", photo, {}, STORY),
        draft("c", photo, {}, FACEBOOK),
      ]),
    ).toEqual(["Photo · Instagram · 4:5", "Photo · Instagram · 9:16", "Photo · Facebook"]);
    // The same size twice is numbered, as the size switch names it.
    expect(
      labels([
        draft("a", photo, {}, INSTAGRAM, "Now hiring"),
        draft("b", photo, {}, INSTAGRAM, "Open role"),
      ]),
    ).toEqual(["Photo · Instagram 1", "Photo · Instagram 2"]);
    // A size with no platform twice, by its template name.
    expect(
      labels([
        draft("a", photo, {}, CUSTOM, "Now hiring"),
        draft("b", photo, {}, CUSTOM, "Now hiring"),
      ]),
    ).toEqual(["Photo · Now hiring 1", "Photo · Now hiring 2"]);
  });
});

describe("photoTargetsFor", () => {
  const photo: ChatPhoto = { dataUrl: "data:image/png;base64,AAAA", aspect: 1.5, source: "upload" };
  const withSlots = [
    field({ fieldKey: "logo", type: "image", static: true }),
    field({ fieldKey: "headshot", type: "image" }),
    field({ fieldKey: "background", type: "image" }),
  ];

  it("names the slot the photo fills in each draft, by imageTargetFor", () => {
    const hinted = draft("b", withSlots);
    hinted.proposal = { ...hinted.proposal, imageTargetFieldKey: "background" };
    const drafts = [draft("a", withSlots), hinted, draft("c", [field({})]), draft("gone", null)];
    expect(photoTargetsFor(drafts, photo)).toEqual({
      a: "headshot",
      b: "background",
      c: null,
      gone: null,
    });
  });

  it("names none without a photo", () => {
    expect(photoTargetsFor([draft("a", withSlots)], null)).toEqual({ a: null });
  });

  it("feeds buildLinkedFields", () => {
    const drafts = [draft("a", withSlots)];
    const entries = build(drafts, { kit: null, photoTargets: photoTargetsFor(drafts, photo) });
    expect(entries.map((e) => e.id)).toEqual(["image:a:background"]);
  });
});

describe("groupValue", () => {
  const fields = [
    field({ fieldKey: "headline" }),
    field({ fieldKey: "photo", label: "Photo", type: "image" }),
  ];

  it("shows the first member's value", () => {
    const drafts = [
      draft("a", fields, { headline: "Now hiring" }),
      draft("b", fields, { headline: "Open role" }),
    ];
    const [group] = texts(build(drafts));
    expect(groupValue(group, drafts)).toBe("Now hiring");
  });

  it("shows the preferred draft's own value, blank or not", () => {
    const drafts = [
      draft("a", fields, { headline: "Now hiring" }),
      draft("b", fields, { headline: "Open role" }),
    ];
    const [group] = texts(build(drafts));
    expect(groupValue(group, drafts, "b")).toBe("Open role");
    // A blank there is what that draft paints, so it is what the input reads.
    const blank = [
      draft("a", fields, { headline: "Now hiring" }),
      draft("b", fields, { headline: " " }),
    ];
    expect(groupValue(group, blank, "b")).toBe(" ");
    const missing = [draft("a", fields, { headline: "Now hiring" }), draft("b", fields, {})];
    expect(groupValue(group, missing, "b")).toBe("");
  });

  it("falls back when the preferred draft is not a member, or not there", () => {
    const drafts = [
      draft("a", fields, { headline: "" }),
      draft("b", fields, { headline: "Chicago" }),
      draft("c", [field({ fieldKey: "cta", label: "CTA" })], { cta: "Apply" }),
    ];
    const [group] = texts(build(drafts));
    // c is a draft of the turn without the field; "gone" is no draft at all.
    expect(groupValue(group, drafts, "c")).toBe("Chicago");
    expect(groupValue(group, drafts, "gone")).toBe("Chicago");
  });

  it("skips a blank member for one with a value when no draft is preferred", () => {
    const drafts = [
      draft("a", fields, { headline: "" }),
      draft("b", fields, { headline: "Chicago" }),
    ];
    expect(groupValue(texts(build(drafts))[0], drafts)).toBe("Chicago");
  });

  it("gives the first member's value, or empty, when every member is blank", () => {
    const drafts = [draft("a", fields, { headline: "  " }), draft("b", fields, {})];
    const [group] = texts(build(drafts));
    expect(groupValue(group, drafts)).toBe("  ");
    expect(groupValue(group, [draft("a", fields, {})])).toBe("");
    // Drafts the group no longer finds read as empty.
    expect(groupValue(group, [])).toBe("");
  });

  it("reads an image slot's value from its draft", () => {
    const drafts = [draft("a", fields, { photo: "data:image/png;base64,BBBB" })];
    const [slot] = images(build(drafts));
    expect(groupValue(slot, drafts)).toBe("data:image/png;base64,BBBB");
  });
});

describe("editsFor", () => {
  it("writes the value to every member", () => {
    const drafts = [
      draft("a", [field({ fieldKey: "location", label: "Location" })]),
      draft("b", [field({ fieldKey: "venue", label: "Location" })]),
    ];
    const [group] = texts(build(drafts));
    expect(editsFor(group, "Chicago")).toEqual([
      { draftId: "a", fieldKey: "location", value: "Chicago" },
      { draftId: "b", fieldKey: "venue", value: "Chicago" },
    ]);
  });

  it("never cuts the value to a member's cap", () => {
    const drafts = [
      draft("a", [field({ fieldKey: "headline", maxLength: 40 })]),
      draft("b", [field({ fieldKey: "headline", maxLength: 10 })]),
    ];
    const [group] = texts(build(drafts));
    expect(editsFor(group, "Senior Nurse Practitioner").map((e) => e.value)).toEqual([
      "Senior Nurse Practitioner",
      "Senior Nurse Practitioner",
    ]);
  });

  it("writes an image slot's one draft", () => {
    const [slot] = images(
      build([draft("a", [field({ fieldKey: "photo", label: "Photo", type: "image" })])]),
    );
    expect(editsFor(slot, "data:x")).toEqual([
      { draftId: "a", fieldKey: "photo", value: "data:x" },
    ]);
  });
});

describe("findGroupForField", () => {
  const drafts = [
    draft("ig", [
      field({ fieldKey: "headline" }),
      field({ fieldKey: "location", label: "Location" }),
      field({ fieldKey: "photo", label: "Photo", type: "image" }),
      field({ fieldKey: "tagline", static: true }),
    ]),
    draft(
      "li",
      [
        field({ fieldKey: "where", label: "Location" }),
        field({ fieldKey: "logo", label: "Logo", type: "image" }),
      ],
      {},
      LINKEDIN,
    ),
  ];
  const entries = build(drafts, { kit: null, photoTargets: { ig: "photo" } });

  it("finds a group by any of its members", () => {
    expect(findGroupForField(entries, "ig", "location")?.id).toBe("text:ig:location");
    expect(findGroupForField(entries, "li", "where")?.id).toBe("text:ig:location");
  });

  it("finds an image slot", () => {
    expect(findGroupForField(entries, "li", "logo")?.id).toBe("image:li:logo");
  });

  it("finds nothing for a field the editor does not list", () => {
    expect(findGroupForField(entries, "ig", "tagline")).toBeUndefined();
    expect(findGroupForField(entries, "ig", "photo")).toBeUndefined();
    expect(findGroupForField(entries, "li", "location")).toBeUndefined();
    expect(findGroupForField(entries, "gone", "headline")).toBeUndefined();
  });

  it("finds the field Try next's fill chip names (frame 05's Add a location)", () => {
    const hiring = [
      field({ fieldKey: "headline", label: "Headline" }),
      field({ fieldKey: "location", label: "Location" }),
      field({ fieldKey: "photo", label: "Photo", type: "image" }),
    ];
    const turnDrafts = [
      draft("now-hiring", hiring, { headline: "Now hiring" }, INSTAGRAM),
      draft("open-role", hiring, { headline: "Open role" }, LINKEDIN),
    ];
    const turn: AssistantTurn = {
      id: "a1",
      role: "assistant",
      createdAt: "2026-09-25T00:00:00Z",
      replyTo: "u1",
      phase: "done",
      step: 3,
      stepLabel: "",
      status: "",
      expected: 2,
      drafts: turnDrafts,
      pendingSlots: 0,
      warnings: [],
    };
    const [fill] = deriveTryNext(turn, { paletteSize: 0 });
    if (fill.kind !== "fillField") throw new Error("expected a fill action");
    const group = findGroupForField(build(turnDrafts), fill.draftId, fill.fieldKey);
    expect(group).toMatchObject({
      kind: "text",
      label: "Location",
      members: [
        { draftId: "now-hiring", fieldKey: "location" },
        { draftId: "open-role", fieldKey: "location" },
      ],
    });
  });
});

describe("inputField", () => {
  it("dresses a group as the field FieldInput enforces", () => {
    const drafts = [
      draft("a", [
        field({ fieldKey: "location", label: "Location", maxLength: 50, placeholder: "Chicago" }),
      ]),
      draft("b", [
        field({ fieldKey: "venue", label: "Location", type: "multiline", maxLength: 30 }),
      ]),
    ];
    const [group] = texts(build(drafts));
    expect(inputField(group)).toMatchObject({
      id: "text:a:location",
      fieldKey: "location",
      label: "Location",
      type: "multiline",
      maxLength: 30,
      placeholder: "Chicago",
    });
    expect(isRequiredField(inputField(group))).toBe(true);
  });

  it("carries a select's options and no cap", () => {
    const options = ["Remote", "On site"];
    const [group] = texts(
      build([
        draft("a", [
          field({ fieldKey: "mode", label: "Mode", type: "select", options, maxLength: 5 }),
        ]),
      ]),
    );
    const f = inputField(group);
    expect(f).toMatchObject({ type: "select", options });
    expect(f).not.toHaveProperty("maxLength");
  });

  it("carries the group's requiredness to the control (aria-required)", () => {
    // Stand in for the day a member field can be optional: here, one the
    // legacy flag marks optional. FieldInput asks isRequiredField of the
    // field inputField hands it.
    vi.mocked(isRequiredField).mockImplementation(
      (f) => realRules.isRequiredField(f) && (f as TemplateField).required !== false,
    );
    const drafts = [
      draft("a", [
        field({ fieldKey: "location", label: "Location", required: false }),
        field({ fieldKey: "note", label: "Note", required: false, maxLength: 0 }),
      ]),
      draft("b", [
        field({ fieldKey: "location", label: "Location" }),
        field({ fieldKey: "note", label: "Note", required: false }),
      ]),
    ];
    const [location, note] = texts(build(drafts));
    expect([location.required, note.required]).toEqual([true, false]);
    // Location is required through b: its control says so, as the tag does.
    expect(isRequiredField(inputField(location, drafts))).toBe(true);
    expect(isRequiredField(inputField(note, drafts))).toBe(false);
    // A member's own stray cap never reaches the control: only the group's.
    expect(inputField(note, drafts)).not.toHaveProperty("maxLength");
    // The dressing is the group's whichever member lends the field.
    expect(inputField(location, drafts)).toMatchObject({
      id: "text:a:location",
      fieldKey: "location",
      label: "Location",
      type: "text",
    });
  });

  it("gives an image slot its template field under the entry's label", () => {
    const photo = field({ fieldKey: "headshot", label: "Headshot", type: "image", aspectRatio: 1 });
    const [slot] = images(
      build([draft("ig", [photo], {}, INSTAGRAM), draft("li", [photo], {}, LINKEDIN)]),
    );
    expect(inputField(slot)).toEqual({ ...photo, label: "Headshot · Instagram" });
  });
});

describe("ids", () => {
  it("are unique across the list", () => {
    const fields = [
      field({ fieldKey: "headline" }),
      field({ fieldKey: "date", label: "Date" }),
      field({ fieldKey: "photo", label: "Photo", type: "image" }),
    ];
    const entries = build([
      draft("a", fields),
      draft("b", fields, {}, LINKEDIN),
      draft("c", [field({ fieldKey: "cta", label: "CTA" })]),
    ]);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stay the same when values change", () => {
    const fields = [
      field({ fieldKey: "headline" }),
      field({ fieldKey: "photo", label: "Photo", type: "image" }),
    ];
    const before = build([draft("a", fields, {}), draft("b", fields, {})]).map((e) => e.id);
    const after = build([
      draft("a", fields, { headline: "Hi" }),
      draft("b", fields, { photo: "data:x" }),
    ]).map((e) => e.id);
    expect(after).toEqual(before);
  });

  it("stay the same, members in order, when a later draft lands", () => {
    // A panel opened on a turn still measuring picks up drafts as they land.
    const fields = [
      field({ fieldKey: "headline" }),
      field({ fieldKey: "photo", label: "Photo", type: "image" }),
    ];
    const a = draft("a", fields);
    const b = draft("b", fields, {}, LINKEDIN);
    const c = draft("c", [
      field({ fieldKey: "headline" }),
      field({ fieldKey: "cta", label: "CTA" }),
    ]);
    const before = build([a, b]);
    const after = build([a, b, c]);
    const ids = (entries: LinkedEntry[]) => entries.map((e) => e.id);
    expect(ids(after).filter((id) => ids(before).includes(id))).toEqual(ids(before));
    expect(texts(after)[0].members.slice(0, 2)).toEqual(texts(before)[0].members);
    expect(texts(after)[0].members[2]).toEqual({ draftId: "c", fieldKey: "headline" });
  });
});

describe("sizeNames", () => {
  const photo = [field({ fieldKey: "photo", label: "Photo", type: "image" })];

  it("names the size switch's segments by platform and ratio", () => {
    expect(
      sizeNames([draft("a", photo, {}, INSTAGRAM), draft("b", photo, {}, LINKEDIN)], {
        ratio: "always",
      }),
    ).toEqual(["Instagram · 4:5", "LinkedIn · 1.91:1"]);
  });

  it("falls back to the template name for a size with no platform", () => {
    expect(
      sizeNames([draft("a", photo, {}, INSTAGRAM), draft("b", photo, {}, CUSTOM, "Poster")], {
        ratio: "always",
      }),
    ).toEqual(["Instagram · 4:5", "Poster · 1:1"]);
  });

  it("numbers one platform and ratio twice, leaving the other sizes as they are", () => {
    expect(
      sizeNames(
        [
          draft("a", photo, {}, INSTAGRAM, "Now hiring"),
          draft("b", photo, {}, LINKEDIN),
          draft("c", photo, {}, INSTAGRAM, "Open role"),
        ],
        { ratio: "always" },
      ),
    ).toEqual(["Instagram 1", "LinkedIn · 1.91:1", "Instagram 2"]);
    expect(
      sizeNames(
        [draft("a", photo, {}, CUSTOM, "Now hiring"), draft("b", photo, {}, CUSTOM, "Now hiring")],
        { ratio: "always" },
      ),
    ).toEqual(["Now hiring 1", "Now hiring 2"]);
  });

  it("puts what tells tied sizes apart first, not a name the segment clips", () => {
    // A freestyle run for one platform: three designs of one size whose
    // names share a long start. By name they would clip alike in a
    // 100px segment ("Product launch (…").
    const names = sizeNames(
      [
        draft("a", photo, {}, INSTAGRAM, "Product launch (new) (new)"),
        draft("b", photo, {}, INSTAGRAM, "Product launch (new)"),
        draft("c", photo, {}, INSTAGRAM, "Product launch"),
      ],
      { ratio: "always" },
    );
    expect(names).toEqual(["Instagram 1", "Instagram 2", "Instagram 3"]);
    // Short enough to show whole, and different before any clipping.
    expect(Math.max(...names.map((n) => n.length))).toBeLessThanOrEqual(12);
    expect(new Set(names.map((n) => n.slice(0, 11))).size).toBe(3);
  });

  it("numbers again a numbered name that meets another draft's", () => {
    expect(
      sizeNames(
        [
          draft("a", photo, {}, INSTAGRAM),
          draft("b", photo, {}, INSTAGRAM),
          draft("c", photo, {}, CUSTOM, "Instagram 1"),
        ],
        { ratio: "onTie" },
      ),
    ).toEqual(["Instagram 1 1", "Instagram 2", "Instagram 1 2"]);
  });

  it("keeps two ratios of one platform apart by their ratios", () => {
    expect(
      sizeNames([draft("a", photo, {}, INSTAGRAM), draft("b", photo, {}, STORY)], {
        ratio: "always",
      }),
    ).toEqual(["Instagram · 4:5", "Instagram · 9:16"]);
  });

  it("names a segment's tooltip by the design and its size", () => {
    expect(sizeTitle(draft("a", photo, {}, INSTAGRAM, "Product launch (new)"))).toBe(
      "Product launch (new) · Instagram · 4:5",
    );
    expect(sizeTitle(draft("b", photo, {}, CUSTOM, "Poster"))).toBe("Poster · 1:1");
  });

  it("adds the ratio only on a tie for image slots", () => {
    expect(
      sizeNames([draft("a", photo, {}, INSTAGRAM), draft("b", photo, {}, FACEBOOK)], {
        ratio: "onTie",
      }),
    ).toEqual(["Instagram", "Facebook"]);
    expect(
      sizeNames([draft("a", photo, {}, INSTAGRAM), draft("b", photo, {}, STORY)], {
        ratio: "onTie",
      }),
    ).toEqual(["Instagram · 4:5", "Instagram · 9:16"]);
  });
});

describe("linkedFillIn (template-chat §12.12)", () => {
  const fields = [
    field({ fieldKey: "headline", label: "Headline" }),
    field({ fieldKey: "link", label: "Link", optional: true }),
    field({ fieldKey: "photo", label: "Photo", type: "image" }),
  ];

  it("lists one tag per group empty in any draft, leading to the first draft missing it", () => {
    const a = draft("a", fields, { headline: "Now hiring" });
    const b = draft("b", fields, {}, LINKEDIN);
    const values = { a: a.values, b: b.values };
    const gaps = linkedFillIn([a, b], values, NO_PHOTO);
    expect(gaps.map((g) => [g.label.split(" · ")[0], g.draftId, g.fieldKey, g.optional])).toEqual([
      ["Headline", "b", "headline", false],
      ["Photo", "a", "photo", false],
      ["Photo", "b", "photo", false],
      ["Link", "a", "link", true],
    ]);
  });

  it("leaves out what every draft has, and the slot the turn's photo fills", () => {
    const a = draft("a", fields, { headline: "Hi", link: "x.co", photo: "data:x" });
    expect(linkedFillIn([a], { a: a.values }, NO_PHOTO)).toEqual([]);
  });
});
