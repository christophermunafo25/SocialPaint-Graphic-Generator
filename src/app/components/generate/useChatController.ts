import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrandKit, TemplateSchema } from "@/lib/types";
import type { PlatformId } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import { primaryPlatformOf } from "@/lib/generate/draftView";
import {
  isAssistantTurn,
  isUserTurn,
  type ChatPhoto,
  type ChatThread,
  type ChatTurn,
  type UserTurn,
} from "@/lib/generate/chat";
import {
  chatReducer,
  emptyThread,
  fillSendGaps,
  isRunningTurn,
  isThreadFull,
  lastComposerTurn,
  lastUserTurn,
  latestDoneTurn,
  pickMode,
  runningTurn,
  settleOrphanedRuns,
  type ChatAction,
} from "@/lib/generate/chatReducer";
import { runChat, type ChatRunEffects } from "@/lib/generate/chatRun";
import type { RunMode } from "@/lib/generate/runCopy";
import type { TryNextAction } from "@/lib/generate/tryNext";

/** A message from the Start state's composer, the thread's compact
 * composer, or a Start from chip plus text. */
export interface ChatSendInput {
  text: string;
  /** The composer's attachment. Snapshotted on the message; only its flag
   * and aspect cross the wire. */
  photo?: ChatPhoto | null;
  /** `null` is an explicit "Any platform"; left out, a follow-up reuses the
   * thread's last composer send (the compact composer has no platform
   * select; a Try next chip's platform was for its own run). */
  platformHint?: PlatformId | null;
  /** Left out, a follow-up reuses the thread's last composer send; a first
   * message gets the stepper's default. */
  variations?: number;
  /** A pinned Start from chip: fill exactly this published template. */
  templateIdHint?: string;
}

export interface ChatController {
  thread: ChatThread;
  /** A run is in flight. There is only ever one. */
  running: boolean;
  /** The thread holds as many turns as a stored chat may (PROMPT §9.8):
   * sends are refused and the composer should go inert. */
  full: boolean;
  /** Starts a run for a message. Returns false when nothing started (blank
   * text, a run already in flight, the chat full, or no company yet), so
   * the caller can keep the composer's text. */
  send(input: ChatSendInput): boolean;
  /** A Try next chip. Platform and layout actions run the model like a
   * message whose text is the chip's label; fillField is the page's (it
   * opens the editor) and does nothing here. */
  runTryNext(action: TryNextAction): void;
  /** Stops the run in flight: the turn settles as stopped at once, keeping
   * any drafts that already landed, and the requests are aborted. */
  stop(): void;
  /** "Try again" on a finished assistant turn. The thread's last turn is
   * replaced in place by a fresh run of the same message; an older turn's
   * message is sent again as a new message at the end of the thread. */
  retry(assistantTurnId: string): void;
  /** The member's edits to one turn's drafts (the editor panel). */
  editValues(
    turnId: string,
    edits: Array<{ draftId: string; fieldKey: string; value: string }>,
  ): void;
  /** New chat: stops a run in flight, then empties the thread. */
  reset(): void;
  /** The platform and variation count of the thread's last composer send
   * (a brief or a typed follow-up, never a Try next chip), which
   * compact-composer follow-ups reuse. Null before the first message. */
  lastSend: { platformHint?: PlatformId; variations: number } | null;
}

export interface ChatControllerOptions {
  companyId: string | null;
  kit: BrandKit | null;
  /** No published templates: every run is freestyle (PROMPT §8.2). */
  libraryEmpty: boolean;
  /** A saved chat to resume (Phase 5). A turn it holds mid-run settles as
   * stopped, since nothing is running behind it any more. */
  initial?: ChatThread;
  /** The company's published templates, when the page has them. Only their
   * canvas sizes are read, so step 2 can say how many sizes it is rendering
   * before each template is fetched. Without it a library proposal's size
   * counts as one of its own. */
  published?: ReadonlyArray<Pick<TemplateSchema, "id" | "canvasWidth" | "canvasHeight">> | null;
}

/** The fields of a message that decide its run. */
type RunRequest = Omit<UserTurn, "id" | "role" | "createdAt" | "hadPhoto" | "photo"> & {
  photo: ChatPhoto | null;
};

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const now = (): string => new Date().toISOString();

