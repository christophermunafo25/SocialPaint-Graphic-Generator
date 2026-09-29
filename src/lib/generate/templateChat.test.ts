// The template chat's run and reducer rules (Template chat PROMPT §9.5,
// §9.6, §12.3, §12.6, §12.8), end to end through the real reducer.

import { describe, expect, it, vi } from "vitest";
import type {
  FieldValues,
  GenerateInput,
  StoredAssistantTurn,
  GenerateResult,
  GeneratedProposal,
  TemplateField,
  TemplateSchema,
} from "../types";
import type { LineMeasurer } from "../render/autoFit";
import type { AssistantTurn, ChatDetail, ChatDraft, ChatThread, UserTurn } from "./chat";
import { missingFields } from "./draftDownload";
import { captionFor, fillInEntries, tooLongFields } from "./draftView";
import {
  buildGenerateInput,
  chatReducer,
  emptyThread,
  sameEdits,
  type ChatAction,
} from "./chatReducer";
import { blockedNote, fieldStatus } from "./editDetails";
import { runChat, type ChatRunEffects } from "./chatRun";
import { NOTHING_FIT, fillingInStatus } from "./runCopy";
import { fromStoredThread, toStoredThread } from "./threadStorage";

const T0 = "2026-09-29T10:00:00.000Z";

/** Every character is half the font size wide. */
const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

const field = (fieldKey: string, over: Partial<TemplateField> = {}): TemplateField => ({
  id: fieldKey,
  label: fieldKey,
  fieldKey,
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 60,
  lineHeight: 1,
  // Free single lines at 40px: 20 characters fit.
  fontSizePx: 40,
  ...over,
});

const TEMPLATE: TemplateSchema = {
  id: "tpl-1",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [field("role"), field("apply_link", { label: "Button link" })],
  captionTemplate: "Join us as {role}",
  variants: [
    { id: "moss", name: "Moss", isDefault: true, overrides: {} },
    { id: "lime", name: "Lime", overrides: {} },
  ],
  createdAt: T0,
  updatedAt: T0,
};

const proposal = (values: FieldValues): GeneratedProposal => ({
  templateId: "tpl-1",
  templateName: "Now hiring",
  values,
  caption: "Come paint with us.",
  why: "",
  imageFieldsNeeded: [],
});

const result = (proposals: GeneratedProposal[], over: Partial<GenerateResult> = {}) => ({
  proposals,
  warnings: [],
  meta: { model: "claude-x", generatedAt: T0, candidateCount: 1, briefLength: 10 },
  ...over,
});

/** One template chat message run to the end on `thread`. */
async function send(
  thread: ChatThread,
  text: string,
  res: GenerateResult,
  opts: { details?: ChatDetail[]; repair?: ChatRunEffects["repair"] } = {},
) {
  const runId = `run-${thread.turns.length}`;
  const userTurnId = `user-${thread.turns.length}`;
  const prior = thread.turns;
  let next = chatReducer(thread, {
    type: "sent",
    runId,
    userTurnId,
    text,
    details: opts.details,
    variations: 1,
    templateIdHint: "tpl-1",
    intent: prior.length ? "followUp" : "brief",
    mode: "library",
    status: fillingInStatus("Now hiring"),
    at: T0,
  });
  const user = next.turns.find((t) => t.id === userTurnId) as UserTurn;
  let ids = 0;
  const inputs: GenerateInput[] = [];
  const repair = vi.fn(opts.repair ?? (() => Promise.resolve({} as FieldValues)));
  const actions: ChatAction[] = [];
  await runChat(
    {
      runId,
      companyId: "co-1",
      prior,
      user,
      mode: "library",
      kit: null,
      templateChat: true,
      signal: new AbortController().signal,
      alive: () => true,
      dispatch: (a) => {
        actions.push(a);
        next = chatReducer(next, a);
      },
    },
    {
      generate: (_c, input) => {
        inputs.push(input);
        return Promise.resolve(res);
      },
      getTemplate: () => Promise.resolve(TEMPLATE),
      repair,
      measurer: () => measure,
      newId: () => `${runId}-d${++ids}`,
      now: () => T0,
      yieldToRender: () => Promise.resolve(),
    },
  );
  const turn = next.turns.find((t) => t.id === runId) as AssistantTurn;
  return { thread: next, turn, input: inputs[0], repair, actions };
}

