import { describe, expect, it } from "vitest";
import type { GeneratedProposal, TemplateField, TemplateSchema } from "../types";
import type { AssistantTurn, ChatDraft, ChatPhoto, ChatThread, UserTurn } from "./chat";
import {
  captionFor,
  captionTabs,
  draftName,
  fallbackTitle,
  imageTargetFor,
  platformLabelFor,
  previewValues,
  primaryPlatformOf,
  turnPhoto,
} from "./draftView";

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

const schema = (over: Partial<TemplateSchema> = {}): TemplateSchema => ({
  id: "t1",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [field({})],
  captionTemplate: "",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  ...over,
});

const proposal = (over: Partial<GeneratedProposal> = {}): GeneratedProposal => ({
  templateId: "t1",
  templateName: "Now hiring",
  values: {},
  caption: "",
  why: "",
  imageFieldsNeeded: [],
  ...over,
});

const draft = (over: Partial<ChatDraft> = {}): ChatDraft => {
  const s = over.schema === undefined ? schema() : over.schema;
  return {
    id: "d1",
    proposal: proposal(),
    schema: s,
    canvas: s ? { width: s.canvasWidth, height: s.canvasHeight } : { width: 1080, height: 1350 },
    values: {},
    ...over,
  };
};

const photo: ChatPhoto = { dataUrl: "data:image/png;base64,AAAA", aspect: 1.5, source: "upload" };

describe("imageTargetFor", () => {
  const slots = [
    field({ fieldKey: "logo", type: "image", static: true }),
    field({ fieldKey: "headshot", type: "image" }),
    field({ fieldKey: "background", type: "image" }),
  ];

  it("takes the hinted slot when it is a member image slot", () => {
    const s = schema({ fields: slots });
    expect(imageTargetFor(proposal({ imageTargetFieldKey: "background" }), s)).toBe("background");
  });

  it("falls back to the first member image slot without a usable hint", () => {
    const s = schema({ fields: slots });
    expect(imageTargetFor(proposal(), s)).toBe("headshot");
    // A fixed image is not the member's slot, and neither is a missing key.
    expect(imageTargetFor(proposal({ imageTargetFieldKey: "logo" }), s)).toBe("headshot");
    expect(imageTargetFor(proposal({ imageTargetFieldKey: "nope" }), s)).toBe("headshot");
  });

  it("is null when the design has no member image slot", () => {
    expect(imageTargetFor(proposal(), schema({ fields: [slots[0], field({})] }))).toBeNull();
  });
});

describe("previewValues", () => {
  const withSlot = schema({
    fields: [field({}), field({ fieldKey: "headshot", type: "image" })],
  });

  it("lays the photo over its target slot without touching the draft", () => {
    const d = draft({ schema: withSlot, values: { headline: "Hi" } });
    expect(previewValues(d, photo)).toEqual({ headline: "Hi", headshot: photo.dataUrl });
    expect(d.values).toEqual({ headline: "Hi" });
  });

  it("returns the draft's own values when there is nothing to add", () => {
    const d = draft({ schema: withSlot, values: { headline: "Hi" } });
    expect(previewValues(d, null)).toBe(d.values);
    expect(previewValues(d, undefined)).toBe(d.values);
    const noSlot = draft({ values: { headline: "Hi" } });
    expect(previewValues(noSlot, photo)).toBe(noSlot.values);
    const gone = draft({ schema: null, values: { headline: "Hi" } });
    expect(previewValues(gone, photo)).toBe(gone.values);
  });
});

describe("draftName", () => {
  it("prefers the template's current name, then the design's, then the proposal's", () => {
    expect(draftName(draft({ schema: schema({ name: "Renamed" }) }))).toBe("Renamed");
    const design = {
      name: "Bold hiring card",
      canvasWidth: 1080,
      canvasHeight: 1350,
      captionTemplate: "",
      fields: [],
    };
    expect(
      draftName(draft({ schema: null, proposal: proposal({ templateName: "x", design }) })),
    ).toBe("Bold hiring card");
    expect(draftName(draft({ schema: null, proposal: proposal({ templateName: "Old" }) }))).toBe(
      "Old",
    );
  });
});