/** What a run calls out to: the stores, the canvas measurer, and a timer
 * that lets React commit what was just dispatched before the loop goes on,
 * so each draft replaces its skeleton as it lands instead of every draft
 * appearing at once. A timer rather than a frame: frames stop in a
 * background tab, and a run must keep going there. */
const RUN_EFFECTS: ChatRunEffects = {
  generate: (companyId, input, signal) => stores.generate.generate(companyId, input, { signal }),
  getTemplate: (templateId) => stores.templates.get(templateId),
  repair: (companyId, input, signal) =>
    stores.generate.repair(companyId, input, { signal }).then((r) => r.values),
  measurer: createCanvasMeasurer,
  newId,
  now,
  yieldToRender: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
};

/** The Generate chat's engine: the thread, and the runs that fill it
 * (PROMPT §9.2, §9.3). Every transition goes through chatReducer, the
 * decisions a run is built from (mode, request body, follow-up context)
 * are the pure functions beside it, and the run itself is runChat
 * (chatRun.ts); this hook holds which run is current and injects the
 * stores.
 *
 * A run is the page this chat replaces, moved: one generate call, then the
 * measurement pass over each proposal in order (designToSchema and
 * measureProposal for a freestyle design; the stored template and one
 * repair round for a library fill), each draft landing in its slot as it
 * resolves and each dropped proposal leaving its warning. The run's id is
 * its assistant turn's id. Stop settles that turn and aborts the requests;
 * the run checks after every await that it is still the current one, and
 * the reducer ignores anything a finished run dispatches late, so a late
 * result never touches a finished turn.
 *
 * The member's photo rides on the message in memory only: the request
 * carries hasImage and imageAspect, never the image. */
