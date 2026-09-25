import React from "react";

/** The member's side of a Generate chat turn (Figma "Generate · Chat",
 * sp-chat-photo / User 328:847 over sp-chat-bubble / User 328:850): a
 * right-aligned column, 6px apart. The photo the turn was sent with comes
 * first, 160 × 107 and cropped to cover; then the message on the sunken
 * fill, up to 472 wide, keeping the member's own line breaks. `note` is a
 * quiet line under the bubble (the "photos aren't saved" notice on a
 * reopened chat). */
export function UserMessage({
  text,
  photo,
  note,
}: {
  text: string;
  photo?: string | null;
  note?: React.ReactNode;
}) {
  return (
    <div className="sp-chat-user">
      {photo && <img src={photo} alt="Attached photo" className="sp-chat-user__photo" />}
      <p className="sp-chat-user__bubble">{text}</p>
      {note && <p className="sp-chat-user__note">{note}</p>}
    </div>
  );
}
