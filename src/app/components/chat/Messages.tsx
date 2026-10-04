import React from "react";
import { BrandMark } from "../BrandMark";

/** Message bubble (Figma 61:505): the person's message, on surface/sunken,
 * up to 472 wide and hugging shorter text, with sent detail tags under it.
 * The thread aligns it right. */
export function MessageBubble({
  children,
  tags,
}: {
  children: React.ReactNode;
  /** Sent detail tags (the Detail tag primitive, state Sent). */
  tags?: React.ReactNode;
}) {
  return (
    <div className="ui-bubble">
      <p className="t-body-m ui-bubble__text">{children}</p>
      {tags && <div className="ui-bubble__tags">{tags}</div>}
    </div>
  );
}

/** Assistant message (Figma 61:532): SocialPaint's reply. The mark signs
 * it, then the message, then its Content slot: results, the caption card,
 * follow-up chips. `mark` is off for a run of questions after the first. */
export function AssistantMessage({
  message,
  messageId,
  mark = true,
  role,
  children,
}: {
  message?: React.ReactNode;
  /** The message's id, for a progress bar it names. */
  messageId?: string;
  mark?: boolean;
  /** "status" where the message is a run's live status sentence. */
  role?: "status";
  children?: React.ReactNode;
}) {
  return (
    <div className="ui-assistant">
      {mark && <BrandMark width={20} />}
      {message !== undefined && (
        <p id={messageId} className="t-body-m ui-assistant__message" role={role}>
          {message}
        </p>
      )}
      {children && <div className="ui-assistant__content">{children}</div>}
    </div>
  );
}
