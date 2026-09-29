import React from "react";
import type { ChatDocumentKind } from "@/lib/types";
import type { DetailTagValue } from "@/lib/generate/details";
import { FileAttachment } from "./AttachmentThumb";
import { DetailTag } from "./DetailTag";

/** The member's side of a chat turn (Figma sp-chat-photo / User 328:847
 * over sp-chat-bubble / User 328:850; frame 10 "Sent"): a right-aligned
 * column, 6px apart. What the turn was sent with comes first, in one row:
 * the photo (160 × 107, cropped to cover) and the document's record (its
 * name and kind; its text is never kept). Then the message on the sunken
 * fill, up to 472 wide, keeping the member's own line breaks, with its
 * detail tags in the Sent state 10 below the text. `note` is a quiet line
 * under the bubble (the "photos aren't saved" notice on a reopened chat). */
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
  tags?: DetailTagValue[];
  note?: React.ReactNode;
}) {
  return (
    <div className="sp-chat-user">
      {(photo || document) && (
        <div className="sp-chat-user__attachments">
          {photo && <img src={photo} alt="Attached photo" className="sp-chat-user__photo" />}
          {document && <FileAttachment name={document.name} kind={document.kind} />}
        </div>
      )}
      <div className="sp-chat-user__bubble">
        <p className="sp-chat-user__text">{text}</p>
        {tags && tags.length > 0 && (
          <div className="sp-chat-user__tags" role="list" aria-label="Details">
            {tags.map((tag) => (
              <span key={tag.fieldKey} role="listitem">
                <DetailTag tag={tag} />
              </span>
            ))}
          </div>
        )}
      </div>
      {note && <p className="sp-chat-user__note">{note}</p>}
    </div>
  );
}
