// The Generate chat's state machine (PROMPT §9.1 to §9.3): one pure reducer
// that owns every transition of a thread, plus the pure decisions a run is
// built from (which mode, which request body, which follow-up context).
// useChatController sequences the side effects and dispatches here;
// components read the thread and never mutate a turn.
//
// A run IS an assistant turn: its id is the run id every run action
// carries. An action whose turn is gone (a reset, or a retry that replaced
// it) or no longer running (done, stopped, error) is ignored and the state
// comes back unchanged, so a late result can never mutate a finished turn.
// "Try again" on the thread's last turn replaces that turn in place with a
// fresh one under a new id, which retires the old id the same way.

import type { FieldValues, GenerateFactKind, GenerateFollowUp, GenerateInput } from "../types";
import type { PlatformId } from "../templates/platforms";
import {
  isAssistantTurn,
  isUserTurn,
  type AssistantTurn,
  type ChatDraft,
  type ChatDetail,
  type ChatDocument,
  type ChatPhoto,
  type ChatThread,
  type ChatTurn,
  type UserTurn,
} from "./chat";
import { isFactKind, MAX_FACT_VALUE } from "./details";
import { fallbackTitle } from "./draftView";
import {
  DONE_FALLBACK,
  GENERATE_FAILED,
  NEW_CHAT_TITLE,
  NOTHING_FIT,
  STEP_CHECKING,
  STOPPED_STATUS,
  askingCopy,
  measuringCopy,
  type ProposalShape,
  type RunMode,
} from "./runCopy";

/** A stored chat holds at most this many turns (PROMPT §9.8). A send adds
 * two, so a thread at the cap takes no more. */
export const MAX_TURNS = 40;
/** The server's brief cap, which the composer's maxLength mirrors. */
export const MAX_BRIEF = 1500;
/** The server's limits on a sent document (template-generate §10.1). */
export const MAX_DOCUMENT_NAME = 120;
export const MAX_DOCUMENT_TEXT = 12_000;
/** The Variations stepper's range and default (PROMPT §7.7, §15 item 4):
 * the server clamps `count` to 1 to 3. */
export const MIN_VARIATIONS = 1;
export const MAX_VARIATIONS = 3;
export const DEFAULT_VARIATIONS = 2;

export type ChatAction =
  /** A message sent: appends the UserTurn and its AssistantTurn (step 1,
   * asking). Ignored while a run is in flight, when the thread is full, or
   * when the text is blank. */
  | {
      type: "sent";
      runId: string;
      userTurnId: string;
      text: string;
      photo?: ChatPhoto | null;
      document?: ChatDocument | null;
      /** A template chat's detail tags. */
      details?: ChatDetail[];
      /** Sent from a template chat's questions. */
      interview?: { skipped: string[] };
      platformHint?: PlatformId;
      variations: number;
      templateIdHint?: string;
      intent: UserTurn["intent"];
      mode: RunMode;
      /** Overrides the asking status (a template chat's "Filling in X."). */
      status?: string;
      at: string;
    }
  /** The model answered: step 2, measuring, one pending slot per proposal. */
  | {
      type: "proposalsArrived";
      runId: string;
      proposals: ProposalShape[];
      meta: NonNullable<AssistantTurn["meta"]>;
      warnings: string[];
      /** Overrides the measuring status (a template chat keeps its own). */
      status?: string;
    }
  /** The model asked one question instead of building (Template chat
   * PROMPT §12.6): the turn finishes, done, with the question as its text
   * and no drafts. */
  | { type: "questionArrived"; runId: string; question: string; at: string }
  /** Step 3: a repair round is in flight, or the last proposal is being
   * resolved. The step never moves back. */
  | { type: "checking"; runId: string }
  /** A draft landed: it takes the next slot, in proposal order. */
  | { type: "draftResolved"; runId: string; draft: ChatDraft }
  /** A proposal was dropped: its slot retires and its warning is kept. */
  | { type: "draftDropped"; runId: string; warning: string }
  /** Every proposal is resolved. `reply` is the server's, when it sent one. */
  | { type: "done"; runId: string; reply?: string; at: string }
  /** The member pressed Stop. */
  | { type: "stopped"; runId: string; at: string }
  /** The request failed; `message` is the server's sentence. */
  | { type: "failed"; runId: string; message: string; at: string }
  /** A name for the chat. Applies only while the title is still the
   * placeholder or the brief-derived fallback, so the first real title
   * sticks. With a runId it is also ignored once that run has finished. */
  | { type: "titleSet"; title: string; runId?: string; at: string }
  /** The member edited drafts (the editor panel, Phase 4). Only member
   * fields of a draft whose template is still available take a value. */
  | {
      type: "valuesEdited";
      turnId: string;
      edits: Array<{ draftId: string; fieldKey: string; value: string }>;
      at: string;
    }
  /** A draft's look changed (Template chat PROMPT §9.5): instant, never a
   * model call. */
  | { type: "lookChanged"; turnId: string; draftId: string; variantId: string; at: string }
  /** The member wrote the caption themselves (Edit details, §12.7). */
  | { type: "captionEdited"; turnId: string; draftId: string; caption: string; at: string }
  /** Discard in Edit details (§12.7): each named draft's values, look,
   * caption and typed keys go back to `drafts`, as they were when the
   * panel opened. Everything else about the draft is untouched. */
  | { type: "draftsRestored"; turnId: string; drafts: ChatDraft[]; at: string }
  /** "Try again" on the thread's last turn: replaces it in place with a
   * fresh step 1 turn whose id is `runId`. Ignored for any other turn or
   * while it runs (the controller re-sends an older turn with "sent"). */
  | {
      type: "retry";
      turnId: string;
      runId: string;
      mode: RunMode;
      status?: string;
      at: string;
    }
  /** The chat was saved for the first time (Phase 5). */
  | { type: "idAssigned"; id: string }
  /** New chat. */
  | { type: "reset"; at?: string };

