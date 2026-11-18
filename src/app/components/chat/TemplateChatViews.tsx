import React, { memo, useCallback, useId, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import type { TemplateSchema } from "@/lib/types";
import type { AssistantTurn, ChatDraft, ChatPhoto } from "@/lib/generate/chat";
import { isRunningTurn } from "@/lib/generate/chatReducer";
import { captionFor, draftName, fillInEntries, previewValues } from "@/lib/generate/draftView";
import { PHOTO_ANSWER, type InterviewStep } from "@/lib/generate/interview";
import { progressLabel, provenanceSentence } from "@/lib/generate/runCopy";
import { defaultVariant, hasVariants } from "@/lib/templates/variants";
import { TemplateThumbnail } from "../TemplateThumbnail";
import {
  Button,
  Chip,
  LookTile,
  Progress,
  ResultCard,
  ResultCardArt,
  ResultCardSkeleton,
  Tag,
} from "../primitives";
import { AssistantMessage, MessageBubble, UserMessage } from "./Messages";

/** The result card's preview height (13:7871): 264, the width following
 * the template's shape. */
const PREVIEW_H = 264;

/** A template chat's thread pieces on the new look (PHASE-4 §9 D1; frames
 * 13:7064 to 13:8148). GenerateChat renders these in template mode only;
 * Generate keeps its own until Phase 5. */

/** The person's answer: a bubble on the right. */
function Answer({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="sp-tchat-user">
      <MessageBubble>{children}</MessageBubble>
      {note && <p className="tu-caption-m sp-tchat-user__note">{note}</p>}
    </div>
  );
}

/** A photo answer (13:7484): the photo itself, 64 square, on the right. A
 * reopened chat has no photo, and says one was attached. */
function PhotoAnswer({ photo, note }: { photo?: string | null; note?: React.ReactNode }) {
  if (!photo) return <Answer note={note}>Photo attached</Answer>;
  return (
    <div className="sp-tchat-user">
      <img src={photo} alt="Attached photo" className="sp-tchat-user__photo" />
      {note && <p className="tu-caption-m sp-tchat-user__note">{note}</p>}
    </div>
  );
}

/** The opening (13:7166): the mark, the intro, the template at 112 wide. */
function Intro({ intro, template }: { intro: string; template: TemplateSchema }) {
  return (
    <AssistantMessage message={intro}>
      <span
        className="sp-tchat-tref"
        style={{ aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }}
        aria-hidden
      >
        <TemplateThumbnail template={template} />
      </span>
    </AssistantMessage>
  );
}

function Exchange({
  step,
  answer,
  photo,
  note,
}: {
  step: InterviewStep;
  answer: string | null;
  photo?: string | null;
  note?: React.ReactNode;
}) {
  return (
    <>
      <AssistantMessage mark={false} message={step.question} />
      {answer === null ? (
        <Answer>Skipped</Answer>
      ) : answer === PHOTO_ANSWER ? (
        <PhotoAnswer photo={photo} note={note} />
      ) : (
        <Answer>{answer}</Answer>
      )}
    </>
  );
}

/** The questions once sent: the opening and every question with its
 * answer, in the order asked. */
export function TemplateInterviewTranscript({
  template,
  intro,
  pairs,
  photo,
  note,
}: {
  template: TemplateSchema;
  intro: string;
  pairs: Array<{ step: InterviewStep; answer: string | null }>;
  photo?: string | null;
  note?: React.ReactNode;
}) {
  return (
    <>
      <Intro intro={intro} template={template} />
      {pairs.map(({ step, answer }) => (
        <Exchange key={step.fieldKey} step={step} answer={answer} photo={photo} note={note} />
      ))}
    </>
  );
}

/** The questions before the first build (13:7064): the opening, the answers
 * so far, and the question being asked with its quick answers as Chips (a
 * select's options, Skip on an optional step, Back). With every step
 * answered it offers "Build it", which the page normally does by itself. */
export function TemplateInterviewLive({
  template,
  intro,
  answered,
  step,
  photo,
  error,
  canBack,
  busy,
  onAnswer,
  onSkip,
  onBack,
  onBuild,
}: {
  template: TemplateSchema;
  intro: string;
  answered: Array<{ step: InterviewStep; answer: string | null }>;
  step: InterviewStep | null;
  photo?: string | null;
  error: string | null;
  canBack: boolean;
  busy: boolean;
  onAnswer(value: string): void;
  onSkip(): void;
  onBack(): void;
  onBuild(): void;
}) {
  const options = step?.type === "select" ? (step.options ?? []) : [];
  const quick = !busy && (options.length > 0 || step?.optional || canBack || !step);
  const question = step
    ? `${step.question}${
        step.maxLength !== undefined && step.type !== "select"
          ? ` Up to ${step.maxLength} characters.`
          : ""
      }`
    : busy
      ? undefined
      : "That's everything. Ready when you are.";
  return (
    <>
      <Intro intro={intro} template={template} />
      {answered.map(({ step: s, answer }) => (
        <Exchange key={s.fieldKey} step={s} answer={answer} photo={photo} />
      ))}
      <div className="sp-tchat-ask" aria-live="polite">
        {question && <AssistantMessage mark={false} message={question} />}
        {error && (
          <p className="tu-caption-m sp-tchat-ask__error" role="alert">
            {error}
          </p>
        )}
        {quick && (
          <div className="sp-tchat-chips" role="group" aria-label="Answers">
            {options.map((o) => (
              <Chip key={o} onClick={() => onAnswer(o)}>
                {o}
              </Chip>
            ))}
            {step?.optional && <Chip onClick={onSkip}>Skip</Chip>}
            {!step && <Chip onClick={onBuild}>Build it</Chip>}
            {canBack && <Chip onClick={onBack}>Back</Chip>}
          </div>
        )}
      </div>
    </>
  );
}

/** A message the person typed after the build (a follow-up): its photo,
 * then the bubble. */
export function TemplateUserTurn(props: {
  text: string;
  photo?: string | null;
  note?: React.ReactNode;
}) {
  return <UserMessage {...props} />;
}

/** What a template turn needs from the page. */
export interface TemplateTurnHandlers {
  template: TemplateSchema;
  registerPreview(draftId: string, el: HTMLButtonElement | null): void;
  onEditDraft(turnId: string, draftId: string): void;
  onDownloadDraft(turnId: string, draftId: string): void;
  onFillIn(turnId: string, draftId: string, fieldKey: string): void;
  onChangeLook(turnId: string, draftId: string, variantId: string): void;
  onRetry(turnId: string): void;
}

/** The Look picker card (13:7899): the draft in each look as Look tiles on
 * a sunken well, then "Look" and the chosen look's name. A radio group;
 * the arrows move the choice. Switching is instant and never calls the
 * model. */
function LookCard({
  draft,
  values,
  onPick,
}: {
  draft: ChatDraft;
  values: Record<string, string>;
  onPick(variantId: string): void;
}) {
  const schema = draft.schema!;
  const titleId = useId();
  const looks = schema.variants ?? [];
  const selected = draft.variantId ?? defaultVariant(schema)?.id;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = looks.findIndex((v) => v.id === selected);
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || i < 0) return;
    e.preventDefault();
    const next = looks[(i + step + looks.length) % looks.length];
    onPick(next.id);
    refs.current.get(next.id)?.focus();
  };
  const name = looks.find((v) => v.id === selected)?.name ?? "";
  return (
    <div className="sp-tchat-looks">
      <div
        className="sp-tchat-looks__well"
        role="radiogroup"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        {looks.map((v) => {
          const on = v.id === selected;
          return (
            <LookTile
              key={v.id}
              ref={(el) => {
                if (el) refs.current.set(v.id, el);
                else refs.current.delete(v.id);
              }}
              role="radio"
              aria-checked={on}
              aria-label={v.name}
              tabIndex={on ? 0 : -1}
              selected={on}
              name={v.name}
              onClick={() => onPick(v.id)}
              thumbnail={
                <span
                  className="sp-tchat-looks__thumb"
                  style={{ aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}` }}
                >
                  <TemplateThumbnail
                    template={schema}
                    values={values}
                    variantId={v.id}
                    emptyFields="chat"
                  />
                </span>
              }
            />
          );
        })}
      </div>
      <div className="sp-tchat-looks__meta">
        <span id={titleId} className="tu-label-m">
          Look
        </span>
        <span className="tu-caption-m sp-tchat-looks__name">{name}</span>
      </div>
    </div>
  );
}

/** The Result card and the Looks card while the draft builds: the card's
 * Loading state (one draft, so no switch) and the Looks card's shape.
 * Decoration only; the status sentence carries the progress. */
function BuildingSkeleton({ template }: { template: TemplateSchema }) {
  const looks = template.variants?.length ?? 0;
  return (
    <div className="sp-tchat-results" aria-hidden>
      <ResultCardSkeleton withSizes={false} />
      {looks > 1 && (
        <div className="sp-tchat-looks sp-tchat-skeleton">
          <span className="sp-tchat-skeleton__preview" style={{ height: PREVIEW_H }} />
          <span className="sp-tchat-skeleton__meta">
            <span className="sp-tchat-skeleton__bar" style={{ width: 56 }} />
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * An assistant turn in a template chat (13:7358 Building, 13:7744 Result):
 * the mark and the status sentence, then
 *
 *  - while it builds: Progress (step of 3), and the result, Looks and
 *    caption skeletons;
 *  - once built: the Fill in row (a Missing tag per empty field, which
 *    opens Edit details on it), the Result card (Edit opens Edit details,
 *    Download downloads, or opens Edit details on what is left to fill)
 *    beside the Looks card, then the caption card;
 *  - a failed turn: its warnings and Try again.
 */
export const TemplateTurn = memo(function TemplateTurn({
  turn,
  photo,
  canRetry,
  busyDraftId,
  downloadedCount,
  handlers,
}: {
  turn: AssistantTurn;
  photo: ChatPhoto | null;
  canRetry: boolean;
  busyDraftId: string | null;
  /** Finished downloads of this turn's drafts, for the card's check. */
  downloadedCount?: number;
  handlers: TemplateTurnHandlers;
}) {
  const statusId = useId();
  const running = isRunningTurn(turn);
  // The card arrives (PROMPT.md section 7.6) only for a run this view saw
  // finish: a revisit or a reload shows the art at once.
  const sawRun = useRef(running);
  if (running) sawRun.current = true;
  const arrive = sawRun.current && !running;
  const draft = turn.drafts[0] as ChatDraft | undefined;
  const values = useMemo(() => (draft ? previewValues(draft, photo) : {}), [draft, photo]);
  const entries = useMemo(() => (draft ? fillInEntries(draft, values) : []), [draft, values]);
  const caption = useMemo(
    () => (draft ? captionFor(draft, { templateFallback: false }) : ""),
    [draft],
  );
  const { registerPreview } = handlers;
  const previewRef = useCallback(
    (el: HTMLButtonElement | null) => {
      if (draft) registerPreview(draft.id, el);
    },
    [registerPreview, draft],
  );
  const schema = draft?.schema ?? null;
  const description = turn.meta ? provenanceSentence(turn.meta) : undefined;

  return (
    <AssistantMessage message={turn.status} messageId={statusId} role="status">
      {running && (
        <>
          <Progress value={turn.step / 3} label={progressLabel(turn.step, turn.stepLabel)} />
          {!draft && <BuildingSkeleton template={handlers.template} />}
        </>
      )}

      {draft && entries.length > 0 && (
        <div className="sp-tchat-fillin">
          <span className="tu-body-s sp-tchat-fillin__label">Fill in</span>
          <ul className="sp-tchat-fillin__tags" aria-label="Fill in">
            {entries.map((e) => (
              <li key={e.fieldKey}>
                <Tag
                  kind="outline"
                  icon={Plus}
                  aria-label={`Add ${e.label}${e.optional ? " (optional)" : ""}`}
                  onClick={() => handlers.onFillIn(turn.id, draft.id, e.fieldKey)}
                >
                  {e.optional ? `${e.label} · optional` : e.label}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft && (
        <div className="sp-tchat-results">
          <ResultCard
            meta={`${draft.canvas.width} × ${draft.canvas.height}`}
            art={
              schema ? (
                <ResultCardArt ratio={schema.canvasWidth / schema.canvasHeight}>
                  <TemplateThumbnail
                    template={schema}
                    values={values}
                    variantId={draft.variantId}
                    emptyFields="chat"
                  />
                </ResultCardArt>
              ) : (
                <span className="t-caption-m sp-gen-result__gone">
                  {draftName(draft)} is no longer available.
                </span>
              )
            }
            onEdit={schema ? () => handlers.onEditDraft(turn.id, draft.id) : undefined}
            editLabel={`Edit ${draftName(draft)}`}
            editRef={previewRef}
            downloadedKey={downloadedCount}
            arrive={arrive}
            caption={running ? "" : caption}
            downloadAll={
              schema
                ? {
                    label: "Download",
                    onClick: () => handlers.onDownloadDraft(turn.id, draft.id),
                    busy: busyDraftId === draft.id,
                  }
                : undefined
            }
            description={description}
          />
          {schema && hasVariants(schema) && (
            <LookCard
              draft={draft}
              values={values}
              onPick={(variantId) => handlers.onChangeLook(turn.id, draft.id, variantId)}
            />
          )}
        </div>
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
          <Button
            kind="neutral"
            size="sm"
            disabled={!canRetry}
            onClick={() => handlers.onRetry(turn.id)}
          >
            Try again
          </Button>
        </div>
      )}
    </AssistantMessage>
  );
});
