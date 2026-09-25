import React from "react";

/** One field in the Generate editor panel (Figma "Generate · Chat", the
 * Field rows of frame 06 around sp-input 288:230): a label row over the
 * control, 6px apart. The label names the control through `htmlFor`; a
 * field the member may leave empty carries "Optional" on the right of the
 * row, in the muted ink. The control is the caller's, normally
 * `FieldInput variant="chat"`. Spacing between fields (12) belongs to the
 * list that stacks them. */
export function EditorField({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-chat-field">
      <div className="sp-chat-field__labelrow">
        <label htmlFor={htmlFor} className="sp-chat-field__label">
          {label}
        </label>
        {optional && <span className="sp-chat-field__optional">Optional</span>}
      </div>
      {children}
    </div>
  );
}
