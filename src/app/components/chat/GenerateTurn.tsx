import React, { memo, useCallback, useId, useMemo } from "react";
import { Plus } from "lucide-react";
import type { AssistantTurn, ChatDraft, ChatPhoto } from "@/lib/generate/chat";
import { isRunningTurn } from "@/lib/generate/chatReducer";
import { captionFor, draftName, previewValues } from "@/lib/generate/draftView";
import { linkedFillIn, photoTargetsFor, sizeNames, sizeTitle } from "@/lib/generate/linkedFields";
import { useBrand } from "@/lib/brand/BrandContext";
import { progressLabel, provenanceSentence } from "@/lib/generate/runCopy";
import type { TryNextAction } from "@/lib/generate/tryNext";
import { TemplateThumbnail } from "../TemplateThumbnail";
import {
  Button,
  Chip,
  Progress,
  ResultCard,
  ResultCardArt,
  ResultCardSkeleton,
  Tag,
} from "../primitives";
import { AssistantMessage } from "./Messages";

/** The Result card's own Download, for every draft it holds. */
export function downloadAllLabel(count: number): string {
  if (count === 1) return "Download";
  return count === 2 ? "Download both" : "Download all";
}

/** How many drafts a running turn will show: one per expected draft while
 * the model call is in flight, then the ones landed and still coming. */
export function expectedDrafts(turn: AssistantTurn): number {
  if (turn.phase === "asking") return turn.expected;
  if (turn.phase === "measuring") return turn.drafts.length + turn.pendingSlots;
  return turn.drafts.length;
}

/** The shown draft on the card's stage: its values with the turn's photo
 * laid into its target slot (never written back), held stable so a render
 * that changes nothing about the draft does not repaint it. */
const DraftArt = memo(function DraftArt({
  draft,
  photo,
}: {
  draft: ChatDraft;
  photo: ChatPhoto | null;
}) {
  const values = useMemo(() => previewValues(draft, photo), [draft, photo]);
  const { schema } = draft;
  if (!schema) {
    return (
      <span className="t-caption-m sp-gen-result__gone">
        {draftName(draft)} is no longer available.
      </span>
    );
  }
  return (
    <ResultCardArt ratio={schema.canvasWidth / schema.canvasHeight}>
      <TemplateThumbnail
        template={schema}
        values={values}
        variantId={draft.variantId}
        emptyFields="chat"
      />
    </ResultCardArt>
  );
});

/**
 * An assistant turn in Generate (13:2824 while it builds, 13:2985 once
 * done) on the Assistant message, mark only: the status sentence, then
 *
 *  - while it builds: Progress (step of 3, named by the sentence) and the
 *    Result card's Loading state;
 *  - once done: the Fill in row (a Missing tag per linked group left empty
 *    in any draft, which opens the editor on it), the Result card with a
 *    switch between the drafts, and the warnings;
 *  - a failed turn: Try again;
 *  - the thread's latest turn, once done and while nothing runs: Try next.
 *
 * The card shows the draft the editor is on while it is open on this turn,
 * and otherwise the one the member picked (the first when unset or gone).
 * The page owns what outlives a render (the pick, Try next and Try again,
 * the editor's draft, a download) and hands in stable callbacks, so typing
 * in the composer or another turn's run never repaints these drafts. The
 * model's provenance is Edit's accessible description only.
 */
