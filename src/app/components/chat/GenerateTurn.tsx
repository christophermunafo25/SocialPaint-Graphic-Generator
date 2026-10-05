import React, { memo, useCallback, useId, useMemo } from "react";
import type { AssistantTurn, ChatDraft, ChatPhoto } from "@/lib/generate/chat";
import { isRunningTurn } from "@/lib/generate/chatReducer";
import {
  captionFor,
  captionTabs,
  draftName,
  platformLabelFor,
  previewValues,
} from "@/lib/generate/draftView";
import { linkedFillIn, photoTargetsFor } from "@/lib/generate/linkedFields";
import { useBrand } from "@/lib/brand/BrandContext";
import { progressLabel, provenanceSentence } from "@/lib/generate/runCopy";
import type { TryNextAction } from "@/lib/generate/tryNext";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { Button, Chip, Progress, ResultCard, Tag } from "../primitives";
import { CaptionCard, CaptionCardSkeleton } from "./CaptionCard";
import { AssistantMessage } from "./Messages";

export type ResultCardSize = "regular" | "compact";

/** The preview's fixed height per card size (13:3085): 264 in the thread,
 * 184 once the editor narrows the chat (13:3150). */
const PREVIEW_HEIGHT: Record<ResultCardSize, number> = { regular: 264, compact: 184 };

/** What the card adds around its preview across its width: 8 a side. */
const CARD_FRAME = 16;

/** The well's shape when the canvas is unknown (a gone template whose size
 * was never stored): the first slot's 4:5. */
const UNKNOWN_ASPECT = 4 / 5;

/** The preview well for a draft `aspect` (width ÷ height) wide: the size's
 * fixed height, the width from the ratio. A width that would push the card
 * past `maxWidth` (the chat column) pins to the room left and the height
 * follows. A skeleton and the card that replaces it share it, so they agree
 * to the pixel. */
export function previewSize(
  aspect: number,
  size: ResultCardSize,
  maxWidth?: number,
): { width: number; height: number } {
  const height = PREVIEW_HEIGHT[size];
  const width = Math.round(height * aspect);
  if (maxWidth === undefined || width + CARD_FRAME <= maxWidth) return { width, height };
  const pinned = Math.max(0, Math.floor(maxWidth - CARD_FRAME));
  return { width: pinned, height: Math.round(pinned / aspect) };
}

/** A slot's shape while its canvas is unknown: 4:5 for the first
 * proposal, the 1.91:1 link card for the second and third. */
const fallbackAspect = (index: number) => (index === 0 ? 4 / 5 : 1.91);

/** The skeletons a running turn shows, as width-over-height ratios. While
 * the model call is in flight there is one per expected draft; once the
 * proposals are in, the unresolved slots are the last `pendingSlots`
 * proposals (drafts land in proposal order and a dropped one retires its
 * slot), each in its proposal's own shape when the client knew it. */
export function skeletonAspects(turn: AssistantTurn): number[] {
  if (turn.phase === "asking") {
    return Array.from({ length: turn.expected }, (_, i) => fallbackAspect(i));
  }
  if (turn.phase !== "measuring") return [];
  const canvases = turn.slotCanvases ?? [];
  const total = Math.max(canvases.length, turn.pendingSlots);
  return Array.from({ length: turn.pendingSlots }, (_, i) => {
    const index = total - turn.pendingSlots + i;
    const canvas = canvases[index];
    return canvas ? canvas.width / canvas.height : fallbackAspect(index);
  });
}

/** A result card's meta line (PHASE-5 §9 D9): the size alone on a regular
 * card ("1080 × 1350"); the platform on a compact one (CJ, 2026-09-25),
 * the size again when the canvas maps to no platform. */
function metaFor(size: ResultCardSize, canvas: { width: number; height: number }): string {
  const platform = size === "compact" ? platformLabelFor(canvas) : null;
  return platform ?? `${canvas.width} × ${canvas.height}`;
}

/** A draft while it renders (13:2766): the Result card's shape, its well
 * and bars as plain sunken wells (§9 D12). Decoration only. */
