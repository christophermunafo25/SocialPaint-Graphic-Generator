import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedProposal, GenerateThreadInput, TemplateSchema } from "../types";
import type { ChatDraft, ChatPhoto, ChatThread } from "./chat";
import { chatReducer, emptyThread, type ChatAction } from "./chatReducer";
import {
  SAVE_DEBOUNCE_MS,
  ThreadSaver,
  WRITES_SETTLED_MAX_MS,
  threadWritesSettled,
  type ThreadSaverStore,
} from "./threadSaver";

// ---------------------------------------------------------------------------
// Fixtures: threads made by the real reducer, fed to the saver the way the
// controller feeds it (every transition, next and prev).
// ---------------------------------------------------------------------------

const AT = "2026-09-25T10:00:00.000Z";

const SCHEMA: TemplateSchema = {
  id: "tpl-ig",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [
    {
      id: "headline",
      label: "Headline",
      fieldKey: "headline",
      type: "text",
      x: 0,
      y: 0,
      width: 400,
      height: 100,
    },
  ],
  captionTemplate: "{headline}",
  createdAt: AT,
  updatedAt: AT,
};

const proposal: GeneratedProposal = {
  templateId: SCHEMA.id,
  templateName: SCHEMA.name,
  values: { headline: "Now hiring" },
  caption: "",
  why: "",
  imageFieldsNeeded: [],
};

const draft = (id: string): ChatDraft => ({
  id,
  proposal,
  schema: SCHEMA,
  canvas: { width: 1080, height: 1350 },
  values: { headline: "Now hiring" },
});

const PHOTO: ChatPhoto = {
  dataUrl: "data:image/jpeg;base64,/9j/4AAQ",
  aspect: 1.5,
  source: "upload",
};

/** A page's thread and the saver watching it, as the controller wires
 * them: every action goes through the reducer and the saver sees the
 * transition. */
function harness(opts: { initial?: ChatThread; initialId?: string | null } = {}) {
  const writes: Array<{ kind: "create" | "update"; id?: string; input: GenerateThreadInput }> = [];
  let nextId = 1;
  let failing = false;
  const pending: Array<() => void> = [];
  let holding = false;
  const settle = <T>(value: () => T): Promise<T> =>
    holding
      ? new Promise<T>((resolve, reject) =>
          pending.push(() => {
            try {
              resolve(value());
            } catch (e) {
              reject(e);
            }
          }),
        )
      : Promise.resolve().then(value);
  const store: ThreadSaverStore = {
    create: vi.fn((_c: string, input: GenerateThreadInput) =>
      settle(() => {
        if (failing) throw new Error("offline");
        const id = `chat-${nextId++}`;
        writes.push({ kind: "create", id, input });
        return { id };
      }),
    ),
    update: vi.fn((_c: string, id: string, input: GenerateThreadInput) =>
      settle(() => {
        if (failing) throw new Error("offline");
        writes.push({ kind: "update", id, input });
      }),
    ),
  };
  const created: string[] = [];
  const unsaved: boolean[] = [];
  const saver = new ThreadSaver({
    companyId: "co-1",
    store,
    initialId: opts.initialId ?? opts.initial?.id ?? null,
    onError: () => {},
  });
  saver.attach({ onCreated: (id) => created.push(id), onUnsaved: (u) => unsaved.push(u) });
  let thread = opts.initial ?? emptyThread(AT);
  const dispatch = (action: ChatAction) => {
    const next = chatReducer(thread, action);
    const prev = thread;
    thread = next;
    saver.observe(next, prev);
  };
  let n = 0;
  /** Sends a message; the run stays in flight until finish(). */
  const send = (text = "We're hiring a Creative Director", photo?: ChatPhoto) => {
    const runId = `run-${++n}`;
    dispatch({
      type: "sent",
      runId,
      userTurnId: `user-${n}`,
      text,
      variations: 1,
      intent: thread.turns.length ? "followUp" : "brief",
      mode: "library",
      at: AT,
      ...(photo ? { photo } : {}),
    });
    return runId;
  };
  const finish = (runId: string, how: "done" | "stopped" | "failed" = "done") => {
    if (how === "done") {
      dispatch({
        type: "proposalsArrived",
        runId,
        proposals: [{ templateName: SCHEMA.name, canvas: { width: 1080, height: 1350 } }],
        meta: { model: "m", candidateCount: 1, mode: "library" },
        warnings: [],
      });
      dispatch({ type: "draftResolved", runId, draft: draft(`${runId}-d1`) });
      dispatch({ type: "done", runId, at: AT });
    } else if (how === "stopped") {
      dispatch({ type: "stopped", runId, at: AT });
    } else {
      dispatch({ type: "failed", runId, message: "You've hit the generate limit.", at: AT });
    }
  };
  const edit = (turnId: string, value: string) =>
    dispatch({
      type: "valuesEdited",
      turnId,
      edits: [{ draftId: `${turnId}-d1`, fieldKey: "headline", value }],
      at: AT,
    });
  return {
    saver,
    store,
    writes,
    created,
    unsaved,
    dispatch,
    send,
    finish,
    edit,
    get thread() {
      return thread;
    },
    fail(on: boolean) {
      failing = on;
    },
    /** Holds every write until release(). */
    hold() {
      holding = true;
    },
    release() {
      holding = false;
      pending.splice(0).forEach((go) => go());
    },
  };
}