export function emptyThread(
  now: string = new Date().toISOString(),
  templateId: string | null = null,
): ChatThread {
  return {
    id: null,
    ...(templateId ? { templateId } : {}),
    title: NEW_CHAT_TITLE,
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function chatReducer(state: ChatThread, action: ChatAction): ChatThread {
  switch (action.type) {
    case "sent": {
      const text = action.text.trim();
      if (!text || runningTurn(state) || isThreadFull(state)) return state;
      const user: UserTurn = {
        id: action.userTurnId,
        role: "user",
        text,
        createdAt: action.at,
        variations: clampVariations(action.variations),
        intent: action.intent,
      };
      if (action.photo) {
        // The snapshot this turn's drafts are previewed with, and the one
        // fact about it that may be persisted.
        user.photo = action.photo;
        user.hadPhoto = { aspect: action.photo.aspect };
      }
      if (action.document) {
        user.document = action.document;
        user.hadDocument = { name: action.document.name, kind: action.document.kind };
      }
      if (action.details?.length) user.details = action.details.map((d) => ({ ...d }));
      if (action.interview) user.interview = { skipped: [...action.interview.skipped] };
      // What the message sends, which is what a follow-up reuses: a pinned
      // template is filled exactly and goes without the platform hint
      // (buildGenerateInput), so a pinned message records no hint either.
      if (action.templateIdHint) user.templateIdHint = action.templateIdHint;
      else if (action.platformHint) user.platformHint = action.platformHint;
      const assistant = askingTurn(action.runId, user, action.mode, action.at, action.status);
      return { ...state, turns: [...state.turns, user, assistant], updatedAt: action.at };
    }

    case "proposalsArrived":
      return updateRun(state, action.runId, (turn) => {
        if (turn.phase !== "asking") return turn;
        const copy = measuringCopy(action.meta.mode, action.proposals);
        return {
          ...turn,
          phase: "measuring",
          step: 2,
          stepLabel: copy.stepLabel,
          status: action.status ?? copy.status,
          pendingSlots: action.proposals.length,
          slotCanvases: action.proposals.map((p) => p.canvas),
          meta: action.meta,
          warnings: [...action.warnings],
        };
      });

    case "checking":
      return updateRun(state, action.runId, (turn) =>
        turn.phase !== "measuring" || turn.step === 3
          ? turn
          : { ...turn, step: 3, stepLabel: STEP_CHECKING },
      );

    case "draftResolved":
      return updateRun(state, action.runId, (turn) =>
        turn.phase !== "measuring"
          ? turn
          : {
              ...turn,
              drafts: [...turn.drafts, action.draft],
              pendingSlots: Math.max(0, turn.pendingSlots - 1),
            },
      );

    case "draftDropped":
      return updateRun(state, action.runId, (turn) =>
        turn.phase !== "measuring"
          ? turn
          : {
              ...turn,
              pendingSlots: Math.max(0, turn.pendingSlots - 1),
              warnings: [...turn.warnings, action.warning],
            },
      );

    case "done":
      return finish(state, action.runId, action.at, (turn) => {
        // Every proposal dropped (or none came back): today's copy, and the
        // turn offers Try again.
        if (turn.drafts.length === 0) return errored(turn, NOTHING_FIT);
        // The model writes its reply about the proposals it made, before
        // the browser measures them. When some were dropped the reply can
        // name drafts that are not there ("in both sizes" over one card),
        // so the turn keeps the neutral sentence and the warnings say what
        // went missing.
        const dropped = turn.drafts.length < (turn.slotCanvases?.length ?? 0);
        const reply = (!dropped && action.reply?.trim()) || undefined;
        return {
          ...turn,
          phase: "done",
          step: 3,
          status: reply ?? DONE_FALLBACK,
          pendingSlots: 0,
          ...(reply ? { reply } : {}),
        };
      });

    case "questionArrived": {
      const question = action.question.trim();
      if (!question) return state;
      return finish(state, action.runId, action.at, (turn) => ({
        ...turn,
        phase: "done",
        step: 3,
        status: question,
        question,
        drafts: [],
        pendingSlots: 0,
      }));
    }

    case "stopped":
      return finish(state, action.runId, action.at, (turn) => ({
        ...turn,
        phase: "stopped",
        status: STOPPED_STATUS,
        pendingSlots: 0,
      }));

    case "failed":
      return finish(state, action.runId, action.at, (turn) =>
        errored(turn, action.message.trim() || GENERATE_FAILED),
      );

    case "titleSet": {
      const title = action.title.trim();
      if (!title || title === state.title) return state;
      if (action.runId !== undefined && !findRunning(state, action.runId)) return state;
      if (!titleIsReplaceable(state)) return state;
      return { ...state, title, updatedAt: action.at };
    }

    case "valuesEdited": {
      let changed = false;
      const turns = state.turns.map((turn) => {
        if (!isAssistantTurn(turn) || turn.id !== action.turnId) return turn;
        const drafts = turn.drafts.map((draft) => {
          const edits = action.edits.filter((e) => e.draftId === draft.id);
          const values = applyEdits(draft, edits);
          if (values === draft.values) return draft;
          changed = true;
          // What the member typed is theirs: carried forward, never repaired.
          const typed = edits.map((e) => e.fieldKey).filter((k) => values[k] !== draft.values[k]);
          const memberKeys = mergeKeys(draft.memberKeys, typed);
          return { ...draft, values, ...(memberKeys ? { memberKeys } : {}) };
        });
        return changed ? { ...turn, drafts } : turn;
      });
      return changed ? { ...state, turns, updatedAt: action.at } : state;
    }

    case "lookChanged":
      return updateDraft(state, action.turnId, action.draftId, action.at, (draft) =>
        !draft.schema ||
        draft.variantId === action.variantId ||
        !draft.schema.variants?.some((v) => v.id === action.variantId)
          ? draft
          : { ...draft, variantId: action.variantId },
      );

    case "captionEdited":
      return updateDraft(state, action.turnId, action.draftId, action.at, (draft) =>
        draft.captionOverride === action.caption
          ? draft
          : { ...draft, captionOverride: action.caption },
      );

    case "draftsRestored": {
      let next = state;
      for (const saved of action.drafts) {
        next = updateDraft(next, action.turnId, saved.id, action.at, (draft) =>
          sameEdits(draft, saved)
            ? draft
            : {
                ...draft,
                values: saved.values,
                variantId: saved.variantId,
                captionOverride: saved.captionOverride,
                memberKeys: saved.memberKeys,
              },
        );
      }
      return next;
    }

    case "retry": {
      const last = state.turns[state.turns.length - 1];
      if (!last || !isAssistantTurn(last) || last.id !== action.turnId || isRunningTurn(last)) {
        return state;
      }
      const user = state.turns.find((t): t is UserTurn => isUserTurn(t) && t.id === last.replyTo);
      if (!user) return state;
      return {
        ...state,
        turns: [
          ...state.turns.slice(0, -1),
          askingTurn(action.runId, user, action.mode, action.at, action.status),
        ],
        updatedAt: action.at,
      };
    }

    case "idAssigned":
      return state.id === action.id ? state : { ...state, id: action.id };

    case "reset":
      // A template chat stays one: New chat starts over on its template.
      return emptyThread(action.at, state.templateId ?? null);
  }
}

// ---------------------------------------------------------------------------
// Transition helpers
// ---------------------------------------------------------------------------

function askingTurn(
  id: string,
  user: UserTurn,
  mode: RunMode,
  at: string,
  status?: string,
): AssistantTurn {
  const copy = askingCopy(mode);
  return {
    id,
    role: "assistant",
    createdAt: at,
    replyTo: user.id,
    phase: "asking",
    step: 1,
    stepLabel: copy.stepLabel,
    status: status ?? copy.status,
    // The skeletons shown while the model call is in flight. Pending slots
    // take over once the proposals are known.
    expected: clampVariations(user.variations),
    drafts: [],
    pendingSlots: 0,
    warnings: [],
  };
}

/** An error turn: the sentence is both its status (what the status block
 * shows) and its error (what marks it failed), and nothing is pending. */
function errored(turn: AssistantTurn, message: string): AssistantTurn {
  return { ...turn, phase: "error", status: message, error: message, pendingSlots: 0 };
}

function findRunning(state: ChatThread, runId: string): AssistantTurn | null {
  const turn = state.turns.find((t) => isAssistantTurn(t) && t.id === runId);
  return turn && isAssistantTurn(turn) && isRunningTurn(turn) ? turn : null;
}

/** Applies `fn` to the running turn `runId`. A missing or finished turn, or
 * an `fn` that changes nothing, returns the state itself. */
function updateRun(
  state: ChatThread,
  runId: string,
  fn: (turn: AssistantTurn) => AssistantTurn,
): ChatThread {
  const running = findRunning(state, runId);
  if (!running) return state;
  const next = fn(running);
  if (next === running) return state;
  return { ...state, turns: state.turns.map((t) => (t === running ? next : t)) };
}

/** A terminal transition: the turn finishes, the thread is stamped, and a
 * chat still called "New chat" takes its brief-derived title (PROMPT §9.9),
 * so even a stopped or failed first turn saves under a real name. */
function finish(
  state: ChatThread,
  runId: string,
  at: string,
  fn: (turn: AssistantTurn) => AssistantTurn,
): ChatThread {
  const next = updateRun(state, runId, fn);
  if (next === state) return state;
  const brief = firstBrief(next.turns);
  const title = isPlaceholderTitle(next.title) && brief ? fallbackTitle(brief) : next.title;
  return { ...next, title, updatedAt: at };
}

function isPlaceholderTitle(title: string): boolean {
  return !title.trim() || title === NEW_CHAT_TITLE;
}

/** The server's title replaces only a title nobody chose: the placeholder,
 * or the fallback made from the first brief's opening words. */
function titleIsReplaceable(state: ChatThread): boolean {
  if (isPlaceholderTitle(state.title)) return true;
  const brief = firstBrief(state.turns);
  return brief !== null && state.title === fallbackTitle(brief);
}

/** Applies `fn` to one draft of a finished turn. An unchanged draft, or a
 * turn or draft that is not there, returns the state itself. */
function updateDraft(
  state: ChatThread,
  turnId: string,
  draftId: string,
  at: string,
  fn: (draft: ChatDraft) => ChatDraft,
): ChatThread {
  let changed = false;
  const turns = state.turns.map((turn) => {
    if (!isAssistantTurn(turn) || turn.id !== turnId || isRunningTurn(turn)) return turn;
    const drafts = turn.drafts.map((draft) => {
      if (draft.id !== draftId) return draft;
      const next = fn(draft);
      if (next !== draft) changed = true;
      return next;
    });
    return changed ? { ...turn, drafts } : turn;
  });
  return changed ? { ...state, turns, updatedAt: at } : state;
}

/** Whether two versions of a draft differ in nothing Edit details changes:
 * its values, look, caption and typed keys. */
export function sameEdits(a: ChatDraft, b: ChatDraft): boolean {
  return (
    a.variantId === b.variantId &&
    a.captionOverride === b.captionOverride &&
    JSON.stringify(a.memberKeys ?? []) === JSON.stringify(b.memberKeys ?? []) &&
    sameValues(a.values, b.values)
  );
}

function sameValues(a: FieldValues, b: FieldValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? "") !== (b[k] ?? "")) return false;
  return true;
}