const fresh = () => emptyThread(T0, "tpl-1");

describe("a template chat's request", () => {
  it("pins the template, sends one draft, and may ask on a bare first message", async () => {
    const { input } = await send(fresh(), "Make one for our open role", result([]));
    expect(input).toMatchObject({ templateIdHint: "tpl-1", count: 1, allowQuestion: true });
    expect(input.details).toBeUndefined();
  });

  it("sends details structured, and then never allows a question", async () => {
    const details = [{ fieldKey: "apply_link", label: "Button link", value: "socialpaint.ai" }];
    const { input } = await send(fresh(), "Hiring", result([proposal({ role: "Designer" })]), {
      details,
    });
    expect(input.details).toEqual([{ fieldKey: "apply_link", value: "socialpaint.ai" }]);
    expect(input.allowQuestion).toBeUndefined();
    expect(input.brief).toBe("Hiring");
  });

  it("never allows a question on a follow-up, or outside a template chat", async () => {
    const first = await send(fresh(), "Hiring", result([proposal({ role: "Designer" })]));
    const second = await send(first.thread, "Shorter", result([proposal({ role: "Designer" })]));
    expect(second.input.allowQuestion).toBeUndefined();
    const user = first.thread.turns[0] as UserTurn;
    expect(buildGenerateInput([], user, "library", false).allowQuestion).toBeUndefined();
  });
});

describe("the one question (§12.6)", () => {
  it("settles the turn as done with the question and no drafts, never 'nothing fit'", async () => {
    const q = "What's the role? If you have the job post, drop it in.";
    const { turn, actions } = await send(fresh(), "Make one", result([], { question: q }));
    expect(actions.map((a) => a.type)).toEqual(["questionArrived"]);
    expect(turn).toMatchObject({ phase: "done", question: q, status: q, drafts: [] });
    expect(turn.status).not.toBe(NOTHING_FIT);
  });

  it("round-trips through a save and a reopen", async () => {
    const { thread } = await send(
      fresh(),
      "Make one",
      result([], { question: "What's the role?" }),
    );
    const stored = toStoredThread(thread);
    expect(stored.templateId).toBe("tpl-1");
    const reopened = await fromStoredThread(
      { id: "c1", createdAt: T0, updatedAt: T0, ...stored },
      { companyId: "co-1", getTemplate: () => Promise.resolve(TEMPLATE) },
    );
    expect(reopened.templateId).toBe("tpl-1");
    expect((reopened.turns[1] as AssistantTurn).question).toBe("What's the role?");
  });
});

