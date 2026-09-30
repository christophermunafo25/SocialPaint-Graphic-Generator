import React from "react";
import type { EditorFieldStatus } from "@/lib/generate/editDetails";

export { fieldStatus, type EditorFieldStatus } from "@/lib/generate/editDetails";

const STATUS_WORD: Record<EditorFieldStatus, string> = {
  missing: "Missing",
  tooLong: "Too long",
  edited: "Edited",
};

/** One field in the chat's editor (Figma "Generate · Chat", the Field rows
 * of frame 06 around sp-input 288:230; template-chat frames 04 and 05): a
 * label row over the control, 6px apart. The label names the control
 * through `htmlFor`; after it, 8 apart, an optional status (a 6px dot and a
 * word, 5 apart: Missing and Too long on the danger dot, Edited on the
 * selection blue; the dot is decorative, the word carries the meaning). A
 * field the member may leave empty carries "Optional" on the right, in the
 * muted ink. The control is the caller's, normally `FieldInput
 * variant="chat"`. Spacing between fields (12) belongs to the list. */
export function EditorField({
  label,
  htmlFor,
  optional = false,
  status = null,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  status?: EditorFieldStatus | null;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-chat-field" data-status={status ?? undefined}>
      <div className="sp-chat-field__labelrow">
        <label htmlFor={htmlFor} className="sp-chat-field__label">
          {label}
        </label>
        {status && (
          <span className="sp-chat-field__status" data-status={status}>
            <span className="sp-chat-field__dot" aria-hidden />
            {STATUS_WORD[status]}
          </span>
        )}
        {optional && <span className="sp-chat-field__optional">Optional</span>}
      </div>
      {children}
    </div>
  );
}