describe("captionFor", () => {
  const tagged = schema({
    fields: [field({}), field({ fieldKey: "city", label: "City" })],
    captionTemplate: "{headline} in {city}!",
  });

  it("keeps a library draft's own caption through edits", () => {
    const d = draft({
      schema: tagged,
      proposal: proposal({ caption: "Come work with us." }),
      values: { headline: "Edited", city: "Chicago" },
    });
    expect(captionFor(d)).toBe("Come work with us.");
  });

  it("merges the template's caption from current values when the model sent none", () => {
    const d = draft({ schema: tagged, values: { headline: "Now hiring", city: "Chicago" } });
    expect(captionFor(d)).toBe("Now hiring in Chicago!");
    expect(captionFor({ ...d, values: { ...d.values, city: "Evanston" } })).toBe(
      "Now hiring in Evanston!",
    );
    // A blank caption is no caption; an empty value reads as the fill
    // page's blank.
    expect(captionFor({ ...d, proposal: proposal({ caption: "  " }), values: {} })).toBe(
      "____ in ____!",
    );
  });

  it("shows a freestyle caption as the server resolved it until a tagged field changes", () => {
    const design = {
      name: "Hiring card",
      canvasWidth: 1080,
      canvasHeight: 1350,
      captionTemplate: "{headline} in {city}!",
      fields: tagged.fields,
    };
    const d = draft({
      schema: { ...tagged, id: "freestyle-1", status: "draft" },
      // The server drops an empty tag; the client's merge would print ____.
      proposal: proposal({
        templateId: "freestyle-1",
        caption: "Now hiring in!",
        values: { headline: "Now hiring" },
        design,
      }),
      values: { headline: "Now hiring" },
    });
    expect(captionFor(d)).toBe("Now hiring in!");
    // An edit to a field the caption does not use changes nothing.
    expect(captionFor({ ...d, values: { ...d.values, other: "x" } })).toBe("Now hiring in!");
    // An edit to a tagged field recomputes it from the current values.
    expect(captionFor({ ...d, values: { headline: "Now hiring", city: "Chicago" } })).toBe(
      "Now hiring in Chicago!",
    );
    expect(captionFor({ ...d, values: { headline: "We're hiring" } })).toBe(
      "We're hiring in ____!",
    );
  });

  it("keeps the proposal's caption when the template is gone", () => {
    expect(captionFor(draft({ schema: null, proposal: proposal({ caption: "Hello." }) }))).toBe(
      "Hello.",
    );
    expect(captionFor(draft({ schema: null }))).toBe("");
  });
});

describe("platformLabelFor", () => {
  it("names the size's primary platform", () => {
    expect(platformLabelFor({ width: 1080, height: 1350 })).toBe("Instagram");
    expect(platformLabelFor({ width: 1080, height: 1920 })).toBe("Instagram");
    expect(platformLabelFor({ width: 1200, height: 627 })).toBe("LinkedIn");
    expect(platformLabelFor({ width: 1200, height: 630 })).toBe("Facebook");
    expect(platformLabelFor({ width: 1600, height: 900 })).toBe("X");
  });

  it("is null for a size that maps to no platform", () => {
    expect(platformLabelFor({ width: 1440, height: 1440 })).toBeNull();
    expect(platformLabelFor({ width: 1000, height: 1000 })).toBeNull();
  });

  it("agrees with primaryPlatformOf", () => {
    expect(primaryPlatformOf({ width: 1080, height: 1350 })).toBe("instagram");
    expect(primaryPlatformOf({ width: 999, height: 999 })).toBe("general");
  });
});

describe("captionTabs", () => {
  const sized = (id: string, name: string, width: number, height: number) =>
    draft({
      id,
      schema: schema({ id: `t-${id}`, name, canvasWidth: width, canvasHeight: height }),
      canvas: { width, height },
    });

  it("labels each draft with its platform, in order (frame 05)", () => {
    expect(
      captionTabs([sized("a", "Now hiring", 1080, 1350), sized("b", "Open role", 1200, 627)]),
    ).toEqual([
      { id: "a", label: "Instagram" },
      { id: "b", label: "LinkedIn" },
    ]);
  });

  it("uses template names for drafts that share a platform, and only for them", () => {
    expect(
      captionTabs([
        sized("a", "Now hiring", 1080, 1350),
        sized("b", "Open role", 1200, 627),
        sized("c", "Team photo", 1080, 1080),
      ]),
    ).toEqual([
      { id: "a", label: "Now hiring" },
      { id: "b", label: "LinkedIn" },
      { id: "c", label: "Team photo" },
    ]);
  });

  it("numbers labels that still tie", () => {
    expect(
      captionTabs([sized("a", "Now hiring", 1080, 1350), sized("b", "Now hiring", 1080, 1350)]),
    ).toEqual([
      { id: "a", label: "Now hiring 1" },
      { id: "b", label: "Now hiring 2" },
    ]);
    // A template named like another draft's platform.
    expect(
      captionTabs([
        sized("a", "LinkedIn", 1080, 1350),
        sized("b", "Other", 1080, 1080),
        sized("c", "Open role", 1200, 627),
      ]),
    ).toEqual([
      { id: "a", label: "LinkedIn 1" },
      { id: "b", label: "Other" },
      { id: "c", label: "LinkedIn 2" },
    ]);
  });

  it("reads General for a size with no platform, and uses the stored canvas", () => {
    const gone = draft({ id: "g", schema: null, canvas: { width: 1200, height: 627 } });
    expect(captionTabs([sized("a", "Square", 1440, 1440), gone])).toEqual([
      { id: "a", label: "General" },
      { id: "g", label: "LinkedIn" },
    ]);
    expect(captionTabs([])).toEqual([]);
  });
});