describe("a template chat's draft", () => {
  it("builds in the template's default look, 'Filling in' while it runs", async () => {
    const { turn, actions } = await send(
      fresh(),
      "Hiring",
      result([proposal({ role: "Designer" })]),
    );
    const arrived = actions.find((a) => a.type === "proposalsArrived");
    expect(arrived).toMatchObject({ status: "Filling in Now hiring." });
    expect(turn.drafts[0].variantId).toBe("moss");
    // An empty required field is not a reason to drop anything.
    expect(turn.drafts[0].values).toEqual({ role: "Designer" });
  });

  it("keeps a draft that still overflows after repair, instead of dropping it", async () => {
    const long = "x".repeat(30);
    const { turn } = await send(fresh(), "Hiring", result([proposal({ role: long })]), {
      repair: () => Promise.resolve({ role: "y".repeat(30) }),
    });
    expect(turn.phase).toBe("done");
    expect(turn.drafts).toHaveLength(1);
  });

  it("never sends a detail the member typed to repair", async () => {
    const long = "x".repeat(30);
    const details = [{ fieldKey: "role", label: "role", value: long }];
    const { turn, repair } = await send(fresh(), "Hiring", result([proposal({ role: long })]), {
      details,
    });
    expect(repair).not.toHaveBeenCalled();
    expect(turn.drafts[0].values.role).toBe(long);
    expect(turn.drafts[0].memberKeys).toEqual(["role"]);
  });

  it("keeps the look and carries forward what the member typed on a follow-up", async () => {
    const first = await send(
      fresh(),
      "Hiring",
      result([proposal({ role: "Designer", apply_link: "a.co" })]),
    );
    const draft = first.turn.drafts[0];
    let thread = chatReducer(first.thread, {
      type: "lookChanged",
      turnId: first.turn.id,
      draftId: draft.id,
      variantId: "lime",
      at: T0,
    });
    thread = chatReducer(thread, {
      type: "valuesEdited",
      turnId: first.turn.id,
      edits: [{ draftId: draft.id, fieldKey: "apply_link", value: "jobs.co/cd" }],
      at: T0,
    });
    // The model's follow-up leaves the link out; the member's stays.
    const second = await send(thread, "Shorter role", result([proposal({ role: "CD" })]));
    expect(second.turn.drafts[0]).toMatchObject({
      variantId: "lime",
      values: { role: "CD", apply_link: "jobs.co/cd" },
      memberKeys: ["apply_link"],
    });
  });

  it("switches looks without any model call, and ignores a look the template lacks", async () => {
    const first = await send(fresh(), "Hiring", result([proposal({ role: "Designer" })]));
    const draft = first.turn.drafts[0];
    const unknown = chatReducer(first.thread, {
      type: "lookChanged",
      turnId: first.turn.id,
      draftId: draft.id,
      variantId: "ghost",
      at: T0,
    });
    expect(unknown).toBe(first.thread);
  });

  it("saves the look, the caption override and the member's keys byte for byte", async () => {
    const first = await send(fresh(), "Hiring", result([proposal({ role: "Designer" })]), {
      details: [{ fieldKey: "apply_link", label: "Button link", value: "jobs.co" }],
    });
    const draft = first.turn.drafts[0];
    const thread = chatReducer(first.thread, {
      type: "captionEdited",
      turnId: first.turn.id,
      draftId: draft.id,
      caption: "My own caption",
      at: T0,
    });
    const stored = toStoredThread(thread);
    const reopened = await fromStoredThread(
      { id: "c1", createdAt: T0, updatedAt: T0, ...stored },
      { companyId: "co-1", getTemplate: () => Promise.resolve(TEMPLATE) },
    );
    const again = toStoredThread(reopened);
    expect(JSON.stringify(again)).toBe(JSON.stringify(stored));
    const storedDraft = (stored.turns[1] as StoredAssistantTurn).drafts[0];
    expect(storedDraft).toMatchObject({
      variantId: "moss",
      captionOverride: "My own caption",
      memberKeys: ["apply_link"],
    });
    expect((stored.turns[0] as { details?: unknown }).details).toEqual([
      { fieldKey: "apply_link", label: "Button link", value: "jobs.co" },
    ]);
  });

  it("starts New chat over on the same template", () => {
    const next = chatReducer(fresh(), { type: "reset", at: T0 });
    expect(next.templateId).toBe("tpl-1");
  });
});

