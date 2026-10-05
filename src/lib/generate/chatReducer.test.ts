import { describe, expect, it } from "vitest";
import type { GeneratedProposal, TemplateField, TemplateSchema } from "../types";
import type { AssistantTurn, ChatDraft, ChatPhoto, ChatThread, ChatTurn, UserTurn } from "./chat";
import {
  MAX_TURNS,
  briefSoFar,
  buildGenerateInput,
  chatReducer,
  clampVariations,
  composeBrief,
  emptyThread,
  fillSendGaps,
  firstBrief,
  followUpFrom,
  isThreadFull,
  lastComposerTurn,
  lastUserTurn,
  latestDoneTurn,
  pickMode,
  repairBriefFor,
  runningTurn,
  settleOrphanedRuns,
  turnMode,
  type ChatAction,
} from "./chatReducer";
import { fallbackTitle } from "./draftView";
import {
  DONE_FALLBACK,
  GENERATE_FAILED,
  NOTHING_FIT,
  STOPPED_STATUS,
  type ProposalShape,
} from "./runCopy";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T10:00:05.000Z";
const T2 = "2026-09-25T10:00:09.000Z";

const BRIEF =
  "We're hiring a Creative Director for the Chicago studio, starting October 6, apply by the 30th.";

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

const FIELDS: TemplateField[] = [
  field({ fieldKey: "headline", label: "Headline" }),
  field({ fieldKey: "body", label: "Body", type: "multiline" }),
  field({ fieldKey: "photo", label: "Photo", type: "image" }),
  field({ fieldKey: "tone", label: "Tone", type: "select", options: ["Warm", "Bold"] }),
  field({ fieldKey: "legal", label: "Legal", static: true, staticValue: "© Studio" }),
  field({ fieldKey: "block", label: "Block", type: "shape", shape: "rect", static: true }),
];

const schema = (id: string, name: string, width = 1080, height = 1350): TemplateSchema => ({
  id,
  companyId: "co-1",
  name,
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: width,
  canvasHeight: height,
  backgroundUrl: "",
  fields: FIELDS,
  captionTemplate: "{headline}",
  createdAt: T0,
  updatedAt: T0,
});

const proposal = (
  templateId: string,
  templateName: string,
  freestyle = false,
): GeneratedProposal => ({
  templateId,
  templateName,
  values: { headline: "Now hiring", body: "Creative Director", tone: "Bold" },
  caption: "Come paint with us.",
  why: "It fits.",
  imageFieldsNeeded: [],
  ...(freestyle
    ? {
        design: {
          name: templateName,
          canvasWidth: 1080,
          canvasHeight: 1350,
          captionTemplate: "{headline}",
          fields: FIELDS,
        },
      }
    : {}),
});

const draft = (
  id: string,
  templateId = "tpl-1",
  name = "Now hiring",
  freestyle = false,
): ChatDraft => {
  const s = schema(templateId, name);
  return {
    id,
    proposal: proposal(templateId, name, freestyle),
    schema: s,
    canvas: { width: s.canvasWidth, height: s.canvasHeight },
    values: { headline: "Now hiring", body: "Creative Director", tone: "Bold" },
  };
};

const PHOTO: ChatPhoto = { dataUrl: "data:image/png;base64,AAAA", aspect: 1.5, source: "paste" };

const sent = (over: Partial<Extract<ChatAction, { type: "sent" }>> = {}): ChatAction => ({
  type: "sent",
  runId: "run-1",
  userTurnId: "user-1",
  text: BRIEF,
  variations: 2,
  intent: "brief",
  mode: "library",
  at: T0,
  ...over,
});

const PROPOSALS: ProposalShape[] = [
  { templateName: "Now hiring", canvas: { width: 1080, height: 1350 } },
  { templateName: "Open role", canvas: { width: 1200, height: 627 } },
];

const arrived = (runId = "run-1", proposals = PROPOSALS, warnings: string[] = []): ChatAction => ({
  type: "proposalsArrived",
  runId,
  proposals,
  meta: { model: "claude-x", candidateCount: 8, mode: "library" },
  warnings,
});

const run = (thread: ChatThread, ...actions: ChatAction[]) => actions.reduce(chatReducer, thread);

const assistant = (thread: ChatThread, id = "run-1"): AssistantTurn => {
  const t = thread.turns.find((x) => x.id === id);
  if (!t || t.role !== "assistant") throw new Error(`no assistant turn ${id}`);
  return t;
};

/** A thread whose first turn finished with the given drafts. */
const doneThread = (drafts: ChatDraft[] = [draft("d1"), draft("d2", "tpl-2", "Open role")]) =>
  run(
    emptyThread(T0),
    sent(),
    arrived(),
    ...drafts.map((d): ChatAction => ({ type: "draftResolved", runId: "run-1", draft: d })),
    { type: "done", runId: "run-1", reply: "Here you go, in both sizes.", at: T1 },
  );

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

describe("emptyThread", () => {
  it("is an unsaved chat called New chat", () => {
    expect(emptyThread(T0)).toEqual({
      id: null,
      title: "New chat",
      turns: [],
      createdAt: T0,
      updatedAt: T0,
    });
  });
});

