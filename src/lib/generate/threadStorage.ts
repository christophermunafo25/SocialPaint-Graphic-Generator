// Saving and reopening a Generate chat (PROMPT.md §9.8, §9.9, §12): the
// client's thread (chat.ts) as the stored shape GenerateThreadStore writes,
// and a stored chat as a thread again. Pure apart from the template fetch a
// reopen is handed, so every rule below is pinned by threadStorage.test.ts.
//
// What a stored chat never holds:
//  - The member's photo. A message keeps `hadPhoto`, the aspect alone, and
//    no data URL survives anywhere: not an image the member uploaded into
//    a field, not a value the model or an asset put there, not any string
//    at any depth. The store runs assertNoDataUrls before every write, so a
//    data URL that slipped past this module still never reaches a row.
//  - A run in flight. Only finished turns are stored (done, stopped or
//    error), and a message only together with its finished answer, so a
//    stored chat is a run of complete exchanges and never holds a question
//    nobody answered. A failed answer counts: its error turn is stored with
//    the message, and a reopened chat offers Try again. The message a run
//    is still answering is saved, with its answer, once the run finishes.
//  - UI and run state: the step and its label, the skeleton counts, each
//    draft's schema. A library draft refetches its template on reopen and a
//    freestyle draft rebuilds from its design.

import type {
  GenerateThreadInput,
  GenerateThreadPreview,
  GenerateThreadRecord,
  StoredAssistantTurn,
  StoredDraft,
  StoredTurn,
  StoredUserTurn,
  TemplateSchema,
} from "../types";
import type { PlatformId } from "../templates/platforms";
import { clampThreadTitle, platformsInOrder } from "../stores/generateThreads";
import {
  isAssistantTurn,
  isUserTurn,
  type AssistantTurn,
  type ChatDraft,
  type ChatThread,
  type ChatTurn,
  type UserTurn,
} from "./chat";
import { MAX_TURNS, clampVariations, firstBrief } from "./chatReducer";
import { designToSchema } from "./designToSchema";
import { fallbackTitle, primaryPlatformOf } from "./draftView";
import { NEW_CHAT_TITLE } from "./runCopy";
import { isDataUrl } from "./dataUrls";

// ---------------------------------------------------------------------------
// Data URLs
// ---------------------------------------------------------------------------

// The guard itself lives in dataUrls.ts, a leaf the stores import without
// pulling in the chat modules this file imports.
export { isDataUrl, assertNoDataUrls } from "./dataUrls";

/** A fresh copy of `value` with every data URL gone, at any depth: an
 * object property that holds one (or is keyed by one) is deleted, not
 * blanked, and an array element that is one is removed. Undefined
 * properties are dropped as well, as JSON would drop them. */
function scrub<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => !(typeof item === "string" && isDataUrl(item))).map(scrub) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || isDataUrl(key)) continue;
      if (typeof item === "string" && isDataUrl(item)) continue;
      out[key] = scrub(item);
    }
    return out as T;
  }
  return value;
}

/** A string the stored shape requires (a message, a status, a caption),
 * blank if it is a data URL, where scrub would delete it and leave the
 * shape broken. Nothing in the app writes one there; this only keeps the
 * promise that no string survives as one. */
const prose = (text: string): string => (isDataUrl(text) ? "" : text);

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/** The thread as the store saves it (PROMPT §9.8): its finished exchanges,
 * without the photo or any data URL, capped at MAX_TURNS; the distinct
 * platforms its drafts are for; the preview Recent and History draw; and
 * its title. Never touches the thread. */
export function toStoredThread(thread: ChatThread): GenerateThreadInput {
  const turns = keptTurns(thread.turns).map(storedTurn);
  return scrub({
    title: storedTitle(thread),
    platforms: platformsOf(turns),
    preview: previewOf(turns),
    turns,
  });
}

type FinishedTurn = AssistantTurn & { phase: StoredAssistantTurn["phase"] };

const isFinished = (turn: ChatTurn): turn is FinishedTurn =>
  isAssistantTurn(turn) &&
  (turn.phase === "done" || turn.phase === "stopped" || turn.phase === "error");

/** The turns a stored chat keeps (see the file header): the finished
 * answers and the messages they answer, in thread order, cut to the first
 * MAX_TURNS without splitting an exchange. The reducer never lets a thread
 * past the cap; the cut is the store's guarantee all the same. */
function keptTurns(turns: readonly ChatTurn[]): Array<UserTurn | FinishedTurn> {
  return completeExchanges(completeExchanges(turns).slice(0, MAX_TURNS));
}

