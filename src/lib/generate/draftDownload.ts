// Downloading a draft straight from its card in the Generate chat
// (docs/design/generate-chat/PROMPT.md §9.6): the rules the hook
// (app/components/generate/useDraftDownload.tsx) runs on, pure so they are
// unit-tested. Four of them:
//
//  - Which drafts count as usage. Only a real published library template
//    records an open and a download (the fill page's semantics, so Insights
//    keeps counting Generate traffic the same way). A freestyle draft is a
//    design with a synthetic id and no template row to attribute an event
//    to, so it records nothing (§2, §9.5).
//  - What the member reads when an export fails. An ExportAssetError names
//    the image that is missing and is written for the member, so it is shown
//    as is; anything else is an internal error and stays behind TemplateFill's
//    generic line (§9.6: "Surface ExportAssetError messages the way
//    TemplateFill does").
//  - Which drafts can be exported at all. The fill page never makes a PNG
//    with a required field unfilled: its Download waits until every one is
//    ("Fill required: …"). A chat draft is the same template with the same
//    values, so the card's Download and the editor's Download PNG keep the
//    same rule (missingFields), applied to the values that would be
//    painted (the turn's photo already in its slot). Exporting past it
//    would bake the renderer's empty-slot box, or a text field's dimmed
//    placeholder copy, into the member's graphic.
//  - The order exports run in. One export at a time: each one mounts a
//    full-size canvas and rasterizes it twice, which is heavy, and two at
//    once would only slow both. A request for another draft waits its turn;
//    a request for a draft that is already exporting or waiting is the same
//    request, not a second one.

import type { FieldValues, TemplateField } from "../types";
import { ExportAssetError } from "../render/exportPng";
import { isRequiredField } from "../templates/fieldRules";
import type { ChatDraft } from "./chat";

/** The failure toast's title, as TemplateFill words it. The hook's `error`
 * is the line under it. */
export const EXPORT_ERROR_TITLE = "Couldn't export the graphic";

/** The line under the title when the failure is not one the member can act
 * on by name (TemplateFill's generic detail, verbatim). */
export const EXPORT_ERROR_GENERIC = "Try again. If it keeps failing, re-upload the photo.";

/** The member-facing line for a failed export: an ExportAssetError's own
 * message (it names the image that did not load), else the generic line. */
export function exportErrorMessage(error: unknown): string {
  return error instanceof ExportAssetError ? error.message : EXPORT_ERROR_GENERIC;
}

/** Whether rendering this draft records usage (SchemaRenderer's
 * `instrument`): only when it fills a real published library template. A
 * freestyle design (`proposal.design`) never does, and neither does a draft
 * whose template is gone or whose schema is not a published one (a
 * freestyle design's schema is a "draft" with a synthetic id). */
export function instrumentsUsage(draft: ChatDraft): boolean {
  return Boolean(draft.schema && !draft.proposal.design && draft.schema.status === "published");
}

/** The required fields `values` leaves unfilled, in the draft's form order,
 * one per fieldKey: TemplateFill's rule (isRequiredField, and a value that
 * is missing or empty), which blocks its Download while any is left. Pass
 * the values that would be painted (draftView.previewValues, so the slot the
 * turn's photo fills counts as filled). Empty for a draft whose template is
 * gone, which has nothing to export anyway. */
export function missingFields(draft: ChatDraft, values: FieldValues): TemplateField[] {
  const seen = new Set<string>();
  return (draft.schema?.fields ?? []).filter((f) => {
    if (!isRequiredField(f) || values[f.fieldKey] || seen.has(f.fieldKey)) return false;
    seen.add(f.fieldKey);
    return true;
  });
}

/** A queued export: a unique id per request (it keys the stage's mount, so
 * each request renders on a fresh canvas) and the draft it exports. */
export interface DownloadJob {
  id: number;
  draftId: string;
}

/** The exports in flight: the one rendering now, then the ones waiting, in
 * the order they were asked for. */
export interface DownloadQueue<J extends DownloadJob> {
  active: J | null;
  waiting: readonly J[];
}

export function emptyQueue<J extends DownloadJob>(): DownloadQueue<J> {
  return { active: null, waiting: [] };
}

/** Whether the draft is exporting or waiting to. */
export function hasDraft<J extends DownloadJob>(queue: DownloadQueue<J>, draftId: string): boolean {
  return queue.active?.draftId === draftId || queue.waiting.some((j) => j.draftId === draftId);
}

/** Queue one export. It starts at once when nothing is exporting, else it
 * waits behind the rest. A draft already in the queue is not queued again:
 * the same queue object comes back, so a state update is a no-op. */
export function enqueue<J extends DownloadJob>(queue: DownloadQueue<J>, job: J): DownloadQueue<J> {
  if (hasDraft(queue, job.draftId)) return queue;
  return queue.active
    ? { active: queue.active, waiting: [...queue.waiting, job] }
    : { active: job, waiting: queue.waiting };
}

/** The export `jobId` finished (downloaded, canceled or failed): the next
 * waiting one starts. Anything but the active job's id changes nothing, so
 * a late or repeated report cannot skip a waiting export. */
export function settle<J extends DownloadJob>(
  queue: DownloadQueue<J>,
  jobId: number,
): DownloadQueue<J> {
  if (queue.active?.id !== jobId) return queue;
  const [next = null, ...rest] = queue.waiting;
  return { active: next, waiting: rest };
}

/** The draft whose export is rendering now, for its card's busy state. */
export function busyDraftId<J extends DownloadJob>(queue: DownloadQueue<J>): string | null {
  return queue.active?.draftId ?? null;
}