describe("sent", () => {
  it("appends the message and its assistant turn at step 1", () => {
    const t = chatReducer(emptyThread(T0), sent({ text: `  ${BRIEF}\n`, at: T1 }));
    expect(t.turns).toHaveLength(2);
    const [user, reply] = t.turns as [UserTurn, AssistantTurn];
    expect(user).toEqual({
      id: "user-1",
      role: "user",
      text: BRIEF,
      createdAt: T1,
      variations: 2,
      intent: "brief",
    });
    expect(reply).toEqual({
      id: "run-1",
      role: "assistant",
      createdAt: T1,
      replyTo: "user-1",
      phase: "asking",
      step: 1,
      stepLabel: "Reading your brief",
      status: "Reading your brief and choosing from your templates.",
      expected: 2,
      drafts: [],
      pendingSlots: 0,
      warnings: [],
    });
    expect(t.updatedAt).toBe(T1);
    expect(runningTurn(t)?.id).toBe("run-1");
  });

  it("says freestyle's step 1 status in freestyle", () => {
    const t = chatReducer(emptyThread(T0), sent({ mode: "freestyle" }));
    expect(assistant(t).status).toBe("Designing new layouts from your brand kit.");
  });

  it("snapshots the photo on the message and records only its aspect for saving", () => {
    const t = chatReducer(emptyThread(T0), sent({ photo: PHOTO }));
    const user = t.turns[0] as UserTurn;
    expect(user.photo).toBe(PHOTO);
    expect(user.hadPhoto).toEqual({ aspect: 1.5 });
  });

  it("keeps the hints and clamps the variation count to 1 to 3", () => {
    const t = chatReducer(emptyThread(T0), sent({ platformHint: "linkedin", variations: 7 }));
    const user = t.turns[0] as UserTurn;
    expect(user.platformHint).toBe("linkedin");
    expect(user.variations).toBe(3);
    expect(assistant(t).expected).toBe(3);
    expect(assistant(chatReducer(emptyThread(T0), sent({ variations: 0 }))).expected).toBe(1);
  });

  it("records a pinned message's template and not the platform it never sent", () => {
    // A pinned template goes without the platform hint (buildGenerateInput),
    // so a follow-up that reuses this message's hint must find none.
    const t = chatReducer(
      emptyThread(T0),
      sent({ platformHint: "instagram", templateIdHint: "tpl-9" }),
    );
    const user = t.turns[0] as UserTurn;
    expect(user.templateIdHint).toBe("tpl-9");
    expect(user.platformHint).toBeUndefined();
    expect(fillSendGaps({}, lastComposerTurn(t.turns))).toEqual({ variations: 2 });
    expect(buildGenerateInput([], user, "library").platformHint).toBeUndefined();
  });

  it("is ignored while a run is in flight, for blank text, and once the chat is full", () => {
    const running = chatReducer(emptyThread(T0), sent());
    expect(chatReducer(running, sent({ runId: "run-2", userTurnId: "user-2" }))).toBe(running);
    const empty = emptyThread(T0);
    expect(chatReducer(empty, sent({ text: "   " }))).toBe(empty);

    let full = emptyThread(T0);
    for (let i = 0; full.turns.length < MAX_TURNS; i++) {
      full = run(full, sent({ runId: `r${i}`, userTurnId: `u${i}` }), {
        type: "stopped",
        runId: `r${i}`,
        at: T1,
      });
    }
    expect(full.turns).toHaveLength(MAX_TURNS);
    expect(isThreadFull(full)).toBe(true);
    expect(chatReducer(full, sent({ runId: "r-last", userTurnId: "u-last" }))).toBe(full);
  });
});

describe("proposalsArrived", () => {
  it("moves to step 2 with a pending slot per proposal", () => {
    const t = run(emptyThread(T0), sent(), arrived("run-1", PROPOSALS, ["No LinkedIn templates."]));
    expect(assistant(t)).toMatchObject({
      phase: "measuring",
      step: 2,
      stepLabel: "Rendering both sizes",
      status: "Filling in your Now hiring and Open role templates.",
      pendingSlots: 2,
      meta: { model: "claude-x", candidateCount: 8, mode: "library" },
      warnings: ["No LinkedIn templates."],
    });
  });

  it("keeps each proposal's canvas for the measuring skeletons", () => {
    const shapes: ProposalShape[] = [...PROPOSALS, { templateName: "Unknown", canvas: null }];
    const t = run(emptyThread(T0), sent(), arrived("run-1", shapes));
    expect(assistant(t).slotCanvases).toEqual([
      { width: 1080, height: 1350 },
      { width: 1200, height: 627 },
      null,
    ]);
  });

  it("reads freestyle's status from the meta's mode", () => {
    const t = run(emptyThread(T0), sent({ mode: "freestyle" }), {
      ...(arrived() as Extract<ChatAction, { type: "proposalsArrived" }>),
      meta: { model: "claude-x", candidateCount: 8, mode: "freestyle" },
    });
    expect(assistant(t).status).toBe("Laying out 2 new designs.");
  });

  it("happens once per run", () => {
    const t = run(emptyThread(T0), sent(), arrived());
    expect(chatReducer(t, arrived("run-1", [PROPOSALS[0]]))).toBe(t);
  });
});

describe("checking", () => {
  it("moves to step 3 and never back", () => {
    const measuring = run(emptyThread(T0), sent(), arrived());
    const t = chatReducer(measuring, { type: "checking", runId: "run-1" });
    expect(assistant(t)).toMatchObject({ step: 3, stepLabel: "Checking every line fits" });
    expect(chatReducer(t, { type: "checking", runId: "run-1" })).toBe(t);
    // A draft landing after step 3 leaves the step alone.
    const landed = chatReducer(t, { type: "draftResolved", runId: "run-1", draft: draft("d1") });
    expect(assistant(landed).step).toBe(3);
  });

  it("waits for the proposals", () => {
    const asking = chatReducer(emptyThread(T0), sent());
    expect(chatReducer(asking, { type: "checking", runId: "run-1" })).toBe(asking);
  });
});

