import React from "react";
import { PHOTO_ANSWER, type InterviewStep } from "@/lib/generate/interview";
import { SuggestionChip } from "./SuggestionChip";
import { UserMessage } from "./UserMessage";

/** One answered question: the question in the assistant's voice, then the
 * member's answer as their message. A skipped step reads "Skipped", and a
 * photo step shows the photo (or, on a reopened chat, says one was sent). */
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
      <div className="sp-chat-turn sp-chat-ask">
        <p className="sp-chat-turn__sentence">{step.question}</p>
      </div>
      {answer === null ? (
        <UserMessage text="Skipped" />
      ) : answer === PHOTO_ANSWER ? (
        <UserMessage text={photo ? "" : "Photo attached"} photo={photo} note={note} />
      ) : (
        <UserMessage text={answer} />
      )}
    </>
  );
}

/** A template chat's questions once sent: the opening line and every
 * question with its answer, in the order asked. Rendered for the message
 * the questions built, in place of that message's bubble. */
export function InterviewTranscript({
  intro,
  pairs,
  photo,
  note,
}: {
  intro: string;
  pairs: Array<{ step: InterviewStep; answer: string | null }>;
  photo?: string | null;
  note?: React.ReactNode;
}) {
  return (
    <>
      <div className="sp-chat-turn sp-chat-ask">
        <p className="sp-chat-turn__sentence">{intro}</p>
      </div>
      {pairs.map(({ step, answer }) => (
        <Exchange key={step.fieldKey} step={step} answer={answer} photo={photo} note={note} />
      ))}
    </>
  );
}

/** A template chat before its first build: the opening line, the questions
 * answered so far, and the one being asked, with its quick answers under it
 * (a select's options, Skip on an optional step, Back to the previous
 * question). With every step answered it offers "Build it", which the page
 * normally does by itself; the button is there when that send was refused,
 * or for a template with nothing to ask. */
export function InterviewLive({
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
  intro: string;
  answered: Array<{ step: InterviewStep; answer: string | null }>;
  step: InterviewStep | null;
  photo?: string | null;
  error: string | null;
  canBack: boolean;
  /** A build is on its way: no quick answers. */
  busy: boolean;
  onAnswer(value: string): void;
  onSkip(): void;
  onBack(): void;
  onBuild(): void;
}) {
  const options = step?.type === "select" ? (step.options ?? []) : [];
  const quick = !busy && (options.length > 0 || step?.optional || canBack || !step);
  return (
    <>
      <div className="sp-chat-turn sp-chat-ask">
        <p className="sp-chat-turn__sentence">{intro}</p>
      </div>
      {answered.map(({ step: s, answer }) => (
        <Exchange key={s.fieldKey} step={s} answer={answer} photo={photo} />
      ))}
      <div className="sp-chat-turn sp-chat-ask" data-current>
        {step && (
          <p className="sp-chat-turn__sentence" aria-live="polite">
            {step.question}
            {step.maxLength !== undefined && step.type !== "select" && (
              <span className="sp-chat-ask__limit"> Up to {step.maxLength} characters.</span>
            )}
          </p>
        )}
        {!step && !busy && (
          <p className="sp-chat-turn__sentence">That's everything. Ready when you are.</p>
        )}
        {error && (
          <p className="sp-chat-ask__error" role="alert">
            {error}
          </p>
        )}
        {quick && (
          <div className="sp-chat-chiprow sp-chat-ask__chips" role="group" aria-label="Answers">
            {options.map((o) => (
              <SuggestionChip key={o} label={o} onClick={() => onAnswer(o)} />
            ))}
            {step?.optional && <SuggestionChip label="Skip" onClick={onSkip} />}
            {!step && <SuggestionChip label="Build it" onClick={onBuild} />}
            {canBack && <SuggestionChip label="Back" onClick={onBack} />}
          </div>
        )}
      </div>
    </>
  );
}