/** `keys` added to `existing`, in first-seen order; undefined when there is
 * nothing in either. */
export function mergeKeys(
  existing: readonly string[] | undefined,
  keys: readonly string[],
): string[] | undefined {
  const out = [...(existing ?? [])];
  for (const k of keys) if (!out.includes(k)) out.push(k);
  return out.length ? out : undefined;
}

/** The member's edits to one draft. A draft whose template is gone cannot be
 * edited, and only the template's member fields take a value: a static
 * element's content is the admin's (the subtraction principle). */
function applyEdits(
  draft: ChatDraft,
  edits: ReadonlyArray<{ fieldKey: string; value: string }>,
): FieldValues {
  if (!draft.schema || edits.length === 0) return draft.values;
  const memberKeys = new Set(
    draft.schema.fields.filter((f) => !f.static && f.type !== "shape").map((f) => f.fieldKey),
  );
  let values = draft.values;
  for (const { fieldKey, value } of edits) {
    if (!memberKeys.has(fieldKey) || values[fieldKey] === value) continue;
    values = { ...values, [fieldKey]: value };
  }
  return values;
}

// ---------------------------------------------------------------------------
// Reading a thread
// ---------------------------------------------------------------------------

export function isRunningTurn(turn: AssistantTurn): boolean {
  return turn.phase === "asking" || turn.phase === "measuring";
}