/** The finished answers whose message is in `turns`, and those messages. */
function completeExchanges(turns: readonly ChatTurn[]): Array<UserTurn | FinishedTurn> {
  const asked = new Set(turns.filter(isUserTurn).map((t) => t.id));
  const answers = turns.filter((t): t is FinishedTurn => isFinished(t) && asked.has(t.replyTo));
  const kept = new Set<ChatTurn>(answers);
  const answered = new Set(answers.map((t) => t.replyTo));
  return turns.filter((t): t is UserTurn | FinishedTurn =>
    isUserTurn(t) ? answered.has(t.id) : kept.has(t),
  );
}

function storedTurn(turn: UserTurn | FinishedTurn): StoredTurn {
  return isUserTurn(turn) ? storedUserTurn(turn) : storedAssistantTurn(turn);
}

function storedUserTurn(turn: UserTurn): StoredUserTurn {
  // The photo stays behind. Its aspect is what says one was attached.
  const aspect = turn.hadPhoto?.aspect ?? turn.photo?.aspect;
  const document = turn.hadDocument ?? turn.document;
  return {
    id: turn.id,
    role: "user",
    text: prose(turn.text),
    createdAt: turn.createdAt,
    ...(aspect !== undefined ? { hadPhoto: { aspect } } : {}),
    // The document's text stays behind too; its name and kind remain.
    ...(document ? { hadDocument: { name: prose(document.name), kind: document.kind } } : {}),
    ...(turn.platformHint ? { platformHint: turn.platformHint } : {}),
    variations: turn.variations,
    ...(turn.templateIdHint ? { templateIdHint: turn.templateIdHint } : {}),
    intent: turn.intent,
  };
}

function storedAssistantTurn(turn: FinishedTurn): StoredAssistantTurn {
  const { meta } = turn;
  return {
    id: turn.id,
    role: "assistant",
    createdAt: turn.createdAt,
    replyTo: turn.replyTo,
    phase: turn.phase,
    status: prose(turn.status),
    ...(turn.reply ? { reply: turn.reply } : {}),
    warnings: turn.warnings,
    ...(turn.error ? { error: turn.error } : {}),
    ...(meta
      ? { meta: { model: prose(meta.model), candidateCount: meta.candidateCount, mode: meta.mode } }
      : {}),
    drafts: turn.drafts.map(storedDraft),
  };
}

/** A draft without its schema: the proposal (a freestyle draft's design
 * included), its canvas, and the member's current values. */
function storedDraft(draft: ChatDraft): StoredDraft {
  const { proposal } = draft;
  return {
    id: draft.id,
    proposal: {
      ...proposal,
      templateId: prose(proposal.templateId),
      templateName: prose(proposal.templateName),
      caption: prose(proposal.caption),
      why: prose(proposal.why),
    },
    canvas: { width: draft.canvas.width, height: draft.canvas.height },
    values: draft.values,
  };
}

/** The chat's title (PROMPT §9.9): its own, which is the server's or the
 * fallback the reducer made from the first brief, else the first brief's
 * opening words (fallbackTitle); empty for a chat with no message. */
function storedTitle(thread: ChatThread): string {
  const own = thread.title.trim();
  const brief = firstBrief(thread.turns);
  const title = own && own !== NEW_CHAT_TITLE ? own : brief ? fallbackTitle(brief) : "";
  // Within the generate_threads title check (migration 0038), counted as
  // Postgres counts characters. The chat's own titles stay well inside it
  // (the server's and the fallback are at most 60).
  return prose(clampThreadTitle(title));
}

/** The distinct primary platforms of every stored draft (a draft whose
 * template has gone still has its canvas), in PLATFORMS order: what the
 * History filter matches and the card meta names. */
function platformsOf(turns: readonly StoredTurn[]): PlatformId[] {
  const present = new Set<PlatformId>();
  for (const turn of turns) {
    if (turn.role !== "assistant") continue;
    for (const draft of turn.drafts) present.add(primaryPlatformOf(draft.canvas));
  }
  return platformsInOrder(present);
}

/** What Recent and History draw: the first draft of the first done turn,
 * by its template (library) or its design (freestyle), with its current
 * values. Null until a turn is done. */
