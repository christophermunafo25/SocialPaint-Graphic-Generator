import { describe, expect, it, vi } from "vitest";
import type {
  FieldValues,
  GenerateResult,
  GeneratedProposal,
  TemplateField,
  TemplateSchema,
} from "../types";
import type { LineMeasurer } from "../render/autoFit";
import type { AssistantTurn, ChatThread, UserTurn } from "./chat";
import {
  buildGenerateInput,
  chatReducer,
  emptyThread,
  repairBriefFor,
  type ChatAction,
} from "./chatReducer";
import { runChat, type ChatRun, type ChatRunEffects } from "./chatRun";
import {
  GENERATE_FAILED,
  STEP_CHECKING,
  overflowingDesignWarning,
  unavailableWarning,
  unfittableDraftWarning,
  type RunMode,
} from "./runCopy";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = "2026-09-25T10:00:00.000Z";
const BRIEF = "We're hiring a Creative Director for the Chicago studio.";

/** Deterministic fake glyphs, as in measureProposal.test.ts: every
 * character is half the font size wide. */
const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

/** A free single line, 400 wide at 40px: 20 characters fit. */
const HEADLINE: TemplateField = {
  id: "headline",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 60,
  lineHeight: 1,
  fontSizePx: 40,
};
const FITS = "Now hiring";
const OVERFLOWS = "x".repeat(30);

const template = (id: string, width = 1080, height = 1350): TemplateSchema => ({
  id,
  companyId: "co-1",
  name: `Template ${id}`,
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: width,
  canvasHeight: height,
  backgroundUrl: "",
  fields: [HEADLINE],
  captionTemplate: "{headline}",
  createdAt: T0,
  updatedAt: T0,
});

const TEMPLATES: Record<string, TemplateSchema> = {
  "tpl-1": template("tpl-1"),
  "tpl-2": template("tpl-2", 1200, 627),
};

const libraryProposal = (templateId: string, headline = FITS): GeneratedProposal => ({
  templateId,
  templateName: `Template ${templateId}`,
  values: { headline },
  caption: "Come paint with us.",
  why: "It fits.",
  imageFieldsNeeded: [],
});

const designProposal = (name: string, headline = FITS): GeneratedProposal => ({
  ...libraryProposal("freestyle", headline),
  templateName: name,
  design: {
    name,
    canvasWidth: 1080,
    canvasHeight: 1080,
    captionTemplate: "{headline}",
    fields: [HEADLINE],
  },
});