export function ResultCardSkeleton({
  aspect,
  size = "regular",
  maxWidth,
}: {
  aspect: number;
  size?: ResultCardSize;
  maxWidth?: number;
}) {
  const well = previewSize(aspect, size, maxWidth);
  return (
    <div
      className="ui-result-card sp-tchat-skeleton sp-gen-result"
      style={{ width: well.width + CARD_FRAME }}
      aria-hidden
    >
      <span className="sp-tchat-skeleton__preview" style={{ height: well.height }} />
      <span className="sp-gen-result__skelmeta">
        <span className="sp-tchat-skeleton__meta">
          <span className="sp-tchat-skeleton__bar" style={{ width: 90 }} />
          <span
            className="sp-tchat-skeleton__bar"
            style={{ width: aspect > 1 ? 150 : 130, maxWidth: "100%", height: 8 }}
          />
        </span>
        <span className="sp-tchat-skeleton__circle" />
      </span>
    </div>
  );
}

/** One draft in the thread on the Result card: its values with the turn's
 * photo laid into its target slot (never written back), held stable so a
 * render that changes nothing about the draft does not repaint it. */
const GenerateDraft = memo(function GenerateDraft({
  draft,
  photo,
  size,
  selected,
  busy,
  maxWidth,
  description,
  registerPreview,
  onEdit,
  onDownload,
}: {
  draft: ChatDraft;
  photo: ChatPhoto | null;
  size: ResultCardSize;
  selected: boolean;
  busy: boolean;
  maxWidth: number | undefined;
  description: string | undefined;
  registerPreview(draftId: string, el: HTMLButtonElement | null): void;
  onEdit(draftId: string): void;
  onDownload(draftId: string): void;
}) {
  const values = useMemo(() => previewValues(draft, photo), [draft, photo]);
  const editRef = useCallback(
    (el: HTMLButtonElement | null) => registerPreview(draft.id, el),
    [registerPreview, draft.id],
  );
  const { schema } = draft;
  const name = draftName(draft);
  const dims =
    draft.canvas ?? (schema ? { width: schema.canvasWidth, height: schema.canvasHeight } : null);
  const well = previewSize(dims ? dims.width / dims.height : UNKNOWN_ASPECT, size, maxWidth);
  return (
    <ResultCard
      className="sp-gen-result"
      title={name}
      meta={dims ? metaFor(size, dims) : null}
      previewStyle={{ width: well.width + CARD_FRAME }}
      preview={
        <span
          className="sp-tchat-preview"
          style={{ width: well.width, height: well.height }}
          data-gone={schema ? undefined : true}
        >
          {schema ? (
            // Contain: the artwork keeps its ratio and pins the axis the
            // well limits; two extra pixels hide the sub-pixel sliver an
            // exact fit leaves along one edge.
            <span
              className="sp-gen-result__art"
              style={{
                aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`,
                ...(schema.canvasWidth / schema.canvasHeight >= well.width / well.height
                  ? { width: "calc(100% + 2px)" }
                  : { height: "calc(100% + 2px)" }),
              }}
            >
              <TemplateThumbnail
                template={schema}
                values={values}
                variantId={draft.variantId}
                emptyFields="chat"
              />
            </span>
          ) : (
            <span className="t-caption-s sp-gen-result__gone">{name} is no longer available.</span>
          )}
        </span>
      }
      onEdit={schema ? () => onEdit(draft.id) : undefined}
      editLabel={`Edit ${name}`}
      editRef={editRef}
      selected={selected}
      description={description}
      onDownload={schema ? () => onDownload(draft.id) : undefined}
      downloadLabel={`Download ${name}`}
      downloadBusy={busy}
    />
  );
});

/**
 * An assistant turn in Generate (13:2757 while it builds, 13:3080 once
 * done) on the Assistant message, mark only: the status sentence, then
 *
 *  - while it builds: Progress (step of 3, named by the sentence), a
 *    skeleton Result card per expected draft at its shape, and the caption
 *    card's skeleton;
 *  - once done: the Fill in row (a Missing tag per linked group left empty
 *    in any draft, which opens the editor on it), the Result cards (each
 *    replacing its skeleton in place as it lands), the warnings, and the
 *    caption card with a switch between the drafts;
 *  - a failed turn: Try again;
 *  - the thread's latest turn, once done and while nothing runs: Try next.
 *
 * Cards are compact while the editor is open, in every turn, and the one it
 * is on is outlined. The page owns what outlives a render (the caption each
 * turn shows, Try next and Try again, the editor's draft, a card download)
 * and hands in stable callbacks, so typing in the composer or another
 * turn's run never repaints these drafts. The model's provenance is the
 * cards' accessible description only.
 */
export const GenerateTurn = memo(function GenerateTurn({
  turn,
  photo,
  tryNext,
  canRetry,
  cardSize,
  selectedDraftId,
  busyDraftId,
  maxWidth,
  captionDraftId,
  onCaptionSelect,
  registerPreview,
  onEditDraft,
  onDownloadDraft,
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
  cardSize: ResultCardSize;
  /** The draft the editor is on, when it is one of this turn's. */
  selectedDraftId: string | null;
  /** The draft a card download is exporting, when it is one of this
   * turn's. */
  busyDraftId: string | null;
  /** The chat column's width, which a wide card must fit. */
  maxWidth: number | undefined;
  /** The draft whose caption the member picked; the first when unset or
   * gone. */
  captionDraftId: string | undefined;
  onCaptionSelect(turnId: string, draftId: string): void;
  registerPreview(draftId: string, el: HTMLButtonElement | null): void;
  onEditDraft(turnId: string, draftId: string): void;
  onDownloadDraft(turnId: string, draftId: string): void;
  onTryNext(action: TryNextAction): void;
  onRetry(turnId: string): void;
  onFillIn(turnId: string, draftId: string, fieldKey: string): void;
}) {
  const { kit } = useBrand();
  const statusId = useId();
  const tryNextId = useId();
  const running = isRunningTurn(turn);
  const skeletons = skeletonAspects(turn);
  const description = turn.meta ? provenanceSentence(turn.meta) : undefined;
  const tabs = useMemo(() => captionTabs(turn.drafts), [turn.drafts]);
  const captionDraft =
    turn.drafts.find((d) => d.id === captionDraftId) ?? (turn.drafts[0] as ChatDraft | undefined);
  const caption = useMemo(
    () => (captionDraft ? captionFor(captionDraft, { templateFallback: true }) : ""),
    [captionDraft],
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
  const onEdit = useCallback(
    (draftId: string) => onEditDraft(turn.id, draftId),
    [onEditDraft, turn.id],
  );
  const onDownload = useCallback(
    (draftId: string) => onDownloadDraft(turn.id, draftId),
    [onDownloadDraft, turn.id],
  );
  const expected = turn.drafts.length + skeletons.length;

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
          <span className="t-caption-m sp-tchat-fillin__label">Fill in</span>
          <ul className="sp-tchat-fillin__tags" aria-label="Fill in">
            {gaps.map((g) => (
              <li key={g.id}>
                <Tag
                  kind="missing"
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

      {expected > 0 && (
        <div className="sp-gen-results">
          {turn.drafts.map((draft) => (
            <GenerateDraft
              key={draft.id}
              draft={draft}
              photo={photo}
              size={cardSize}
              selected={draft.id === selectedDraftId}
              busy={draft.id === busyDraftId}
              maxWidth={maxWidth}
              description={description}
              registerPreview={registerPreview}
              onEdit={onEdit}
              onDownload={onDownload}
            />
          ))}
          {skeletons.map((aspect, i) => (
            <ResultCardSkeleton
              key={`slot-${turn.drafts.length + i}`}
              aspect={aspect}
              size={cardSize}
              maxWidth={maxWidth}
            />
          ))}
        </div>
      )}

      {!running && turn.warnings.length > 0 && (
        <div className="sp-tchat-warnings">
          {turn.warnings.map((w, i) => (
            <p key={i} className="t-caption-s">
              {w}
            </p>
          ))}
        </div>
      )}

      {running ? (
        <CaptionCardSkeleton withSwitch={expected > 1} />
      ) : (
        captionDraft && (
          <CaptionCard
            caption={caption}
            tabs={tabs}
            selectedId={captionDraft.id}
            onSelect={(id) => onCaptionSelect(turn.id, id)}
          />
        )
      )}

      {turn.phase === "error" && (
        <div>
          <Button
            kind="neutralOnPage"
            size="sm"
            disabled={!canRetry}
            onClick={() => onRetry(turn.id)}
          >
            Try again
          </Button>
        </div>
      )}

      {tryNext.length > 0 && (
        <div className="sp-gen-trynext" role="group" aria-labelledby={tryNextId}>
          <span id={tryNextId} className="t-caption-m sp-gen-trynext__label">
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