describe("fallbackTitle", () => {
  it("keeps a short brief whole, whitespace collapsed", () => {
    expect(fallbackTitle("  Open house   next\nSaturday ")).toBe("Open house next Saturday");
    expect(fallbackTitle("one two three four five six")).toBe("one two three four five six");
  });

  it("keeps six words and adds an ellipsis when the brief runs longer", () => {
    expect(fallbackTitle("We're hiring a Creative Director for our Chicago studio.")).toBe(
      "We're hiring a Creative Director for\u2026",
    );
  });

  it("never ends on closing punctuation", () => {
    expect(fallbackTitle("Open house Saturday.")).toBe("Open house Saturday");
    expect(fallbackTitle("Can you make a post?")).toBe("Can you make a post");
    expect(fallbackTitle("We're hiring a senior Creative Director, remote-friendly")).toBe(
      "We're hiring a senior Creative Director\u2026",
    );
    expect(fallbackTitle("We're hiring a Creative Director \u2014 remote")).toBe(
      "We're hiring a Creative Director\u2026",
    );
    // Punctuation alone is left as it is rather than emptied.
    expect(fallbackTitle("?!")).toBe("?!");
  });

  it("stays within 60 characters, cutting at a word", () => {
    const brief =
      "Celebrating https://www.example.com/careers/senior-nurse-practitioner-evanston today with everyone";
    const title = fallbackTitle(brief);
    expect(title).toBe("Celebrating\u2026");
    // 58 characters to the end of "interdisciplinary", then a space: the
    // word that ends inside the limit stays, the one that crosses it goes.
    const long = "Announcing extraordinarily comprehensive interdisciplinary collaborations";
    expect(fallbackTitle(long)).toBe(
      "Announcing extraordinarily comprehensive interdisciplinary\u2026",
    );
    // A word ending exactly at the 59th character keeps its place too.
    const exact = `${"b".repeat(50)} ${"c".repeat(8)} dddd`;
    expect(fallbackTitle(exact)).toBe(`${"b".repeat(50)} ${"c".repeat(8)}\u2026`);
    for (const t of [title, fallbackTitle(long), fallbackTitle(exact)]) {
      expect(Array.from(t).length).toBeLessThanOrEqual(60);
    }
  });

  it("cuts a single overlong word mid-word, never through an emoji", () => {
    const word = "a".repeat(58) + "\u{1F3A8}\u{1F3A8}\u{1F3A8}";
    const title = fallbackTitle(word);
    expect(Array.from(title)).toHaveLength(60);
    expect(title).toBe("a".repeat(58) + "\u{1F3A8}\u2026");
  });

  it("is empty for an empty brief", () => {
    expect(fallbackTitle("")).toBe("");
    expect(fallbackTitle("   \n ")).toBe("");
  });
});

describe("turnPhoto", () => {
  const user = (id: string, p?: ChatPhoto): UserTurn => ({
    id,
    role: "user",
    text: "Brief",
    createdAt: "2026-09-25T00:00:00Z",
    photo: p,
    variations: 2,
    intent: "brief",
  });
  const assistant = (id: string, replyTo: string): AssistantTurn => ({
    id,
    role: "assistant",
    createdAt: "2026-09-25T00:00:00Z",
    replyTo,
    phase: "done",
    step: 3,
    stepLabel: "",
    status: "",
    expected: 1,
    drafts: [],
    pendingSlots: 0,
    warnings: [],
  });
  const other: ChatPhoto = { ...photo, dataUrl: "data:image/png;base64,BBBB" };
  const thread: ChatThread = {
    id: null,
    title: "New chat",
    turns: [
      user("u1", photo),
      assistant("a1", "u1"),
      user("u2"),
      assistant("a2", "u2"),
      user("u3", other),
      // A retry answers the same user turn again.
      assistant("a3", "u1"),
    ],
    createdAt: "2026-09-25T00:00:00Z",
    updatedAt: "2026-09-25T00:00:00Z",
  };

  it("is the photo of the user turn the assistant turn replies to", () => {
    expect(turnPhoto(thread, assistant("a1", "u1"))).toBe(photo);
    expect(turnPhoto(thread, assistant("a3", "u1"))).toBe(photo);
  });

  it("is null when that message had none, or cannot be found", () => {
    expect(turnPhoto(thread, assistant("a2", "u2"))).toBeNull();
    expect(turnPhoto(thread, assistant("ax", "missing"))).toBeNull();
    // An id that names an assistant turn is not a message with a photo.
    expect(turnPhoto(thread, assistant("ax", "a1"))).toBeNull();
  });
});