/** The turn whose run is in flight. There is at most one, and it is last. */
export function runningTurn(thread: ChatThread): AssistantTurn | null {
  for (const t of thread.turns) if (isAssistantTurn(t) && isRunningTurn(t)) return t;
  return null;
}

/** At the stored-turn cap: the composer goes inert (PROMPT §9.8). */
export function isThreadFull(thread: ChatThread): boolean {
  return thread.turns.length + 2 > MAX_TURNS;
}

/** The chat's first brief: the text of its first message. */
export function firstBrief(turns: readonly ChatTurn[]): string | null {
  const first = turns.find(isUserTurn);
  return first ? first.text : null;
}

export function lastUserTurn(turns: readonly ChatTurn[]): UserTurn | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (isUserTurn(t)) return t;
  }
  return null;
}

/** The latest message the member sent from a composer (a brief or a typed
 * follow-up), passing over Try next chips. A chip's count of one and its
 * platform are for that chip's run alone, so this, not the last message,
 * is the send a compact-composer follow-up reuses. */
export function lastComposerTurn(turns: readonly ChatTurn[]): UserTurn | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (isUserTurn(t) && (t.intent === "brief" || t.intent === "followUp")) return t;
  }
  return null;
}

/** The latest turn that finished with drafts: what a follow-up revises. */
export function latestDoneTurn(turns: readonly ChatTurn[]): AssistantTurn | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (isAssistantTurn(t) && t.phase === "done") return t;
  }
  return null;
}