describe("draftResolved and draftDropped", () => {
  it("lands drafts in proposal order, replacing a slot each", () => {
    const t1 = run(emptyThread(T0), sent(), arrived(), {
      type: "draftResolved",
      runId: "run-1",
      draft: draft("d1"),
    });
    expect(assistant(t1).drafts.map((d) => d.id)).toEqual(["d1"]);
    expect(assistant(t1).pendingSlots).toBe(1);
    const t2 = chatReducer(t1, { type: "draftResolved", runId: "run-1", draft: draft("d2") });
    expect(assistant(t2).drafts.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(assistant(t2).pendingSlots).toBe(0);
  });

  it("retires a dropped proposal's slot and keeps its warning", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived("run-1", PROPOSALS, ["Server note."]),
      { type: "draftDropped", runId: "run-1", warning: "Dropped a draft." },
      { type: "draftResolved", runId: "run-1", draft: draft("d2") },
    );
    expect(assistant(t).pendingSlots).toBe(0);
    expect(assistant(t).drafts.map((d) => d.id)).toEqual(["d2"]);
    expect(assistant(t).warnings).toEqual(["Server note.", "Dropped a draft."]);
  });

  it("never lets pending slots go negative", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived("run-1", [PROPOSALS[0]]),
      { type: "draftDropped", runId: "run-1", warning: "a" },
      { type: "draftDropped", runId: "run-1", warning: "b" },
    );
    expect(assistant(t).pendingSlots).toBe(0);
  });
});

describe("done", () => {
  it("shows the server's reply as the status", () => {
    const t = doneThread();
    expect(assistant(t)).toMatchObject({
      phase: "done",
      status: "Here you go, in both sizes.",
      reply: "Here you go, in both sizes.",
      pendingSlots: 0,
    });
    expect(t.updatedAt).toBe(T1);
    expect(runningTurn(t)).toBeNull();
  });

  it("falls back to its own sentence without a reply", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived(),
      { type: "draftResolved", runId: "run-1", draft: draft("d1") },
      { type: "done", runId: "run-1", reply: "  ", at: T1 },
    );
    expect(assistant(t).status).toBe(DONE_FALLBACK);
    expect(assistant(t).reply).toBeUndefined();
  });

  it("turns into today's error when every proposal was dropped", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived(),
      { type: "draftDropped", runId: "run-1", warning: "Dropped one." },
      { type: "draftDropped", runId: "run-1", warning: "Dropped two." },
      { type: "done", runId: "run-1", reply: "Here you go.", at: T1 },
    );
    expect(assistant(t)).toMatchObject({
      phase: "error",
      status: NOTHING_FIT,
      error: NOTHING_FIT,
      pendingSlots: 0,
      warnings: ["Dropped one.", "Dropped two."],
    });
    expect(assistant(t).reply).toBeUndefined();
  });

  it("keeps its own sentence when a proposal was dropped, since the reply counts it", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived(),
      { type: "draftResolved", runId: "run-1", draft: draft("d1") },
      { type: "draftDropped", runId: "run-1", warning: "Dropped the Open role draft." },
      { type: "done", runId: "run-1", reply: "Here you go, in both sizes.", at: T1 },
    );
    expect(assistant(t)).toMatchObject({
      phase: "done",
      status: DONE_FALLBACK,
      warnings: ["Dropped the Open role draft."],
    });
    expect(assistant(t).reply).toBeUndefined();
  });

  it("is an error too when the server sent no proposals", () => {
    const t = run(emptyThread(T0), sent(), arrived("run-1", []), {
      type: "done",
      runId: "run-1",
      at: T1,
    });
    expect(assistant(t).phase).toBe("error");
  });
});

describe("stopped", () => {
  it("keeps the drafts that finished and clears the pending slots", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived(),
      { type: "draftResolved", runId: "run-1", draft: draft("d1") },
      { type: "stopped", runId: "run-1", at: T1 },
    );
    expect(assistant(t)).toMatchObject({
      phase: "stopped",
      status: STOPPED_STATUS,
      pendingSlots: 0,
    });
    expect(assistant(t).drafts.map((d) => d.id)).toEqual(["d1"]);
    expect(runningTurn(t)).toBeNull();
  });

  it("works while still asking", () => {
    const t = run(emptyThread(T0), sent(), { type: "stopped", runId: "run-1", at: T1 });
    expect(assistant(t).phase).toBe("stopped");
    expect(assistant(t).drafts).toEqual([]);
  });
});

describe("failed", () => {
  it("shows the server's sentence and offers Try again", () => {
    const limit =
      "You've hit the generate limit (10 in 10 minutes). Try again in a few minutes. The library and the manual fill path are unaffected.";
    const t = run(emptyThread(T0), sent(), {
      type: "failed",
      runId: "run-1",
      message: limit,
      at: T1,
    });
    expect(assistant(t)).toMatchObject({ phase: "error", status: limit, error: limit });
  });

  it("falls back when the error has no sentence", () => {
    const t = run(emptyThread(T0), sent(), { type: "failed", runId: "run-1", message: "", at: T1 });
    expect(assistant(t).error).toBe(GENERATE_FAILED);
  });

  it("keeps drafts that landed before the failure", () => {
    const t = run(
      emptyThread(T0),
      sent(),
      arrived(),
      { type: "draftResolved", runId: "run-1", draft: draft("d1") },
      { type: "failed", runId: "run-1", message: "Network down.", at: T1 },
    );
    expect(assistant(t).drafts).toHaveLength(1);
    expect(assistant(t).pendingSlots).toBe(0);
  });
});