const result = (proposals: GeneratedProposal[], over: Partial<GenerateResult> = {}) => ({
  proposals,
  warnings: [],
  meta: { model: "claude-x", generatedAt: T0, candidateCount: 6, briefLength: BRIEF.length },
  ...over,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const abortError = () =>
  Object.assign(new Error("The operation was aborted."), { name: "AbortError" });

/** A run of the chat's first message (or of `text` after `prior`), wired
 * to the real reducer, with a log of every dispatch and every call out in
 * the order they happened. `alive` is the chat's current-run check, which
 * a test flips to play Stop, New chat or a superseding run. */
function harness(
  fx: Partial<ChatRunEffects>,
  opts: {
    mode?: RunMode;
    thread?: ChatThread;
    text?: string;
    published?: ChatRun["published"];
  } = {},
) {
  const mode = opts.mode ?? "library";
  const before = opts.thread ?? emptyThread(T0);
  let thread = chatReducer(before, {
    type: "sent",
    runId: "run-1",
    userTurnId: "user-1",
    text: opts.text ?? BRIEF,
    variations: 2,
    intent: before.turns.length > 0 ? "followUp" : "brief",
    mode,
    at: T0,
  });
  const user = thread.turns.find((t) => t.id === "user-1") as UserTurn;
  const log: string[] = [];
  const dispatched: ChatAction[] = [];
  let alive = true;
  let ids = 0;
  const abort = new AbortController();
  const effects: ChatRunEffects = {
    generate: vi.fn(() => Promise.resolve(result([]))),
    getTemplate: vi.fn((id: string) => {
      log.push(`get ${id}`);
      return Promise.resolve(TEMPLATES[id] ?? null);
    }),
    repair: vi.fn(() => Promise.resolve({} as FieldValues)),
    measurer: () => measure,
    newId: () => `draft-${++ids}`,
    now: () => T0,
    yieldToRender: () => Promise.resolve(),
    ...fx,
  };
  const request: ChatRun = {
    runId: "run-1",
    companyId: "co-1",
    prior: before.turns,
    user,
    mode,
    kit: null,
    published: opts.published,
    signal: abort.signal,
    alive: () => alive,
    dispatch: (action) => {
      log.push(action.type);
      dispatched.push(action);
      thread = chatReducer(thread, action);
    },
  };
  return {
    effects,
    request,
    user,
    log,
    dispatched,
    abort,
    start: () => runChat(request, effects),
    kill: () => {
      alive = false;
    },
    turn: () => thread.turns.find((t) => t.id === "run-1") as AssistantTurn,
    thread: () => thread,
  };
}

// ---------------------------------------------------------------------------

describe("runChat", () => {
  it("runs a message to done, landing each draft in proposal order", async () => {
    const h = harness({
      generate: vi.fn(() =>
        Promise.resolve(
          result([libraryProposal("tpl-1"), libraryProposal("tpl-2")], {
            reply: "Here you go, in both sizes.",
            title: "Creative Director post",
          }),
        ),
      ),
    });
    await h.start();
    expect(h.log).toEqual([
      "titleSet",
      "proposalsArrived",
      "get tpl-1",
      "draftResolved",
      // Step 3 before the last proposal is resolved.
      "checking",
      "get tpl-2",
      "draftResolved",
      "done",
    ]);
    expect(h.turn()).toMatchObject({
      phase: "done",
      step: 3,
      status: "Here you go, in both sizes.",
      pendingSlots: 0,
    });
    expect(h.turn().drafts.map((d) => [d.id, d.proposal.templateId, d.canvas])).toEqual([
      ["draft-1", "tpl-1", { width: 1080, height: 1350 }],
      ["draft-2", "tpl-2", { width: 1200, height: 627 }],
    ]);
    expect(h.thread().title).toBe("Creative Director post");
  });

  it("sends the request buildGenerateInput builds, with the run's abort signal", async () => {
    const h = harness({});
    await h.start();
    expect(h.effects.generate).toHaveBeenCalledWith(
      "co-1",
      buildGenerateInput([], h.user, "library"),
      h.abort.signal,
    );
  });

  it("names each proposal's size before it is fetched, from the published list", async () => {
    const h = harness(
      {
        generate: vi.fn(() =>
          Promise.resolve(
            result([libraryProposal("tpl-2"), libraryProposal("tpl-9"), designProposal("Bold")]),
          ),
        ),
      },
      { published: [TEMPLATES["tpl-2"]] },
    );
    await h.start();
    const arrived = h.dispatched.find((a) => a.type === "proposalsArrived");
    expect(arrived).toMatchObject({
      proposals: [
        { templateName: "Template tpl-2", canvas: { width: 1200, height: 627 } },
        { templateName: "Template tpl-9", canvas: null },
        { templateName: "Bold", canvas: { width: 1080, height: 1080 } },
      ],
      meta: { model: "claude-x", candidateCount: 6, mode: "library" },
    });
  });

  it("reaches step 3 before a single proposal is resolved", async () => {
    const h = harness({
      generate: vi.fn(() => Promise.resolve(result([libraryProposal("tpl-1")]))),
    });
    await h.start();
    expect(h.log).toEqual(["proposalsArrived", "checking", "get tpl-1", "draftResolved", "done"]);
  });

  describe("the repair round", () => {
    it("runs at step 3 with the brief so far, and lands the rewrite", async () => {
      const repair = vi.fn((_c: string, input: { fields: Array<{ fieldKey: string }> }) => {
        h.log.push("repair");
        return Promise.resolve({ [input.fields[0].fieldKey]: "Short" } as FieldValues);
      });
      const h = harness({
        generate: vi.fn(() =>
          Promise.resolve(result([libraryProposal("tpl-1", OVERFLOWS), libraryProposal("tpl-2")])),
        ),
        repair,
      });
      await h.start();
      // The first of two proposals needs repair: step 3 comes with the round.
      expect(h.log.slice(0, 5)).toEqual([
        "proposalsArrived",
        "get tpl-1",
        "checking",
        "repair",
        "draftResolved",
      ]);
      expect(repair).toHaveBeenCalledWith(
        "co-1",
        {
          templateId: "tpl-1",
          brief: repairBriefFor([], h.user),
          fields: [{ fieldKey: "headline", value: OVERFLOWS, characterBudget: 18 }],
        },
        h.abort.signal,
      );
      expect(h.turn().drafts[0].values).toEqual({ headline: "Short" });
      expect(h.turn().stepLabel).toBe(STEP_CHECKING);
    });

    it("drops a proposal the rewrite still does not fit", async () => {
      const h = harness({
        generate: vi.fn(() => Promise.resolve(result([libraryProposal("tpl-1", OVERFLOWS)]))),
        repair: vi.fn(() => Promise.resolve({ headline: OVERFLOWS } as FieldValues)),
      });
      await h.start();
      expect(h.turn().warnings).toEqual([unfittableDraftWarning("Template tpl-1")]);
      expect(h.turn().phase).toBe("error");
    });
  });

  it("keeps the old warnings for a gone template and an overflowing design", async () => {
    const h = harness({
      generate: vi.fn(() =>
        Promise.resolve(
          result([
            libraryProposal("tpl-9"),
            designProposal("Too long", OVERFLOWS),
            libraryProposal("tpl-1"),
          ]),
        ),
      ),
    });
    await h.start();
    expect(h.turn().warnings).toEqual([
      unavailableWarning("Template tpl-9"),
      overflowingDesignWarning("Too long"),
    ]);
    expect(h.turn().drafts.map((d) => d.proposal.templateId)).toEqual(["tpl-1"]);
  });

  it("builds a freestyle design's template, numbered in proposal order", async () => {
    const h = harness(
      {
        generate: vi.fn(() =>
          Promise.resolve(
            result([designProposal("Bold"), designProposal("Calm")], {
              meta: {
                model: "claude-x",
                generatedAt: T0,
                candidateCount: 6,
                briefLength: 10,
                mode: "freestyle",
              },
            }),
          ),
        ),
      },
      { mode: "freestyle" },
    );
    await h.start();
    expect(h.effects.getTemplate).not.toHaveBeenCalled();
    expect(h.turn().drafts.map((d) => [d.schema?.id, d.schema?.name, d.schema?.status])).toEqual([
      ["freestyle-1", "Bold", "draft"],
      ["freestyle-2", "Calm", "draft"],
    ]);
    expect(h.turn().meta?.mode).toBe("freestyle");
  });

  describe("failures", () => {
    it("settles the turn with the server's sentence", async () => {
      const h = harness({
        generate: vi.fn(() => Promise.reject(new Error("You've hit the generate limit."))),
      });
      await h.start();
      expect(h.log).toEqual(["failed"]);
      expect(h.turn()).toMatchObject({ phase: "error", error: "You've hit the generate limit." });
    });

    it("falls back to its own sentence for an error with none", async () => {
      const h = harness({ generate: vi.fn(() => Promise.reject("nope")) });
      await h.start();
      expect(h.turn().error).toBe(GENERATE_FAILED);
    });
  });

  describe("a run that is no longer wanted", () => {
    it("dispatches nothing once stopped while the model is asked, answered or not", async () => {
      for (const settle of ["resolve", "reject"] as const) {
        const call = deferred<GenerateResult>();
        const h = harness({ generate: vi.fn(() => call.promise) });
        const done = h.start();
        h.kill();
        if (settle === "resolve") call.resolve(result([libraryProposal("tpl-1")]));
        else call.reject(abortError());
        await done;
        expect(h.dispatched).toEqual([]);
      }
    });

    it("leaves no warning behind when a stop cuts a repair round short", async () => {
      const round = deferred<FieldValues>();
      const h = harness({
        generate: vi.fn(() => Promise.resolve(result([libraryProposal("tpl-1", OVERFLOWS)]))),
        repair: vi.fn(() => round.promise),
      });
      const done = h.start();
      await vi.waitFor(() => expect(h.effects.repair).toHaveBeenCalled());
      h.kill();
      round.reject(abortError());
      await done;
      // The last proposal's step 3, then the repair round's (a no-op).
      expect(h.log).toEqual(["proposalsArrived", "checking", "get tpl-1", "checking"]);
      expect(h.turn().warnings).toEqual([]);
    });

    it("stops between drafts: nothing lands after the run is gone", async () => {
      const second = deferred<TemplateSchema | null>();
      const h = harness({
        generate: vi.fn(() =>
          Promise.resolve(result([libraryProposal("tpl-1"), libraryProposal("tpl-2")])),
        ),
        getTemplate: vi.fn((id: string) =>
          id === "tpl-2" ? second.promise : Promise.resolve(TEMPLATES[id] ?? null),
        ),
      });
      const done = h.start();
      await vi.waitFor(() => expect(h.effects.getTemplate).toHaveBeenCalledTimes(2));
      h.kill();
      second.resolve(TEMPLATES["tpl-2"]);
      await done;
      expect(h.dispatched.map((a) => a.type)).toEqual([
        "proposalsArrived",
        "draftResolved",
        "checking",
      ]);
    });

    it("never touches a turn that finished, even if something is dispatched late", async () => {
      // The reducer's half of the guard: the run's own check aside, a
      // stopped turn ignores the rest of its run.
      const h = harness({
        generate: vi.fn(() => Promise.resolve(result([libraryProposal("tpl-1")]))),
      });
      h.request.dispatch({ type: "stopped", runId: "run-1", at: T0 });
      await h.start();
      expect(h.turn()).toMatchObject({ phase: "stopped", drafts: [] });
    });
  });
});
