import React from "react";
import { Globe } from "lucide-react";
import type { ChatDocumentKind } from "@/lib/types";
import type { DetailTagValue } from "@/lib/generate/details";
import { BrandMark } from "../BrandMark";
import { DetailTag } from "../primitives";
import { FileTile } from "./Attachments";

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
      {children ? <p className="t-body-m ui-bubble__text">{children}</p> : null}
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

/** The person's message in a thread (Generate · Sent 13:2729; the template
 * chat's follow-ups, 13:7484): a right-aligned column, 6 apart, of what it
 * was sent with (the 64 photo and the file tile, without remove), then the
 * Message bubble with its sent detail tags. Each tag reads "{label}:
 * {value}" (only the value is drawn), a link's with the globe. `note` is a
 * quiet line under it (a reopened chat's "photos aren't saved"). With no
 * text and no tags there is no bubble (a photo sent on its own). */
export function UserMessage({
  text,
  photo,
  document,
  tags,
  note,
}: {
  text: string;
  photo?: string | null;
  document?: { name: string; kind: ChatDocumentKind } | null;
  tags?: readonly DetailTagValue[];
  note?: React.ReactNode;
}) {
  const hasTags = Boolean(tags && tags.length > 0);
  return (
    <div className="sp-tchat-user">
      {(photo || document) && (
        <div className="sp-tchat-user__attachments">
          {photo && <img src={photo} alt="Attached photo" className="sp-tchat-user__photo" />}
          {document && <FileTile name={document.name} kind={document.kind} />}
        </div>
      )}
      {(text || hasTags) && (
        <MessageBubble
          tags={
            hasTags && (
              <ul className="ui-bubble__tag-list" aria-label="Details">
                {tags!.map((tag) => (
                  <li key={tag.fieldKey}>
                    <DetailTag state="sent" icon={tag.kind === "link" ? Globe : undefined}>
                      <span className="sr-only">{tag.label}: </span>
                      {tag.value}
                    </DetailTag>
                  </li>
                ))}
              </ul>
            )
          }
        >
          {text}
        </MessageBubble>
      )}
      {note && <p className="t-caption-s sp-tchat-user__note">{note}</p>}
    </div>
  );
}