describe("late results", () => {
  const late: ChatAction[] = [
    arrived(),
    { type: "checking", runId: "run-1" },
    { type: "draftResolved", runId: "run-1", draft: draft("late") },
    { type: "draftDropped", runId: "run-1", warning: "late" },
    { type: "done", runId: "run-1", reply: "late", at: T2 },
    { type: "stopped", runId: "run-1", at: T2 },
    { type: "failed", runId: "run-1", message: "late", at: T2 },
    { type: "titleSet", title: "Late title", runId: "run-1", at: T2 },
  ];

  it("never touch a stopped turn", () => {
    const stopped = run(emptyThread(T0), sent(), { type: "stopped", runId: "run-1", at: T1 });
    for (const action of late) expect(chatReducer(stopped, action)).toBe(stopped);
  });

  it("never touch a done turn or an errored one", () => {
    const done = doneThread();
    for (const action of late) expect(chatReducer(done, action)).toBe(done);
    const failed = run(emptyThread(T0), sent(), {
      type: "failed",
      runId: "run-1",
      message: "No.",
      at: T1,
    });
    for (const action of late) expect(chatReducer(failed, action)).toBe(failed);
  });

  it("never touch the run that superseded them", () => {
    // Run 1 is stopped mid-measure, run 2 starts, then run 1's results land.
    const t = run(
      emptyThread(T0),
      sent(),
      arrived(),
      { type: "stopped", runId: "run-1", at: T1 },
      sent({ runId: "run-2", userTurnId: "user-2", text: "Make it bolder", intent: "followUp" }),
    );
    const after = run(t, ...late);
    expect(after).toBe(t);
    expect(assistant(after, "run-2")).toMatchObject({ phase: "asking", drafts: [] });
  });

  it("never touch a thread that was reset", () => {
    const t = run(emptyThread(T0), sent(), { type: "reset", at: T1 });
    for (const action of late) expect(chatReducer(t, action)).toBe(t);
  });

  it("are ignored for a run id nobody knows", () => {
    const t = chatReducer(emptyThread(T0), sent());
    expect(chatReducer(t, arrived("run-x"))).toBe(t);
  });
});

describe("titleSet", () => {
  it("replaces the placeholder with the server's title", () => {
    const t = run(emptyThread(T0), sent(), {
      type: "titleSet",
      title: " Creative Director post ",
      runId: "run-1",
      at: T1,
    });
    expect(t.title).toBe("Creative Director post");
    expect(t.updatedAt).toBe(T1);
  });

  it("keeps the first real title", () => {
    const t = run(
      doneThread(),
      { type: "titleSet", title: "Creative Director post", at: T1 },
      { type: "titleSet", title: "Something else", at: T2 },
    );
    expect(t.title).toBe("Creative Director post");
  });

  it("titles the chat from the brief when a first turn finishes without one", () => {
    expect(doneThread().title).toBe(fallbackTitle(BRIEF));
    const stopped = run(emptyThread(T0), sent(), { type: "stopped", runId: "run-1", at: T1 });
    expect(stopped.title).toBe(fallbackTitle(BRIEF));
    const failed = run(emptyThread(T0), sent(), {
      type: "failed",
      runId: "run-1",
      message: "No.",
      at: T1,
    });
    expect(failed.title).toBe(fallbackTitle(BRIEF));
  });

  it("lets a later server title replace the fallback", () => {
    const t = chatReducer(doneThread(), { type: "titleSet", title: "Hiring post", at: T2 });
    expect(t.title).toBe("Hiring post");
  });

  it("does not replace a title once a real one is set, nor a blank one", () => {
    const titled = chatReducer(doneThread(), { type: "titleSet", title: "Hiring post", at: T2 });
    const done = run(
      titled,
      sent({ runId: "run-2", userTurnId: "user-2", text: "Shorter", intent: "followUp" }),
      arrived("run-2"),
      { type: "draftResolved", runId: "run-2", draft: draft("d3") },
      { type: "done", runId: "run-2", at: T2 },
    );
    expect(done.title).toBe("Hiring post");
    expect(chatReducer(emptyThread(T0), { type: "titleSet", title: "  ", at: T1 }).title).toBe(
      "New chat",
    );
  });

  it("ignores a title from a run that has finished", () => {
    const stopped = run(emptyThread(T0), sent(), { type: "stopped", runId: "run-1", at: T1 });
    expect(chatReducer(stopped, { type: "titleSet", title: "Late", runId: "run-1", at: T2 })).toBe(
      stopped,
    );
  });
});