/** Whether a finished turn's drafts were freestyle designs or library
 * fills. */
export function turnMode(turn: AssistantTurn): RunMode {
  if (turn.meta) return turn.meta.mode;
  return turn.drafts.some((d) => d.proposal.design) ? "freestyle" : "library";
}

/** A run crashed out of (a reload mid-run, a thread saved while a turn was
 * in flight) has nothing behind it any more. Settle such a turn as stopped
 * so a restored thread never shows a run that cannot finish, and never
 * blocks the next send. */
export function settleOrphanedRuns(thread: ChatThread): ChatThread {
  if (!runningTurn(thread)) return thread;
  return {
    ...thread,
    turns: thread.turns.map((t) =>
      isAssistantTurn(t) && isRunningTurn(t)
        ? { ...t, phase: "stopped", status: STOPPED_STATUS, pendingSlots: 0 }
        : t,
    ),
  };
}

// ---------------------------------------------------------------------------
// Building a run
// ---------------------------------------------------------------------------

export function clampVariations(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return DEFAULT_VARIATIONS;
  return Math.min(MAX_VARIATIONS, Math.max(MIN_VARIATIONS, Math.round(n)));
}

/** A send's platform and variation count. The compact composer has neither
 * control, so a follow-up reuses the thread's last composer send (`last`,
 * from lastComposerTurn): `undefined` means "not given, reuse", while
 * `null` is an explicit "Any platform". */