export const GenerateTurn = memo(function GenerateTurn({
  turn,
  photo,
  tryNext,
  canRetry,
  selectedDraftId,
  busyDraftId,
  pickedDraftId,
  onPickDraft,
  registerPreview,
  onEditDraft,
  onDownloadDraft,
  onDownloadAll,
  onTryNext,
  onRetry,
  onFillIn,
}: {
  turn: AssistantTurn;
  /** The photo the message this turn answers was sent with. */
  photo: ChatPhoto | null;
  /** Try next's actions: empty except on the thread's last turn, once it
   * is done, while nothing runs and the chat can take another message. */
  tryNext: readonly TryNextAction[];
  /** Try again can run now. Only an error turn shows the button. */
  canRetry: boolean;
  /** The draft the editor is on, when it is one of this turn's. */
  selectedDraftId: string | null;
  /** The draft a download is exporting, when it is one of this turn's. */
  busyDraftId: string | null;
  /** The draft the member picked on the card's switch. */
  pickedDraftId: string | undefined;
  onPickDraft(turnId: string, draftId: string): void;
  /** Edit, which focus returns to when the editor closes, for each of the
   * turn's drafts. */
  registerPreview(draftId: string, el: HTMLButtonElement | null): void;
  onEditDraft(turnId: string, draftId: string): void;
  onDownloadDraft(turnId: string, draftId: string): void;
  onDownloadAll(turnId: string): void;
  onTryNext(action: TryNextAction): void;
  onRetry(turnId: string): void;
  onFillIn(turnId: string, draftId: string, fieldKey: string): void;
}) {
  const { kit } = useBrand();
  const statusId = useId();
  const tryNextId = useId();
  const running = isRunningTurn(turn);
  const description = turn.meta ? provenanceSentence(turn.meta) : undefined;
  // The switch names each draft as the editor's does: its platform, with
  // the ratio where two share one (linkedFields' sizeNames).
  const tabs = useMemo(() => {
    const names = sizeNames(turn.drafts, { ratio: "onTie" });
    return turn.drafts.map((d, i) => ({ id: d.id, label: names[i], title: sizeTitle(d) }));
  }, [turn.drafts]);
  const shown =
    turn.drafts.find((d) => d.id === (selectedDraftId ?? pickedDraftId)) ??
    (turn.drafts[0] as ChatDraft | undefined);
  const caption = useMemo(
    () => (shown ? captionFor(shown, { templateFallback: true }) : ""),
    [shown],
  );
  const gaps = useMemo(() => {
    if (running || turn.drafts.length === 0) return [];
    const values: Record<string, Record<string, string>> = {};
    for (const d of turn.drafts) values[d.id] = previewValues(d, photo);
    return linkedFillIn(turn.drafts, values, {
      kit,
      photoTargets: photoTargetsFor(turn.drafts, photo),
    });
  }, [running, turn.drafts, photo, kit]);
  // One Edit stands for every draft on the card.
  const draftIds = useMemo(() => turn.drafts.map((d) => d.id).join("\n"), [turn.drafts]);
  const editRef = useCallback(
    (el: HTMLButtonElement | null) => {
      for (const id of draftIds.split("\n")) if (id) registerPreview(id, el);
    },
    [registerPreview, draftIds],
  );
  const exportable = turn.drafts.filter((d) => d.schema).length;
  const name = shown ? draftName(shown) : "";

  return (
    <AssistantMessage message={turn.status} messageId={statusId} role="status">
      {running && (
        <Progress
          value={turn.step / 3}
          label={progressLabel(turn.step, turn.stepLabel)}
          steps={{ now: turn.step, max: 3, labelledBy: statusId }}
        />
      )}

      {gaps.length > 0 && (
        <div className="sp-tchat-fillin">
          <span className="tu-body-s sp-tchat-fillin__label">Fill in</span>
          <ul className="sp-tchat-fillin__tags" aria-label="Fill in">
            {gaps.map((g) => (
              <li key={g.id}>
                <Tag
                  kind="outline"
                  icon={Plus}
                  aria-label={`Add ${g.label}${g.optional ? " (optional)" : ""}`}
                  onClick={() => onFillIn(turn.id, g.draftId, g.fieldKey)}
                >
                  {g.optional ? `${g.label} · optional` : g.label}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      )}

      {running ? (
        <ResultCardSkeleton withSizes={expectedDrafts(turn) > 1} />
      ) : (
        shown && (
          <ResultCard
            sizes={tabs}
            selectedId={shown.id}
            onSelect={(id) => onPickDraft(turn.id, id)}
            sizesLabel="Variations"
            meta={`${shown.canvas.width} × ${shown.canvas.height}`}
            art={<DraftArt draft={shown} photo={photo} />}
            onEdit={shown.schema ? () => onEditDraft(turn.id, shown.id) : undefined}
            editLabel={`Edit ${name}`}
            editRef={editRef}
            selected={selectedDraftId !== null}
            onDownload={
              shown.schema && turn.drafts.length > 1
                ? () => onDownloadDraft(turn.id, shown.id)
                : undefined
            }
            downloadLabel={`Download ${name}`}
            downloadBusy={busyDraftId === shown.id}
            caption={caption}
            downloadAll={
              exportable > 0
                ? {
                    label: downloadAllLabel(turn.drafts.length),
                    onClick: () => onDownloadAll(turn.id),
                    busy: busyDraftId !== null,
                  }
                : undefined
            }
            description={description}
          />
        )
      )}

      {!running && turn.warnings.length > 0 && (
        <div className="sp-tchat-warnings">
          {turn.warnings.map((w, i) => (
            <p key={i} className="tu-caption-m">
              {w}
            </p>
          ))}
        </div>
      )}

      {turn.phase === "error" && (
        <div>
          <Button kind="neutral" size="sm" disabled={!canRetry} onClick={() => onRetry(turn.id)}>
            Try again
          </Button>
        </div>
      )}

      {tryNext.length > 0 && (
        <div className="sp-gen-trynext" role="group" aria-labelledby={tryNextId}>
          <span id={tryNextId} className="tu-caption-m sp-gen-trynext__label">
            Try next
          </span>
          {tryNext.map((action) => (
            <Chip key={action.label} onClick={() => onTryNext(action)}>
              {action.label}
            </Chip>
          ))}
        </div>
      )}
    </AssistantMessage>
  );
});