describe("valuesEdited", () => {
  it("writes each edit to its draft and stamps the thread", () => {
    const t = doneThread();
    const edited = chatReducer(t, {
      type: "valuesEdited",
      turnId: "run-1",
      edits: [
        { draftId: "d1", fieldKey: "headline", value: "Join us" },
        { draftId: "d2", fieldKey: "headline", value: "Join us" },
        { draftId: "d2", fieldKey: "body", value: "Art Director" },
      ],
      at: T2,
    });
    const [d1, d2] = assistant(edited).drafts;
    expect(d1.values).toEqual({ headline: "Join us", body: "Creative Director", tone: "Bold" });
    expect(d2.values).toEqual({ headline: "Join us", body: "Art Director", tone: "Bold" });
    expect(edited.updatedAt).toBe(T2);
    // The proposal keeps what the model wrote.
    expect(d1.proposal.values.headline).toBe("Now hiring");
  });

  it("accepts member fields only", () => {
    const t = doneThread();
    const same = chatReducer(t, {
      type: "valuesEdited",
      turnId: "run-1",
      edits: [
        { draftId: "d1", fieldKey: "legal", value: "Hacked" },
        { draftId: "d1", fieldKey: "block", value: "x" },
        { draftId: "d1", fieldKey: "nope", value: "x" },
      ],
      at: T2,
    });
    expect(same).toBe(t);
    const photo = chatReducer(t, {
      type: "valuesEdited",
      turnId: "run-1",
      edits: [{ draftId: "d1", fieldKey: "photo", value: "data:image/png;base64,BB" }],
      at: T2,
    });
    expect(assistant(photo).drafts[0].values.photo).toBe("data:image/png;base64,BB");
  });

  it("leaves a draft whose template is gone alone, and returns the thread for a no-op", () => {
    const gone = { ...draft("d1"), schema: null };
    const t = doneThread([gone]);
    const edit: ChatAction = {
      type: "valuesEdited",
      turnId: "run-1",
      edits: [{ draftId: "d1", fieldKey: "headline", value: "New" }],
      at: T2,
    };
    expect(chatReducer(t, edit)).toBe(t);
    const unchanged = doneThread();
    expect(
      chatReducer(unchanged, {
        type: "valuesEdited",
        turnId: "run-1",
        edits: [{ draftId: "d1", fieldKey: "headline", value: "Now hiring" }],
        at: T2,
      }),
    ).toBe(unchanged);
    expect(chatReducer(unchanged, { ...edit, turnId: "user-1" })).toBe(unchanged);
  });

  it("touches only the named turn", () => {
    const t = run(
      doneThread(),
      sent({ runId: "run-2", userTurnId: "user-2", text: "Shorter", intent: "followUp" }),
      arrived("run-2"),
      { type: "draftResolved", runId: "run-2", draft: draft("d1") },
      { type: "done", runId: "run-2", at: T2 },
    );
    const edited = chatReducer(t, {
      type: "valuesEdited",
      turnId: "run-2",
      edits: [{ draftId: "d1", fieldKey: "headline", value: "Edited" }],
      at: T2,
    });
    expect(assistant(edited, "run-1").drafts[0].values.headline).toBe("Now hiring");
    expect(assistant(edited, "run-2").drafts[0].values.headline).toBe("Edited");
    expect(edited.turns[0]).toBe(t.turns[0]);
  });
});

describe("retry", () => {
  const failed = () =>
    run(emptyThread(T0), sent({ photo: PHOTO }), arrived(), {
      type: "failed",
      runId: "run-1",
      message: "No.",
      at: T1,
    });

  it("replaces the last turn in place with a fresh run of the same message", () => {
    const before = failed();
    const t = chatReducer(before, {
      type: "retry",
      turnId: "run-1",
      runId: "run-2",
      mode: "library",
      at: T2,
    });
    expect(t.turns).toHaveLength(2);
    // The same message, photo snapshot included.
    expect(t.turns[0]).toBe(before.turns[0]);
    expect((t.turns[0] as UserTurn).photo).toBe(PHOTO);
    expect(assistant(t, "run-2")).toEqual({
      id: "run-2",
      role: "assistant",
      createdAt: T2,
      replyTo: "user-1",
      phase: "asking",
      step: 1,
      stepLabel: "Reading your brief",
      status: "Reading your brief and choosing from your templates.",
      expected: 2,
      drafts: [],
      pendingSlots: 0,
      warnings: [],
    });
    expect(t.updatedAt).toBe(T2);
    // The replaced run's id is retired: its late results go nowhere.
    expect(chatReducer(t, arrived("run-1"))).toBe(t);
    expect(runningTurn(t)?.id).toBe("run-2");
  });

  it("works for a stopped or done last turn too", () => {
    const stopped = run(emptyThread(T0), sent(), { type: "stopped", runId: "run-1", at: T1 });
    const retried = chatReducer(stopped, {
      type: "retry",
      turnId: "run-1",
      runId: "run-2",
      mode: "freestyle",
      at: T2,
    });
    expect(assistant(retried, "run-2").status).toBe("Designing new layouts from your brand kit.");
    const again = chatReducer(doneThread(), {
      type: "retry",
      turnId: "run-1",
      runId: "run-2",
      mode: "library",
      at: T2,
    });
    expect(assistant(again, "run-2").phase).toBe("asking");
  });

  it("is ignored for a running turn, an older turn, or an unknown one", () => {
    const running = chatReducer(emptyThread(T0), sent());
    const retry = (turnId: string): ChatAction => ({
      type: "retry",
      turnId,
      runId: "run-9",
      mode: "library",
      at: T2,
    });
    expect(chatReducer(running, retry("run-1"))).toBe(running);
    const two = run(
      failed(),
      sent({ runId: "run-2", userTurnId: "user-2", text: "Again", intent: "followUp" }),
      { type: "stopped", runId: "run-2", at: T2 },
    );
    expect(chatReducer(two, retry("run-1"))).toBe(two);
    expect(chatReducer(two, retry("user-2"))).toBe(two);
    expect(chatReducer(two, retry("nope"))).toBe(two);
  });
});

describe("idAssigned and reset", () => {
  it("records the saved id once", () => {
    const t = chatReducer(doneThread(), { type: "idAssigned", id: "thread-1" });
    expect(t.id).toBe("thread-1");
    expect(chatReducer(t, { type: "idAssigned", id: "thread-1" })).toBe(t);
  });

  it("starts a new chat", () => {
    expect(chatReducer(doneThread(), { type: "reset", at: T2 })).toEqual(emptyThread(T2));
  });
});