/** Lets pending promise callbacks (the writes) run. */
const drain = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ThreadSaver (PROMPT §9.8)", () => {
  it("saves nothing until the first turn finishes, then creates the chat once", async () => {
    const h = harness();
    const run = h.send();
    await drain();
    expect(h.writes).toEqual([]);

    h.finish(run);
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(h.created).toEqual(["chat-1"]);
    expect(h.writes[0].input.turns).toHaveLength(2);
    expect(h.writes[0].input.title).toBe("We're hiring a Creative Director");
  });

  it.each(["stopped", "failed"] as const)("saves a first turn that %s", async (how) => {
    const h = harness();
    h.finish(h.send(), how);
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    const answer = h.writes[0].input.turns[1];
    expect(answer.role === "assistant" && answer.phase).toBe(how === "failed" ? "error" : how);
  });

  it("updates the same chat as each later turn finishes, never while it runs", async () => {
    const h = harness();
    h.finish(h.send());
    await drain();
    h.dispatch({ type: "idAssigned", id: "chat-1" });
    const second = h.send("Make the headline shorter");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(h.writes).toHaveLength(1);

    h.finish(second);
    await drain();
    expect(h.writes.map((w) => [w.kind, w.id])).toEqual([
      ["create", "chat-1"],
      ["update", "chat-1"],
    ]);
    expect(h.writes[1].input.turns).toHaveLength(4);
    expect(h.created).toEqual(["chat-1"]);
  });

  it("writes editor changes 800ms after the last one, as one update", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.edit(run, "Now hiring: a");
    await vi.advanceTimersByTimeAsync(500);
    h.edit(run, "Now hiring: a Director");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
    expect(h.writes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.writes.map((w) => w.kind)).toEqual(["create", "update"]);
    const answer = h.writes[1].input.turns[1];
    expect(answer.role === "assistant" && answer.drafts[0].values.headline).toBe(
      "Now hiring: a Director",
    );
  });

  it("holds an edit made while a run is in flight for that run's finished state", async () => {
    const h = harness();
    const first = h.send();
    h.finish(first);
    await drain();
    const second = h.send("Make the headline shorter");
    h.edit(first, "Edited during the run");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(h.writes).toHaveLength(1);
    h.finish(second);
    await drain();
    expect(h.writes).toHaveLength(2);
    const answer = h.writes[1].input.turns[1];
    expect(answer.role === "assistant" && answer.drafts[0].values.headline).toBe(
      "Edited during the run",
    );
  });

  it("an edit pending when a run starts is saved with the run, not on its own", async () => {
    const h = harness();
    const first = h.send();
    h.finish(first);
    await drain();
    h.edit(first, "Edited, then sent");
    const second = h.send("Make it warmer");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(h.writes).toHaveLength(1);
    h.finish(second);
    await drain();
    expect(h.writes).toHaveLength(2);
  });

  it("creates a chat once when save points come while the create is in flight", async () => {
    const h = harness();
    h.hold();
    const run = h.send();
    h.finish(run);
    h.edit(run, "One");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    h.edit(run, "Two");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(h.store.create).toHaveBeenCalledTimes(1);
    h.release();
    await drain();
    h.release();
    await drain();
    expect(h.writes.map((w) => [w.kind, w.id])).toEqual([
      ["create", "chat-1"],
      ["update", "chat-1"],
    ]);
    const answer = h.writes[1].input.turns[1];
    expect(answer.role === "assistant" && answer.drafts[0].values.headline).toBe("Two");
  });

  it("a failed save leaves the chat unsaved and running, and the next save point retries", async () => {
    const h = harness();
    h.fail(true);
    const first = h.send();
    h.finish(first);
    await drain();
    expect(h.writes).toEqual([]);
    expect(h.created).toEqual([]);
    expect(h.unsaved).toEqual([true]);

    // The chat goes on: another message runs and finishes.
    h.fail(false);
    const second = h.send("Make the headline shorter");
    expect(h.thread.turns).toHaveLength(4);
    h.finish(second);
    await drain();
    // Still unsaved, so the retry creates it, with everything so far.
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(h.writes[0].input.turns).toHaveLength(4);
    expect(h.created).toEqual(["chat-1"]);
    expect(h.unsaved).toEqual([true, false]);
  });

  it("a failed update is retried at the next edit", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.fail(true);
    h.edit(run, "Lost?");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(h.unsaved).toEqual([false, true]);
    h.fail(false);
    h.edit(run, "Saved");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(h.writes.map((w) => w.kind)).toEqual(["create", "update"]);
    expect(h.unsaved).toEqual([false, true, false]);
  });

  it("New chat after a failed save writes the change the note said was unsaved", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.fail(true);
    h.edit(run, "Edited once");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(h.unsaved).toEqual([false, true]);
    h.fail(false);
    h.dispatch({ type: "reset", at: AT });
    await drain();
    expect(h.writes.map((w) => [w.kind, w.id])).toEqual([
      ["create", "chat-1"],
      ["update", "chat-1"],
    ]);
    const answer = h.writes[1].input.turns[1];
    expect(answer.role === "assistant" && answer.drafts[0].values.headline).toBe("Edited once");
  });

  it("leaving the page after a failed save tries the chat once more", async () => {
    const h = harness();
    h.fail(true);
    const run = h.send();
    h.finish(run);
    await drain();
    expect(h.unsaved).toEqual([true]);
    h.fail(false);
    h.saver.detach();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    // The page has gone: nothing is named after it and nothing is told.
    expect(h.created).toEqual([]);
    expect(h.unsaved).toEqual([true]);
  });

  it("writes nothing when a change leaves the stored chat as it was", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.dispatch({ type: "idAssigned", id: "chat-1" });
    // The first edit is saved: the value, and the field now counts as the
    // member's own (memberKeys).
    h.edit(run, "Changed");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(h.writes).toHaveLength(2);
    // Away and back again inside the debounce: nothing new to write.
    h.edit(run, "Something else");
    h.edit(run, "Changed");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2);
    expect(h.writes).toHaveLength(2);
  });

  it("never stores the photo", async () => {
    const h = harness();
    h.finish(h.send("Team photo post", PHOTO));
    await drain();
    expect(JSON.stringify(h.writes[0].input)).not.toContain("data:");
    const user = h.writes[0].input.turns[0];
    expect(user.role === "user" && user.hadPhoto).toEqual({ aspect: 1.5 });
  });

  it("a title that arrives while nothing runs is saved like an edit", async () => {
    const h = harness();
    h.finish(h.send());
    await drain();
    h.dispatch({ type: "titleSet", title: "Creative Director post", at: AT });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(h.writes.map((w) => [w.kind, w.input.title])).toEqual([
      ["create", "We're hiring a Creative Director"],
      ["update", "Creative Director post"],
    ]);
  });

  it("New chat writes the old chat's pending edit and starts a chat of its own", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.edit(run, "Last edit");
    h.dispatch({ type: "reset", at: AT });
    await drain();
    expect(h.writes.map((w) => [w.kind, w.id])).toEqual([
      ["create", "chat-1"],
      ["update", "chat-1"],
    ]);

    // The next chat is a new row, not an update of the old one.
    h.finish(h.send("Webinar promo"));
    await drain();
    expect(h.writes.map((w) => [w.kind, w.id])).toEqual([
      ["create", "chat-1"],
      ["update", "chat-1"],
      ["create", "chat-2"],
    ]);
    expect(h.created).toEqual(["chat-1", "chat-2"]);
  });

  it("New chat mid-run saves the stopped chat but never names the new one after it", async () => {
    const h = harness();
    h.hold();
    const run = h.send();
    // The controller's reset: stop the run, then empty the thread.
    h.finish(run, "stopped");
    h.dispatch({ type: "reset", at: AT });
    h.release();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(h.created).toEqual([]);
  });

  it("a reopened chat updates its own row and never creates one", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    const reopened = { ...h.thread, id: "chat-1" };
    const r = harness({ initial: reopened });
    r.edit(run, "Reopened edit");
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(r.writes.map((w) => [w.kind, w.id])).toEqual([["update", "chat-1"]]);
    expect(r.created).toEqual([]);
  });

  it("once the page has gone, a run it stopped is still saved, silently", async () => {
    const h = harness();
    const run = h.send();
    h.saver.detach();
    // The controller's unmount: the run in flight settles as stopped.
    h.finish(run, "stopped");
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(h.created).toEqual([]);
    expect(h.unsaved).toEqual([]);
  });

  it("leaving the page writes a pending edit at once", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.edit(run, "Typed, then left");
    h.saver.detach();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create", "update"]);
  });

  it("flush writes a pending edit now (the tab is hidden)", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.edit(run, "Hidden");
    h.saver.flush();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create", "update"]);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(h.writes).toHaveLength(2);
  });

  it("writes nothing without a workspace", async () => {
    const store = { create: vi.fn(), update: vi.fn() };
    const saver = new ThreadSaver({ companyId: null, store, initialId: null });
    let thread = emptyThread(AT);
    const apply = (action: ChatAction) => {
      const next = chatReducer(thread, action);
      saver.observe(next, thread);
      thread = next;
    };
    apply({
      type: "sent",
      runId: "r",
      userTurnId: "u",
      text: "Brief",
      variations: 1,
      intent: "brief",
      mode: "library",
      at: AT,
    });
    apply({ type: "stopped", runId: "r", at: AT });
    await drain();
    expect(store.create).not.toHaveBeenCalled();
  });
});

