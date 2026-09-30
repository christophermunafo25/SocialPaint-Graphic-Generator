// The Generate chat's client model (docs/design/generate-chat/PROMPT.md
// §9.1): a thread of user turns and assistant turns. Every transition goes
// through the pure reducer in chatReducer.ts; components read these shapes
// and never mutate a turn directly.
//
// Two properties are load-bearing:
//  - The member's photo lives on the UserTurn in memory only. It is never
//    sent anywhere (only hasImage and imageAspect cross the wire) and never
//    persisted: what a saved chat keeps is `hadPhoto`, the aspect alone.
//  - An attached document is text read in the browser. It lives on the
//    UserTurn in memory, crosses the wire once with that message, and is
//    never persisted: a saved chat keeps `hadDocument`, its name and kind.
//  - A draft carries its canvas size apart from its schema, so a reopened
//    chat whose library template has since gone still knows the card's
//    shape (schema null is the "no longer available" state).

import type { ChatDocumentKind, FieldValues, GeneratedProposal, TemplateSchema } from "../types";
import type { PlatformId } from "../templates/platforms";

/** A photo attached to one message. `dataUrl` is the downscaled image in
 * page memory; `aspect` is its width over height. */
export interface ChatPhoto {
  dataUrl: string;
  aspect: number;
  source: "upload" | "paste" | "brand";
  /** The Brand Studio asset it came from, when source is "brand". */
  assetId?: string;
}

/** One detail tag on a message: a field the member filled in themselves. */
export interface ChatDetail {
  fieldKey: string;
  label: string;
  value: string;
}

/** A document attached to one message: the text the browser extracted
 * from it (capped, see documentText.ts), its file name and its kind. */
export interface ChatDocument {
  name: string;
  kind: ChatDocumentKind;
  text: string;
}

export interface ChatDraft {
  /** Stable per draft, for keys, selection and edits. */
  id: string;
  proposal: GeneratedProposal;
  /** The template it fills (fetched for library drafts, designToSchema for
   * freestyle ones). Null when a reopened library draft's template is no
   * longer published: the card says so and cannot be edited or exported. */
  schema: TemplateSchema | null;
  /** The canvas size, kept apart from the schema (see the file header). */
  canvas: { width: number; height: number };
  /** Measured and repaired values, then the member's edits. */
  values: FieldValues;
  /** The template's look it is shown in (Template chat PROMPT §9.5).
   * Absent is the template's default. Switching looks never calls the
   * model. */
  variantId?: string;
  /** A caption the member wrote in Edit details, shown instead of the
   * model's (§12.7). */
  captionOverride?: string;
  /** The fields the member typed themselves: their detail tags and every
   * field they changed by hand. A follow-up carries these forward when its
   * proposal leaves them empty, and repair never rewrites them (§9.6,
   * §12.8). */
  memberKeys?: string[];
}

export interface UserTurn {
  id: string;
  role: "user";
  text: string;
  createdAt: string;
  /** In memory only, never persisted. */
  photo?: ChatPhoto;
  /** What is persisted instead of the photo. */
  hadPhoto?: { aspect: number };
  /** In memory only, never persisted, sent with this message only. */
  document?: ChatDocument;
  /** What is persisted instead of the document. */
  hadDocument?: { name: string; kind: ChatDocumentKind };
  /** A template chat's detail tags, as the member typed them. Sent as
   * `details` and applied verbatim; safe to persist (§12.3). */
  details?: ChatDetail[];
  platformHint?: PlatformId;
  variations: number;
  templateIdHint?: string;
  intent: "brief" | "followUp" | "platform" | "freestyle";
}

export type AssistantPhase = "asking" | "measuring" | "done" | "stopped" | "error";

export interface AssistantTurn {
  id: string;
  role: "assistant";
  createdAt: string;
  /** The UserTurn this answers. */
  replyTo: string;
  phase: AssistantPhase;
  step: 1 | 2 | 3;
  stepLabel: string;
  /** The sentence shown above the drafts. */
  status: string;
  /** Skeleton count while asking. */
  expected: number;
  drafts: ChatDraft[];
  /** Skeletons still unresolved while measuring. */
  pendingSlots: number;
  /** Each proposal's canvas size, in proposal order, when the client knew
   * it at step 2 (null when it did not). The unresolved slots are the last
   * `pendingSlots` of these, so a measuring skeleton takes the shape of the
   * card that will replace it. Absent while asking. */
  slotCanvases?: Array<{ width: number; height: number } | null>;
  /** The server's reply (PROMPT.md §10), when it sent one. */
  reply?: string;
  /** A template chat's one question (Template chat PROMPT §12.6): the turn
   * finished with it as its text and no drafts. */
  question?: string;
  warnings: string[];
  error?: string;
  meta?: { model: string; candidateCount: number; mode: "library" | "freestyle" };
}

export type ChatTurn = UserTurn | AssistantTurn;

export interface ChatThread {
  /** Null until first persisted. */
  id: string | null;
  /** A template chat's template, scoped for the whole thread (Template chat
   * PROMPT §0). Absent or null for a Generate chat. */
  templateId?: string | null;
  title: string;
  turns: ChatTurn[];
  createdAt: string;
  updatedAt: string;
}

export const isUserTurn = (t: ChatTurn): t is UserTurn => t.role === "user";
export const isAssistantTurn = (t: ChatTurn): t is AssistantTurn => t.role === "assistant";