describe("settleOrphanedRuns", () => {
  it("settles a restored turn that was mid-run as stopped", () => {
    const midRun = run(emptyThread(T0), sent(), arrived());
    const settled = settleOrphanedRuns(midRun);
    expect(assistant(settled)).toMatchObject({
      phase: "stopped",
      status: STOPPED_STATUS,
      pendingSlots: 0,
    });
    expect(runningTurn(settled)).toBeNull();
    const done = doneThread();
    expect(settleOrphanedRuns(done)).toBe(done);
  });
});

// ---------------------------------------------------------------------------
// Building a run
// ---------------------------------------------------------------------------

const userTurn = (over: Partial<UserTurn> = {}): UserTurn => ({
  id: "user-2",
  role: "user",
  text: "Make the date Friday",
  createdAt: T2,
  variations: 2,
  intent: "followUp",
  ...over,
});

describe("reading a thread", () => {
  it("finds the first brief, the last message and the latest finished turn", () => {
    const t = run(
      doneThread(),
      sent({ runId: "run-2", userTurnId: "user-2", text: "Shorter", intent: "followUp" }),
      { type: "stopped", runId: "run-2", at: T2 },
    );
    expect(firstBrief(t.turns)).toBe(BRIEF);
    expect(lastUserTurn(t.turns)?.id).toBe("user-2");
    expect(latestDoneTurn(t.turns)?.id).toBe("run-1");
    expect(firstBrief([])).toBeNull();
    expect(lastUserTurn([])).toBeNull();
    expect(latestDoneTurn([])).toBeNull();
  });

  it("tells a freestyle turn from a library one", () => {
    const library = assistant(doneThread());
    expect(turnMode(library)).toBe("library");
    expect(turnMode({ ...library, meta: undefined, drafts: [draft("f", "x", "Y", true)] })).toBe(
      "freestyle",
    );
    expect(
      turnMode({ ...library, meta: { model: "m", candidateCount: 1, mode: "freestyle" } }),
    ).toBe("freestyle");
  });
});

describe("lastComposerTurn", () => {
  it("passes over Try next chips to the last brief or typed follow-up", () => {
    const brief = userTurn({ id: "u1", intent: "brief", variations: 3 });
    const typed = userTurn({ id: "u2", intent: "followUp", platformHint: "linkedin" });
    const chip = userTurn({
      id: "u3",
      intent: "platform",
      platformHint: "facebook",
      variations: 1,
    });
    const layout = userTurn({ id: "u4", intent: "freestyle", variations: 1 });
    expect(lastComposerTurn([brief, chip])?.id).toBe("u1");
    expect(lastComposerTurn([brief, typed, chip, layout])?.id).toBe("u2");
    expect(lastComposerTurn([chip])).toBeNull();
    // So a typed follow-up after a chip keeps the member's own count.
    expect(fillSendGaps({}, lastComposerTurn([brief, chip]))).toEqual({ variations: 3 });
  });
});

describe("fillSendGaps", () => {
  const last = userTurn({ platformHint: "linkedin", variations: 3 });

  it("reuses the last send's platform and count when the composer has neither", () => {
    expect(fillSendGaps({}, last)).toEqual({ platformHint: "linkedin", variations: 3 });
  });

  it("keeps what the caller passed, including an explicit Any platform", () => {
    expect(fillSendGaps({ platformHint: "instagram", variations: 1 }, last)).toEqual({
      platformHint: "instagram",
      variations: 1,
    });
    expect(fillSendGaps({ platformHint: null }, last)).toEqual({ variations: 3 });
  });

  it("defaults a first message to two variations and no platform", () => {
    expect(fillSendGaps({}, null)).toEqual({ variations: 2 });
    expect(clampVariations(undefined)).toBe(2);
    expect(clampVariations(9)).toBe(3);
    expect(clampVariations(0)).toBe(1);
  });
});

describe("pickMode", () => {
  const library = doneThread().turns;
  const freestyle = doneThread([draft("f1", "freestyle-1", "Bold", true)]).turns.map((t) =>
    t.role === "assistant" && t.meta
      ? { ...t, meta: { ...t.meta, mode: "freestyle" as const } }
      : t,
  );

  it("fills the library by default", () => {
    expect(pickMode([], { intent: "brief" }, false)).toBe("library");
    expect(pickMode(library, { intent: "followUp" }, false)).toBe("library");
    expect(pickMode(library, { intent: "platform" }, false)).toBe("library");
  });

  it("runs freestyle when the library is empty and for Try another layout", () => {
    expect(pickMode([], { intent: "brief" }, true)).toBe("freestyle");
    expect(pickMode(library, { intent: "freestyle" }, false)).toBe("freestyle");
  });

  it("revises freestyle drafts as freestyle", () => {
    expect(pickMode(freestyle, { intent: "followUp" }, false)).toBe("freestyle");
    expect(pickMode(freestyle, { intent: "platform" }, false)).toBe("freestyle");
  });

  it("fills a pinned template from the library", () => {
    expect(pickMode(freestyle, { intent: "followUp", templateIdHint: "tpl-1" }, false)).toBe(
      "library",
    );
  });

  it("follows the latest finished turn, not a later stopped one", () => {
    const t = [
      ...freestyle,
      userTurn(),
      { ...assistant(doneThread()), id: "run-2", phase: "stopped" as const },
    ];
    expect(pickMode(t, { intent: "followUp" }, false)).toBe("freestyle");
  });
});

