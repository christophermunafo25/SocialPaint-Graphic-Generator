// When and how a Generate chat saves itself (PROMPT.md §9.8): the rules as
// one small state machine with no React in it, so every case is pinned by
// threadSaver.test.ts. useThreadPersistence (the page's hook) creates one
// per chat page and feeds it every transition of the thread.
//
//  - A chat is saved the first time a turn finishes (done, stopped or
//    error). A chat whose only turn is still running is never saved.
//  - It is saved again as soon as each later turn finishes, and 800ms
//    after the member's last edit (the editor panel) or any other change
//    while nothing is running (the server's title, for one).
//  - Never while a turn is running: an edit made during a run is written
//    with that run's finished state, which is the next save point anyway.
//  - One write at a time per chat. A save point that comes while a write is
//    in flight is kept and written after it, so a new chat is created once
//    and never twice, and the last word is always the latest thread.
//  - A failed write never interrupts the chat. The thread stays in memory,
//    the chat reports itself unsaved, and the next save point tries again,
//    New chat and the page leaving among them.
//
// A chat is a session here. New chat empties the thread in place, which
// starts a new session: the old one's pending edit is written at once, and
// a write of the old chat that lands later (its create, say) still
// finishes the old chat's saving but never names the new one. The page's
// callbacks (a chat was created, the unsaved flag) go only to the current
// session and only while the page is attached, so a chat stopped by
// leaving the page is still written, and nothing touches the page it left.
//
// What a chat page writes as it goes is often still in flight when the
// member lands on the next page: leaving writes the pending edit, and New
// chat or leaving mid-run writes the stopped turn, each a round trip to the
// store. The pages that read chats (a reopened chat, Recent, History) wait
// for those writes first (threadWritesSettled), so they show the chat as
// it was left and never load a copy the write is about to replace.

import type { GenerateThreadInput } from "../types";
import { isAssistantTurn, type ChatThread } from "./chat";
import { isRunningTurn, runningTurn } from "./chatReducer";
import { toStoredThread } from "./threadStorage";

/** The editor's debounce (PROMPT §9.8). */
export const SAVE_DEBOUNCE_MS = 800;

/** The longest a read waits for chat writes in flight: a write that hangs
 * must not hold History or a reopened chat for good. Past it the read goes
 * ahead with what the store has. */
export const WRITES_SETTLED_MAX_MS = 5000;

/** Every chat write in flight, from every saver: the pages share them. */
const inFlight = new Set<Promise<void>>();

/** Resolves once every chat write in flight when it is called (and any
 * started while it waits) has succeeded or failed, or after
 * WRITES_SETTLED_MAX_MS. Never rejects. A read of chats that a page just
 * left may still be writing awaits it first: a write starts synchronously
 * at its save point, and a page's unmount (ThreadSaver.detach) runs before
 * the next page's effects, so the next page's read always sees it. */
export function threadWritesSettled(): Promise<void> {
  if (inFlight.size === 0) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, WRITES_SETTLED_MAX_MS);
  });
  const settled = (async () => {
    while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
  })();
  return Promise.race([settled, cap]).finally(() => clearTimeout(timer));
}

/** The two writes a chat needs: GenerateThreadStore's create and update. */
export interface ThreadSaverStore {
  create(companyId: string, input: GenerateThreadInput): Promise<{ id: string }>;
  update(companyId: string, id: string, input: GenerateThreadInput): Promise<void>;
}

/** What the page hears from its chat's saving. */
export interface ThreadSaverCallbacks {
  /** The chat on screen was saved for the first time, as `id`. */
  onCreated(id: string): void;
  /** Whether the chat on screen has a change its last write failed to
   * save ("This chat isn't saved yet."). */
  onUnsaved(unsaved: boolean): void;
}

export interface ThreadSaverOptions {
  /** The workspace every write of this page goes to. Null never writes. */
  companyId: string | null;
  store: ThreadSaverStore;
  /** The id of the chat the page opened on (a reopened chat), else null. */
  initialId: string | null;
  debounceMs?: number;
  /** The stored shape (threadStorage). Replaceable for tests. */
  toStored?(thread: ChatThread): GenerateThreadInput;
  /** A failed write, for the console. The member sees only the note. */
  onError?(error: unknown): void;
}

/** One chat's saving. */
interface Session {
  /** The stored chat's id, once it has one. */
  id: string | null;
  /** The thread to write next. */
  latest: ChatThread | null;
  /** The stored shape of the last write that succeeded, as JSON: a save
   * point that changes nothing stored writes nothing. */
  savedJson: string | null;
  /** A write is in flight. */
  writing: boolean;
  /** A save point came while it was in flight. */
  again: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** The last write failed and none has succeeded since. */
  failed: boolean;
}