export function fillSendGaps(
  input: { platformHint?: PlatformId | null; variations?: number },
  last: UserTurn | null,
): { platformHint?: PlatformId; variations: number } {
  const platformHint =
    input.platformHint === undefined ? last?.platformHint : (input.platformHint ?? undefined);
  return {
    ...(platformHint ? { platformHint } : {}),
    variations: clampVariations(input.variations ?? last?.variations),
  };
}

/** Which kind of run a send makes (PROMPT §4, §9.3, §9.4):
 *  - freestyle when the library is empty (nothing to fill), and for "Try
 *    another layout";
 *  - library when a Start from chip pins a template, and for a chat's first
 *    message;
 *  - otherwise a follow-up follows the latest finished turn: freestyle
 *    drafts are revised as freestyle, library drafts as library. */
export function pickMode(
  prior: readonly ChatTurn[],
  send: { intent: UserTurn["intent"]; templateIdHint?: string },
  libraryEmpty: boolean,
): RunMode {
  if (libraryEmpty || send.intent === "freestyle") return "freestyle";
  if (send.templateIdHint || send.intent === "brief") return "library";
  const done = latestDoneTurn(prior);
  return done && turnMode(done) === "freestyle" ? "freestyle" : "library";
}

/** Everything the member has asked of the chat so far, as one brief: the
 * first brief, then each typed follow-up a finished turn answered, a blank
 * line between each. A freestyle design carries no follow-up context the
 * way library drafts do (their revised values), so this is how "make it
 * warmer" is still in the brief two revisions later. Try next chips are
 * left out: "Make a Facebook version" is an instruction for its own run,
 * not a fact about the post. Null before the first message. */
export function briefSoFar(prior: readonly ChatTurn[]): string | null {
  const first = prior.find(isUserTurn);
  if (!first) return null;
  const parts = [first.text];
  for (const turn of prior) {
    if (!isAssistantTurn(turn) || turn.phase !== "done") continue;
    const asked = prior.find((t) => t.id === turn.replyTo);
    if (asked && asked !== first && isUserTurn(asked) && asked.intent === "followUp") {
      parts.push(asked.text);
    }
  }
  return parts.join("\n\n");
}

/** A freestyle follow-up's brief: the brief so far (briefSoFar), a blank
 * line, then the new message. The server caps a brief at 1,500 characters,
 * so the earlier text gives way (from its end, keeping the first brief's
 * facts longest) before the new message does. */
export function composeBrief(previous: string, next: string): string {
  const room = MAX_BRIEF - next.length - 2;
  if (room <= 0) return next.slice(0, MAX_BRIEF);
  const head = previous.slice(0, room).trimEnd();
  return head ? `${head}\n\n${next}` : next;
}

/** The server's follow-up limits (template-generate, parseFollowUp). */
const FOLLOW_UP_MAX_DRAFTS = 3;
const FOLLOW_UP_MAX_VALUES = 60;
const FOLLOW_UP_MAX_NAME = 120;
const FOLLOW_UP_MAX_KEY = 60;
const FOLLOW_UP_MAX_VALUE = 4000;

/** The follow-up context of a library message (PROMPT §9.3): the chat's
 * first brief and the latest finished turn's library drafts, with the
 * member's current values. Text fields only: never an image field, and
 * never a value that is a data URL, so the photo still never leaves the
 * browser. Undefined for a chat's first message. */
export function followUpFrom(prior: readonly ChatTurn[]): GenerateFollowUp | undefined {
  const previousBrief = firstBrief(prior);
  if (!previousBrief) return undefined;
  const done = latestDoneTurn(prior);
  const drafts = (done?.drafts ?? [])
    // A freestyle design has no template row for the model to revise.
    .filter((d) => !d.proposal.design)
    .slice(0, FOLLOW_UP_MAX_DRAFTS)
    .map((d) => ({
      templateId: d.proposal.templateId,
      templateName: d.proposal.templateName.slice(0, FOLLOW_UP_MAX_NAME),
      values: textValues(d),
    }));
  return { previousBrief: previousBrief.slice(0, MAX_BRIEF), drafts };
}

/** A draft's member text values in form order (select values are text
 * too). Without a schema (a template that has since gone) there is no form
 * order or field type to go by, so every non-data-URL value rides as is. */