describe("briefSoFar", () => {
  /** A thread of freestyle turns: the first brief, then each follow-up
   * finishing as `phases` says. */
  const chain = (
    ...followUps: Array<{ text: string; intent?: UserTurn["intent"]; phase?: "done" | "stopped" }>
  ) => {
    let t = doneThread([draft("f1", "freestyle-1", "Bold", true)]);
    followUps.forEach(({ text, intent = "followUp", phase = "done" }, i) => {
      const runId = `run-${i + 2}`;
      t = run(
        t,
        sent({ runId, userTurnId: `user-${i + 2}`, text, intent, mode: "freestyle" }),
        arrived(runId),
        { type: "draftResolved", runId, draft: draft(`f${i + 2}`, "freestyle-1", "Bold", true) },
        phase === "done" ? { type: "done", runId, at: T2 } : { type: "stopped", runId, at: T2 },
      );
    });
    return t.turns;
  };

  it("is the first brief, then each typed follow-up a finished turn answered", () => {
    expect(briefSoFar([])).toBeNull();
    expect(briefSoFar(chain())).toBe(BRIEF);
    expect(
      briefSoFar(chain({ text: "Make it warmer" }, { text: "Stopped idea", phase: "stopped" })),
    ).toBe(`${BRIEF}\n\nMake it warmer`);
  });

  it("leaves out Try next chips, which were for their own run", () => {
    expect(
      briefSoFar(
        chain(
          { text: "Make it warmer" },
          { text: "Try another layout", intent: "freestyle" },
          { text: "Make a Facebook version", intent: "platform" },
        ),
      ),
    ).toBe(`${BRIEF}\n\nMake it warmer`);
  });

  it("keeps an earlier freestyle revision in the next freestyle brief", () => {
    const prior = chain({ text: "Make it warmer" });
    const input = buildGenerateInput(
      prior,
      userTurn({ text: "Use a bigger headline" }),
      "freestyle",
    );
    expect(input.brief).toBe(`${BRIEF}\n\nMake it warmer\n\nUse a bigger headline`);
    expect(repairBriefFor(prior, userTurn({ text: "Use a bigger headline" }))).toBe(input.brief);
  });
});

describe("composeBrief", () => {
  it("puts a blank line between the first brief and the new message", () => {
    expect(composeBrief("Open house Saturday.", "Make it bolder")).toBe(
      "Open house Saturday.\n\nMake it bolder",
    );
  });

  it("stays within the server's 1,500 characters, shortening the earlier brief first", () => {
    const composed = composeBrief("a".repeat(1500), "b".repeat(100));
    expect(composed).toHaveLength(1500);
    expect(composed.endsWith(`\n\n${"b".repeat(100)}`)).toBe(true);
    expect(composeBrief("a".repeat(10), "b".repeat(1499))).toBe("b".repeat(1499));
    expect(composeBrief("a", "b".repeat(1600))).toHaveLength(1500);
  });
});

describe("followUpFrom", () => {
  it("carries the first brief and the latest finished turn's drafts, text fields only", () => {
    const d = draft("d1");
    d.values = { ...d.values, photo: "data:image/png;base64,SECRET", legal: "x" };
    const f = followUpFrom(doneThread([d, draft("d2", "tpl-2", "Open role")]).turns);
    expect(f).toEqual({
      previousBrief: BRIEF,
      drafts: [
        {
          templateId: "tpl-1",
          templateName: "Now hiring",
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "body", value: "Creative Director" },
            { fieldKey: "tone", value: "Bold" },
          ],
        },
        {
          templateId: "tpl-2",
          templateName: "Open role",
          values: [
            { fieldKey: "headline", value: "Now hiring" },
            { fieldKey: "body", value: "Creative Director" },
            { fieldKey: "tone", value: "Bold" },
          ],
        },
      ],
    });
    expect(JSON.stringify(f)).not.toContain("data:");
  });

  it("carries the member's edits", () => {
    const t = chatReducer(doneThread(), {
      type: "valuesEdited",
      turnId: "run-1",
      edits: [{ draftId: "d1", fieldKey: "headline", value: "Join us" }],
      at: T2,
    });
    expect(followUpFrom(t.turns)?.drafts[0].values[0]).toEqual({
      fieldKey: "headline",
      value: "Join us",
    });
  });

  it("leaves out freestyle drafts and data URLs from a gone template's values", () => {
    const gone: ChatDraft = {
      ...draft("g"),
      schema: null,
      values: { headline: "Hi", photo: "data:image/png;base64,X" },
    };
    const f = followUpFrom(doneThread([draft("f", "freestyle-1", "Bold", true), gone]).turns);
    expect(f?.drafts).toEqual([
      {
        templateId: "tpl-1",
        templateName: "Now hiring",
        values: [{ fieldKey: "headline", value: "Hi" }],
      },
    ]);
  });

  it("stays within the server's limits", () => {
    const long = draft("d1", "tpl-1", "N".repeat(200));
    long.values = { ...long.values, body: "v".repeat(5000) };
    const drafts = [long, draft("d2"), draft("d3"), draft("d4")];
    const f = followUpFrom(doneThread(drafts).turns)!;
    expect(f.drafts).toHaveLength(3);
    expect(f.drafts[0].templateName).toHaveLength(120);
    expect(f.drafts[0].values.find((v) => v.fieldKey === "body")?.value).toHaveLength(4000);
  });

  it("sends no drafts when no turn has finished, and nothing before the first message", () => {
    const failed = run(emptyThread(T0), sent(), {
      type: "failed",
      runId: "run-1",
      message: "No.",
      at: T1,
    });
    expect(followUpFrom(failed.turns)).toEqual({ previousBrief: BRIEF, drafts: [] });
    expect(followUpFrom([])).toBeUndefined();
  });
});