describe("the draft's view in a template chat", () => {
  const draftOf = (values: FieldValues, over: Partial<ChatDraft> = {}): ChatDraft => ({
    id: "d1",
    proposal: { ...proposal(values), caption: "" },
    schema: {
      ...TEMPLATE,
      fields: [
        ...TEMPLATE.fields,
        field("location", { label: "Location", optional: true }),
        field("photo", { label: "Photo", type: "image" }),
      ],
      variants: [
        { id: "moss", name: "Moss", isDefault: true, overrides: {} },
        { id: "bare", name: "Bare", overrides: { apply_link: { hidden: true } } },
      ],
    },
    canvas: { width: 1080, height: 1350 },
    values,
    ...over,
  });

  it("lists what is missing: required first in form order, then optional", () => {
    const d = draftOf({ role: "Designer" });
    expect(fillInEntries(d, d.values).map((e) => [e.fieldKey, e.optional])).toEqual([
      ["apply_link", false],
      ["photo", false],
      ["location", true],
    ]);
    // The turn's photo fills its slot, so the slot is not listed.
    expect(fillInEntries(d, { ...d.values, photo: "data:x" }).map((e) => e.fieldKey)).toEqual([
      "apply_link",
      "location",
    ]);
  });

  it("reads the look: a field it hides is neither required nor listed", () => {
    const d = draftOf({ role: "Designer" }, { variantId: "bare" });
    expect(fillInEntries(d, d.values).map((e) => e.fieldKey)).not.toContain("apply_link");
    expect(missingFields(d, d.values).map((f) => f.fieldKey)).toEqual(["photo"]);
  });

  it("flags a value too long for its line against the look", () => {
    const d = draftOf({ role: "x".repeat(30), apply_link: "ok" });
    expect(tooLongFields(d, d.values, null, measure)).toEqual(["role"]);
    expect(tooLongFields(draftOf({ role: "fits" }), { role: "fits" }, null, measure)).toEqual([]);
  });

  it("never falls back to the template's caption, and shows the member's own", () => {
    const d = draftOf({ role: "Designer" });
    expect(captionFor(d)).toBe("Join us as Designer");
    expect(captionFor(d, { templateFallback: false })).toBe("");
    expect(captionFor({ ...d, captionOverride: "Mine" }, { templateFallback: false })).toBe("Mine");
  });
});

describe("Edit details", () => {
  it("shows one status, Missing before Too long before Edited", () => {
    expect(fieldStatus({ missing: true, tooLong: true, edited: true })).toBe("missing");
    expect(fieldStatus({ missing: false, tooLong: true, edited: true })).toBe("tooLong");
    expect(fieldStatus({ missing: false, tooLong: false, edited: true })).toBe("edited");
    expect(fieldStatus({ missing: false, tooLong: false, edited: false })).toBeNull();
  });

  it("names what to fill and what to shorten under Download PNG", () => {
    expect(blockedNote(["Button link"], [])).toBe("Fill required: Button link");
    expect(blockedNote([], ["Role"])).toBe("Shorten: Role");
    expect(blockedNote(["Button link", "Photo"], ["Role"])).toBe(
      "Fill required: Button link, Photo. Shorten: Role",
    );
  });

  it("Discard puts the values, look, caption and typed keys back exactly", async () => {
    const first = await send(fresh(), "Hiring", result([proposal({ role: "Designer" })]));
    const turnId = first.turn.id;
    const snapshot = first.turn.drafts;
    const draftId = snapshot[0].id;
    let thread = chatReducer(first.thread, {
      type: "valuesEdited",
      turnId,
      edits: [{ draftId, fieldKey: "apply_link", value: "jobs.co" }],
      at: T0,
    });
    thread = chatReducer(thread, {
      type: "lookChanged",
      turnId,
      draftId,
      variantId: "lime",
      at: T0,
    });
    thread = chatReducer(thread, {
      type: "captionEdited",
      turnId,
      draftId,
      caption: "Mine",
      at: T0,
    });
    const edited = (thread.turns[1] as AssistantTurn).drafts[0];
    expect(sameEdits(edited, snapshot[0])).toBe(false);
    const restored = chatReducer(thread, {
      type: "draftsRestored",
      turnId,
      drafts: snapshot,
      at: T0,
    });
    const back = (restored.turns[1] as AssistantTurn).drafts[0];
    expect(sameEdits(back, snapshot[0])).toBe(true);
    expect(back).toMatchObject({ variantId: "moss", values: { role: "Designer" } });
    expect(back.captionOverride).toBeUndefined();
    expect(back.memberKeys).toBeUndefined();
    // Nothing to put back: the same state.
    expect(
      chatReducer(restored, { type: "draftsRestored", turnId, drafts: snapshot, at: T0 }),
    ).toBe(restored);
  });
});