function textValues(draft: ChatDraft): Array<{ fieldKey: string; value: string }> {
  const keys = draft.schema
    ? draft.schema.fields
        .filter(
          (f) => !f.static && (f.type === "text" || f.type === "multiline" || f.type === "select"),
        )
        .map((f) => f.fieldKey)
    : Object.keys(draft.values);
  const out: Array<{ fieldKey: string; value: string }> = [];
  for (const fieldKey of keys) {
    const value = draft.values[fieldKey];
    if (typeof value !== "string" || value.startsWith("data:")) continue;
    if (!fieldKey || fieldKey.length > FOLLOW_UP_MAX_KEY) continue;
    out.push({ fieldKey, value: value.slice(0, FOLLOW_UP_MAX_VALUE) });
    if (out.length === FOLLOW_UP_MAX_VALUES) break;
  }
  return out;
}

/** The generate request for a message, built as the page this chat replaces
 * built it (brief, hints, count, mode, and only the photo's flag and
 * aspect), plus the follow-up context (PROMPT §9.2, §9.3):
 *  - a chat's first message sends its text as the brief;
 *  - a library follow-up sends the new text as the brief with `followUp`;
 *  - a freestyle follow-up folds the brief so far (briefSoFar) into
 *    `brief` instead, with no `followUp` (the server revises library
 *    drafts only).
 * `prior` is the thread before this message. */
export function buildGenerateInput(
  prior: readonly ChatTurn[],
  user: UserTurn,
  mode: RunMode,
  /** A template chat (Template chat PROMPT §12.3): its details travel as
   * `details`, and its first message may be answered with one question. */
  templateChat = false,
): GenerateInput {
  const previous = briefSoFar(prior);
  const followUp = user.intent !== "brief" && previous !== null;
  const input: GenerateInput = {
    brief: followUp && mode === "freestyle" ? composeBrief(previous, user.text) : user.text,
    count: clampVariations(user.variations),
    mode,
  };
  // A pinned template is filled exactly; a platform hint would only narrow
  // a choice the pin already made.
  if (user.templateIdHint) input.templateIdHint = user.templateIdHint;
  else if (user.platformHint) input.platformHint = user.platformHint;
  // Only the flag and the shape cross the wire, never the photo.
  if (user.photo) {
    input.hasImage = true;
    input.imageAspect = Math.min(10, Math.max(0.1, user.photo.aspect));
  }
  if (followUp && mode === "library") input.followUp = followUpFrom(prior);
  // Detail tags travel structured, never folded into the text, and are
  // applied verbatim (template-generate §10.1). Only a template chat has
  // them, and they need its pinned template.
  if (templateChat && user.templateIdHint && user.details?.length) {
    input.details = user.details.map((d) => ({ fieldKey: d.fieldKey, value: d.value }));
  }
  // Generate's details (new look, Phase 5) are not tied to a template:
  // they travel as facts, one per kind, for the model to place.
  if (!templateChat && user.details?.length) {
    const byKind = new Map<GenerateFactKind, string>();
    for (const d of user.details) {
      const value = d.value.trim().slice(0, MAX_FACT_VALUE);
      if (isFactKind(d.fieldKey) && value) byKind.set(d.fieldKey, value);
    }
    if (byKind.size > 0) input.facts = [...byKind].map(([kind, value]) => ({ kind, value }));
  }
  // One question, on a first message with nothing structured to build from
  // (§12.6). A follow-up (the answer) can never ask again.
  if (templateChat && user.templateIdHint && !followUp && !user.details?.length && !user.document) {
    input.allowQuestion = true;
  }
  // The document's text goes with its own message only (PROMPT §12.3): a
  // follow-up carries the drafts its facts already landed in.
  if (user.document) {
    input.documents = [
      {
        name: user.document.name.slice(0, MAX_DOCUMENT_NAME) || "Document",
        text: user.document.text.slice(0, MAX_DOCUMENT_TEXT),
      },
    ];
  }
  return input;
}

/** The brief a repair round carries so the rewrite keeps the facts and the
 * voice: the message itself for a chat's first message, the brief so far
 * plus the message for a follow-up (whose text alone, "Make the date
 * Friday", has no facts to keep). */
export function repairBriefFor(prior: readonly ChatTurn[], user: UserTurn): string {
  const previous = briefSoFar(prior);
  return user.intent !== "brief" && previous !== null
    ? composeBrief(previous, user.text)
    : user.text;
}