export function useChatController(opts: ChatControllerOptions): ChatController {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [thread, setThread] = useState<ChatThread>(() =>
    settleOrphanedRuns(opts.initial ?? emptyThread()),
  );
  // The thread as of the last dispatch, ahead of React's render: a run reads
  // it between awaits, and a second send in the same tick sees the first.
  const threadRef = useRef(thread);
  // The run in flight. Cleared by stop, by reset and on unmount, which is
  // what tells a loop resuming after an await that it is no longer wanted.
  const runRef = useRef<{ id: string; abort: AbortController } | null>(null);

  const apply = useCallback((action: ChatAction) => {
    const next = chatReducer(threadRef.current, action);
    if (next === threadRef.current) return;
    threadRef.current = next;
    setThread(next);
  }, []);

  // Leaving the page (another chat, another route) stops the run in flight.
  // The turn is settled too, for a remount that keeps this state (a hot
  // reload in development).
  useEffect(
    () => () => {
      const run = runRef.current;
      if (!run) return;
      runRef.current = null;
      apply({ type: "stopped", runId: run.id, at: now() });
      run.abort.abort();
    },
    [apply],
  );

  /** One run, start to finish, for the message `user` whose assistant turn
   * is `runId`. `prior` is the thread before that message. The run is
   * current until it finishes, or until stop, reset or unmount clears it. */
  const execute = useCallback(
    async (
      runId: string,
      companyId: string,
      prior: readonly ChatTurn[],
      user: UserTurn,
      mode: RunMode,
    ) => {
      const { kit, published } = optsRef.current;
      const abort = new AbortController();
      runRef.current = { id: runId, abort };
      try {
        await runChat(
          {
            runId,
            companyId,
            prior,
            user,
            mode,
            kit,
            published,
            signal: abort.signal,
            alive: () => runRef.current?.id === runId,
            dispatch: apply,
          },
          RUN_EFFECTS,
        );
      } finally {
        if (runRef.current?.id === runId) runRef.current = null;
      }
    },
    [apply],
  );

  /** Appends a message and its assistant turn and starts the run. */
  const start = useCallback(
    (request: RunRequest): boolean => {
      const current = threadRef.current;
      const { companyId, libraryEmpty } = optsRef.current;
      if (!companyId || runRef.current || runningTurn(current) || isThreadFull(current)) {
        return false;
      }
      const prior = current.turns;
      const mode = pickMode(prior, request, libraryEmpty);
      const runId = newId();
      const userTurnId = newId();
      apply({ type: "sent", runId, userTurnId, ...request, mode, at: now() });
      const user = threadRef.current.turns.find(
        (t): t is UserTurn => isUserTurn(t) && t.id === userTurnId,
      );
      if (!user) return false;
      void execute(runId, companyId, prior, user, mode);
      return true;
    },
    [apply, execute],
  );

  const send = useCallback(
    (input: ChatSendInput): boolean => {
      const text = input.text.trim();
      if (!text) return false;
      const { turns } = threadRef.current;
      return start({
        text,
        photo: input.photo ?? null,
        // A chip's count of one and its platform were for its own run.
        ...fillSendGaps(input, lastComposerTurn(turns)),
        ...(input.templateIdHint ? { templateIdHint: input.templateIdHint } : {}),
        intent: lastUserTurn(turns) ? "followUp" : "brief",
      });
    },
    [start],
  );

  const runTryNext = useCallback(
    (action: TryNextAction) => {
      switch (action.kind) {
        case "fillField":
          // The editor panel's, not the model's.
          return;
        case "platform":
          start({
            text: action.label,
            photo: null,
            platformHint: action.platform,
            variations: 1,
            intent: "platform",
          });
          return;
        case "layout": {
          // A new layout at the size of the latest drafts' first one.
          const first = latestDoneTurn(threadRef.current.turns)?.drafts[0];
          const platformHint = first ? primaryPlatformOf(first.canvas) : undefined;
          start({
            text: action.label,
            photo: null,
            ...(platformHint ? { platformHint } : {}),
            variations: 1,
            intent: "freestyle",
          });
          return;
        }
      }
    },
    [start],
  );

  const stop = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    runRef.current = null;
    apply({ type: "stopped", runId: run.id, at: now() });
    run.abort.abort();
  }, [apply]);

  const retry = useCallback(
    (assistantTurnId: string) => {
      const current = threadRef.current;
      const { companyId, libraryEmpty } = optsRef.current;
      if (!companyId || runRef.current || runningTurn(current)) return;
      const index = current.turns.findIndex((t) => t.id === assistantTurnId);
      const turn = current.turns[index];
      if (!turn || !isAssistantTurn(turn) || isRunningTurn(turn)) return;
      const userIndex = current.turns.findIndex((t) => isUserTurn(t) && t.id === turn.replyTo);
      const user = current.turns[userIndex];
      if (!user || !isUserTurn(user)) return;

      if (index !== current.turns.length - 1) {
        // An older turn: its message goes again, at the end of the thread.
        start({
          text: user.text,
          photo: user.photo ?? null,
          ...(user.platformHint ? { platformHint: user.platformHint } : {}),
          variations: user.variations,
          ...(user.templateIdHint ? { templateIdHint: user.templateIdHint } : {}),
          intent: user.intent,
        });
        return;
      }
      // The last turn runs again in place, against the thread as it stood
      // when its message was sent.
      const prior = current.turns.slice(0, userIndex);
      const mode = pickMode(prior, user, libraryEmpty);
      const runId = newId();
      apply({ type: "retry", turnId: turn.id, runId, mode, at: now() });
      if (threadRef.current === current) return;
      void execute(runId, companyId, prior, user, mode);
    },
    [apply, execute, start],
  );

  const editValues = useCallback(
    (turnId: string, edits: Array<{ draftId: string; fieldKey: string; value: string }>) =>
      apply({ type: "valuesEdited", turnId, edits, at: now() }),
    [apply],
  );

  const reset = useCallback(() => {
    stop();
    apply({ type: "reset", at: now() });
  }, [apply, stop]);

  const lastSend = useMemo(() => {
    const last = lastComposerTurn(thread.turns);
    if (!last) return null;
    return {
      ...(last.platformHint ? { platformHint: last.platformHint } : {}),
      variations: last.variations,
    };
  }, [thread]);

  return {
    thread,
    running: runningTurn(thread) !== null,
    full: isThreadFull(thread),
    send,
    runTryNext,
    stop,
    retry,
    editValues,
    reset,
    lastSend,
  };
}