function previewOf(turns: readonly StoredTurn[]): GenerateThreadPreview | null {
  for (const turn of turns) {
    if (turn.role !== "assistant" || turn.phase !== "done") continue;
    const first = turn.drafts[0];
    if (!first) continue;
    const { design, templateId } = first.proposal;
    return {
      ...(design ? { design } : { templateId }),
      values: first.values,
      canvas: first.canvas,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reopening
// ---------------------------------------------------------------------------

export interface ThreadLoaders {
  /** A template by id; null when it is gone. */
  getTemplate(id: string): Promise<TemplateSchema | null>;
  /** The company the chat belongs to, which a rebuilt freestyle design is
   * stamped with (designToSchema). */
  companyId: string;
}

/** A stored chat as a thread again (PROMPT §9.8), ids and all:
 *  - a library draft refetches its template, once per template however
 *    many drafts fill it. One that is gone or no longer published leaves
 *    the draft with no schema and its stored canvas: the card says the
 *    template is no longer available and cannot be edited or downloaded;
 *  - a freestyle draft rebuilds from its design, stamped with its turn's
 *    model and start time (the stored meta has no generatedAt; the turn
 *    began seconds before the server stamped it);
 *  - photos are not restored. A message that had one keeps `hadPhoto`.
 * Every turn comes back finished, so the reducer and the controller take
 * the thread as it is. A template that fails to load (the network, not a
 * missing template) rejects the reopen rather than call a template gone
 * that is not. */
export async function fromStoredThread(
  record: GenerateThreadRecord,
  loaders: ThreadLoaders,
): Promise<ChatThread> {
  const fetched = new Map<string, Promise<TemplateSchema | null>>();
  const template = (id: string): Promise<TemplateSchema | null> => {
    let pending = fetched.get(id);
    if (!pending) {
      pending = loaders
        .getTemplate(id)
        .then((schema) => (schema && schema.status === "published" ? schema : null));
      fetched.set(id, pending);
    }
    return pending;
  };

  const questions = new Map<string, StoredUserTurn>();
  for (const turn of record.turns) if (turn.role === "user") questions.set(turn.id, turn);

  const turns = await Promise.all(
    record.turns.map((turn): Promise<ChatTurn> | ChatTurn =>
      turn.role === "user"
        ? restoredUserTurn(turn)
        : restoredAssistantTurn(turn, questions.get(turn.replyTo), template, loaders.companyId),
    ),
  );
  const brief = firstBrief(turns);
  return {
    id: record.id,
    title: record.title.trim() || (brief ? fallbackTitle(brief) : "") || NEW_CHAT_TITLE,
    turns,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function restoredUserTurn(turn: StoredUserTurn): UserTurn {
  return {
    id: turn.id,
    role: "user",
    text: turn.text,
    createdAt: turn.createdAt,
    ...(turn.hadPhoto ? { hadPhoto: { aspect: turn.hadPhoto.aspect } } : {}),
    ...(turn.hadDocument
      ? { hadDocument: { name: turn.hadDocument.name, kind: turn.hadDocument.kind } }
      : {}),
    ...(turn.platformHint ? { platformHint: turn.platformHint } : {}),
    variations: turn.variations,
    ...(turn.templateIdHint ? { templateIdHint: turn.templateIdHint } : {}),
    intent: turn.intent,
  };
}

async function restoredAssistantTurn(
  turn: StoredAssistantTurn,
  question: StoredUserTurn | undefined,
  template: (id: string) => Promise<TemplateSchema | null>,
  companyId: string,
): Promise<AssistantTurn> {
  const drafts = await Promise.all(
    turn.drafts.map((draft, i) => restoredDraft(draft, i, turn, template, companyId)),
  );
  return {
    id: turn.id,
    role: "assistant",
    createdAt: turn.createdAt,
    replyTo: turn.replyTo,
    phase: turn.phase,
    // A finished turn draws no progress row, so its step is not stored: a
    // reopened turn reads as one that ran to the end.
    step: 3,
    stepLabel: "",
    status: turn.status,
    // As the turn was asked (the reducer's askingTurn).
    expected: clampVariations(question?.variations),
    drafts,
    pendingSlots: 0,
    ...(turn.reply ? { reply: turn.reply } : {}),
    warnings: turn.warnings,
    ...(turn.error ? { error: turn.error } : {}),
    ...(turn.meta ? { meta: turn.meta } : {}),
  };
}

async function restoredDraft(
  draft: StoredDraft,
  index: number,
  turn: StoredAssistantTurn,
  template: (id: string) => Promise<TemplateSchema | null>,
  companyId: string,
): Promise<ChatDraft> {
  const { proposal } = draft;
  // The ordinal is the draft's place in its turn, as a run numbers the
  // designs it resolves (a dropped proposal's gap is not stored).
  const schema = proposal.design
    ? designToSchema(proposal.design, companyId, index + 1, {
        model: turn.meta?.model ?? "",
        generatedAt: turn.createdAt,
      })
    : await template(proposal.templateId);
  return {
    id: draft.id,
    proposal,
    schema,
    // The card takes the shape of what it renders; with no template left to
    // render, the shape it was saved with.
    canvas: schema ? { width: schema.canvasWidth, height: schema.canvasHeight } : draft.canvas,
    values: draft.values,
  };
}