describe("threadWritesSettled (a read after leaving a chat)", () => {
  /** Whether the promise has settled, after pending callbacks ran. */
  const watch = (p: Promise<void>) => {
    const state = { settled: false };
    void p.then(() => {
      state.settled = true;
    });
    return state;
  };

  it("resolves at once with nothing in flight", async () => {
    const waited = watch(threadWritesSettled());
    await drain();
    expect(waited.settled).toBe(true);
  });

  it("waits for a create in flight and the update it carries on to", async () => {
    const h = harness();
    h.hold();
    const run = h.send();
    h.finish(run);
    // Leaving with an edit while the create is in flight: the update waits
    // for it and goes next, and a read waits for both.
    h.edit(run, "Left with this");
    h.saver.detach();
    const waited = watch(threadWritesSettled());
    await drain();
    expect(waited.settled).toBe(false);
    // The create lands; the update it carries on to is held in turn.
    h.release();
    h.hold();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(waited.settled).toBe(false);
    h.release();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create", "update"]);
    expect(waited.settled).toBe(true);
  });

  it("waits for the pending edit leaving the page writes, and for one that fails", async () => {
    const h = harness();
    const run = h.send();
    h.finish(run);
    await drain();
    h.hold();
    h.fail(true);
    h.edit(run, "Typed, then left");
    h.saver.detach();
    const waited = watch(threadWritesSettled());
    await drain();
    expect(waited.settled).toBe(false);
    h.release();
    await drain();
    expect(waited.settled).toBe(true);
  });

  it("stops waiting for a write that hangs after WRITES_SETTLED_MAX_MS", async () => {
    const h = harness();
    h.hold();
    h.finish(h.send());
    const waited = watch(threadWritesSettled());
    await vi.advanceTimersByTimeAsync(WRITES_SETTLED_MAX_MS - 1);
    expect(waited.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(waited.settled).toBe(true);
    h.release();
    await drain();
    expect(h.writes.map((w) => w.kind)).toEqual(["create"]);
  });
});
