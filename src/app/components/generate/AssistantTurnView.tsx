import React, { memo, useId, useMemo } from "react";
import type { AssistantTurn, ChatDraft, ChatPhoto } from "@/lib/generate/chat";
import { isRunningTurn } from "@/lib/generate/chatReducer";
import { captionFor, captionTabs, draftName, previewValues } from "@/lib/generate/draftView";
import { progressLabel, provenanceSentence } from "@/lib/generate/runCopy";
import type { TryNextAction } from "@/lib/generate/tryNext";
import { AssistantHeader } from "./AssistantHeader";
import { CaptionCard } from "./CaptionCard";
import { ChatButton } from "./ChatButton";
import { DraftCard } from "./DraftCard";
import { DraftCardSkeleton } from "./DraftCardSkeleton";
import { ChipRow, SuggestionChip } from "./SuggestionChip";

/** A slot's shape while its canvas is unknown (PROMPT §7.15): 4:5 for the
 * first proposal, the 1.91:1 link card for the second and third, as frame
 * 04 draws them. */
const fallbackAspect = (index: number) => (index === 0 ? 4 / 5 : 1.91);

/** The skeletons a running turn shows, as width-over-height ratios. While
 * the model call is in flight there is one per expected draft; once the
 * proposals are in, the unresolved slots are the last `pendingSlots`
 * proposals (drafts land in proposal order and a dropped one retires its
 * slot), each in its proposal's own shape when the client knew it. */