describe("buildGenerateInput", () => {
  it("sends a first message as the brief, as the old page did", () => {
    const first = userTurn({
      id: "user-1",
      text: BRIEF,
      intent: "brief",
      platformHint: "instagram",
    });
    expect(buildGenerateInput([], first, "library")).toEqual({
      brief: BRIEF,
      count: 2,
      mode: "library",
      platformHint: "instagram",
    });
  });

  it("sends Generate's details as facts, one per kind, and never as details", () => {
    const first = userTurn({
      intent: "brief",
      details: [
        { fieldKey: "headline", label: "Headline", value: "  Spring open house " },
        { fieldKey: "date", label: "Date & time", value: "Friday" },
        { fieldKey: "date", label: "Date & time", value: "Saturday" },
        { fieldKey: "venue", label: "Venue", value: "Not a kind" },
        { fieldKey: "link", label: "Link", value: "   " },
      ],
    });
    const input = buildGenerateInput([], first, "freestyle");
    expect(input.facts).toEqual([
      { kind: "headline", value: "Spring open house" },
      { kind: "date", value: "Saturday" },
    ]);
    expect(input.details).toBeUndefined();
    // A template chat's details stay field-keyed.
    const pinned = userTurn({
      intent: "brief",
      templateIdHint: "tpl-1",
      details: [{ fieldKey: "headline", label: "Headline", value: "Hi" }],
    });
    const chat = buildGenerateInput([], pinned, "library", true);
    expect(chat.facts).toBeUndefined();
    expect(chat.details).toEqual([{ fieldKey: "headline", value: "Hi" }]);
  });

  it("carries only the photo's flag and its clamped aspect", () => {
    const first = userTurn({ intent: "brief", photo: PHOTO });
    const input = buildGenerateInput([], first, "library");
    expect(input.hasImage).toBe(true);
    expect(input.imageAspect).toBe(1.5);
    expect(JSON.stringify(input)).not.toContain(PHOTO.dataUrl);
    const panorama = userTurn({ intent: "brief", photo: { ...PHOTO, aspect: 40 } });
    expect(buildGenerateInput([], panorama, "library").imageAspect).toBe(10);
    const sliver = userTurn({ intent: "brief", photo: { ...PHOTO, aspect: 0.01 } });
    expect(buildGenerateInput([], sliver, "library").imageAspect).toBe(0.1);
  });

  it("sends no photo flag for a message whose photo was not restored", () => {
    const reopened = userTurn({ intent: "brief", hadPhoto: { aspect: 1.5 } });
    expect(buildGenerateInput([], reopened, "library").hasImage).toBeUndefined();
  });

  it("lets a pinned template win over the platform hint", () => {
    const pinned = userTurn({ intent: "brief", templateIdHint: "tpl-9", platformHint: "linkedin" });
    const input = buildGenerateInput([], pinned, "library");
    expect(input.templateIdHint).toBe("tpl-9");
    expect(input.platformHint).toBeUndefined();
  });

  it("sends a library follow-up's text as the brief with the follow-up context", () => {
    const prior = doneThread().turns;
    const input = buildGenerateInput(prior, userTurn(), "library");
    expect(input.brief).toBe("Make the date Friday");
    expect(input.mode).toBe("library");
    expect(input.followUp).toEqual(followUpFrom(prior));
    expect(input.followUp?.previousBrief).toBe(BRIEF);
  });

  it("folds the first brief into a freestyle follow-up and sends no follow-up object", () => {
    const prior = doneThread([draft("f1", "freestyle-1", "Bold", true)]).turns;
    const input = buildGenerateInput(prior, userTurn(), "freestyle");
    expect(input.brief).toBe(`${BRIEF}\n\nMake the date Friday`);
    expect(input.followUp).toBeUndefined();
  });

  it("builds a platform version as a one-draft follow-up hinted to that platform", () => {
    const prior = doneThread().turns;
    const version = userTurn({
      text: "Make a Facebook version",
      intent: "platform",
      platformHint: "facebook",
      variations: 1,
    });
    const input = buildGenerateInput(prior, version, "library");
    expect(input).toMatchObject({
      brief: "Make a Facebook version",
      count: 1,
      platformHint: "facebook",
      mode: "library",
    });
    expect(input.followUp?.drafts).toHaveLength(2);
  });

  it("builds Try another layout as a one-draft freestyle run from the first brief", () => {
    const prior = doneThread().turns;
    const layout = userTurn({
      text: "Try another layout",
      intent: "freestyle",
      platformHint: "instagram",
      variations: 1,
    });
    expect(buildGenerateInput(prior, layout, "freestyle")).toEqual({
      brief: `${BRIEF}\n\nTry another layout`,
      count: 1,
      mode: "freestyle",
      platformHint: "instagram",
    });
  });

  it("never lets a photo or an image value reach the request", () => {
    const d = draft("d1");
    d.values = { ...d.values, photo: PHOTO.dataUrl };
    const prior: ChatTurn[] = run(
      emptyThread(T0),
      sent({ photo: PHOTO }),
      arrived(),
      {
        type: "draftResolved",
        runId: "run-1",
        draft: d,
      },
      { type: "done", runId: "run-1", at: T1 },
    ).turns;
    const body = JSON.stringify(buildGenerateInput(prior, userTurn({ photo: PHOTO }), "library"));
    expect(body).not.toContain("data:");
  });
});

describe("repairBriefFor", () => {
  it("is the message itself for a first message", () => {
    expect(repairBriefFor([], userTurn({ text: BRIEF, intent: "brief" }))).toBe(BRIEF);
  });

  it("keeps the first brief's facts for a follow-up", () => {
    expect(repairBriefFor(doneThread().turns, userTurn())).toBe(`${BRIEF}\n\nMake the date Friday`);
  });
});