const newSession = (id: string | null): Session => ({
  id,
  latest: null,
  savedJson: null,
  writing: false,
  again: false,
  timer: null,
  failed: false,
});

/** Whether the thread has a finished turn, which is what makes it a chat
 * worth saving. */
const hasFinishedTurn = (thread: ChatThread): boolean =>
  thread.turns.some((t) => isAssistantTurn(t) && !isRunningTurn(t));

export class ThreadSaver {
  private readonly opts: ThreadSaverOptions;
  private session: Session;
  private callbacks: ThreadSaverCallbacks | null = null;

  constructor(opts: ThreadSaverOptions) {
    this.opts = opts;
    this.session = newSession(opts.initialId);
  }

  /** The page is listening. */
  attach(callbacks: ThreadSaverCallbacks): void {
    this.callbacks = callbacks;
  }

  /** The page has gone: pending edits are written now, and later writes go
   * ahead without telling anyone. */
  detach(): void {
    this.callbacks = null;
    this.flush();
  }

  /** Writes the current chat's pending edit now instead of at the end of
   * its debounce (the tab is being hidden or closed, or the page left). */
  flush(): void {
    this.flushSession(this.session);
  }

  /** Every transition of the thread, as the reducer made it: `next` is the
   * thread after the action, `prev` before it. */
  observe(next: ChatThread, prev: ChatThread): void {
    if (next === prev) return;
    if (next.turns.length === 0) {
      // New chat: the chat that was on screen writes what it has left, and
      // a new one begins. (An empty thread is otherwise only ever the one
      // the page started with, which is never observed.)
      if (prev.turns.length > 0) {
        this.flushSession(this.session);
        this.session = newSession(null);
        this.callbacks?.onUnsaved(false);
      }
      return;
    }
    // The id arriving, or a stamp: nothing a stored chat holds.
    if (next.turns === prev.turns && next.title === prev.title) return;
    const session = this.session;
    if (runningTurn(next)) {
      // A pending edit rides with the run's finished state instead.
      this.cancelTimer(session);
      return;
    }
    if (!hasFinishedTurn(next)) return;
    session.latest = next;
    if (runningTurn(prev) || !this.callbacks) this.saveNow(session);
    else this.schedule(session);
  }

  private saveNow(session: Session): void {
    this.cancelTimer(session);
    this.start(session);
  }

  private schedule(session: Session): void {
    this.cancelTimer(session);
    session.timer = setTimeout(() => {
      session.timer = null;
      this.start(session);
    }, this.opts.debounceMs ?? SAVE_DEBOUNCE_MS);
  }

  /** Starts a write, in the shared set of writes in flight until it (and
   * a save point it carries on to) settles. */
  private start(session: Session): void {
    const writing = this.write(session);
    inFlight.add(writing);
    void writing.finally(() => inFlight.delete(writing));
  }

  /** A flush point (New chat, the page leaving, the tab hiding) writes a
   * pending edit now, and tries again a chat whose last write failed: what
   * "This chat isn't saved yet." refers to is not left behind. A write that
   * would store nothing new is skipped in write(). */
  private flushSession(session: Session): void {
    if (session.timer !== null || session.failed) this.saveNow(session);
  }

  private cancelTimer(session: Session): void {
    if (session.timer === null) return;
    clearTimeout(session.timer);
    session.timer = null;
  }

  private async write(session: Session): Promise<void> {
    const { companyId, store } = this.opts;
    if (!companyId || !session.latest) return;
    if (session.writing) {
      session.again = true;
      return;
    }
    const input = (this.opts.toStored ?? toStoredThread)(session.latest);
    if (input.turns.length === 0) return;
    const json = JSON.stringify(input);
    if (json === session.savedJson) return;

    session.writing = true;
    try {
      if (session.id === null) {
        const created = await store.create(companyId, input);
        session.id = created.id;
        if (session === this.session) this.callbacks?.onCreated(created.id);
      } else {
        await store.update(companyId, session.id, input);
      }
      session.savedJson = json;
      session.failed = false;
    } catch (e) {
      session.failed = true;
      (this.opts.onError ?? ((err) => console.error("Saving the chat failed", err)))(e);
    } finally {
      session.writing = false;
    }
    if (session === this.session) this.callbacks?.onUnsaved(session.failed);
    if (session.again) {
      session.again = false;
      await this.write(session);
    }
  }
}