function skeletonAspects(turn: AssistantTurn): number[] {
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

/** The three-step progress row (Figma "Generate · Chat", frame 04,
 * "Progress"): a 120 × 4 sunken track whose inverse fill stands at step ÷ 3
 * and eases between steps over --dur-panel (zeroed under reduced motion),
 * then "2 of 3 · Rendering both sizes" in mono. The bar moves by step,
 * never by time. The progressbar is named by the turn's status sentence and
 * speaks the label as its value, so the drawn label is hidden from
 * assistive tech rather than read twice. */
function RunProgress({
  step,
  stepLabel,
  labelledBy,
}: {
  step: AssistantTurn["step"];
  stepLabel: string;
  labelledBy: string;
}) {
  const label = progressLabel(step, stepLabel);
  return (
    <div className="sp-chat-progress">
      <div
        className="sp-chat-progress__track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-valuetext={label}
        aria-labelledby={labelledBy}
      >
        <span className="sp-chat-progress__fill" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      <span className="sp-chat-progress__label" aria-hidden>
        {label}
      </span>
    </div>
  );
}

/** One draft in the thread: its values with the turn's photo laid into
 * its target slot (never written back into the draft), held stable so a
 * re-render that changes nothing about the draft does not repaint it. */
function ThreadDraft({
  draft,
  photo,
  maxWidth,
  description,
  onEdit,
  onDownload,
}: {
  draft: ChatDraft;
  photo: ChatPhoto | null;
  maxWidth: number | undefined;
  description: string | undefined;
  onEdit(): void;
  onDownload(): void;
}) {
  const values = useMemo(() => previewValues(draft, photo), [draft, photo]);
  return (
    <DraftCard
      name={draftName(draft)}
      canvas={draft.canvas}
      schema={draft.schema}
      values={values}
      size="regular"
      maxWidth={maxWidth}
      onEdit={onEdit}
      onDownload={onDownload}
      description={description}
    />
  );
}

/**
 * An assistant turn in the Generate chat (Figma "Generate · Chat", frames
 * 04 and 05, "Message · SocialPaint"; PROMPT §8.4, §9.2): a column, 16
 * apart, of
 *
 *  1. the byline;
 *  2. the status sentence and, while the run is in flight, the progress
 *     row; once the turn is done the row goes and the sentence is the
 *     server's reply;
 *  3. the drafts, 12 apart and wrapping: skeletons while the run is in
 *     flight, each replaced in place by its card as it lands (no
 *     transition), and removed when its proposal is dropped;
 *  4. the warnings a run left, one per line, once it has finished;
 *  5. the caption card, Loading while the run is in flight;
 *  6. on a failed turn, Try again (it re-sends the same message);
 *  7. on the thread's latest turn, once it is done and while nothing else
 *     is running, the Try next row (§9.4), whose actions the page derives
 *     (it knows the whole thread, and which platforms it has asked for).
 *
 * The page owns what outlives a render (which caption tab each turn
 * shows, whether Try next and Try again are open to the member) and hands
 * in stable callbacks, and props that only change for a turn that shows
 * them, so the turn is memoized: typing in the composer, or a run starting
 * and ending, never repaints the drafts of the turns above. The model's
 * provenance is the drafts' accessible description only; it is not drawn
 * (§9.2 item 4).
 */
export const AssistantTurnView = memo(function AssistantTurnView({
  turn,
  photo,
  tryNext,
  canRetry,
  maxWidth,
  captionDraftId,
  onCaptionSelect,
  onEditDraft,
  onDownloadDraft,
  onTryNext,
  onRetry,
}: {
  turn: AssistantTurn;
  /** The photo the message this turn answers was sent with. */
  photo: ChatPhoto | null;
  /** The Try next row's chips (deriveTryNext): empty except on the
   * thread's last turn, once it is done, while nothing is running and the
   * chat can take another message. The page passes one stable empty list
   * to every other turn. */
  tryNext: readonly TryNextAction[];
  /** Try again can run now: nothing else is running, and the chat can take
   * the message (an older turn's retry is sent again at the end). Only an
   * error turn shows the button, so the page passes false to every other
   * turn. */
  canRetry: boolean;
  /** The chat column's width, which a wide draft's card must fit. */
  maxWidth: number | undefined;
  /** The draft whose caption the member picked; the first draft when unset
   * or gone. */
  captionDraftId: string | undefined;
  onCaptionSelect(turnId: string, draftId: string): void;
  onEditDraft(turnId: string, draftId: string): void;
  onDownloadDraft(turnId: string, draftId: string): void;
  onTryNext(action: TryNextAction): void;
  onRetry(turnId: string): void;
}) {
  const statusId = useId();
  const running = isRunningTurn(turn);
  const skeletons = skeletonAspects(turn);
  const description = turn.meta ? provenanceSentence(turn.meta) : undefined;

  const tabs = useMemo(() => captionTabs(turn.drafts), [turn.drafts]);
  const captionDraft =
    turn.drafts.find((d) => d.id === captionDraftId) ?? (turn.drafts[0] as ChatDraft | undefined);
  const caption = useMemo(() => (captionDraft ? captionFor(captionDraft) : ""), [captionDraft]);

  return (
    <div className="sp-chat-turn">
      <AssistantHeader />
      <div className="sp-chat-turn__status">
        <p id={statusId} className="sp-chat-turn__sentence" role="status">
          {turn.status}
        </p>
        {running && (
          <RunProgress step={turn.step} stepLabel={turn.stepLabel} labelledBy={statusId} />
        )}
      </div>

      {(turn.drafts.length > 0 || skeletons.length > 0) && (
        <div className="sp-chat-turn__drafts">
          {turn.drafts.map((draft) => (
            <ThreadDraft
              key={draft.id}
              draft={draft}
              photo={photo}
              maxWidth={maxWidth}
              description={description}
              onEdit={() => onEditDraft(turn.id, draft.id)}
              onDownload={() => onDownloadDraft(turn.id, draft.id)}
            />
          ))}
          {skeletons.map((aspect, i) => (
            <DraftCardSkeleton
              key={`slot-${turn.drafts.length + i}`}
              aspect={aspect}
              maxWidth={maxWidth}
            />
          ))}
        </div>
      )}

      {!running && turn.warnings.length > 0 && (
        <div className="sp-chat-turn__warnings">
          {turn.warnings.map((warning, i) => (
            <p key={i} className="sp-chat-turn__warning">
              {warning}
            </p>
          ))}
        </div>
      )}

      {running ? (
        <CaptionCard state="loading" />
      ) : (
        captionDraft && (
          <CaptionCard
            state="ready"
            tabs={tabs}
            selectedId={captionDraft.id}
            onSelect={(id) => onCaptionSelect(turn.id, id)}
            caption={caption}
          />
        )
      )}

      {turn.phase === "error" && (
        <div className="sp-chat-turn__retry">
          <ChatButton
            kind="tertiary"
            size="small"
            disabled={!canRetry}
            onClick={() => onRetry(turn.id)}
          >
            Try again
          </ChatButton>
        </div>
      )}

      {tryNext.length > 0 && (
        <ChipRow label="Try next">
          {tryNext.map((action) => (
            <SuggestionChip
              key={action.label}
              label={action.label}
              onClick={() => onTryNext(action)}
            />
          ))}
        </ChipRow>
      )}
    </div>
  );
});
